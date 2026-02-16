import { invoke } from "@tauri-apps/api/core";
import type {
  GeniusCredentialsStatus,
  GeminiKeyStatus,
  Job,
  JobResponse,
  LyricsMode,
  LyricsResearchResponse,
  ModelsResponse,
  MusicBrainzCredentialsStatus,
  OpenAIKeyStatus,
  SearchResult,
  SongDetailResponse,
  SongResponse,
  WorkerStatus,
  YtdlpStatus,
} from "../types";

export const api = {
  libraryList: () => invoke<SongResponse[]>("library_list"),
  songGet: (songId: number) =>
    invoke<SongDetailResponse>("song_get", { request: { song_id: songId } }),
  ingestStart: (url: string, rehydrate = false, songId?: number) =>
    invoke<JobResponse>("ingest_start", {
      request: {
        url,
        rehydrate,
        song_id: songId ?? null,
      },
    }),
  searchMusic: (q: string, platform = "youtube", socialSources?: string | null) =>
    invoke<SearchResult[]>("search_music", {
      request: { q, platform, social_sources: socialSources ?? null },
    }),
  lyricsResearch: (songId: number, modelId?: string, mode?: string) =>
    invoke<LyricsResearchResponse>("lyrics_research", {
      request: { song_id: songId, model_id: modelId ?? null, mode: mode ?? null },
    }),
  jobsActive: () => invoke<Job[]>("jobs_active"),
  jobsHistory: () => invoke<Job[]>("jobs_history"),
  jobGet: (jobId: number) => invoke<Job>("job_get", { request: { job_id: jobId } }),
  lyricsRetry: (songId: number) =>
    invoke<JobResponse>("lyrics_retry", { request: { song_id: songId } }),
  settingsGeminiGet: () => invoke<GeminiKeyStatus>("settings_gemini_get"),
  settingsGeminiSet: (apiKey: string) =>
    invoke("settings_gemini_set", { request: { api_key: apiKey } }),
  settingsGeminiDelete: () => invoke("settings_gemini_delete"),
  settingsGeminiTest: (apiKey: string) =>
    invoke("settings_gemini_test", { request: { api_key: apiKey } }),
  settingsGeniusGet: () => invoke<GeniusCredentialsStatus>("settings_genius_get"),
  settingsGeniusSet: (request: {
    client_id?: string | null;
    client_secret?: string | null;
    access_token?: string | null;
  }) => invoke("settings_genius_set", { request }),
  settingsGeniusDelete: () => invoke("settings_genius_delete"),
  settingsGeniusTest: (request: {
    client_id?: string | null;
    client_secret?: string | null;
    access_token?: string | null;
  }) => invoke("settings_genius_test", { request }),
  settingsOpenaiGet: () => invoke<OpenAIKeyStatus>("settings_openai_get"),
  settingsOpenaiSet: (apiKey: string) =>
    invoke("settings_openai_set", { request: { api_key: apiKey } }),
  settingsMusicbrainzGet: () => invoke<MusicBrainzCredentialsStatus>("settings_musicbrainz_get"),
  settingsMusicbrainzSet: (username: string, password: string) =>
    invoke("settings_musicbrainz_set", { request: { username, password } }),
  settingsLyricsModeGet: () => invoke<LyricsMode>("settings_lyrics_mode_get"),
  settingsLyricsModeSet: (strictLrc: boolean, allowExplicit: boolean) =>
    invoke("settings_lyrics_mode_set", { request: { strict_lrc: strictLrc, allow_explicit: allowExplicit } }),
  settingsModelsGet: () => invoke<ModelsResponse>("settings_gemini_model_get"),
  settingsModelsSet: (modelId: string) =>
    invoke("settings_gemini_model_set", { request: { model_id: modelId, mode: null } }),
  systemYtdlpStatus: () => invoke<YtdlpStatus>("system_ytdlp_status"),
  systemWorkerStatus: () => invoke<WorkerStatus>("system_worker_status"),
};
