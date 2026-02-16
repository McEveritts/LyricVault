#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use lv_core::{
    ingest_start as core_ingest_start, job_get as core_job_get, jobs_active as core_jobs_active,
};
use lv_core::{jobs_history as core_jobs_history, library_list as core_library_list};
use lv_core::{retry_lyrics as core_retry_lyrics, song_get as core_song_get};
use lv_events::EventBus;
use lv_jobs::WorkerRuntime;
use lv_jobs::{publish_job_event, publish_song_event};
use lv_lyrics::{
    research_lyrics as lyrics_research_impl, validate_gemini_key, validate_genius_token,
};
use lv_media::{get_ytdlp_status, search_music as media_search_music};
use lv_settings::{mask_secret, SettingsStore};
use lv_types::{
    ApiKeyRequest, AppError, GeminiKeyStatus, GeniusCredentialsRequest, GeniusCredentialsStatus,
    IngestStartArgs, Job, JobResponse, LyricsMode, LyricsResearchArgs, LyricsResearchResponse,
    ModelRequest, ModelsResponse, MusicBrainzCredentialsRequest, MusicBrainzCredentialsStatus,
    OpenAIKeyStatus, SearchArgs, SearchResult, SongDetailResponse, SongResponse,
    WorkerStatus, YtdlpStatus,
};
use serde_json::json;
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::http::{header::CONTENT_TYPE, Response, StatusCode};
use tauri::{Emitter, Manager, State};

#[derive(Clone)]
struct AppState {
    settings: Arc<SettingsStore>,
    event_bus: EventBus,
    worker: WorkerRuntime,
}

#[derive(Debug, serde::Deserialize)]
struct SongIdRequest {
    #[serde(alias = "songId")]
    song_id: i64,
}

#[derive(Debug, serde::Deserialize)]
struct JobIdRequest {
    #[serde(alias = "jobId")]
    job_id: i64,
}

impl AppState {
    fn emit_event(&self, kind: &str, data: serde_json::Value) {
        self.event_bus.publish(kind.to_string(), data);
    }
}

fn map_err(code: &str, error: impl std::fmt::Display) -> AppError {
    AppError::new(code, error.to_string())
}

#[tauri::command]
fn library_list(state: State<'_, AppState>) -> Result<Vec<SongResponse>, AppError> {
    core_library_list(&state.settings).map_err(|e| map_err("library_list_failed", e))
}

#[tauri::command]
fn song_get(
    state: State<'_, AppState>,
    request: SongIdRequest,
) -> Result<SongDetailResponse, AppError> {
    core_song_get(request.song_id, &state.settings).map_err(|e| map_err("song_get_failed", e))
}

#[tauri::command]
fn ingest_start(
    state: State<'_, AppState>,
    request: IngestStartArgs,
) -> Result<JobResponse, AppError> {
    let job = core_ingest_start(&request).map_err(|e| map_err("ingest_start_failed", e))?;
    publish_job_event(
        &state.event_bus,
        job.id,
        &job.kind,
        &job.status,
        Some("Ingest queued"),
    );
    Ok(job)
}

#[tauri::command]
fn search_music(request: SearchArgs) -> Result<Vec<SearchResult>, AppError> {
    media_search_music(&request).map_err(|e| map_err("search_failed", e))
}

#[tauri::command]
fn lyrics_research(request: LyricsResearchArgs) -> Result<LyricsResearchResponse, AppError> {
    lyrics_research_impl(&request).map_err(|e| map_err("lyrics_research_failed", e))
}

#[tauri::command]
fn jobs_active() -> Result<Vec<Job>, AppError> {
    core_jobs_active().map_err(|e| map_err("jobs_active_failed", e))
}

#[tauri::command]
fn jobs_history() -> Result<Vec<Job>, AppError> {
    core_jobs_history().map_err(|e| map_err("jobs_history_failed", e))
}

#[tauri::command]
fn job_get(request: JobIdRequest) -> Result<Job, AppError> {
    core_job_get(request.job_id).map_err(|e| map_err("job_get_failed", e))
}

#[tauri::command]
fn lyrics_retry(
    state: State<'_, AppState>,
    request: SongIdRequest,
) -> Result<JobResponse, AppError> {
    let job = core_retry_lyrics(request.song_id).map_err(|e| map_err("lyrics_retry_failed", e))?;
    publish_job_event(
        &state.event_bus,
        job.id,
        &job.kind,
        &job.status,
        Some("Retry lyrics queued"),
    );
    publish_song_event(&state.event_bus, "lyrics_retry_queued", request.song_id);
    Ok(job)
}

