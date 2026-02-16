use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine as _;
use lv_types::{
    GeniusCredentials, GeniusCredentialsRequest, ModelOption, ModelsResponse, YtdlpState,
};
use regex::Regex;
use serde_json::{Map, Value};
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use thiserror::Error;

const DPAPI_PREFIX: &str = "dpapi:";
const DEFAULT_MODEL: &str = "gemini-2.0-flash";

#[derive(Debug, Error)]
pub enum SettingsError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("invalid setting: {0}")]
    Invalid(String),
    #[error("secret decode failed")]
    SecretDecode,
    #[error("dpapi error: {0}")]
    Dpapi(String),
}

#[derive(Debug, Clone)]
pub struct SettingsStore {
    pub path: PathBuf,
}

impl Default for SettingsStore {
    fn default() -> Self {
        Self {
            path: settings_path(),
        }
    }
}

impl SettingsStore {
    pub fn from_path(path: impl AsRef<Path>) -> Self {
        Self {
            path: path.as_ref().to_path_buf(),
        }
    }

    pub fn get_gemini_api_key(&self) -> Result<Option<String>, SettingsError> {
        let mut map = self.read_map()?;
        if let Some(stored) = map.get("gemini_api_key").and_then(|v| v.as_str()) {
            let key = deobfuscate(stored).unwrap_or_else(|_| stored.to_string());
            let normalized = normalize_secret(Some(&key));
            if looks_like_gemini_key(normalized.as_deref()) {
                return Ok(normalized);
            }

            map.remove("gemini_api_key");
            self.write_map(&map)?;
        }

        let env_key = normalize_secret(env::var("GEMINI_API_KEY").ok().as_deref());
        Ok(env_key.filter(|v| looks_like_gemini_key(Some(v))))
    }

    pub fn set_gemini_api_key(&self, key: &str) -> Result<(), SettingsError> {
        let normalized = normalize_secret(Some(key))
            .ok_or_else(|| SettingsError::Invalid("API key cannot be empty".to_string()))?;
        let mut map = self.read_map()?;
        map.insert(
            "gemini_api_key".to_string(),
            Value::String(obfuscate(&normalized)?),
        );
        self.write_map(&map)
    }

    pub fn delete_gemini_api_key(&self) -> Result<(), SettingsError> {
        let mut map = self.read_map()?;
        map.remove("gemini_api_key");
        self.write_map(&map)
    }

    pub fn get_openai_api_key(&self) -> Result<Option<String>, SettingsError> {
        let mut map = self.read_map()?;
        if let Some(stored) = map.get("openai_api_key").and_then(|v| v.as_str()) {
            let key = deobfuscate(stored).unwrap_or_else(|_| stored.to_string());
            let normalized = normalize_secret(Some(&key));
            return Ok(normalized);
        }
        Ok(normalize_secret(env::var("OPENAI_API_KEY").ok().as_deref()))
    }

    pub fn set_openai_api_key(&self, key: &str) -> Result<(), SettingsError> {
        let normalized = normalize_secret(Some(key))
            .ok_or_else(|| SettingsError::Invalid("API key cannot be empty".to_string()))?;
        let mut map = self.read_map()?;
        map.insert(
            "openai_api_key".to_string(),
            Value::String(obfuscate(&normalized)?),
        );
        self.write_map(&map)
    }

    pub fn delete_openai_api_key(&self) -> Result<(), SettingsError> {
        let mut map = self.read_map()?;
        map.remove("openai_api_key");
        self.write_map(&map)
    }

    pub fn get_genius_credentials(&self) -> Result<GeniusCredentials, SettingsError> {
        let map = self.read_map()?;
        let get = |key: &str, env_name: &str| -> Option<String> {
            if let Some(v) = map.get(key).and_then(|x| x.as_str()) {
                return deobfuscate(v).ok().or_else(|| normalize_secret(Some(v)));
            }
            normalize_secret(env::var(env_name).ok().as_deref())
        };

        Ok(GeniusCredentials {
            client_id: get("genius_client_id", "GENIUS_CLIENT_ID"),
            client_secret: get("genius_client_secret", "GENIUS_CLIENT_SECRET"),
            access_token: get("genius_access_token", "GENIUS_ACCESS_TOKEN"),
        })
    }

