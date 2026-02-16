use lv_core::parse_url_platform;
use lv_settings::SettingsStore;
use lv_types::{SearchArgs, SearchResult, YtdlpStatus};
use once_cell::sync::Lazy;
use serde_json::Value;
use std::env;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::RwLock;
use thiserror::Error;
use url::Url;

#[derive(Debug, Error)]
pub enum MediaError {
    #[error("settings error: {0}")]
    Settings(#[from] lv_settings::SettingsError),
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("search failed: {0}")]
    Search(String),
}

static RESOURCE_DIR: Lazy<RwLock<Option<PathBuf>>> = Lazy::new(|| RwLock::new(None));

pub fn set_resource_dir(path: PathBuf) {
    if let Ok(mut slot) = RESOURCE_DIR.write() {
        *slot = Some(path);
    }
}

pub fn get_ytdlp_status(settings: &SettingsStore) -> Result<YtdlpStatus, MediaError> {
    let state = settings.get_ytdlp_state()?;
    Ok(YtdlpStatus {
        version: ytdlp_version(),
        self_update_allowed: false,
        self_update_supported: false,
        last_known_good_version: state.last_known_good_version,
        last_checked_at: state.last_checked_at,
        last_update_status: state.last_update_status,
        last_update_error: state.last_update_error,
        last_smoke_test_ok: state.last_smoke_test_ok,
    })
}

pub fn search_music(request: &SearchArgs) -> Result<Vec<SearchResult>, MediaError> {
    let query = request.q.trim();
    if query.is_empty() {
        return Ok(Vec::new());
    }

    let platform = request
        .platform
        .as_deref()
        .unwrap_or("youtube")
        .trim()
        .to_lowercase();

    if matches!(
        platform.as_str(),
        "social" | "tiktok" | "instagram" | "facebook"
    ) {
        return bridge_search_music(request);
    }

    if looks_like_url(query) {
        return search_by_url(query, &platform);
    }

    let search_term = match platform.as_str() {
        "youtube" => format!("ytsearch5:{query}"),
        "soundcloud" => format!("scsearch5:{query}"),
        "spotify" | "apple" => format!("ytsearch5:{query}"),
        "social" | "tiktok" | "instagram" | "facebook" => return Ok(Vec::new()),
        _ => format!("ytsearch5:{query}"),
    };

    let result = run_ytdlp_json(&["--dump-single-json", "--skip-download", &search_term])?;
    Ok(extract_entries(result, &platform))
}

fn search_by_url(query: &str, platform_hint: &str) -> Result<Vec<SearchResult>, MediaError> {
    let resolved_platform = parse_url_platform(query)
        .map(ToString::to_string)
        .unwrap_or_else(|| platform_hint.to_string());
    let result = run_ytdlp_json(&["--dump-single-json", "--skip-download", query])?;
    Ok(extract_entries(result, &resolved_platform))
}

fn extract_entries(value: Value, platform: &str) -> Vec<SearchResult> {
    if let Some(entries) = value.get("entries").and_then(|v| v.as_array()) {
        return entries
            .iter()
            .filter_map(|entry| map_entry(entry, platform))
            .collect();
    }

    map_entry(&value, platform).into_iter().collect()
}