#[tauri::command]
fn settings_gemini_get(state: State<'_, AppState>) -> Result<GeminiKeyStatus, AppError> {
    let key = state
        .settings
        .get_gemini_api_key()
        .map_err(|e| map_err("settings_gemini_get_failed", e))?;
    Ok(GeminiKeyStatus {
        configured: key.is_some(),
        masked_key: mask_secret(key.as_deref()),
        available: key.is_some(),
    })
}

#[tauri::command]
fn settings_gemini_set(
    state: State<'_, AppState>,
    request: ApiKeyRequest,
) -> Result<serde_json::Value, AppError> {
    let key = request.api_key.trim();
    if key.is_empty() {
        return Err(map_err("validation_error", "API key cannot be empty"));
    }
    if !validate_gemini_key(key) {
        return Err(map_err("validation_error", "Invalid API key format"));
    }
    state
        .settings
        .set_gemini_api_key(key)
        .map_err(|e| map_err("settings_gemini_set_failed", e))?;
    Ok(json!({ "status": "saved", "message": "API key saved successfully" }))
}

#[tauri::command]
fn settings_gemini_delete(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    state
        .settings
        .delete_gemini_api_key()
        .map_err(|e| map_err("settings_gemini_delete_failed", e))?;
    Ok(json!({ "status": "deleted", "message": "API key removed" }))
}

#[tauri::command]
fn settings_gemini_test(request: ApiKeyRequest) -> Result<serde_json::Value, AppError> {
    if validate_gemini_key(&request.api_key) {
        Ok(json!({ "status": "success", "message": "API key is valid" }))
    } else {
        Err(map_err("validation_error", "Invalid Gemini API key"))
    }
}

#[tauri::command]
fn settings_genius_get(state: State<'_, AppState>) -> Result<GeniusCredentialsStatus, AppError> {
    let credentials = state
        .settings
        .get_genius_credentials()
        .map_err(|e| map_err("settings_genius_get_failed", e))?;
    Ok(GeniusCredentialsStatus {
        client_id: mask_secret(credentials.client_id.as_deref()),
        client_secret: mask_secret(credentials.client_secret.as_deref()),
        access_token: mask_secret(credentials.access_token.as_deref()),
        configured: credentials.client_id.is_some()
            || credentials.client_secret.is_some()
            || credentials.access_token.is_some(),
    })
}

#[tauri::command]
fn settings_genius_set(
    state: State<'_, AppState>,
    request: GeniusCredentialsRequest,
) -> Result<serde_json::Value, AppError> {
    state
        .settings
        .set_genius_credentials(&request)
        .map_err(|e| map_err("settings_genius_set_failed", e))?;
    Ok(json!({ "status": "saved", "message": "Genius credentials saved successfully" }))
}

#[tauri::command]
fn settings_genius_delete(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    state
        .settings
        .delete_genius_credentials()
        .map_err(|e| map_err("settings_genius_delete_failed", e))?;
    Ok(json!({ "status": "deleted", "message": "Genius credentials removed" }))
}

#[tauri::command]
fn settings_genius_test(
    state: State<'_, AppState>,
    request: GeniusCredentialsRequest,
) -> Result<serde_json::Value, AppError> {
    let token = request.access_token.or_else(|| {
        state
            .settings
            .get_genius_credentials()
            .ok()
            .and_then(|c| c.access_token)
    });
    let Some(token) = token else {
        return Err(map_err(
            "validation_error",
            "No access token provided for testing",
        ));
    };
    if validate_genius_token(&token) {
        Ok(json!({ "status": "success", "message": "Genius token format is valid" }))
    } else {
        Err(map_err("validation_error", "Invalid Genius token"))
    }
}

#[tauri::command]
fn settings_lyrics_mode_get(state: State<'_, AppState>) -> Result<LyricsMode, AppError> {
    let strict_lrc = state
        .settings
        .get_strict_lrc_mode()
        .map_err(|e| map_err("settings_lyrics_mode_get_failed", e))?;
    let allow_explicit = state
        .settings
        .get_allow_explicit()
        .map_err(|e| map_err("settings_allow_explicit_get_failed", e))?;
    Ok(LyricsMode { strict_lrc, allow_explicit })
}

#[tauri::command]
fn settings_lyrics_mode_set(
    state: State<'_, AppState>,
    request: LyricsMode,
) -> Result<serde_json::Value, AppError> {
    state
        .settings
        .set_lyrics_mode(request.strict_lrc, request.allow_explicit)
        .map_err(|e| map_err("settings_lyrics_mode_set_failed", e))?;
    Ok(json!({ "status": "saved" }))
}