    pub fn set_genius_credentials(
        &self,
        request: &GeniusCredentialsRequest,
    ) -> Result<(), SettingsError> {
        let mut map = self.read_map()?;

        if let Some(client_id) = request.client_id.as_deref() {
            map.insert(
                "genius_client_id".to_string(),
                Value::String(obfuscate(client_id.trim())?),
            );
        }

        if let Some(client_secret) = request.client_secret.as_deref() {
            map.insert(
                "genius_client_secret".to_string(),
                Value::String(obfuscate(client_secret.trim())?),
            );
        }

        if let Some(access_token) = request.access_token.as_deref() {
            let normalized = normalize_secret(Some(access_token));
            if let Some(token) = normalized {
                map.insert(
                    "genius_access_token".to_string(),
                    Value::String(obfuscate(&token)?),
                );
            }
        }

        self.write_map(&map)
    }

    pub fn delete_genius_credentials(&self) -> Result<(), SettingsError> {
        let mut map = self.read_map()?;
        map.remove("genius_client_id");
        map.remove("genius_client_secret");
        map.remove("genius_client_access_token");
        map.remove("genius_access_token");
        map.remove("genius_api_key");
        self.write_map(&map)
    }

    pub fn get_musicbrainz_username(&self) -> Result<Option<String>, SettingsError> {
        let map = self.read_map()?;
        Ok(map.get("musicbrainz_username").and_then(|v| v.as_str()).map(|s| s.to_string()))
    }

    pub fn set_musicbrainz_credentials(&self, username: &str, password: &str) -> Result<(), SettingsError> {
        let mut map = self.read_map()?;
        map.insert("musicbrainz_username".to_string(), Value::String(username.to_string()));
        map.insert("musicbrainz_password".to_string(), Value::String(obfuscate(password)?));
        self.write_map(&map)
    }

    pub fn delete_musicbrainz_credentials(&self) -> Result<(), SettingsError> {
        let mut map = self.read_map()?;
        map.remove("musicbrainz_username");
        map.remove("musicbrainz_password");
        self.write_map(&map)
    }

    pub fn get_strict_lrc_mode(&self) -> Result<bool, SettingsError> {
        let map = self.read_map()?;
        let Some(value) = map.get("strict_lrc") else {
            return Ok(true);
        };
        Ok(value.as_bool().unwrap_or(true))
    }

    pub fn get_allow_explicit(&self) -> Result<bool, SettingsError> {
        let map = self.read_map()?;
        let Some(value) = map.get("allow_explicit") else {
            return Ok(false);
        };
        Ok(value.as_bool().unwrap_or(false))
    }

    pub fn set_lyrics_mode(&self, strict: bool, explicit: bool) -> Result<(), SettingsError> {
        let mut map = self.read_map()?;
        map.insert("strict_lrc".to_string(), Value::Bool(strict));
        map.insert("allow_explicit".to_string(), Value::Bool(explicit));
        self.write_map(&map)
    }

    pub fn get_available_models(&self) -> Vec<ModelOption> {
        available_models()
    }

    pub fn get_model_metadata(&self, model_id: &str) -> Option<ModelOption> {
        self.get_available_models()
            .into_iter()
            .find(|model| model.id == model_id)
    }

    pub fn get_stable_gemini_model(&self) -> String {
        self.get_available_models()
            .into_iter()
            .find(|model| model.lifecycle == "stable")
            .map(|model| model.id)
            .unwrap_or_else(|| DEFAULT_MODEL.to_string())
    }

    pub fn get_gemini_model(&self) -> Result<String, SettingsError> {
        let mut map = self.read_map()?;
        let selected = map
            .get("gemini_model")
            .and_then(|v| v.as_str())
            .unwrap_or(DEFAULT_MODEL)
            .to_string();

        let valid = self
            .get_available_models()
            .iter()
            .any(|model| model.id == selected);
        if valid {
            return Ok(selected);
        }

        map.insert(
            "gemini_model".to_string(),
            Value::String(DEFAULT_MODEL.to_string()),
        );
        self.write_map(&map)?;
        Ok(DEFAULT_MODEL.to_string())
    }

