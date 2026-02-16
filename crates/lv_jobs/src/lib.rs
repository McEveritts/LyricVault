use chrono::{Duration as ChronoDuration, Utc};
use lv_core::{downloads_dir, init_database, open_connection};
use lv_events::EventBus;
use lv_settings::SettingsStore;
use lv_types::WorkerStatus;
use regex::Regex;
use rusqlite::{params, OptionalExtension};
use serde_json::{json, Value};
use std::collections::HashSet;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, SystemTime};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum WorkerError {
    #[error("core error: {0}")]
    Core(#[from] lv_core::CoreError),
    #[error("db error: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("settings error: {0}")]
    Settings(#[from] lv_settings::SettingsError),
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("bridge error: {0}")]
    Bridge(String),
    #[error("invalid payload: {0}")]
    Payload(String),
}

#[derive(Debug, Clone)]
struct ClaimedJob {
    id: i64,
    kind: String,
    title: Option<String>,
    payload: Option<String>,
    retry_count: i64,
    max_retries: i64,
}

#[derive(Debug, Clone)]
struct JobWorkResult {
    result_json: Option<String>,
    updated_title: Option<String>,
    song_event: Option<(String, i64)>,
}

#[derive(Clone)]
pub struct WorkerRuntime {
    worker_id: String,
    settings: Arc<SettingsStore>,
    event_bus: EventBus,
    started: Arc<AtomicBool>,
    running: Arc<AtomicBool>,
    active_job_id: Arc<Mutex<Option<i64>>>,
    last_heartbeat_at: Arc<Mutex<Option<String>>>,
}

impl WorkerRuntime {
    pub fn new(settings: Arc<SettingsStore>, event_bus: EventBus) -> Self {
        let worker_id = format!(
            "worker_{}_{}",
            std::env::var("COMPUTERNAME").unwrap_or_else(|_| "local".to_string()),
            std::process::id()
        );
        Self {
            worker_id,
            settings,
            event_bus,
            started: Arc::new(AtomicBool::new(false)),
            running: Arc::new(AtomicBool::new(false)),
            active_job_id: Arc::new(Mutex::new(None)),
            last_heartbeat_at: Arc::new(Mutex::new(None)),
        }
    }

    pub fn start(&self) {
        if self.started.swap(true, Ordering::SeqCst) {
            return;
        }
        self.running.store(true, Ordering::SeqCst);

        let runtime = self.clone();
        thread::Builder::new()
            .name("lyricvault-worker".to_string())
            .spawn(move || runtime.run_loop())
            .ok();
    }

    pub fn status(&self) -> WorkerStatus {
        WorkerStatus {
            running: self.running.load(Ordering::SeqCst),
            worker_id: self.worker_id.clone(),
            active_job_id: self.active_job_id.lock().ok().and_then(|g| *g),
            last_heartbeat_at: self.last_heartbeat_at.lock().ok().and_then(|g| g.clone()),
        }
    }

    fn run_loop(self) {
        if let Err(error) = init_database() {
            eprintln!("Worker database initialization failed: {error}");
        }
        let mut last_cleanup = SystemTime::UNIX_EPOCH;
        let mut last_requeue = SystemTime::UNIX_EPOCH;
        let mut last_legacy_migration = SystemTime::UNIX_EPOCH;

        while self.running.load(Ordering::SeqCst) {
            let now = SystemTime::now();
            if now
                .duration_since(last_requeue)
                .unwrap_or_default()
                .as_secs()
                >= 15
            {
                let _ = self.requeue_stale_jobs();
                last_requeue = now;
            }
            if now
                .duration_since(last_cleanup)
                .unwrap_or_default()
                .as_secs()
                >= 10 * 60
            {
                let _ = self.cleanup_cached_audio();
                last_cleanup = now;
            }
            if now
                .duration_since(last_legacy_migration)
                .unwrap_or_default()
                .as_secs()
                >= 60
            {
                let _ = self.queue_legacy_unsynced_lyrics();
                last_legacy_migration = now;
            }

            match self.process_once() {
                Ok(true) => {}
                Ok(false) => thread::sleep(Duration::from_secs(2)),
                Err(error) => {
                    eprintln!("Worker loop error: {error}");
                    thread::sleep(Duration::from_secs(5));
                }
            }
        }
    }

    fn process_once(&self) -> Result<bool, WorkerError> {
        let conn = open_connection()?;
        let Some(job) = self.claim_one_job(&conn)? else {
            return Ok(false);
        };
        if let Ok(mut guard) = self.active_job_id.lock() {
            *guard = Some(job.id);
        }
        publish_job_event(
            &self.event_bus,
            job.id,
            &job.kind,
            "processing",
            job.title.as_deref(),
        );

        let heartbeat_stop = Arc::new(AtomicBool::new(false));
        let heartbeat_runtime = self.clone();
        let heartbeat_flag = heartbeat_stop.clone();
        let heartbeat_job_id = job.id;
        thread::Builder::new()
            .name(format!("lyricvault-heartbeat-{}", job.id))
            .spawn(move || heartbeat_runtime.heartbeat_loop(heartbeat_job_id, heartbeat_flag))
            .ok();

        let result = self.handle_job(&conn, &job);
        heartbeat_stop.store(true, Ordering::SeqCst);

        match result {
            Ok(work) => {
                self.complete_job(
                    &conn,
                    &job,
                    work.result_json.clone(),
                    work.updated_title.as_deref(),
                )?;
                publish_job_event(
                    &self.event_bus,
                    job.id,
                    &job.kind,
                    "completed",
                    work.updated_title.as_deref().or(job.title.as_deref()),
                );
                if let Some((action, song_id)) = work.song_event {
                    publish_song_event(&self.event_bus, &action, song_id);
                }
            }
            Err(error) => {
                let message = error.to_string();
                let next_status = self.fail_or_retry_job(&conn, &job, &message)?;
                publish_job_event(
                    &self.event_bus,
                    job.id,
                    &job.kind,
                    &next_status,
                    job.title.as_deref(),
                );
            }
        }

        if let Ok(mut guard) = self.active_job_id.lock() {
            *guard = None;
        }
        Ok(true)
    }

    fn claim_one_job(
        &self,
        conn: &rusqlite::Connection,
    ) -> Result<Option<ClaimedJob>, WorkerError> {
        let now = now_iso();
        let lease_until = (Utc::now() + ChronoDuration::minutes(5)).to_rfc3339();

        let mut stmt = conn.prepare(
            r#"
            SELECT
                id,
                type,
                title,
                payload,
                COALESCE(retry_count, 0),
                COALESCE(max_retries, 3)
            FROM jobs
            WHERE status IN ('pending', 'retrying')
              AND COALESCE(available_at, ?1) <= ?1
              AND COALESCE(retry_count, 0) < COALESCE(max_retries, 3)
            ORDER BY created_at ASC
            LIMIT 1
        "#,
        )?;
        let claimed = stmt
            .query_row(params![now.clone()], |row| {
                Ok(ClaimedJob {
                    id: row.get(0)?,
                    kind: row.get(1)?,
                    title: row.get(2)?,
                    payload: row.get(3)?,
                    retry_count: row.get(4)?,
                    max_retries: row.get(5)?,
                })
            })
            .optional()?;

        let Some(job) = claimed else {
            return Ok(None);
        };

        let updated = conn.execute(
            r#"
            UPDATE jobs
            SET status = 'processing',
                worker_id = ?2,
                leased_until = ?3,
                started_at = COALESCE(started_at, ?1),
                updated_at = ?1
            WHERE id = ?4
              AND status IN ('pending', 'retrying')
        "#,
            params![now, self.worker_id, lease_until, job.id],
        )?;

        if updated == 0 {
            return Ok(None);
        }

        Ok(Some(job))
    }

    fn heartbeat_loop(&self, job_id: i64, stop: Arc<AtomicBool>) {
        while !stop.load(Ordering::SeqCst) {
            thread::sleep(Duration::from_secs(60));
            if stop.load(Ordering::SeqCst) {
                break;
            }
            if self.heartbeat(job_id).is_ok() {
                if let Ok(mut guard) = self.last_heartbeat_at.lock() {
                    *guard = Some(now_iso());
                }
            }
        }
    }

    fn heartbeat(&self, job_id: i64) -> Result<(), WorkerError> {
        let conn = open_connection()?;
        let now = now_iso();
        let lease_until = (Utc::now() + ChronoDuration::minutes(5)).to_rfc3339();
        conn.execute(
            r#"
            UPDATE jobs
            SET leased_until = ?2,
                updated_at = ?1
            WHERE id = ?3
              AND status = 'processing'
              AND worker_id = ?4
        "#,
            params![now, lease_until, job_id, self.worker_id],
        )?;
        Ok(())
    }

    fn complete_job(
        &self,
        conn: &rusqlite::Connection,
        job: &ClaimedJob,
        result_json: Option<String>,
        updated_title: Option<&str>,
    ) -> Result<(), WorkerError> {
        let now = now_iso();
        conn.execute(
            r#"
            UPDATE jobs
            SET status = 'completed',
                progress = 100,
                result_json = ?2,
                title = COALESCE(?3, title),
                completed_at = ?1,
                updated_at = ?1,
                worker_id = NULL,
                leased_until = NULL
            WHERE id = ?4
        "#,
            params![now, result_json, updated_title, job.id],
        )?;
        Ok(())
    }

    fn fail_or_retry_job(
        &self,
        conn: &rusqlite::Connection,
        job: &ClaimedJob,
        last_error: &str,
    ) -> Result<String, WorkerError> {
        let now = now_iso();
        let next_retry = job.retry_count + 1;
        if next_retry >= job.max_retries {
            conn.execute(
                r#"
                UPDATE jobs
                SET status = 'failed',
                    retry_count = ?2,
                    last_error = ?3,
                    progress = 100,
                    completed_at = ?1,
                    updated_at = ?1,
                    worker_id = NULL,
                    leased_until = NULL
                WHERE id = ?4
            "#,
                params![now, next_retry, last_error, job.id],
            )?;
            return Ok("failed".to_string());
        }

        let backoff = 30_i64 * 4_i64.pow((next_retry.saturating_sub(1)) as u32);
        let available_at = (Utc::now() + ChronoDuration::seconds(backoff)).to_rfc3339();
        conn.execute(
            r#"
            UPDATE jobs
            SET status = 'retrying',
                retry_count = ?2,
                last_error = ?3,
                available_at = ?4,
                updated_at = ?1,
                worker_id = NULL,
                leased_until = NULL
            WHERE id = ?5
        "#,
            params![now, next_retry, last_error, available_at, job.id],
        )?;
        Ok("retrying".to_string())
    }

    fn handle_job(
        &self,
        conn: &rusqlite::Connection,
        job: &ClaimedJob,
    ) -> Result<JobWorkResult, WorkerError> {
        let payload: Value = match job.payload.as_deref() {
            Some(raw) if !raw.trim().is_empty() => serde_json::from_str(raw)?,
            _ => json!({}),
        };
        match job.kind.as_str() {
            "ingest_audio" => self.handle_ingest_job(conn, job.id, payload),
            "generate_lyrics" => self.handle_lyrics_job(conn, payload),
            "maintenance_update_ytdlp" => Ok(JobWorkResult {
                result_json: Some(
                    json!({
                        "status": "unsupported",
                        "error": "yt-dlp self-update is not supported; update LyricVault to get newer yt-dlp."
                    })
                    .to_string(),
                ),
                updated_title: job.title.clone(),
                song_event: None,
            }),
            _ => Err(WorkerError::Payload(format!("Unknown job type '{}'", job.kind))),
        }
    }

    fn handle_ingest_job(
        &self,
        conn: &rusqlite::Connection,
        job_id: i64,
        payload: Value,
    ) -> Result<JobWorkResult, WorkerError> {
        let url = payload
            .get("url")
            .and_then(|v| v.as_str())
            .map(ToString::to_string)
            .ok_or_else(|| WorkerError::Payload("ingest job missing url".to_string()))?;
        let payload_song_id = payload.get("song_id").and_then(|v| {
            v.as_i64()
                .or_else(|| v.as_str().and_then(|s| s.parse().ok()))
        });

        self.set_job_progress(conn, job_id, 20, None)?;
        let bridge = invoke_bridge("download_audio", json!({ "url": url }))?;
        let metadata = bridge
            .get("data")
            .cloned()
            .ok_or_else(|| WorkerError::Bridge("download_audio missing data".to_string()))?;

        let title = metadata
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("Unknown")
            .to_string();
        let artist_name = metadata
            .get("artist")
            .and_then(|v| v.as_str())
            .unwrap_or("Unknown")
            .to_string();
        let file_path = metadata
            .get("file_path")
            .and_then(|v| v.as_str())
            .map(ToString::to_string)
            .ok_or_else(|| WorkerError::Bridge("download_audio missing file_path".to_string()))?;
        let cover_url = metadata
            .get("cover_url")
            .and_then(|v| v.as_str())
            .map(ToString::to_string);
        let duration = normalize_duration_seconds(metadata.get("duration"));
        let display_title = Some(format!("Ingesting: {} - {}", artist_name, title));
        self.set_job_progress(conn, job_id, 60, display_title.as_deref())?;

        let artist_id = ensure_artist(conn, &artist_name)?;
        let mut song_id = find_song_for_ingest(conn, payload_song_id, Some(&url), &file_path)?;
        if let Some(existing_song_id) = song_id {
            conn.execute(
                r#"
                UPDATE songs
                SET title = ?2,
                    artist_id = ?3,
                    file_path = ?4,
                    duration = ?5,
                    source_url = ?6,
                    cover_url = COALESCE(?7, cover_url)
                WHERE id = ?1
            "#,
                params![
                    existing_song_id,
                    title,
                    artist_id,
                    file_path,
                    duration,
                    url,
                    cover_url
                ],
            )?;
        } else {
            conn.execute(
                r#"
                INSERT INTO songs (
                    title, artist_id, file_path, duration, source_url, lyrics_synced, cover_url
                ) VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6)
            "#,
                params![title, artist_id, file_path, duration, url, cover_url],
            )?;
            song_id = Some(conn.last_insert_rowid());
        }

        let song_id =
            song_id.ok_or_else(|| WorkerError::Payload("failed to resolve song id".to_string()))?;
        queue_lyrics_job(
            conn,
            song_id,
            &artist_name,
            metadata.get("title"),
            &file_path,
        )?;

        Ok(JobWorkResult {
            result_json: Some(
                json!({
                    "song_id": song_id,
                    "file_path": file_path
                })
                .to_string(),
            ),
            updated_title: display_title,
            song_event: Some(("ingest_completed".to_string(), song_id)),
        })
    }

    fn handle_lyrics_job(
        &self,
        conn: &rusqlite::Connection,
        payload: Value,
    ) -> Result<JobWorkResult, WorkerError> {
        let song_id = payload
            .get("song_id")
            .and_then(|v| {
                v.as_i64()
                    .or_else(|| v.as_str().and_then(|s| s.parse().ok()))
            })
            .ok_or_else(|| WorkerError::Payload("lyrics job missing song_id".to_string()))?;

        let mut stmt = conn.prepare(
            r#"
            SELECT
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
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, Option<i64>>(4)?.unwrap_or(0) != 0,
                ))
            })
            .optional()?
            .ok_or_else(|| WorkerError::Payload(format!("song {} not found", song_id)))?;

        let title = payload
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or(&row.0)
            .to_string();
        let artist = payload
            .get("artist")
            .and_then(|v| v.as_str())
            .unwrap_or(&row.1)
            .to_string();
        let file_path = payload
            .get("file_path")
            .and_then(|v| v.as_str())
            .map(ToString::to_string)
            .or_else(|| row.2.clone());
        let mode = payload
            .get("mode")
            .and_then(|v| v.as_str())
            .map(ToString::to_string);
        let model_id = payload
            .get("model_id")
            .and_then(|v| v.as_str())
            .map(ToString::to_string);

        let strict_lrc = self.settings.get_strict_lrc_mode().unwrap_or(true);
        let existing_synced = row.4 && row.3.as_deref().map(validate_lrc).unwrap_or(false);

        let bridge = invoke_bridge(
            "research_lyrics",
            json!({
                "title": title,
                "artist": artist,
                "file_path": file_path,
                "mode": mode,
                "model_id": model_id
            }),
        )?;
        let data = bridge
            .get("data")
            .cloned()
            .ok_or_else(|| WorkerError::Bridge("research_lyrics missing data".to_string()))?;

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
            .unwrap_or("not_found")
            .to_string();

        let result_json = if let Some(text) = lyrics {
            if synced {
                conn.execute(
                    "UPDATE songs SET lyrics = ?2, lyrics_synced = 1, lyrics_source = ?3 WHERE id = ?1",
                    params![song_id, text, source],
                )?;
                json!({
                    "status": "found",
                    "synced": true,
                    "source": source
                })
                .to_string()
            } else if !strict_lrc {
                conn.execute(
                    "UPDATE songs SET lyrics = ?2, lyrics_synced = 0, lyrics_source = ?3 WHERE id = ?1",
                    params![song_id, text, source],
                )?;
                json!({
                    "status": "found_unsynced",
                    "synced": false,
                    "source": source
                })
                .to_string()
            } else if existing_synced {
                json!({
                    "status": "kept_existing_synced",
                    "synced": true,
                    "failure_reason": failure_reason
                })
                .to_string()
            } else {
                conn.execute(
                    "UPDATE songs SET lyrics = 'Lyrics not found.', lyrics_synced = 0 WHERE id = ?1",
                    params![song_id],
                )?;
                json!({
                    "status": "not_found",
                    "synced": false,
                    "failure_reason": failure_reason
                })
                .to_string()
            }
        } else if existing_synced {
            json!({
                "status": "kept_existing_synced",
                "synced": true,
                "failure_reason": failure_reason
            })
            .to_string()
        } else {
            conn.execute(
                "UPDATE songs SET lyrics = 'Lyrics not found.', lyrics_synced = 0 WHERE id = ?1",
                params![song_id],
            )?;
            json!({
                "status": "not_found",
                "synced": false,
                "failure_reason": failure_reason
            })
            .to_string()
        };

        Ok(JobWorkResult {
            result_json: Some(result_json),
            updated_title: None,
            song_event: Some(("lyrics_updated".to_string(), song_id)),
        })
    }

    fn set_job_progress(
        &self,
        conn: &rusqlite::Connection,
        job_id: i64,
        progress: i64,
        title: Option<&str>,
    ) -> Result<(), WorkerError> {
        let now = now_iso();
        conn.execute(
            r#"
            UPDATE jobs
            SET progress = ?2,
                title = COALESCE(?3, title),
                updated_at = ?1
            WHERE id = ?4
        "#,
            params![now, progress, title, job_id],
        )?;
        Ok(())
    }

    fn requeue_stale_jobs(&self) -> Result<(), WorkerError> {
        let conn = open_connection()?;
        let cutoff = (Utc::now() - ChronoDuration::seconds(90)).to_rfc3339();
        conn.execute(
            r#"
            UPDATE jobs
            SET status = 'pending',
                worker_id = NULL,
                leased_until = NULL,
                updated_at = ?1
            WHERE status = 'processing'
              AND leased_until IS NOT NULL
              AND leased_until < ?2
              AND updated_at IS NOT NULL
              AND updated_at < ?2
        "#,
            params![now_iso(), cutoff],
        )?;
        Ok(())
    }

    fn cleanup_cached_audio(&self) -> Result<(), WorkerError> {
        let dir = downloads_dir();
        if !dir.exists() {
            return Ok(());
        }

        let now = SystemTime::now();
        let ttl = Duration::from_secs(60 * 60);
        let mut removed = Vec::new();
        for entry in std::fs::read_dir(&dir)? {
            let entry = entry?;
            let path = entry.path();
            if !path.is_file() {
                continue;
            }
            let extension = path
                .extension()
                .and_then(|v| v.to_str())
                .map(|v| v.to_lowercase())
                .unwrap_or_default();
            if !matches!(
                extension.as_str(),
                "mp3" | "m4a" | "wav" | "flac" | "ogg" | "aac" | "opus" | "webm" | "mp4"
            ) {
                continue;
            }
            let modified = entry.metadata()?.modified().ok();
            let expired = modified
                .and_then(|v| now.duration_since(v).ok())
                .map(|age| age >= ttl)
                .unwrap_or(false);
            if !expired {
                continue;
            }
            if std::fs::remove_file(&path).is_ok() {
                removed.push(path);
            }
        }

        if removed.is_empty() {
            return Ok(());
        }

        let conn = open_connection()?;
        for path in removed {
            let path_str = path.to_string_lossy().to_string();
            let mut stmt = conn.prepare("SELECT id FROM songs WHERE file_path = ?1")?;
            let song_ids: Vec<i64> = stmt
                .query_map(params![path_str.clone()], |row| row.get(0))?
                .flatten()
                .collect();
            conn.execute(
                "UPDATE songs SET file_path = NULL WHERE file_path = ?1",
                params![path_str],
            )?;
            for song_id in song_ids {
                publish_song_event(&self.event_bus, "cache_expired", song_id);
            }
        }
        Ok(())
    }

    fn queue_legacy_unsynced_lyrics(&self) -> Result<(), WorkerError> {
        if !self.settings.get_strict_lrc_mode().unwrap_or(true) {
            return Ok(());
        }
        let conn = open_connection()?;

        let mut active_stmt = conn.prepare(
            "SELECT payload FROM jobs WHERE type = 'generate_lyrics' AND status IN ('pending','processing','retrying')",
        )?;
        let active_rows = active_stmt.query_map([], |row| row.get::<_, Option<String>>(0))?;
        let mut active_song_ids = HashSet::new();
        for row in active_rows {
            if let Some(payload) = row? {
                if let Ok(value) = serde_json::from_str::<Value>(&payload) {
                    if let Some(song_id) = value.get("song_id").and_then(|v| {
                        v.as_i64()
                            .or_else(|| v.as_str().and_then(|s| s.parse().ok()))
                    }) {
                        active_song_ids.insert(song_id);
                    }
                }
            }
        }

        let mut candidates_stmt = conn.prepare(
            r#"
            SELECT
                s.id,
                COALESCE(s.title, ''),
                COALESCE(a.name, 'Unknown'),
                s.file_path,
                s.lyrics
            FROM songs s
            LEFT JOIN artists a ON a.id = s.artist_id
            WHERE COALESCE(s.lyrics_synced, 0) = 0
              AND s.lyrics IS NOT NULL
              AND s.lyrics != ''
              AND s.lyrics != 'Lyrics not found.'
            ORDER BY s.id ASC
            LIMIT 25
        "#,
        )?;
        let rows = candidates_stmt.query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, Option<String>>(4)?,
            ))
        })?;

        for row in rows {
            let (song_id, title, artist, file_path, lyrics) = row?;
            if active_song_ids.contains(&song_id) {
                continue;
            }
            if lyrics.as_deref().map(validate_lrc).unwrap_or(false) {
                conn.execute(
                    "UPDATE songs SET lyrics_synced = 1 WHERE id = ?1",
                    params![song_id],
                )?;
                continue;
            }
            let key = format!("lyrics_legacy_migrate_{song_id}");
            let exists = conn
                .query_row(
                    "SELECT 1 FROM jobs WHERE idempotency_key = ?1 LIMIT 1",
                    params![key.clone()],
                    |_| Ok(()),
                )
                .optional()?
                .is_some();
            if exists {
                continue;
            }
            let now = now_iso();
            conn.execute(
                r#"
                INSERT INTO jobs (
                    type, status, title, idempotency_key, payload,
                    progress, retry_count, max_retries, available_at, created_at, updated_at
                ) VALUES (
                    'generate_lyrics', 'pending', ?1, ?2, ?3,
                    0, 0, 3, ?4, ?4, ?4
                )
            "#,
                params![
                    format!("Lyrics Migration: {} - {}", artist, title),
                    key,
                    json!({
                        "song_id": song_id,
                        "title": title,
                        "artist": artist,
                        "file_path": file_path
                    })
                    .to_string(),
                    now
                ],
            )?;
        }

        Ok(())
    }
}