fn map_entry(entry: &Value, platform: &str) -> Option<SearchResult> {
    let id = entry.get("id").and_then(|v| v.as_str())?.to_string();
    let title = entry
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("Unknown")
        .to_string();
    let url = entry
        .get("webpage_url")
        .or_else(|| entry.get("url"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    if url.is_empty() {
        return None;
    }

    let duration = entry
        .get("duration")
        .and_then(|v| v.as_f64())
        .map(|v| v.round() as i64);

    Some(SearchResult {
        id,
        title,
        artist: entry
            .get("artist")
            .or_else(|| entry.get("uploader"))
            .and_then(|v| v.as_str())
            .map(ToString::to_string),
        uploader: entry
            .get("uploader")
            .and_then(|v| v.as_str())
            .map(ToString::to_string),
        url,
        duration,
        thumbnail: entry
            .get("thumbnail")
            .and_then(|v| v.as_str())
            .map(ToString::to_string),
        platform: platform.to_string(),
    })
}

fn run_ytdlp_json(args: &[&str]) -> Result<Value, MediaError> {
    let binary = find_ytdlp_binary();
    let output = match binary {
        Some(bin) => Command::new(bin).args(args).output(),
        None => Command::new("yt-dlp").args(args).output(),
    }
    .map_err(|e| MediaError::Search(format!("yt-dlp launch failed: {e}")))?;

    if !output.status.success() {
        return Err(MediaError::Search(
            String::from_utf8_lossy(&output.stderr).trim().to_string(),
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let first_line = stdout
        .lines()
        .find(|line| !line.trim().is_empty())
        .unwrap_or("");
    if first_line.is_empty() {
        return Err(MediaError::Search(
            "yt-dlp returned empty output".to_string(),
        ));
    }
    Ok(serde_json::from_str::<Value>(first_line)?)
}

fn ytdlp_version() -> Option<String> {
    let output = match find_ytdlp_binary() {
        Some(bin) => Command::new(bin).arg("--version").output().ok()?,
        None => Command::new("yt-dlp").arg("--version").output().ok()?,
    };
    if !output.status.success() {
        return None;
    }
    let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if value.is_empty() {
        None
    } else {
        Some(value)
    }
}

fn find_ytdlp_binary() -> Option<PathBuf> {
    if let Ok(explicit) = env::var("LYRICVAULT_YTDLP_PATH") {
        let path = PathBuf::from(explicit);
        if path.exists() {
            return Some(path);
        }
    }

    if let Ok(lock) = RESOURCE_DIR.read() {
        if let Some(resource_dir) = lock.as_ref() {
            let path = resource_dir
                .join("python-embed")
                .join("Scripts")
                .join("yt-dlp.exe");
            if path.exists() {
                return Some(path);
            }
        }
    }

    let cwd_candidate = Path::new("python-embed").join("Scripts").join("yt-dlp.exe");
    if cwd_candidate.exists() {
        return Some(cwd_candidate);
    }

    None
}

fn looks_like_url(value: &str) -> bool {
    Url::parse(value)
        .ok()
        .map(|url| matches!(url.scheme(), "http" | "https"))
        .unwrap_or(false)
}

fn bridge_search_music(request: &SearchArgs) -> Result<Vec<SearchResult>, MediaError> {
    let payload = serde_json::json!({
        "q": request.q,
        "platform": request.platform.as_deref().unwrap_or("youtube"),
        "social_sources": request.social_sources,
    });
    let response = invoke_bridge("search_music", payload)?;
    let data = response
        .get("data")
        .cloned()
        .ok_or_else(|| MediaError::Search("bridge response missing data".to_string()))?;
    Ok(serde_json::from_value::<Vec<SearchResult>>(data)?)
}

fn invoke_bridge(action: &str, payload: Value) -> Result<Value, MediaError> {
    let python = find_python_binary();
    let script = find_bridge_script()
        .ok_or_else(|| MediaError::Search("bridge_cli.py not found".to_string()))?;

    let mut command = Command::new(python);
    command
        .arg(script)
        .arg(action)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = command
        .spawn()
        .map_err(|e| MediaError::Search(format!("bridge launch failed: {e}")))?;

    if let Some(stdin) = child.stdin.as_mut() {
        stdin
            .write_all(payload.to_string().as_bytes())
            .map_err(|e| MediaError::Search(format!("bridge stdin write failed: {e}")))?;
    }

    let output = child
        .wait_with_output()
        .map_err(|e| MediaError::Search(format!("bridge wait failed: {e}")))?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    if stdout.is_empty() {
        return Err(MediaError::Search(format!(
            "bridge produced empty stdout; stderr: {stderr}"
        )));
    }

    let value: Value = serde_json::from_str(&stdout)?;
    if !output.status.success() || value.get("ok").and_then(|v| v.as_bool()) == Some(false) {
        let bridge_error = value
            .get("error")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown bridge error");
        return Err(MediaError::Search(format!(
            "bridge action '{action}' failed: {bridge_error}; stderr: {stderr}"
        )));
    }
    Ok(value)
}

fn find_python_binary() -> PathBuf {
    if let Ok(explicit) = env::var("LYRICVAULT_BRIDGE_PYTHON") {
        let path = PathBuf::from(explicit);
        if path.exists() {
            return path;
        }
    }

    if let Ok(lock) = RESOURCE_DIR.read() {
        if let Some(resource_dir) = lock.as_ref() {
            let embedded = resource_dir.join("python-embed").join("python.exe");
            if embedded.exists() {
                return embedded;
            }
        }
    }

    let cwd_embedded = Path::new("python-embed").join("python.exe");
    if cwd_embedded.exists() {
        return cwd_embedded;
    }

    PathBuf::from("python")
}

fn find_bridge_script() -> Option<PathBuf> {
    if let Ok(explicit) = env::var("LYRICVAULT_BRIDGE_SCRIPT") {
        let path = PathBuf::from(explicit);
        if path.exists() {
            return Some(path);
        }
    }

    if let Ok(lock) = RESOURCE_DIR.read() {
        if let Some(resource_dir) = lock.as_ref() {
            let bundled = resource_dir
                .join("backend")
                .join("tools")
                .join("bridge_cli.py");
            if bundled.exists() {
                return Some(bundled);
            }
        }
    }

    let cwd_script = Path::new("backend").join("tools").join("bridge_cli.py");
    if cwd_script.exists() {
        return Some(cwd_script);
    }

    None
}