#[tauri::command]
fn settings_openai_get(state: State<'_, AppState>) -> Result<OpenAIKeyStatus, AppError> {
    let key = state
        .settings
        .get_openai_api_key()
        .map_err(|e| map_err("settings_openai_get_failed", e))?;
    Ok(OpenAIKeyStatus {
        configured: key.is_some(),
        masked_key: mask_secret(key.as_deref()),
        available: key.is_some(),
    })
}

#[tauri::command]
fn settings_openai_set(
    state: State<'_, AppState>,
    request: ApiKeyRequest,
) -> Result<serde_json::Value, AppError> {
    state
        .settings
        .set_openai_api_key(&request.api_key)
        .map_err(|e| map_err("settings_openai_set_failed", e))?;
    Ok(json!({ "status": "saved" }))
}

#[tauri::command]
fn settings_musicbrainz_get(state: State<'_, AppState>) -> Result<MusicBrainzCredentialsStatus, AppError> {
    let username = state
        .settings
        .get_musicbrainz_username()
        .map_err(|e| map_err("settings_mb_get_failed", e))?;
    Ok(MusicBrainzCredentialsStatus {
        username,
        configured: true, // simplified for now
    })
}

#[tauri::command]
fn settings_musicbrainz_set(
    state: State<'_, AppState>,
    request: MusicBrainzCredentialsRequest,
) -> Result<serde_json::Value, AppError> {
    state
        .settings
        .set_musicbrainz_credentials(
            request.username.as_deref().unwrap_or(""),
            request.password.as_deref().unwrap_or(""),
        )
        .map_err(|e| map_err("settings_mb_set_failed", e))?;
    Ok(json!({ "status": "saved" }))
}

#[tauri::command]
fn settings_gemini_model_get(state: State<'_, AppState>) -> Result<ModelsResponse, AppError> {
    state
        .settings
        .get_models_response()
        .map_err(|e| map_err("settings_models_get_failed", e))
}

#[tauri::command]
fn settings_gemini_model_set(
    state: State<'_, AppState>,
    request: ModelRequest,
) -> Result<serde_json::Value, AppError> {
    state
        .settings
        .set_gemini_model(&request.model_id)
        .map_err(|e| map_err("settings_models_set_failed", e))?;
    Ok(json!({ "status": "saved" }))
}

#[tauri::command]
fn system_ytdlp_update(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
     // placeholder for update logic
     Ok(json!({ "status": "no-op" }))
}

#[tauri::command]
fn system_ytdlp_status(state: State<'_, AppState>) -> Result<YtdlpStatus, AppError> {
    get_ytdlp_status(&state.settings).map_err(|e| map_err("system_ytdlp_status_failed", e))
}

#[tauri::command]
fn system_worker_status(state: State<'_, AppState>) -> Result<WorkerStatus, AppError> {
    Ok(state.worker.status())
}

fn media_protocol_response(
    media_root: PathBuf,
    request: &tauri::http::Request<Vec<u8>>,
) -> Response<Vec<u8>> {
    let uri = request.uri().to_string();
    let raw = uri
        .split("lvmedia://localhost/")
        .nth(1)
        .map(ToString::to_string)
        .unwrap_or_else(|| uri.trim_start_matches('/').to_string());
    let decoded = urlencoding::decode(&raw)
        .map(|v| v.to_string())
        .unwrap_or_else(|_| raw.clone());

    let requested = media_root.join(decoded);
    let canonical_root = media_root.canonicalize().ok();
    let canonical_file = requested.canonicalize().ok();

    let mut not_found = Response::new(Vec::<u8>::new());
    *not_found.status_mut() = StatusCode::NOT_FOUND;

    let Some(canonical_root) = canonical_root else {
        return not_found;
    };
    let Some(canonical_file) = canonical_file else {
        return not_found;
    };

    if !canonical_file.starts_with(&canonical_root) {
        let mut forbidden = Response::new(Vec::<u8>::new());
        *forbidden.status_mut() = StatusCode::FORBIDDEN;
        return forbidden;
    }

    let Ok(bytes) = fs::read(&canonical_file) else {
        return not_found;
    };

    let len = bytes.len();
    let mut response = Response::new(bytes);
    
    // Handle Range Requests
    if let Some(range_header) = request.headers().get("range") {
        if let Ok(range_str) = range_header.to_str() {
            if range_str.starts_with("bytes=") {
                let range = &range_str[6..];
                let parts: Vec<&str> = range.split('-').collect();
                if parts.len() == 2 {
                    let start = parts[0].parse::<usize>().unwrap_or(0);
                    let end = parts[1].parse::<usize>().unwrap_or(len - 1);
                    let end = if end >= len { len - 1 } else { end };
                    
                    if start < len && start <= end {
                        let partial_bytes = response.body()[start..=end].to_vec();
                        let mut partial_resp = Response::new(partial_bytes);
                        *partial_resp.status_mut() = StatusCode::PARTIAL_CONTENT;
                        
                        partial_resp.headers_mut().insert(
                            "Content-Range",
                            format!("bytes {}-{}/{}", start, end, len).parse().unwrap(),
                        );
                        partial_resp.headers_mut().insert("Accept-Ranges", "bytes".parse().unwrap());
                        if let Ok(content_type) = "audio/mpeg".parse() {
                            partial_resp.headers_mut().insert(CONTENT_TYPE, content_type);
                        }
                        return partial_resp;
                    }
                }
            }
        }
    }

    *response.status_mut() = StatusCode::OK;
    response.headers_mut().insert("Accept-Ranges", "bytes".parse().unwrap());
    if let Ok(content_type) = "audio/mpeg".parse() {
        response.headers_mut().insert(CONTENT_TYPE, content_type);
    }
    response
}

