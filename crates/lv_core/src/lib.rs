use chrono::Utc;
use lv_settings::SettingsStore;
use lv_types::{IngestStartArgs, Job, JobResponse, SongDetailResponse, SongResponse};
use regex::Regex;
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{json, Value};
use std::collections::HashSet;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use thiserror::Error;
use url::Url;

#[derive(Debug, Error)]
pub enum CoreError {
    #[error("database error: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("settings error: {0}")]
    Settings(#[from] lv_settings::SettingsError),
    #[error("not found: {0}")]
    NotFound(String),
    #[error("validation: {0}")]
    Validation(String),
}

#[derive(Debug, Clone)]
struct SongRow {
    id: i64,
    title: String,
    artist: String,
    lyrics: Option<String>,
    lyrics_synced: bool,
    source_url: Option<String>,
    cover_url: Option<String>,
    duration: Option<i64>,
    lyrics_source: Option<String>,
    file_path: Option<String>,
}

const MIGRATIONS: &[&str] = &[
    "0001_jobs_title_column",
    "0002_songs_album_id",
    "0003_restore_song_columns",
];

pub fn lyricvault_root() -> PathBuf {
    let app_data = env::var("APPDATA")
        .ok()
        .filter(|v| !v.trim().is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            env::var("HOME")
                .map(PathBuf::from)
                .unwrap_or_else(|_| PathBuf::from("."))
        });
    app_data.join("LyricVault")
}

pub fn database_path() -> PathBuf {
    lyricvault_root().join("lyricvault_v2.db")
}

pub fn downloads_dir() -> PathBuf {
    lyricvault_root().join("downloads")
}

pub fn logs_dir() -> PathBuf {
    lyricvault_root().join("logs")
}

pub fn init_database() -> Result<(), CoreError> {
    fs::create_dir_all(lyricvault_root())?;
    fs::create_dir_all(downloads_dir())?;
    fs::create_dir_all(logs_dir())?;

    let conn = open_connection()?;
    ensure_base_schema(&conn)?;
    run_migrations(&conn, &database_path())?;
    Ok(())
}

fn ensure_base_schema(conn: &Connection) -> Result<(), CoreError> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS artists (
            id INTEGER PRIMARY KEY,
            name TEXT UNIQUE,
            image_url TEXT
        );
        CREATE TABLE IF NOT EXISTS albums (
            id INTEGER PRIMARY KEY,
            name TEXT,
            artist_id INTEGER,
            cover_url TEXT,
            year INTEGER
        );
        CREATE TABLE IF NOT EXISTS songs (
            id INTEGER PRIMARY KEY,
            title TEXT,
            artist_id INTEGER,
            album_id INTEGER,
            lyrics TEXT,
            lyrics_synced BOOLEAN DEFAULT 0,
            source_url TEXT,
            cover_url TEXT,
            duration INTEGER,
            lyrics_source TEXT,
            file_path TEXT
        );
        CREATE TABLE IF NOT EXISTS jobs (
            id INTEGER PRIMARY KEY,
            type TEXT,
            status TEXT DEFAULT 'pending',
            title TEXT,
            idempotency_key TEXT UNIQUE,
            payload TEXT,
            result_json TEXT,
            progress INTEGER DEFAULT 0,
            retry_count INTEGER DEFAULT 0,
            max_retries INTEGER DEFAULT 3,
            last_error TEXT,
            worker_id TEXT,
            leased_until DATETIME,
            available_at DATETIME,
            started_at DATETIME,
            completed_at DATETIME,
            created_at DATETIME,
            updated_at DATETIME
        );
    "#,
    )?;
    Ok(())
}

pub fn open_connection() -> Result<Connection, CoreError> {
    fs::create_dir_all(lyricvault_root())?;
    let path = database_path();
    let conn = Connection::open(path)?;
    // Use pragmas but tolerate failures if DB is being accessed in legacy/restrictive mode
    let _ = conn.pragma_update(None, "journal_mode", "WAL");
    let _ = conn.pragma_update(None, "busy_timeout", "30000");
    Ok(conn)
}

