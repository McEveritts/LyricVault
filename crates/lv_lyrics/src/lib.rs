use lv_core::open_connection;
use lv_settings::SettingsStore;
use lv_types::{LyricsResearchArgs, LyricsResearchResponse};
use once_cell::sync::Lazy;
use regex::Regex;
use rusqlite::{params, OptionalExtension};
use serde_json::{json, Value};
use std::env;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::RwLock;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum LyricsError {
    #[error("core error: {0}")]
    Core(#[from] lv_core::CoreError),
    #[error("database error: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("settings error: {0}")]
    Settings(#[from] lv_settings::SettingsError),
    #[error("lyrics engine unavailable: {0}")]
    Unavailable(String),
}

#[derive(Debug)]
struct SongContext {
    id: i64,
    title: String,
    artist: String,
    file_path: Option<String>,
    lyrics: Option<String>,
    lyrics_synced: bool,
}

static RESOURCE_DIR: Lazy<RwLock<Option<PathBuf>>> = Lazy::new(|| RwLock::new(None));

pub fn set_resource_dir(path: PathBuf) {
    if let Ok(mut slot) = RESOURCE_DIR.write() {
        *slot = Some(path);
    }
}

pub fn research_lyrics(
    request: &LyricsResearchArgs,
) -> Result<LyricsResearchResponse, LyricsError> {
    let conn = open_connection()?;
    let mut song = load_song(&conn, request.song_id)?.ok_or_else(|| {
        LyricsError::Unavailable(format!(
            "Song {} not found for lyrics research",
            request.song_id
        ))
    })?;

    let payload = json!({
        "title": song.title,
        "artist": song.artist,
        "file_path": song.file_path,
        "mode": request.mode,
        "model_id": request.model_id,
    });
    let bridge_result = invoke_bridge("research_lyrics", payload)?;
    let data = bridge_result
        .get("data")
        .cloned()
        .ok_or_else(|| LyricsError::Unavailable("Bridge response missing data".to_string()))?;

    let lyrics = data
        .get("lyrics")
        .and_then(|v| v.as_str())
        .map(ToString::to_string)
        .filter(|v| !v.trim().is_empty());
    let source = data
        .get("source")
        .and_then(|v| v.as_str())
        .unwrap_or("auto")
        .to_string();
    let synced = data
        .get("synced")
        .and_then(|v| v.as_bool())
        .unwrap_or_else(|| lyrics.as_deref().map(validate_lrc).unwrap_or(false));
    let failure_reason = data
        .get("failure_reason")
        .and_then(|v| v.as_str())
        .map(ToString::to_string)
        .or(Some("not_found".to_string()));

    let strict_lrc = SettingsStore::default().get_strict_lrc_mode()?;
    let existing_synced =
        song.lyrics_synced && song.lyrics.as_deref().map(validate_lrc).unwrap_or(false);

    if let Some(text) = lyrics.clone() {
        if synced {
            conn.execute(
                r#"
                UPDATE songs
                SET lyrics = ?2, lyrics_synced = 1, lyrics_source = ?3
                WHERE id = ?1
            "#,
                params![song.id, text, source],
            )?;
            return Ok(LyricsResearchResponse {
                status: "success".to_string(),
                synced: Some(true),
                lyrics: lyrics.clone(),
                message: None,
                failure_reason: None,
            });
        }
        if !strict_lrc {
            conn.execute(
                r#"
                UPDATE songs
                SET lyrics = ?2, lyrics_synced = 0, lyrics_source = ?3
                WHERE id = ?1
            "#,
                params![song.id, text, source],
            )?;
            return Ok(LyricsResearchResponse {
                status: "success".to_string(),
                synced: Some(false),
                lyrics: lyrics.clone(),
                message: None,
                failure_reason: None,
            });
        }
    }

    if !existing_synced {
        conn.execute(
            "UPDATE songs SET lyrics = 'Lyrics not found.', lyrics_synced = 0 WHERE id = ?1",
            params![song.id],
        )?;
        song.lyrics = Some("Lyrics not found.".to_string());
        song.lyrics_synced = false;
    }

    Ok(LyricsResearchResponse {
        status: "failed".to_string(),
        synced: Some(false),
        lyrics: None,
        message: Some("AI could not find valid synced lyrics.".to_string()),
        failure_reason,
    })
}

pub fn validate_gemini_key(key: &str) -> bool {
    let trimmed = key.trim();
    trimmed.starts_with("AIza") && trimmed.len() >= 34
}

pub fn validate_genius_token(token: &str) -> bool {
    token.trim().len() >= 5
}

fn load_song(
    conn: &rusqlite::Connection,
    song_id: i64,
) -> Result<Option<SongContext>, LyricsError> {
    let mut stmt = conn.prepare(
        r#"
        SELECT
            s.id,
            COALESCE(s.title, ''),
            COALESCE(a.name, 'Unknown'),
            s.file_path,
            s.lyrics,
            COALESCE(s.lyrics_synced, 0)
        FROM songs s
        LEFT JOIN artists a ON a.id = s.artist_id
        WHERE s.id = ?1
        LIMIT 1
    "#,
    )?;
    let row = stmt
        .query_row(params![song_id], |row| {
            Ok(SongContext {
                id: row.get(0)?,
                title: row.get(1)?,
                artist: row.get(2)?,
                file_path: row.get(3)?,
                lyrics: row.get(4)?,
                lyrics_synced: row.get::<_, Option<i64>>(5)?.unwrap_or(0) != 0,
            })
        })
        .optional()?;
    Ok(row)
}

fn lrc_regex() -> &'static Regex {
    static LRC_PATTERN: std::sync::OnceLock<Regex> = std::sync::OnceLock::new();
    LRC_PATTERN.get_or_init(|| Regex::new(r"(?m)^\\s*\\[\\d{2}:\\d{2}(?:\\.\\d{1,3})?\\]").unwrap())
}

fn validate_lrc(input: &str) -> bool {
    lrc_regex().find_iter(input).count() >= 5
}

fn invoke_bridge(action: &str, payload: Value) -> Result<Value, LyricsError> {
    let python = find_python_binary();
    let script = find_bridge_script()
        .ok_or_else(|| LyricsError::Unavailable("bridge_cli.py not found".to_string()))?;

    let mut command = Command::new(python);
    command
        .arg(script)
        .arg(action)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = command
        .spawn()
        .map_err(|e| LyricsError::Unavailable(format!("bridge launch failed: {e}")))?;

    if let Some(stdin) = child.stdin.as_mut() {
        stdin.write_all(payload.to_string().as_bytes())?;
    }

    let output = child.wait_with_output()?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    if stdout.is_empty() {
        return Err(LyricsError::Unavailable(format!(
            "bridge produced empty stdout; stderr: {stderr}"
        )));
    }

    let value: Value = serde_json::from_str(&stdout)?;
    if !output.status.success() || value.get("ok").and_then(|v| v.as_bool()) == Some(false) {
        let bridge_error = value
            .get("error")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown bridge error");
        return Err(LyricsError::Unavailable(format!(
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