    pub fn set_gemini_model(&self, model_id: &str) -> Result<(), SettingsError> {
        let valid = self
            .get_available_models()
            .iter()
            .any(|model| model.id == model_id);
        if !valid {
            return Err(SettingsError::Invalid(format!("Unknown model: {model_id}")));
        }
        let mut map = self.read_map()?;
        map.insert(
            "gemini_model".to_string(),
            Value::String(model_id.to_string()),
        );
        self.write_map(&map)
    }

    pub fn get_models_response(&self) -> Result<ModelsResponse, SettingsError> {
        Ok(ModelsResponse {
            models: self.get_available_models(),
            selected: self.get_gemini_model()?,
        })
    }

    pub fn get_ytdlp_state(&self) -> Result<YtdlpState, SettingsError> {
        let map = self.read_map()?;
        let state = map
            .get("ytdlp_state")
            .and_then(|v| v.as_object())
            .cloned()
            .unwrap_or_default();
        Ok(YtdlpState {
            last_known_good_version: state
                .get("last_known_good_version")
                .and_then(|v| v.as_str())
                .map(ToString::to_string),
            last_checked_at: state
                .get("last_checked_at")
                .and_then(|v| v.as_str())
                .map(ToString::to_string),
            last_update_status: state
                .get("last_update_status")
                .and_then(|v| v.as_str())
                .map(ToString::to_string),
            last_update_error: state
                .get("last_update_error")
                .and_then(|v| v.as_str())
                .map(ToString::to_string),
            last_smoke_test_ok: state.get("last_smoke_test_ok").and_then(|v| v.as_bool()),
        })
    }

    pub fn set_ytdlp_state(&self, state: &YtdlpState) -> Result<(), SettingsError> {
        let mut map = self.read_map()?;
        let mut node = Map::<String, Value>::new();
        node.insert(
            "last_known_good_version".to_string(),
            to_opt_value(&state.last_known_good_version),
        );
        node.insert(
            "last_checked_at".to_string(),
            to_opt_value(&state.last_checked_at),
        );
        node.insert(
            "last_update_status".to_string(),
            to_opt_value(&state.last_update_status),
        );
        node.insert(
            "last_update_error".to_string(),
            to_opt_value(&state.last_update_error),
        );
        node.insert(
            "last_smoke_test_ok".to_string(),
            state
                .last_smoke_test_ok
                .map(Value::Bool)
                .unwrap_or(Value::Null),
        );
        map.insert("ytdlp_state".to_string(), Value::Object(node));
        self.write_map(&map)
    }

    fn read_map(&self) -> Result<Map<String, Value>, SettingsError> {
        ensure_parent_dir(&self.path)?;
        if !self.path.exists() {
            return Ok(Map::new());
        }

        let raw = fs::read_to_string(&self.path)?;
        let parsed = serde_json::from_str::<Value>(&raw)?;
        Ok(parsed.as_object().cloned().unwrap_or_default())
    }

    fn write_map(&self, map: &Map<String, Value>) -> Result<(), SettingsError> {
        ensure_parent_dir(&self.path)?;
        let raw = serde_json::to_string_pretty(map)?;
        fs::write(&self.path, raw)?;
        Ok(())
    }
}

pub fn settings_dir() -> PathBuf {
    let app_data = env::var("APPDATA")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            env::var("HOME")
                .map(PathBuf::from)
                .unwrap_or_else(|_| PathBuf::from("."))
        });
    app_data.join("LyricVault")
}

pub fn settings_path() -> PathBuf {
    settings_dir().join("settings.json")
}

pub fn mask_secret(value: Option<&str>) -> Option<String> {
    value.and_then(|v| {
        let trimmed = v.trim();
        if trimmed.is_empty() {
            return None;
        }
        if trimmed.len() <= 8 {
            return Some("****".to_string());
        }
        let prefix = &trimmed[..4];
        let suffix = &trimmed[trimmed.len() - 4..];
        let stars = "*".repeat(trimmed.len().saturating_sub(8));
        Some(format!("{prefix}{stars}{suffix}"))
    })
}