fn run_migrations(conn: &Connection, db_path: &Path) -> Result<(), CoreError> {
    // Ensure base tables exist even if bootstrap was bypassed
    ensure_base_schema(conn)?;

    conn.execute(
        r#"
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version TEXT PRIMARY KEY,
            applied_at DATETIME NOT NULL
        )
    "#,
        [],
    )?;

    let applied: HashSet<String> = {
        let mut stmt = conn.prepare("SELECT version FROM schema_migrations")?;
        let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
        let mut result = HashSet::new();
        for row in rows {
            result.insert(row?);
        }
        result
    };

    let pending: Vec<&str> = MIGRATIONS
        .iter()
        .copied()
        .filter(|version| !applied.contains(*version))
        .collect();

    if pending.is_empty() {
        return Ok(());
    }

    if db_path.exists() {
        let stamp = Utc::now().format("%Y%m%dT%H%M%SZ").to_string();
        let backup = db_path.with_extension(format!("db.bak.{stamp}"));
        let _ = fs::copy(db_path, backup);
    }

    for version in pending {
        match version {
            "0001_jobs_title_column" => {
                if !has_table(conn, "jobs")? {
                    ensure_base_schema(conn)?;
                }
                if !has_column(conn, "jobs", "title")? {
                    conn.execute("ALTER TABLE jobs ADD COLUMN title TEXT", [])?;
                }
            }
            "0002_songs_album_id" => {
                if has_table(conn, "songs")? && !has_column(conn, "songs", "album_id")? {
                    conn.execute("ALTER TABLE songs ADD COLUMN album_id INTEGER", [])?;
                }
            }
            "0003_restore_song_columns" => {
                for (column, sql) in [
                    ("lyrics", "ALTER TABLE songs ADD COLUMN lyrics TEXT"),
                    (
                        "lyrics_synced",
                        "ALTER TABLE songs ADD COLUMN lyrics_synced BOOLEAN DEFAULT 0",
                    ),
                    ("source_url", "ALTER TABLE songs ADD COLUMN source_url TEXT"),
                    ("cover_url", "ALTER TABLE songs ADD COLUMN cover_url TEXT"),
                    ("duration", "ALTER TABLE songs ADD COLUMN duration INTEGER"),
                    (
                        "lyrics_source",
                        "ALTER TABLE songs ADD COLUMN lyrics_source TEXT",
                    ),
                    ("file_path", "ALTER TABLE songs ADD COLUMN file_path TEXT"),
                ] {
                    if has_table(conn, "songs")? && !has_column(conn, "songs", column)? {
                        conn.execute(sql, [])?;
                    }
                }
            }
            _ => {}
        }
        conn.execute(
            "INSERT INTO schema_migrations(version, applied_at) VALUES (?1, ?2)",
            params![version, now_iso()],
        )?;
    }
    Ok(())
}

fn has_table(conn: &Connection, table: &str) -> Result<bool, CoreError> {
    let exists = conn
        .query_row(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?1 LIMIT 1",
            params![table],
            |_row| Ok(true),
        )
        .optional()?
        .unwrap_or(false);
    Ok(exists)
}

fn has_column(conn: &Connection, table: &str, column: &str) -> Result<bool, CoreError> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({table})"))?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(1))?;
    for row in rows {
        if row? == column {
            return Ok(true);
        }
    }
    Ok(false)
}

fn now_iso() -> String {
    Utc::now().to_rfc3339()
}

fn host_matches(host: &str, domain: &str) -> bool {
    host == domain || host.ends_with(&format!(".{domain}"))
}

pub fn parse_url_platform(raw: &str) -> Option<&'static str> {
    let parsed = Url::parse(raw.trim()).ok()?;
    let host = parsed
        .host_str()
        .unwrap_or_default()
        .trim_start_matches("www.")
        .to_lowercase();

    if host_matches(&host, "youtube.com") || host_matches(&host, "youtu.be") {
        return Some("youtube");
    }
    if host_matches(&host, "spotify.com") {
        return Some("spotify");
    }
    if host_matches(&host, "soundcloud.com") {
        return Some("soundcloud");
    }
    if host_matches(&host, "music.apple.com") {
        return Some("apple");
    }
    if host_matches(&host, "tiktok.com") {
        return Some("tiktok");
    }
    if host_matches(&host, "instagram.com") {
        return Some("instagram");
    }
    if host_matches(&host, "facebook.com") || host_matches(&host, "fb.watch") {
        return Some("facebook");
    }
    None
}