pub fn publish_job_event(bus: &EventBus, id: i64, kind: &str, status: &str, title: Option<&str>) {
    bus.publish(
        "job",
        json!({
            "id": id,
            "type": kind,
            "status": status,
            "title": title,
        }),
    );
}

pub fn publish_song_event(bus: &EventBus, action: &str, song_id: i64) {
    bus.publish(
        "song",
        json!({
            "action": action,
            "song_ids": [song_id],
        }),
    );
}

fn now_iso() -> String {
    Utc::now().to_rfc3339()
}

fn normalize_duration_seconds(value: Option<&Value>) -> Option<i64> {
    let Some(value) = value else {
        return None;
    };
    if let Some(v) = value.as_i64() {
        return (v >= 0).then_some(v);
    }
    if let Some(v) = value.as_u64() {
        return Some(v as i64);
    }
    value.as_f64().and_then(|v| {
        if v >= 0.0 {
            Some(v.round() as i64)
        } else {
            None
        }
    })
}

fn ensure_artist(conn: &rusqlite::Connection, name: &str) -> Result<i64, WorkerError> {
    conn.execute(
        "INSERT OR IGNORE INTO artists (name) VALUES (?1)",
        params![name],
    )?;
    let id = conn
        .query_row(
            "SELECT id FROM artists WHERE name = ?1 LIMIT 1",
            params![name],
            |row| row.get::<_, i64>(0),
        )
        .optional()?
        .ok_or_else(|| WorkerError::Payload("failed to resolve artist id".to_string()))?;
    Ok(id)
}