fn main() {
    if let Err(error) = lv_core::init_database() {
        eprintln!("Database initialization failed: {error}");
    }

    let settings = Arc::new(SettingsStore::default());
    let event_bus = EventBus::default();
    let state = AppState {
        settings: settings.clone(),
        worker: WorkerRuntime::new(settings, event_bus.clone()),
        event_bus: event_bus.clone(),
    };

    let media_root = lv_core::downloads_dir();

    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .register_uri_scheme_protocol("lvmedia", move |_app, request| {
            media_protocol_response(media_root.clone(), &request)
        })
        .manage(state)
        .setup(move |app| {
            if let Ok(resource_dir) = app.path().resource_dir() {
                lv_media::set_resource_dir(resource_dir.clone());
                lv_lyrics::set_resource_dir(resource_dir.clone());
                std::env::set_var("LYRICVAULT_RESOURCE_DIR", resource_dir);
            }

            let app_handle = app.handle().clone();
            let mut rx = event_bus.subscribe();
            tauri::async_runtime::spawn(async move {
                while let Ok(event) = rx.recv().await {
                    let _ = app_handle.emit("lyricvault:event", event);
                }
            });

            app.state::<AppState>().worker.start();

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            library_list,
            song_get,
            ingest_start,
            search_music,
            lyrics_research,
            jobs_active,
            jobs_history,
            job_get,
            lyrics_retry,
            settings_gemini_get,
            settings_gemini_set,
            settings_gemini_delete,
            settings_gemini_test,
            settings_genius_get,
            settings_genius_set,
            settings_genius_delete,
            settings_genius_test,
            settings_openai_get,
            settings_openai_set,
            settings_musicbrainz_get,
            settings_musicbrainz_set,
            settings_lyrics_mode_get,
            settings_lyrics_mode_set,
            settings_gemini_model_get,
            settings_gemini_model_set,
            system_ytdlp_status,
            system_ytdlp_update,
            system_worker_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running LyricVault Tauri app");
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn media_protocol_allows_files_inside_root() {
        let root = tempdir().expect("tempdir");
        let media_file = root.path().join("sample.mp3");
        std::fs::write(&media_file, b"abc").expect("write media");
        let request = tauri::http::Request::builder()
            .uri("lvmedia://localhost/sample.mp3")
            .body(Vec::<u8>::new())
            .expect("request");

        let response = media_protocol_response(root.path().to_path_buf(), &request);
        assert_eq!(response.status(), tauri::http::StatusCode::OK);
        assert_eq!(response.body(), &b"abc".to_vec());
    }

    #[test]
    fn media_protocol_blocks_path_traversal() {
        let root = tempdir().expect("tempdir");
        let parent = root.path().parent().expect("parent").to_path_buf();
        let secret = parent.join("secret.txt");
        std::fs::write(&secret, b"secret").expect("write secret");

        let request = tauri::http::Request::builder()
            .uri("lvmedia://localhost/..%2Fsecret.txt")
            .body(Vec::<u8>::new())
            .expect("request");
        let response = media_protocol_response(root.path().to_path_buf(), &request);
        assert_eq!(response.status(), tauri::http::StatusCode::FORBIDDEN);
    }
}