pub fn normalize_url(raw: &str) -> String {
    let Ok(mut parsed) = Url::parse(raw.trim()) else {
        return raw.trim().to_string();
    };
    let scheme = parsed.scheme().to_lowercase();
    let host = parsed
        .host_str()
        .unwrap_or_default()
        .to_lowercase()
        .trim_start_matches("www.")
        .to_string();

    let _ = parsed.set_scheme(&scheme);
    let _ = parsed.set_host(Some(&host));
    parsed.set_fragment(None);

    if parsed.path() != "/" && parsed.path().ends_with('/') {
        let trimmed = parsed.path().trim_end_matches('/').to_string();
        parsed.set_path(&trimmed);
    }

    if host_matches(&host, "youtube.com") {
        let video_id = parsed
            .query_pairs()
            .find(|(key, _)| key == "v")
            .map(|(_, value)| value.to_string());
        parsed.set_query(None);
        if let Some(video_id) = video_id {
            parsed
                .query_pairs_mut()
                .clear()
                .append_pair("v", video_id.as_str());
        }
    } else {
        parsed.set_query(None);
    }

    parsed.to_string().trim_end_matches('/').to_string()
}

fn stream_url_for_file(file_path: Option<&str>) -> String {
    let Some(file_path) = file_path else {
        return String::new();
    };
    let Some(name) = Path::new(file_path).file_name() else {
        return String::new();
    };
    let name_lossy = name.to_string_lossy();
    let encoded = urlencoding::encode(name_lossy.as_ref());
    format!("lvmedia://localhost/{encoded}")
}

fn load_active_ingest_urls(conn: &Connection) -> Result<HashSet<String>, CoreError> {
    let mut stmt = conn.prepare(
        "SELECT payload FROM jobs WHERE type = 'ingest_audio' AND status IN ('pending','processing')",
    )?;
    let rows = stmt.query_map([], |row| row.get::<_, Option<String>>(0))?;
    let mut urls = HashSet::new();
    for row in rows {
        let Some(payload) = row? else {
            continue;
        };
        let Ok(value) = serde_json::from_str::<Value>(&payload) else {
            continue;
        };
        let Some(url) = value.get("url").and_then(|v| v.as_str()) else {
            continue;
        };
        urls.insert(normalize_url(url));
    }
    Ok(urls)
}

fn load_active_lyrics_song_ids(conn: &Connection) -> Result<HashSet<i64>, CoreError> {
    let mut stmt = conn.prepare(
        "SELECT payload FROM jobs WHERE type = 'generate_lyrics' AND status IN ('pending','processing','retrying')",
    )?;
    let rows = stmt.query_map([], |row| row.get::<_, Option<String>>(0))?;
    let mut ids = HashSet::new();
    for row in rows {
        let Some(payload) = row? else {
            continue;
        };
        let Ok(value) = serde_json::from_str::<Value>(&payload) else {
            continue;
        };
        let song_id = value.get("song_id").and_then(|v| {
            v.as_i64()
                .or_else(|| v.as_str().and_then(|s| s.parse().ok()))
        });
        if let Some(song_id) = song_id {
            ids.insert(song_id);
        }
    }
    Ok(ids)
}

fn lrc_regex() -> &'static Regex {
    static LRC_PATTERN: std::sync::OnceLock<Regex> = std::sync::OnceLock::new();
    LRC_PATTERN.get_or_init(|| Regex::new(r"(?m)^\\s*\\[\\d{2}:\\d{2}(?:\\.\\d{1,3})?\\]").unwrap())
}

fn validate_lrc(input: &str) -> bool {
    let count = lrc_regex().find_iter(input).count();
    count >= 5
}

fn has_unsynced_text(lyrics: Option<&str>) -> bool {
    lyrics
        .map(|value| {
            let trimmed = value.trim();
            !trimmed.is_empty() && trimmed != "Lyrics not found."
        })
        .unwrap_or(false)
}

