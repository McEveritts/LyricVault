export type SongResponse = {
  id: number;
  title: string;
  artist: string;
  status: "cached" | "re-downloading" | "expired" | string;
  lyrics_status: "ready" | "processing" | "unsynced" | "unavailable" | string;
  lyrics_synced: boolean;
  stream_url: string;
  source_url?: string | null;
  cover_url?: string | null;
  duration?: number | null;
  lyrics_source?: string | null;
};

export type SongDetailResponse = SongResponse & {
  lyrics?: string | null;
  file_path?: string | null;
};

export type SearchResult = {
  id: string;
  title: string;
  artist?: string | null;
  uploader?: string | null;
  url: string;
  duration?: number | null;
  thumbnail?: string | null;
  platform: string;
};

export type Job = {
  id: number;
  status: string;
  type: string;
  title?: string | null;
  progress?: number | null;
  retry_count?: number | null;
  max_retries?: number | null;
  last_error?: string | null;
  result_json?: string | null;
  updated_at?: string | null;
};

export type JobResponse = {
  id: number;
  status: string;
  type: string;
};

export type GeminiKeyStatus = {
  configured: boolean;
  masked_key?: string | null;
  available: boolean;
};

export type OpenAIKeyStatus = {
  configured: boolean;
  masked_key?: string | null;
  available: boolean;
};

export type GeniusCredentialsStatus = {
  client_id?: string | null;
  client_secret?: string | null;
  access_token?: string | null;
  configured: boolean;
};

export type MusicBrainzCredentialsStatus = {
  username?: string | null;
  configured: boolean;
};

export type LyricsMode = {
  strict_lrc: boolean;
  allow_explicit: boolean;
};

export type ModelOption = {
  id: string;
  name: string;
  description: string;
  rate_limit: string;
  pricing: string;
  cost_per_song: string;
  tier: string;
  lifecycle: string;
};

export type ModelsResponse = {
  models: ModelOption[];
  selected: string;
};

export type YtdlpStatus = {
  version?: string | null;
  self_update_allowed: boolean;
  self_update_supported: boolean;
  last_known_good_version?: string | null;
  last_checked_at?: string | null;
  last_update_status?: string | null;
  last_update_error?: string | null;
  last_smoke_test_ok?: boolean | null;
};

export type WorkerStatus = {
  running: boolean;
  worker_id: string;
  active_job_id?: number | null;
  last_heartbeat_at?: string | null;
};

export type LyricsResearchResponse = {
  status: string;
  synced?: boolean | null;
  lyrics?: string | null;
  message?: string | null;
  failure_reason?: string | null;
};

export type EventEnvelope = {
  event: string;
  data: Record<string, unknown>;
  ts: number;
};
