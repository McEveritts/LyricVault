use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SongResponse {
    pub id: i64,
    pub title: String,
    pub artist: String,
    pub status: String,
    pub lyrics_status: String,
    pub lyrics_synced: bool,
    pub stream_url: String,
    pub source_url: Option<String>,
    pub cover_url: Option<String>,
    pub duration: Option<i64>,
    pub lyrics_source: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SongDetailResponse {
    pub id: i64,
    pub title: String,
    pub artist: String,
    pub status: String,
    pub lyrics_status: String,
    pub lyrics_synced: bool,
    pub lyrics: Option<String>,
    pub file_path: Option<String>,
    pub stream_url: String,
    pub source_url: Option<String>,
    pub cover_url: Option<String>,
    pub duration: Option<i64>,
    pub lyrics_source: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Job {
    pub id: i64,
    pub status: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub title: Option<String>,
    pub idempotency_key: Option<String>,
    pub payload: Option<String>,
    pub result_json: Option<String>,
    pub progress: Option<i64>,
    pub retry_count: Option<i64>,
    pub max_retries: Option<i64>,
    pub last_error: Option<String>,
    pub worker_id: Option<String>,
    pub leased_until: Option<String>,
    pub available_at: Option<String>,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobResponse {
    pub id: i64,
    pub status: String,
    #[serde(rename = "type")]
    pub kind: String,
}

impl JobResponse {
    pub fn from_job(job: &Job) -> Self {
        Self {
            id: job.id,
            status: job.status.clone(),
            kind: job.kind.clone(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IngestStartArgs {
    pub url: String,
    #[serde(default)]
    pub rehydrate: bool,
    pub song_id: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchArgs {
    pub q: String,
    pub platform: Option<String>,
    pub social_sources: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub id: String,
    pub title: String,
    pub artist: Option<String>,
    pub uploader: Option<String>,
    pub url: String,
    pub duration: Option<i64>,
    pub thumbnail: Option<String>,
    pub platform: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LyricsResearchArgs {
    pub song_id: i64,
    pub model_id: Option<String>,
    pub mode: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LyricsResearchResponse {
    pub status: String,
    pub synced: Option<bool>,
    pub lyrics: Option<String>,
    pub message: Option<String>,
    pub failure_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKeyRequest {
    pub api_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeniusCredentials {
    pub client_id: Option<String>,
    pub client_secret: Option<String>,
    pub access_token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeniusCredentialsRequest {
    pub client_id: Option<String>,
    pub client_secret: Option<String>,
    pub access_token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MusicBrainzCredentialsRequest {
    pub username: Option<String>,
    pub password: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeminiKeyStatus {
    pub configured: bool,
    pub masked_key: Option<String>,
    pub available: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAIKeyStatus {
    pub configured: bool,
    pub masked_key: Option<String>,
    pub available: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeniusCredentialsStatus {
    pub client_id: Option<String>,
    pub client_secret: Option<String>,
    pub access_token: Option<String>,
    pub configured: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MusicBrainzCredentialsStatus {
    pub username: Option<String>,
    pub configured: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LyricsMode {
    pub strict_lrc: bool,
    pub allow_explicit: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelOption {
    pub id: String,
    pub name: String,
    pub description: String,
    pub rate_limit: String,
    pub pricing: String,
    pub cost_per_song: String,
    pub tier: String,
    pub lifecycle: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelsResponse {
    pub models: Vec<ModelOption>,
    pub selected: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelRequest {
    pub model_id: String,
    pub mode: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct YtdlpState {
    pub last_known_good_version: Option<String>,
    pub last_checked_at: Option<String>,
    pub last_update_status: Option<String>,
    pub last_update_error: Option<String>,
    pub last_smoke_test_ok: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct YtdlpStatus {
    pub version: Option<String>,
    pub self_update_allowed: bool,
    pub self_update_supported: bool,
    pub last_known_good_version: Option<String>,
    pub last_checked_at: Option<String>,
    pub last_update_status: Option<String>,
    pub last_update_error: Option<String>,
    pub last_smoke_test_ok: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkerStatus {
    pub running: bool,
    pub worker_id: String,
    pub active_job_id: Option<i64>,
    pub last_heartbeat_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventEnvelope {
    pub event: String,
    pub data: serde_json::Value,
    pub ts: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppError {
    pub code: String,
    pub message: String,
}

impl AppError {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
        }
    }
}