fn resolve_audio_status(
    file_path: Option<&str>,
    source_url: Option<&str>,
    active_ingest_urls: &HashSet<String>,
) -> String {
    if let Some(path) = file_path {
        if Path::new(path).exists() {
            return "cached".to_string();
        }
    }
    if let Some(source_url) = source_url {
        let normalized = normalize_url(source_url);
        if active_ingest_urls.contains(&normalized) {
            return "re-downloading".to_string();
        }
    }
    "expired".to_string()
}

fn resolve_lyrics_status(
    song_id: i64,
    lyrics: Option<&str>,
    lyrics_synced: bool,
    active_lyrics_song_ids: &HashSet<i64>,
    strict_lrc: bool,
) -> String {
    if lyrics_synced && lyrics.map(validate_lrc).unwrap_or(false) {
        return "ready".to_string();
    }
    if active_lyrics_song_ids.contains(&song_id) {
        return "processing".to_string();
    }
    if !strict_lrc && has_unsynced_text(lyrics) {
        return "unsynced".to_string();
    }
    "unavailable".to_string()
}

fn row_to_song(row: &rusqlite::Row<'_>) -> Result<SongRow, rusqlite::Error> {
    Ok(SongRow {
        id: row.get(0)?,
        title: row.get(1)?,
        artist: row.get(2)?,
        lyrics: row.get(3)?,
        lyrics_synced: row.get::<_, Option<i64>>(4)?.unwrap_or(0) != 0,
        source_url: row.get(5)?,
        cover_url: row.get(6)?,
        duration: row.get(7)?,
        lyrics_source: row.get(8)?,
        file_path: row.get(9)?,
    })
}

fn clear_missing_file_paths(conn: &Connection, songs: &[SongRow]) -> Result<(), CoreError> {
    let missing: Vec<i64> = songs
        .iter()
        .filter_map(|song| match song.file_path.as_deref() {
            Some(path) if !Path::new(path).exists() => Some(song.id),
            _ => None,
        })
        .collect();

    if missing.is_empty() {
        return Ok(());
    }

    for song_id in missing {
        conn.execute(
            "UPDATE songs SET file_path = NULL WHERE id = ?1",
            params![song_id],
        )?;
    }
    Ok(())
}

pub fn library_list(settings: &SettingsStore) -> Result<Vec<SongResponse>, CoreError> {
    init_database()?;
    let conn = open_connection()?;
    let strict_lrc = settings.get_strict_lrc_mode()?;
    let active_ingest = load_active_ingest_urls(&conn)?;
    let active_lyrics = load_active_lyrics_song_ids(&conn)?;

    let mut stmt = conn.prepare(
        r#"
        SELECT
            s.id,
            COALESCE(s.title, ''),
            COALESCE(a.name, 'Unknown'),
            s.lyrics,
            COALESCE(s.lyrics_synced, 0),
            s.source_url,
            s.cover_url,
            s.duration,
            s.lyrics_source,
            s.file_path
        FROM songs s
        LEFT JOIN artists a ON a.id = s.artist_id
        ORDER BY s.id DESC
    "#,
    )?;
    let rows = stmt.query_map([], row_to_song)?;
    let mut songs = Vec::new();
    for row in rows {
        songs.push(row?);
    }

    clear_missing_file_paths(&conn, &songs)?;

    Ok(songs
        .into_iter()
        .map(|song| {
            let status = resolve_audio_status(
                song.file_path.as_deref(),
                song.source_url.as_deref(),
                &active_ingest,
            );
            let stream_url = if status == "cached" {
                stream_url_for_file(song.file_path.as_deref())
            } else {
                String::new()
            };

            SongResponse {
                id: song.id,
                title: song.title,
                artist: song.artist,
                status,
                lyrics_status: resolve_lyrics_status(
                    song.id,
                    song.lyrics.as_deref(),
                    song.lyrics_synced,
                    &active_lyrics,
                    strict_lrc,
                ),
                lyrics_synced: song.lyrics.as_deref().map(validate_lrc).unwrap_or(false)
                    && song.lyrics_synced,
                stream_url,
                source_url: song.source_url,
                cover_url: song.cover_url,
                duration: song.duration,
                lyrics_source: song.lyrics_source,
            }
        })
        .collect())
}