fn to_opt_value(value: &Option<String>) -> Value {
    value
        .as_ref()
        .map(|v| Value::String(v.clone()))
        .unwrap_or(Value::Null)
}

fn ensure_parent_dir(path: &Path) -> Result<(), SettingsError> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    Ok(())
}

fn normalize_secret(value: Option<&str>) -> Option<String> {
    let mut key = value?.trim().to_string();
    if key.is_empty() {
        return None;
    }
    if key.len() >= 2
        && ((key.starts_with('"') && key.ends_with('"'))
            || (key.starts_with('\'') && key.ends_with('\'')))
    {
        key = key[1..key.len() - 1].trim().to_string();
    }
    if key.is_empty() {
        None
    } else {
        Some(key)
    }
}

fn looks_like_gemini_key(value: Option<&str>) -> bool {
    let Some(value) = value else {
        return false;
    };
    static GEMINI_REGEX: std::sync::OnceLock<Regex> = std::sync::OnceLock::new();
    let regex = GEMINI_REGEX.get_or_init(|| Regex::new(r"^AIza[A-Za-z0-9_-]{30,}$").unwrap());
    regex.is_match(value)
}

fn obfuscate(value: &str) -> Result<String, SettingsError> {
    let normalized = value.trim();
    if normalized.is_empty() {
        return Err(SettingsError::Invalid(
            "secret value cannot be empty".to_string(),
        ));
    }
    match dpapi_protect(normalized) {
        Ok(encrypted) => Ok(format!("{DPAPI_PREFIX}{encrypted}")),
        Err(_) => Ok(BASE64.encode(normalized.as_bytes())),
    }
}

fn deobfuscate(value: &str) -> Result<String, SettingsError> {
    if let Some(ciphertext) = value.strip_prefix(DPAPI_PREFIX) {
        return dpapi_unprotect(ciphertext);
    }
    let decoded = BASE64
        .decode(value.as_bytes())
        .map_err(|_| SettingsError::SecretDecode)?;
    String::from_utf8(decoded).map_err(|_| SettingsError::SecretDecode)
}

#[cfg(target_os = "windows")]
fn dpapi_protect(plaintext: &str) -> Result<String, SettingsError> {
    use core::ffi::c_void;
    use std::ptr::{null, null_mut};
    use windows_sys::Win32::Foundation::LocalFree;
    use windows_sys::Win32::Security::Cryptography::{CryptProtectData, CRYPT_INTEGER_BLOB};

    let bytes = plaintext.as_bytes();
    let in_blob = CRYPT_INTEGER_BLOB {
        cbData: bytes.len() as u32,
        pbData: bytes.as_ptr() as *mut u8,
    };
    let mut out_blob = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: null_mut(),
    };

    let ok =
        unsafe { CryptProtectData(&in_blob, null(), null(), null(), null(), 0, &mut out_blob) };
    if ok == 0 {
        return Err(SettingsError::Dpapi("CryptProtectData failed".to_string()));
    }

    let encrypted =
        unsafe { std::slice::from_raw_parts(out_blob.pbData, out_blob.cbData as usize) };
    let encoded = BASE64.encode(encrypted);
    unsafe {
        LocalFree(out_blob.pbData as *mut c_void);
    }
    Ok(encoded)
}

#[cfg(not(target_os = "windows"))]
fn dpapi_protect(_plaintext: &str) -> Result<String, SettingsError> {
    Err(SettingsError::Dpapi(
        "DPAPI unavailable on this platform".to_string(),
    ))
}