fn find_song_for_ingest(
    conn: &rusqlite::Connection,
    payload_song_id: Option<i64>,
    url: Option<&str>,
    file_path: &str,
) -> Result<Option<i64>, WorkerError> {
    if let Some(song_id) = payload_song_id {
        let exists = conn
            .query_row(
                "SELECT id FROM songs WHERE id = ?1 LIMIT 1",
                params![song_id],
                |row| row.get::<_, i64>(0),
            )
            .optional()?;
        if exists.is_some() {
            return Ok(Some(song_id));
        }
    }

    if let Some(url) = url {
        if let Some(song_id) = conn
            .query_row(
                "SELECT id FROM songs WHERE source_url = ?1 ORDER BY id DESC LIMIT 1",
                params![url],
                |row| row.get::<_, i64>(0),
            )
            .optional()?
        {
            return Ok(Some(song_id));
        }
    }

    let song_id = conn
        .query_row(
            "SELECT id FROM songs WHERE file_path = ?1 ORDER BY id DESC LIMIT 1",
            params![file_path],
            |row| row.get::<_, i64>(0),
        )
        .optional()?;
    Ok(song_id)
}

fn queue_lyrics_job(
    conn: &rusqlite::Connection,
    song_id: i64,
    artist: &str,
    title_value: Option<&Value>,
    file_path: &str,
) -> Result<(), WorkerError> {
    let key = format!("lyrics_{song_id}");
    let exists = conn
        .query_row(
            "SELECT 1 FROM jobs WHERE idempotency_key = ?1 LIMIT 1",
            params![key.clone()],
            |_| Ok(()),
        )
        .optional()?
        .is_some();
    if exists {
        return Ok(());
    }
    let title = title_value
        .and_then(|v| v.as_str())
        .unwrap_or("Unknown")
        .to_string();
    let now = now_iso();
    conn.execute(
        r#"
        INSERT INTO jobs (
            type, status, title, idempotency_key, payload,
            progress, retry_count, max_retries, available_at, created_at, updated_at
        ) VALUES (
            'generate_lyrics', 'pending', ?1, ?2, ?3,
            0, 0, 3, ?4, ?4, ?4
        )
    "#,
        params![
            format!("Lyrics: {} - {}", artist, title),
            key,
            json!({
                "song_id": song_id,
                "title": title,
                "artist": artist,
                "file_path": file_path
            })
            .to_string(),
            now
        ],
    )?;
    Ok(())
}