pub fn song_get(song_id: i64, settings: &SettingsStore) -> Result<SongDetailResponse, CoreError> {
    init_database()?;
    let conn = open_connection()?;
    let strict_lrc = settings.get_strict_lrc_mode()?;
    let active_ingest = load_active_ingest_urls(&conn)?;
    let active_lyrics = load_active_lyrics_song_ids(&conn)?;

    let mut stmt = conn.prepare(
        r#"
        SELECT
            s.id,
            COALESCE(s.title, ''),
            COALESCE(a.name, 'Unknown'),
            s.lyrics,
            COALESCE(s.lyrics_synced, 0),
            s.source_url,
            s.cover_url,
            s.duration,
            s.lyrics_source,
            s.file_path
        FROM songs s
        LEFT JOIN artists a ON a.id = s.artist_id
        WHERE s.id = ?1
    "#,
    )?;
    let mut rows = stmt.query(params![song_id])?;
    let Some(row) = rows.next()? else {
        return Err(CoreError::NotFound("Song not found".to_string()));
    };
    let mut song = row_to_song(row)?;

    if let Some(file_path) = song.file_path.as_deref() {
        if !Path::new(file_path).exists() {
            conn.execute(
                "UPDATE songs SET file_path = NULL WHERE id = ?1",
                params![song_id],
            )?;
            song.file_path = None;
        }
    }

    let status = resolve_audio_status(
        song.file_path.as_deref(),
        song.source_url.as_deref(),
        &active_ingest,
    );
    let stream_url = if status == "cached" {
        stream_url_for_file(song.file_path.as_deref())
    } else {
        String::new()
    };

    Ok(SongDetailResponse {
        id: song.id,
        title: song.title,
        artist: song.artist,
        status,
        lyrics_status: resolve_lyrics_status(
            song.id,
            song.lyrics.as_deref(),
            song.lyrics_synced,
            &active_lyrics,
            strict_lrc,
        ),
        lyrics_synced: song.lyrics.as_deref().map(validate_lrc).unwrap_or(false)
            && song.lyrics_synced,
        lyrics: song.lyrics,
        file_path: song.file_path,
        stream_url,
        source_url: song.source_url,
        cover_url: song.cover_url,
        duration: song.duration,
        lyrics_source: song.lyrics_source,
    })
}

pub fn jobs_active() -> Result<Vec<Job>, CoreError> {
    list_jobs_by_clause(
        "status IN ('pending','processing','retrying')",
        "created_at ASC",
    )
}

pub fn jobs_history() -> Result<Vec<Job>, CoreError> {
    list_jobs_by_clause(
        "status IN ('completed','failed')",
        "updated_at DESC LIMIT 50",
    )
}

pub fn job_get(job_id: i64) -> Result<Job, CoreError> {
    init_database()?;
    let conn = open_connection()?;
    let mut stmt = conn.prepare(&job_projection_sql(Some("id = ?1"), Some("LIMIT 1")))?;
    let mut rows = stmt.query(params![job_id])?;
    let Some(row) = rows.next()? else {
        return Err(CoreError::NotFound("Job not found".to_string()));
    };
    Ok(row_to_job(row)?)
}

fn list_jobs_by_clause(clause: &str, order: &str) -> Result<Vec<Job>, CoreError> {
    init_database()?;
    let conn = open_connection()?;
    let sql = format!(
        "{} WHERE {} ORDER BY {}",
        job_projection_sql(None, None),
        clause,
        order
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], row_to_job)?;
    let mut jobs = Vec::new();
    for row in rows {
        jobs.push(row?);
    }
    Ok(jobs)
}

fn job_projection_sql(filter: Option<&str>, suffix: Option<&str>) -> String {
    let mut sql = String::from(
        r#"
        SELECT
            id,
            status,
            type,
            title,
            idempotency_key,
            payload,
            result_json,
            progress,
            retry_count,
            max_retries,
            last_error,
            worker_id,
            CAST(leased_until AS TEXT),
            CAST(available_at AS TEXT),
            CAST(started_at AS TEXT),
            CAST(completed_at AS TEXT),
            CAST(created_at AS TEXT),
            CAST(updated_at AS TEXT)
        FROM jobs
    "#,
    );
    if let Some(filter) = filter {
        sql.push_str(" WHERE ");
        sql.push_str(filter);
    }
    if let Some(suffix) = suffix {
        sql.push(' ');
        sql.push_str(suffix);
    }
    sql
}