#[cfg(target_os = "windows")]
fn dpapi_unprotect(ciphertext_b64: &str) -> Result<String, SettingsError> {
    use core::ffi::c_void;
    use std::ptr::{null, null_mut};
    use windows_sys::Win32::Foundation::LocalFree;
    use windows_sys::Win32::Security::Cryptography::{CryptUnprotectData, CRYPT_INTEGER_BLOB};

    let ciphertext = BASE64
        .decode(ciphertext_b64.as_bytes())
        .map_err(|_| SettingsError::SecretDecode)?;

    let in_blob = CRYPT_INTEGER_BLOB {
        cbData: ciphertext.len() as u32,
        pbData: ciphertext.as_ptr() as *mut u8,
    };
    let mut out_blob = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: null_mut(),
    };

    let ok = unsafe {
        CryptUnprotectData(
            &in_blob,
            null_mut(),
            null(),
            null(),
            null(),
            0,
            &mut out_blob,
        )
    };
    if ok == 0 {
        return Err(SettingsError::Dpapi(
            "CryptUnprotectData failed".to_string(),
        ));
    }

    let decrypted =
        unsafe { std::slice::from_raw_parts(out_blob.pbData, out_blob.cbData as usize) };
    let value = String::from_utf8(decrypted.to_vec()).map_err(|_| SettingsError::SecretDecode)?;
    unsafe {
        LocalFree(out_blob.pbData as *mut c_void);
    }
    Ok(value)
}

#[cfg(not(target_os = "windows"))]
fn dpapi_unprotect(_ciphertext_b64: &str) -> Result<String, SettingsError> {
    Err(SettingsError::Dpapi(
        "DPAPI unavailable on this platform".to_string(),
    ))
}

fn available_models() -> Vec<ModelOption> {
    vec![
        ModelOption {
            id: "gemini-3-pro-preview".to_string(),
            name: "Gemini 3.0 Pro".to_string(),
            description: "Highest quality output - best for complex lyrics".to_string(),
            rate_limit: "5 RPM / 200 RPD".to_string(),
            pricing: "$3.50 / 1M tokens".to_string(),
            cost_per_song: "~$0.04 / song".to_string(),
            tier: "quality".to_string(),
            lifecycle: "preview".to_string(),
        },
        ModelOption {
            id: "gemini-3-flash-preview".to_string(),
            name: "Gemini 3.0 Flash".to_string(),
            description: "Next-gen speed and efficiency".to_string(),
            rate_limit: "15 RPM / 1,500 RPD".to_string(),
            pricing: "$0.075 / 1M tokens".to_string(),
            cost_per_song: "< $0.01 / song".to_string(),
            tier: "preview".to_string(),
            lifecycle: "preview".to_string(),
        },
        ModelOption {
            id: "gemini-2.5-flash".to_string(),
            name: "Gemini 2.5 Flash".to_string(),
            description: "Balanced performance and latency".to_string(),
            rate_limit: "15 RPM / 1,500 RPD".to_string(),
            pricing: "$0.075 / 1M tokens".to_string(),
            cost_per_song: "< $0.01 / song".to_string(),
            tier: "fast".to_string(),
            lifecycle: "stable".to_string(),
        },
        ModelOption {
            id: DEFAULT_MODEL.to_string(),
            name: "Gemini 2.0 Flash".to_string(),
            description: "Stable and reliable - current standard".to_string(),
            rate_limit: "15 RPM / 1,500 RPD".to_string(),
            pricing: "$0.075 / 1M tokens".to_string(),
            cost_per_song: "< $0.01 / song".to_string(),
            tier: "recommended".to_string(),
            lifecycle: "stable".to_string(),
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn gemini_key_roundtrip_uses_obfuscated_storage() {
        let dir = tempdir().expect("tempdir");
        let path = dir.path().join("settings.json");
        let store = SettingsStore::from_path(&path);
        let key = "AIzaSyA123456789012345678901234567890";

        store.set_gemini_api_key(key).expect("set key");
        let fetched = store.get_gemini_api_key().expect("get key");
        assert_eq!(fetched.as_deref(), Some(key));

        let raw = fs::read_to_string(path).expect("read settings");
        assert!(
            !raw.contains(key),
            "settings file should not store raw API key"
        );
    }

    #[test]
    fn legacy_plain_text_key_is_still_readable() {
        let dir = tempdir().expect("tempdir");
        let path = dir.path().join("settings.json");
        let key = "AIzaSyB123456789012345678901234567890";
        fs::write(&path, format!(r#"{{"gemini_api_key":"{}"}}"#, key)).expect("write settings");

        let store = SettingsStore::from_path(&path);
        let fetched = store.get_gemini_api_key().expect("get key");
        assert_eq!(fetched.as_deref(), Some(key));
    }
}