fn lrc_regex() -> &'static Regex {
    static LRC_PATTERN: std::sync::OnceLock<Regex> = std::sync::OnceLock::new();
    LRC_PATTERN.get_or_init(|| Regex::new(r"(?m)^\\s*\\[\\d{2}:\\d{2}(?:\\.\\d{1,3})?\\]").unwrap())
}

fn validate_lrc(input: &str) -> bool {
    lrc_regex().find_iter(input).count() >= 5
}

fn invoke_bridge(action: &str, payload: Value) -> Result<Value, WorkerError> {
    let python = find_python_binary();
    let script = find_bridge_script()
        .ok_or_else(|| WorkerError::Bridge("bridge_cli.py not found".to_string()))?;

    let mut command = Command::new(python);
    command
        .arg(script)
        .arg(action)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = command
        .spawn()
        .map_err(|e| WorkerError::Bridge(format!("bridge launch failed: {e}")))?;

    if let Some(stdin) = child.stdin.as_mut() {
        stdin.write_all(payload.to_string().as_bytes())?;
    }
    let output = child.wait_with_output()?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    if stdout.is_empty() {
        return Err(WorkerError::Bridge(format!(
            "bridge action '{action}' produced empty stdout; stderr: {stderr}"
        )));
    }

    let value: Value = serde_json::from_str(&stdout)?;
    if !output.status.success() || value.get("ok").and_then(|v| v.as_bool()) == Some(false) {
        let bridge_error = value
            .get("error")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown bridge error");
        return Err(WorkerError::Bridge(format!(
            "bridge action '{action}' failed: {bridge_error}; stderr: {stderr}"
        )));
    }
    Ok(value)
}