fn row_to_job(row: &rusqlite::Row<'_>) -> Result<Job, rusqlite::Error> {
    Ok(Job {
        id: row.get(0)?,
        status: row.get(1)?,
        kind: row.get(2)?,
        title: row.get(3)?,
        idempotency_key: row.get(4)?,
        payload: row.get(5)?,
        result_json: row.get(6)?,
        progress: row.get(7)?,
        retry_count: row.get(8)?,
        max_retries: row.get(9)?,
        last_error: row.get(10)?,
        worker_id: row.get(11)?,
        leased_until: row.get(12)?,
        available_at: row.get(13)?,
        started_at: row.get(14)?,
        completed_at: row.get(15)?,
        created_at: row.get(16)?,
        updated_at: row.get(17)?,
    })
}

pub fn ingest_start(request: &IngestStartArgs) -> Result<JobResponse, CoreError> {
    init_database()?;
    let conn = open_connection()?;

    let url = request.url.trim();
    if url.is_empty() {
        return Err(CoreError::Validation("URL cannot be empty".to_string()));
    }
    if parse_url_platform(url).is_none() {
        return Err(CoreError::Validation("Unsupported platform".to_string()));
    }

    let normalized = normalize_url(url);
    let digest = md5::compute(normalized.as_bytes());
    let idempotency_key = format!("ingest_{digest:x}");

    let mut stmt = conn.prepare(
        r#"
        SELECT id, status, type, title, idempotency_key, payload, result_json,
               progress, retry_count, max_retries, last_error, worker_id,
               CAST(leased_until AS TEXT), CAST(available_at AS TEXT), CAST(started_at AS TEXT),
               CAST(completed_at AS TEXT), CAST(created_at AS TEXT), CAST(updated_at AS TEXT)
        FROM jobs WHERE idempotency_key = ?1 LIMIT 1
    "#,
    )?;
    let existing = stmt
        .query_row(params![&idempotency_key], row_to_job)
        .optional()?;

    let payload = if let Some(song_id) = request.song_id {
        json!({ "url": url, "song_id": song_id }).to_string()
    } else {
        json!({ "url": url }).to_string()
    };
    let title = format!(
        "Ingesting: {}...",
        &url.chars().take(50).collect::<String>()
    );

    if let Some(existing) = existing {
        if existing.status == "pending" || existing.status == "processing" {
            return Ok(JobResponse::from_job(&existing));
        }
        if !request.rehydrate {
            return Ok(JobResponse::from_job(&existing));
        }
        conn.execute(
            r#"
            UPDATE jobs
            SET type = 'ingest_audio',
                title = ?2,
                status = 'pending',
                payload = ?3,
                result_json = NULL,
                progress = 0,
                retry_count = 0,
                last_error = NULL,
                worker_id = NULL,
                leased_until = NULL,
                available_at = ?4,
                started_at = NULL,
                completed_at = NULL,
                updated_at = ?4
            WHERE id = ?1
        "#,
            params![existing.id, title, payload, now_iso()],
        )?;
        return job_get(existing.id).map(|job| JobResponse::from_job(&job));
    }

    let now = now_iso();
    conn.execute(
        r#"
        INSERT INTO jobs (
            type, status, title, idempotency_key, payload,
            progress, retry_count, max_retries, available_at, created_at, updated_at
        ) VALUES (
            'ingest_audio', 'pending', ?1, ?2, ?3,
            0, 0, 3, ?4, ?4, ?4
        )
    "#,
        params![title, idempotency_key, payload, now],
    )?;
    let id = conn.last_insert_rowid();
    job_get(id).map(|job| JobResponse::from_job(&job))
}

pub fn retry_lyrics(song_id: i64) -> Result<JobResponse, CoreError> {
    init_database()?;
    let conn = open_connection()?;
    let mut stmt = conn.prepare(
        r#"
        SELECT s.id, COALESCE(s.title, ''), COALESCE(a.name, 'Unknown'), s.file_path
        FROM songs s
        LEFT JOIN artists a ON a.id = s.artist_id
        WHERE s.id = ?1
    "#,
    )?;
    let song = stmt
        .query_row(params![song_id], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, Option<String>>(3)?,
            ))
        })
        .optional()?;
    let Some((id, title, artist, file_path)) = song else {
        return Err(CoreError::NotFound("Song not found".to_string()));
    };

    conn.execute(
        "UPDATE songs SET lyrics = NULL, lyrics_synced = 0 WHERE id = ?1",
        params![song_id],
    )?;

    let now = now_iso();
    let idempotency_key = format!("lyrics_retry_{id}_{}", Utc::now().timestamp());
    let payload = json!({
        "song_id": id,
        "title": title,
        "artist": artist,
        "file_path": file_path
    })
    .to_string();

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
            format!("Retrying Lyrics: {title}"),
            idempotency_key,
            payload,
            now
        ],
    )?;
    let job_id = conn.last_insert_rowid();
    job_get(job_id).map(|job| JobResponse::from_job(&job))
}

#[cfg(test)]
mod tests {
    use super::*;
    use lv_settings::SettingsStore;
    use std::sync::{Mutex, OnceLock};
    use tempfile::TempDir;