fn find_python_binary() -> PathBuf {
    if let Ok(explicit) = std::env::var("LYRICVAULT_BRIDGE_PYTHON") {
        let path = PathBuf::from(explicit);
        if path.exists() {
            return path;
        }
    }
    if let Ok(resource_dir) = std::env::var("LYRICVAULT_RESOURCE_DIR") {
        let embedded = PathBuf::from(resource_dir)
            .join("python-embed")
            .join("python.exe");
        if embedded.exists() {
            return embedded;
        }
    }
    let cwd_embedded = Path::new("python-embed").join("python.exe");
    if cwd_embedded.exists() {
        return cwd_embedded;
    }
    PathBuf::from("python")
}

fn find_bridge_script() -> Option<PathBuf> {
    if let Ok(explicit) = std::env::var("LYRICVAULT_BRIDGE_SCRIPT") {
        let path = PathBuf::from(explicit);
        if path.exists() {
            return Some(path);
        }
    }
    if let Ok(resource_dir) = std::env::var("LYRICVAULT_RESOURCE_DIR") {
        let path = PathBuf::from(resource_dir)
            .join("backend")
            .join("tools")
            .join("bridge_cli.py");
        if path.exists() {
            return Some(path);
        }
    }
    let cwd_path = Path::new("backend").join("tools").join("bridge_cli.py");
    if cwd_path.exists() {
        return Some(cwd_path);
    }
    None
}