    fn env_lock() -> &'static Mutex<()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
    }

    fn setup_temp_appdata() -> TempDir {
        let dir = tempfile::tempdir().expect("tempdir");
        std::env::set_var("APPDATA", dir.path());
        dir
    }

    #[test]
    fn jobs_active_and_history_are_split() {
        let _guard = env_lock().lock().unwrap_or_else(|p| p.into_inner());
        let _temp = setup_temp_appdata();
        init_database().expect("init db");
        let conn = open_connection().expect("open db");
        let now = now_iso();
        for status in ["pending", "processing", "retrying", "completed", "failed"] {
            conn.execute(
                r#"
                INSERT INTO jobs (
                    type, status, title, idempotency_key, payload,
                    progress, retry_count, max_retries, available_at, created_at, updated_at
                ) VALUES (
                    'ingest_audio', ?1, ?2, ?3, '{}',
                    0, 0, 3, ?4, ?4, ?4
                )
            "#,
                params![status, format!("job-{status}"), format!("k-{status}"), now],
            )
            .expect("insert job");
        }

        let active = jobs_active().expect("active");
        let history = jobs_history().expect("history");
        let active_status: Vec<String> = active.into_iter().map(|job| job.status).collect();
        let history_status: Vec<String> = history.into_iter().map(|job| job.status).collect();

        assert!(active_status.contains(&"pending".to_string()));
        assert!(active_status.contains(&"processing".to_string()));
        assert!(active_status.contains(&"retrying".to_string()));
        assert!(!active_status.contains(&"completed".to_string()));

        assert!(history_status.contains(&"completed".to_string()));
        assert!(history_status.contains(&"failed".to_string()));
        assert!(!history_status.contains(&"pending".to_string()));
    }

    #[test]
    fn rehydrate_flow_resets_completed_ingest() {
        let _guard = env_lock().lock().unwrap_or_else(|p| p.into_inner());
        let _temp = setup_temp_appdata();
        init_database().expect("init db");

        let request = IngestStartArgs {
            url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ".to_string(),
            rehydrate: false,
            song_id: None,
        };
        let created = ingest_start(&request).expect("create ingest");
        let conn = open_connection().expect("open db");
        conn.execute(
            "UPDATE jobs SET status = 'completed', updated_at = ?2 WHERE id = ?1",
            params![created.id, now_iso()],
        )
        .expect("complete job");

        let same = ingest_start(&request).expect("reuse existing");
        assert_eq!(same.id, created.id);
        assert_eq!(same.status, "completed");

        let rehydrate = ingest_start(&IngestStartArgs {
            url: request.url,
            rehydrate: true,
            song_id: None,
        })
        .expect("rehydrate");
        assert_eq!(rehydrate.id, created.id);
        assert_eq!(rehydrate.status, "pending");
    }

    #[test]
    fn strict_vs_fallback_lyrics_modes_are_reflected() {
        let _guard = env_lock().lock().unwrap_or_else(|p| p.into_inner());
        let _temp = setup_temp_appdata();
        init_database().expect("init db");
        let settings = SettingsStore::default();
        let conn = open_connection().expect("open db");
        conn.execute("INSERT INTO artists (name) VALUES ('Artist A')", [])
            .expect("artist");
        conn.execute(
            r#"
            INSERT INTO songs (
                title, artist_id, lyrics, lyrics_synced, source_url
            ) VALUES (
                'Song A', 1, 'plain unsynced lyric text', 0, 'https://www.youtube.com/watch?v=abc123'
            )
        "#,
            [],
        )
        .expect("song");

        settings.set_lyrics_mode(true, false).expect("set strict true");
        let strict = library_list(&settings).expect("strict list");
        assert_eq!(strict[0].lyrics_status, "unavailable");

        settings
            .set_lyrics_mode(false, false)
            .expect("set strict false");
        let fallback = library_list(&settings).expect("fallback list");
        assert_eq!(fallback[0].lyrics_status, "unsynced");
    }

    #[test]
    fn audio_status_transitions_between_redownloading_and_expired() {
        let _guard = env_lock().lock().unwrap_or_else(|p| p.into_inner());
        let _temp = setup_temp_appdata();
        init_database().expect("init db");
        let settings = SettingsStore::default();
        let conn = open_connection().expect("open db");
        conn.execute("INSERT INTO artists (name) VALUES ('Artist B')", [])
            .expect("artist");
        conn.execute(
            r#"
            INSERT INTO songs (
                title, artist_id, source_url, lyrics_synced
            ) VALUES (
                'Song B', 1, 'https://www.youtube.com/watch?v=abc999', 0
            )
        "#,
            [],
        )
        .expect("song");
        conn.execute(
            r#"
            INSERT INTO jobs (
                type, status, title, idempotency_key, payload,
                progress, retry_count, max_retries, available_at, created_at, updated_at
            ) VALUES (
                'ingest_audio', 'pending', 'ingest', 'ingest_status_test',
                '{"url":"https://www.youtube.com/watch?v=abc999"}',
                0, 0, 3, ?1, ?1, ?1
            )
        "#,
            params![now_iso()],
        )
        .expect("job");

        let downloading = library_list(&settings).expect("list downloading");
        assert_eq!(downloading[0].status, "re-downloading");

        conn.execute(
            "DELETE FROM jobs WHERE idempotency_key = 'ingest_status_test'",
            [],
        )
        .expect("delete job");
        let expired = library_list(&settings).expect("list expired");
        assert_eq!(expired[0].status, "expired");
    }

    #[test]
    fn init_database_preserves_existing_rows() {
        let _guard = env_lock().lock().unwrap_or_else(|p| p.into_inner());
        let _temp = setup_temp_appdata();
        let db_path = database_path();
        std::fs::create_dir_all(db_path.parent().expect("db path parent")).expect("mkdir");
        let conn = rusqlite::Connection::open(&db_path).expect("open legacy db");
        conn.execute(
            "CREATE TABLE IF NOT EXISTS artists (id INTEGER PRIMARY KEY, name TEXT UNIQUE)",
            [],
        )
        .expect("artists");
        conn.execute(
            "CREATE TABLE IF NOT EXISTS songs (id INTEGER PRIMARY KEY, title TEXT, artist_id INTEGER)",
            [],
        )
        .expect("songs");
        conn.execute(
            "INSERT INTO artists (id, name) VALUES (1, 'Legacy Artist')",
            [],
        )
        .expect("insert artist");
        conn.execute(
            "INSERT INTO songs (id, title, artist_id) VALUES (1, 'Legacy Song', 1)",
            [],
        )
        .expect("insert song");

        init_database().expect("init migrated db");
        let settings = SettingsStore::default();
        let songs = library_list(&settings).expect("library");
        assert_eq!(songs.len(), 1);
        assert_eq!(songs[0].title, "Legacy Song");
        assert_eq!(songs[0].artist, "Legacy Artist");
    }
}
