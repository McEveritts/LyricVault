import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import VisualizerDeck from "./components/VisualizerDeck";
import { subscribeToLyricVaultEvents } from "./lib/events";
import { api } from "./lib/ipc";
import type {
  EventEnvelope,
  GeniusCredentialsStatus,
  GeminiKeyStatus,
  Job,
  ModelOption,
  MusicBrainzCredentialsStatus,
  OpenAIKeyStatus,
  SearchResult,
  SongResponse,
  WorkerStatus,
  YtdlpStatus,
} from "./types";

type Tab = "library" | "discover" | "jobs" | "settings";
type NoticeKind = "info" | "success";
type Notice = { kind: NoticeKind; message: string };

export default function App() {
  const [tab, setTab] = createSignal<Tab>("discover");
  const [songs, setSongs] = createSignal<SongResponse[]>([]);
  const [activeJobs, setActiveJobs] = createSignal<Job[]>([]);
  const [historyJobs, setHistoryJobs] = createSignal<Job[]>([]);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [searchPlatform, setSearchPlatform] = createSignal("youtube");
  const [socialInstagram, setSocialInstagram] = createSignal(true);
  const [socialTiktok, setSocialTiktok] = createSignal(true);
  const [socialFacebook, setSocialFacebook] = createSignal(true);
  const [searchResults, setSearchResults] = createSignal<SearchResult[]>([]);
  const [ingestUrl, setIngestUrl] = createSignal("");
  const [currentSong, setCurrentSong] = createSignal<SongResponse | null>(null);
  const [playing, setPlaying] = createSignal(false);
  const [position, setPosition] = createSignal(0);
  const [duration, setDuration] = createSignal(0);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [notice, setNotice] = createSignal<Notice | null>(null);
  const [pendingAutoplaySongId, setPendingAutoplaySongId] = createSignal<number | null>(null);
  const [geminiStatus, setGeminiStatus] = createSignal<GeminiKeyStatus | null>(null);
  const [geniusStatus, setGeniusStatus] = createSignal<GeniusCredentialsStatus | null>(null);
  const [geminiInput, setGeminiInput] = createSignal("");
  const [strictLrc, setStrictLrc] = createSignal(true);
  const [models, setModels] = createSignal<ModelOption[]>([]);
  const [selectedModel, setSelectedModel] = createSignal("");
  const [ytdlpStatus, setYtdlpStatus] = createSignal<YtdlpStatus | null>(null);
  const [workerStatus, setWorkerStatus] = createSignal<WorkerStatus | null>(null);
  const [analyser, setAnalyser] = createSignal<AnalyserNode | null>(null);
  const [showVisualizer, setShowVisualizer] = createSignal(false);
  const [volume, setVolume] = createSignal(0.8);
  const [shuffle, setShuffle] = createSignal(false);
  const [repeat, setRepeat] = createSignal(false);
  const [sortBy, setSortBy] = createSignal<"artist" | "title" | "date">("date");
  const [searchFilter, setSearchFilter] = createSignal("");
  const [magicSuggestion, setMagicSuggestion] = createSignal<string | null>(null);
  const [audioLoading, setAudioLoading] = createSignal(false);
  const [settingsTab, setSettingsTab] = createSignal<"general" | "api">("general");
  const [openaiStatus, setOpenaiStatus] = createSignal<OpenAIKeyStatus | null>(null);
  const [mbStatus, setMbStatus] = createSignal<MusicBrainzCredentialsStatus | null>(null);
  const [allowExplicit, setAllowExplicit] = createSignal(false);
  const [openaiInput, setOpenaiInput] = createSignal("");
  const [mbUser, setMbUser] = createSignal("");
  const [mbPass, setMbPass] = createSignal("");
  let audioRef: HTMLAudioElement | undefined;
  let audioContext: AudioContext | undefined;
  let sourceNode: MediaElementAudioSourceNode | undefined;
  let noticeTimer: number | undefined;
  let autoplayInFlight = false;

  const showNotice = (kind: NoticeKind, message: string, timeoutMs = 4500) => {
    setNotice({ kind, message });
    clearTimeout(noticeTimer);
    if (timeoutMs > 0) {
      noticeTimer = window.setTimeout(() => setNotice(null), timeoutMs);
    }
  };

  const formatDuration = (seconds: number | null | undefined) => {
    if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return "";
    const s = Math.floor(seconds);
    const mins = Math.floor(s / 60);
    const rem = s % 60;
    return `${mins}:${String(rem).padStart(2, "0")}`;
  };

  const socialSourcesCsv = () => {
    const sources: string[] = [];
    if (socialInstagram()) sources.push("instagram");
    if (socialTiktok()) sources.push("tiktok");
    if (socialFacebook()) sources.push("facebook");
    return sources.length ? sources.join(",") : null;
  };


  const refreshLibrary = async () => {
    try {
      setSongs(await api.libraryList());
    } catch (e) {
      setError(String(e));
    }
  };

  const refreshJobs = async () => {
    try {
      const [active, history] = await Promise.all([api.jobsActive(), api.jobsHistory()]);
      setActiveJobs(active);
      setHistoryJobs(history);
    } catch (e) {
      setError(String(e));
    }
  };

  const refreshSettings = async () => {
    try {
      const [gemini, genius, openai, mb, mode, modelData, ytdlp, worker] = await Promise.all([
        api.settingsGeminiGet(),
        api.settingsGeniusGet(),
        api.settingsOpenaiGet(),
        api.settingsMusicbrainzGet(),
        api.settingsLyricsModeGet(),
        api.settingsModelsGet(),
        api.systemYtdlpStatus(),
        api.systemWorkerStatus(),
      ]);
      setGeminiStatus(gemini);
      setGeniusStatus(genius);
      setOpenaiStatus(openai);
      setMbStatus(mb);
      setStrictLrc(mode.strict_lrc);
      setAllowExplicit(mode.allow_explicit);
      setModels(modelData.models);
      setSelectedModel(modelData.selected);
      setYtdlpStatus(ytdlp);
      setWorkerStatus(worker);
    } catch (e) {
      setError(String(e));
    }
  };

  const refreshAll = async () => {
    await Promise.all([refreshLibrary(), refreshJobs(), refreshSettings()]);
  };

  const search = async () => {
    if (!searchQuery().trim()) {
      setSearchResults([]);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const platform = searchPlatform();
      const sources = platform === "social" ? socialSourcesCsv() : null;
      if (platform === "social" && !sources) {
        setError("Select at least one social provider (TikTok / Instagram / Facebook).");
        return;
      }
      const results = await api.searchMusic(searchQuery().trim(), platform, sources);
      setSearchResults(
        results.map((result) => ({
          id: result.id,
          title: result.title,
          artist: result.artist ?? result.uploader ?? "Unknown",
          thumbnail: result.thumbnail,
          duration: result.duration,
          url: result.url,
          platform: result.platform,
        })),
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const submitIngest = async () => {
    const url = ingestUrl().trim();
    if (!url) return;
    setBusy(true);
    setError(null);
    try {
      await api.ingestStart(url);
      setIngestUrl("");
      setTab("jobs");
      await refreshJobs();
      const preview = url.length > 52 ? `${url.slice(0, 52)}…` : url;
      showNotice("success", `Transfer queued: ${preview}`);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const extractSongIds = (data: Record<string, unknown>): number[] => {
    const raw = (data as { song_ids?: unknown }).song_ids;
    if (!Array.isArray(raw)) return [];
    const out: number[] = [];
    for (const value of raw) {
      if (typeof value === "number" && Number.isFinite(value)) out.push(value);
      if (typeof value === "string") {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) out.push(parsed);
      }
    }
    return out;
  };

  const maybeAutoplaySong = async (songId: number) => {
    if (autoplayInFlight) return;
    autoplayInFlight = true;
    try {
      const fullSong = await api.songGet(songId);
      if (fullSong.status === "cached" && fullSong.stream_url) {
        setCurrentSong(fullSong);
        setAudioLoading(true);
        if (audioContext?.state === "suspended") {
          void audioContext.resume();
        }
        setPlaying(true);
        setPendingAutoplaySongId(null);
        showNotice("success", `Now playing: ${fullSong.title}`);
      }
    } catch (e) {
      setError(String(e));
      setPendingAutoplaySongId(null);
    } finally {
      autoplayInFlight = false;
    }
  };

  const playSong = async (song: SongResponse) => {
    setError(null);
    setAudioLoading(true);
    setPendingAutoplaySongId(null);
    try {
      const fullSong = await api.songGet(song.id);
      setCurrentSong(fullSong);
      if (fullSong.status === "cached" && fullSong.stream_url) {
        if (audioContext?.state === "suspended") {
          void audioContext.resume();
        }
        setPlaying(true);
        return;
      }

      setPlaying(false);
      setAudioLoading(false);

      if (fullSong.status === "re-downloading") {
        setPendingAutoplaySongId(fullSong.id);
        showNotice("info", "Audio is downloading. LyricVault will auto-play when ready.");
        void refreshJobs();
        return;
      }

      if (fullSong.status === "expired") {
        const sourceUrl = fullSong.source_url ?? song.source_url;
        if (!sourceUrl) {
          setError("Audio is missing and cannot be re-downloaded (source URL unavailable).");
          return;
        }

        setPendingAutoplaySongId(fullSong.id);
        showNotice("info", "Audio expired. Re-downloading now; auto-play will start when cached.");
        await api.ingestStart(sourceUrl, true, fullSong.id);
        void refreshJobs();
        return;
      } else {
        setPlaying(false);
      }
    } catch (e) {
      setError(String(e));
      setAudioLoading(false);
    }
  };

  const retryLyrics = async (songId: number) => {
    setBusy(true);
    try {
      await api.lyricsRetry(songId);
      await refreshJobs();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  let refreshTimer: number | undefined;
  const debouncedRefresh = (type: "job" | "song" | "settings") => {
    clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => {
      if (type === "job") void refreshJobs();
      if (type === "song") void refreshLibrary();
      if (type === "settings") void refreshSettings();
    }, 200);
  };

  const onEvent = (event: EventEnvelope) => {
    if (event.event === "job") debouncedRefresh("job");
    if (event.event === "song") {
      debouncedRefresh("song");
      const pendingId = pendingAutoplaySongId();
      if (pendingId) {
        const ids = extractSongIds(event.data);
        if (ids.includes(pendingId)) {
          void maybeAutoplaySong(pendingId);
        }
      }
    }
    if (event.event === "settings") debouncedRefresh("settings");
  };

  const saveGeminiKey = async () => {
    if (!geminiInput().trim()) return;
    setBusy(true);
    try {
      await api.settingsGeminiSet(geminiInput().trim());
      setGeminiInput("");
      await refreshSettings();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const saveOpenaiKey = async () => {
    if (!openaiInput().trim()) return;
    setBusy(true);
    try {
      await api.settingsOpenaiSet(openaiInput().trim());
      setOpenaiInput("");
      await refreshSettings();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const saveMbCreds = async () => {
    if (!mbUser().trim()) return;
    setBusy(true);
    try {
      await api.settingsMusicbrainzSet(mbUser().trim(), mbPass().trim());
      setMbUser("");
      setMbPass("");
      await refreshSettings();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleLyricsMode = async (strict: boolean, explicit: boolean) => {
    try {
      await api.settingsLyricsModeSet(strict, explicit);
      setStrictLrc(strict);
      setAllowExplicit(explicit);
      showNotice("success", "Preferences saved.");
    } catch (e) {
      setError(String(e));
    }
  };

  const updateModel = async (modelId: string) => {
    try {
      await api.settingsModelsSet(modelId);
      setSelectedModel(modelId);
    } catch (e) {
      setError(String(e));
    }
  };

  const checkClipboard = async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      const supportedPatterns = [
        /youtube\.com\/watch\?v=/, /youtu\.be\//,
        /spotify\.com\/(track|album|playlist)/,
        /soundcloud\.com\//,
        /music\.apple\.com\//,
        /instagram\.com\/(reels|p)\//,
        /facebook\.com\/(watch|stories|reels)/,
        /tiktok\.com\//
      ];

      const isGitHub = /github\.com\//.test(text);
      const isSupported = supportedPatterns.some(p => p.test(text));

      if (isSupported && !isGitHub && text !== ingestUrl()) {
        setMagicSuggestion(text);
      } else {
        setMagicSuggestion(null);
      }
    } catch (e) { }
  };

  const sortedSongs = createMemo(() => {
    let list = songs().filter(s =>
      s.title.toLowerCase().includes(searchFilter().toLowerCase()) ||
      s.artist.toLowerCase().includes(searchFilter().toLowerCase())
    );

    return list.sort((a, b) => {
      if (sortBy() === "artist") return a.artist.localeCompare(b.artist);
      if (sortBy() === "title") return a.title.localeCompare(b.title);
      return b.id - a.id; // Date Added (desc)
    });
  });

  const progressRatio = createMemo(() => {
    const d = duration();
    if (!d || d <= 0) return 0;
    const ratio = position() / d;
    if (!Number.isFinite(ratio)) return 0;
    return Math.min(1, Math.max(0, ratio));
  });

  const getPlaybackList = () => {
    const list = sortedSongs();
    return list.length ? list : songs();
  };

  const pickRandomIndex = (length: number, excludeIndex: number) => {
    if (length <= 1) return 0;
    const exclude = excludeIndex >= 0 && excludeIndex < length ? excludeIndex : 0;
    let idx = exclude;
    for (let tries = 0; tries < 6 && idx === exclude; tries += 1) {
      idx = Math.floor(Math.random() * length);
    }
    if (idx === exclude) {
      idx = (exclude + 1) % length;
    }
    return idx;
  };

  const playNext = async (reason: "manual" | "ended" = "manual") => {
    const list = getPlaybackList();
    const currentId = currentSong()?.id;
    if (!currentId || list.length === 0) return;

    let currentIndex = list.findIndex((s) => s.id === currentId);
    if (currentIndex < 0) currentIndex = 0;

    let nextIndex = 0;
    if (shuffle() && list.length > 1) {
      nextIndex = pickRandomIndex(list.length, currentIndex);
    } else {
      nextIndex = currentIndex + 1;
      if (nextIndex >= list.length) {
        if (repeat()) {
          nextIndex = 0;
        } else {
          setPlaying(false);
          setAudioLoading(false);
          if (reason === "ended") {
            showNotice("info", "End of queue.");
          }
          return;
        }
      }
    }

    await playSong(list[nextIndex]);
  };

  const playPrevious = async () => {
    const list = getPlaybackList();
    const currentId = currentSong()?.id;
    if (!currentId || list.length === 0) return;

    if (audioRef && audioRef.currentTime > 3) {
      audioRef.currentTime = 0;
      return;
    }

    let currentIndex = list.findIndex((s) => s.id === currentId);
    if (currentIndex < 0) currentIndex = 0;

    let prevIndex = 0;
    if (shuffle() && list.length > 1) {
      prevIndex = pickRandomIndex(list.length, currentIndex);
    } else {
      prevIndex = currentIndex - 1;
      if (prevIndex < 0) {
        if (repeat()) {
          prevIndex = list.length - 1;
        } else {
          if (audioRef) audioRef.currentTime = 0;
          return;
        }
      }
    }

    await playSong(list[prevIndex]);
  };

  onMount(() => {
    window.addEventListener("focus", () => void checkClipboard());
    document.addEventListener("mousemove", (e) => {
      const x = (e.clientX / window.innerWidth) * 100;
      const y = (e.clientY / window.innerHeight) * 100;
      document.documentElement.style.setProperty('--mouse-x', `${x}%`);
      document.documentElement.style.setProperty('--mouse-y', `${y}%`);
    });
    void (async () => {
      await refreshAll();
      const unlisten = await subscribeToLyricVaultEvents(onEvent);
      onCleanup(() => unlisten());
    })();

    if (audioRef) {
      audioContext = new AudioContext();
      sourceNode = audioContext.createMediaElementSource(audioRef);
      const analyserNode = audioContext.createAnalyser();
      analyserNode.fftSize = 2048;
      sourceNode.connect(analyserNode);
      analyserNode.connect(audioContext.destination);
      setAnalyser(analyserNode);
      onCleanup(() => {
        sourceNode?.disconnect();
        analyserNode.disconnect();
        void audioContext?.close();
      });
    }

    onCleanup(() => clearTimeout(noticeTimer));
  });

  createEffect(() => {
    const song = currentSong();
    if (!audioRef) return;

    if (song?.stream_url) {
      if (audioRef.src !== song.stream_url) {
        audioRef.src = song.stream_url;
        audioRef.load();
        setAudioLoading(true);
      }
    } else {
      audioRef.removeAttribute("src");
      audioRef.load();
      setAudioLoading(false);
    }
  });

  createEffect(() => {
    if (audioRef) audioRef.volume = volume();
  });

  createEffect(() => {
    const isPlaying = playing();
    if (!audioRef || !currentSong()) return;

    if (isPlaying) {
      if (audioContext?.state === "suspended") {
        void audioContext.resume();
      }
      void audioRef.play().catch(() => {
        setPlaying(false);
        setAudioLoading(false);
      });
    } else {
      audioRef.pause();
    }
  });

  const seek = (e: MouseEvent) => {
    if (!audioRef || !duration()) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    audioRef.currentTime = pos * duration();
  };

  return (
    <div class="app-shell">
      <aside class="sidebar">
        <div style="margin-bottom: 3.5rem; padding-left: 0.5rem">
          <h1 style="font-size: 2rem; margin: 0; font-weight: 800; letter-spacing: -0.04em; background: linear-gradient(135deg, #fff 0%, var(--stone-600) 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">LyricVault</h1>
          <p style="font-size: 0.75rem; color: var(--gold-500); font-weight: 800; margin-top: 0.3rem; letter-spacing: 0.05em; text-transform: uppercase; opacity: 0.9">Pre-Alpha.4</p>
        </div>

        <nav class="nav-links">
          <button classList={{ "nav-item": true, active: tab() === "library" }} onClick={() => setTab("library")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 22px"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
            <span>Library</span>
          </button>
          <button classList={{ "nav-item": true, active: tab() === "discover" }} onClick={() => setTab("discover")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 22px"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /><path d="M11 8a3 3 0 0 1 0 6" /></svg>
            <span>Discover</span>
          </button>
          <button classList={{ "nav-item": true, active: tab() === "jobs" }} onClick={() => setTab("jobs")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 22px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
            <span>Transfers</span>
          </button>
          <button classList={{ "nav-item": true, active: tab() === "settings" }} onClick={() => setTab("settings")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 22px"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
            <span>Settings</span>
          </button>
        </nav>
      </aside>

      <main class="app-main">
        <Show when={error()}>
          <div class="notice error">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 20px"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
            {error()}
            <button style="margin-left: auto; padding: 0.2rem 0.5rem" onClick={() => setError(null)}>Dismiss</button>
          </div>
        </Show>
        <Show when={notice()}>
          <div class={`notice ${notice()!.kind}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 20px">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-5" />
              <path d="M12 8h.01" />
            </svg>
            {notice()!.message}
            <button style="margin-left: auto; padding: 0.2rem 0.5rem" onClick={() => setNotice(null)}>Dismiss</button>
          </div>
        </Show>

        <div class="view-content">
          <Show when={tab() === "library"}>
            <header class="view-header">
              <div>
                <h2>Library</h2>
                <div class="sort-bar" style="margin-top: 1rem">
                  <span classList={{ "sort-item": true, active: sortBy() === "date" }} onClick={() => setSortBy("date")}>Recent</span>
                  <span classList={{ "sort-item": true, active: sortBy() === "artist" }} onClick={() => setSortBy("artist")}>Artist</span>
                  <span classList={{ "sort-item": true, active: sortBy() === "title" }} onClick={() => setSortBy("title")}>A-Z</span>
                </div>
              </div>
              <div style="position: relative">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 18px; position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); opacity: 0.4"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                <input
                  type="text"
                  placeholder="Search library..."
                  value={searchFilter()}
                  onInput={(e) => setSearchFilter(e.currentTarget.value)}
                  style="width: 300px; padding-left: 3rem"
                />
              </div>
            </header>

            <div class="song-grid">
                <For each={sortedSongs()}>
                  {(song) => (
                    <article class="song-card" onClick={() => void playSong(song)}>
                      <div class="song-artwork">
                        <Show when={song.cover_url} fallback={<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:var(--stone-700); font-size:3rem">🎵</div>}>
                          <img src={song.cover_url!} />
                        </Show>
                        <div class="status-pill" style="position: absolute; top: 1rem; right: 1rem; background: rgba(0,0,0,0.6); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1)">
                          {song.status === "cached" ? "OFFLINE" : song.status === "re-downloading" ? "DOWNLOADING" : "EXPIRED"}
                        </div>
                        <Show when={song.lyrics_status === "unavailable" || song.lyrics_status === "unsynced"}>
                          <button class="retry-lyrics-btn" onClick={(e) => { e.stopPropagation(); void retryLyrics(song.id); }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 18px"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3L22 8M22 12.5a10 10 0 0 1-18.8 4.3L2 16" /></svg>
                          </button>
                        </Show>
                      </div>
                    <div class="song-card-content">
                      <h3>{song.title}</h3>
                      <p class="artist">{song.artist}</p>
                    </div>
                  </article>
                )}
              </For>
            </div>
          </Show>

          <Show when={tab() === "discover"}>
            <header class="view-header">
              <h2>Discover</h2>
            </header>
            <div
              class="magic-zone"
              classList={{ suggesting: !!magicSuggestion() }}
              onClick={() => magicSuggestion() ? (setIngestUrl(magicSuggestion()!), setMagicSuggestion(null), void submitIngest()) : null}
            >
              <div class="pulse-icon">
                <Show when={magicSuggestion()} fallback={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 32px">
                    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                  </svg>
                }>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 36px">
                    <path d="m13 2-2 2.5h3L12 7h3l-4 5m1 2 7-7m-7 7-2 8 4-8-4 8" />
                    <circle cx="12" cy="12" r="10" stroke-opacity="0.2" />
                  </svg>
                </Show>
              </div>
              <div style="z-index: 1">
                <h3 style="font-size: 1.5rem; margin: 0; font-weight: 800">{magicSuggestion() ? "Magic Link Detected" : "Drop URL or Copy Link"}</h3>
                <p style="margin-top: 0.5rem; opacity: 0.6; max-width: 400px">
                  {magicSuggestion() ? `Instantly ingest: ${magicSuggestion()}` : "LyricVault monitors your clipboard for music links from YouTube, Spotify, and more."}
                </p>
              </div>
            </div>

            <div class="panel" style="margin-top: 2rem">
              <div style="display: flex; gap: 1rem; margin-bottom: 2rem">
                <input
                  type="text"
                  placeholder="Paste URL (YouTube, Spotify, etc)..."
                  value={ingestUrl()}
                  onInput={(e) => setIngestUrl(e.currentTarget.value)}
                  style="flex: 1"
                />
                <button class="primary" onClick={() => void submitIngest()} disabled={busy()}>Ingest</button>
              </div>

              <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem">
                <input
                  type="text"
                  placeholder="Search music..."
                  value={searchQuery()}
                  onInput={(e) => setSearchQuery(e.currentTarget.value)}
                  style="flex: 1"
                />
                <select value={searchPlatform()} onInput={(e) => setSearchPlatform(e.currentTarget.value)}>
                  <option value="youtube">YouTube</option>
                  <option value="spotify">Spotify</option>
                  <option value="soundcloud">Soundcloud</option>
                  <option value="social">Social Media</option>
                </select>
                <button onClick={() => void search()} disabled={busy()}>Search</button>
              </div>

              <Show when={searchPlatform() === "social"}>
                <div class="social-sources">
                  <span class="social-label">Social Sources:</span>
                  <label>
                    <input type="checkbox" checked={socialTiktok()} onChange={(e) => setSocialTiktok(e.currentTarget.checked)} />
                    TikTok
                  </label>
                  <label>
                    <input type="checkbox" checked={socialInstagram()} onChange={(e) => setSocialInstagram(e.currentTarget.checked)} />
                    Instagram
                  </label>
                  <label>
                    <input type="checkbox" checked={socialFacebook()} onChange={(e) => setSocialFacebook(e.currentTarget.checked)} />
                    Facebook
                  </label>
                </div>
              </Show>

              <div class="song-grid">
                <For each={searchResults()}>
                  {(res) => (
                    <article class="song-card" style="min-height: auto" onClick={() => (setIngestUrl(res.url), void submitIngest())}>
                      <div class="song-artwork" style={{ "aspect-ratio": "16 / 9" }}>
                        <Show when={res.thumbnail} fallback={<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:var(--stone-700); font-size:2.25rem">🔎</div>}>
                          <img src={res.thumbnail!} />
                        </Show>
                      </div>
                      <div class="song-card-content">
                        <div style="display:flex; align-items:center; justify-content:space-between; gap: 0.75rem; margin-bottom: 0.5rem">
                          <div class="status-pill">{res.platform}</div>
                          <Show when={res.duration != null}>
                            <div class="duration-pill">{formatDuration(res.duration ?? null)}</div>
                          </Show>
                        </div>
                        <h3>{res.title}</h3>
                        <p class="artist">{res.artist}</p>
                      </div>
                    </article>
                  )}
                </For>
              </div>
            </div>
          </Show>

          <Show when={tab() === "jobs"}>
            <header class="view-header">
              <h2>Transfers</h2>
            </header>
            <div class="panel">
              <For each={activeJobs()} fallback={<p style="text-align: center; color: var(--slate-400); padding: 2rem">No active transfers</p>}>
                {(job) => (
                  <div class="transfer-item">
                    <div style="display: flex; justify-content: space-between; align-items: center">
                      <div>
                        <h4 style="margin: 0">{job.title || "Processing..."}</h4>
                        <p style="margin: 0.2rem 0 0; font-size: 0.8rem; color: var(--gold-500)">{job.type.toUpperCase()}</p>
                      </div>
                      <span class="status-pill">{job.status}</span>
                    </div>
                    <div class="progress-track">
                      <div class="progress-fill-active" style={{ width: `${job.progress || 0}%` }}></div>
                    </div>
                  </div>
                )}
              </For>
            </div>

            <h3 style="margin-top: 3rem; margin-bottom: 1.5rem">History</h3>
            <div class="panel" style="background: transparent; border: none; padding: 0">
              <For each={historyJobs()} fallback={<p style="padding: 2rem; color: var(--stone-600)">History is empty</p>}>
                {(job) => (
                  <div style="padding: 1.25rem; background: var(--stone-900); border: 1px solid var(--border); border-radius: 18px; margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center">
                    <div>
                      <span class="status-pill" style="font-size: 0.6rem; margin-bottom: 0.5rem; display: inline-block; color: var(--gold-500)">{job.type.toUpperCase()}</span>
                      <h4 style="margin: 0; font-weight: 600">{job.title || "Unknown Task"}</h4>
                    </div>
                    <div style="text-align: right">
                      <span style={{
                        padding: "0.4rem 0.8rem",
                        "border-radius": "10px",
                        "font-size": "0.75rem",
                        "font-weight": "700",
                        background: job.status === "completed" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                        color: job.status === "completed" ? "#4ade80" : "#f87171"
                      }}>
                        {job.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>

          <Show when={tab() === "settings"}>
            <header class="view-header">
              <h2>Settings</h2>
            </header>

            <nav class="settings-nav">
              <span classList={{ "settings-nav-item": true, active: settingsTab() === "general" }} onClick={() => setSettingsTab("general")}>General</span>
              <span classList={{ "settings-nav-item": true, active: settingsTab() === "api" }} onClick={() => setSettingsTab("api")}>API Connections</span>
            </nav>

            <div class="settings-content">
              <Show when={settingsTab() === "general"}>
                <div class="api-connection-grid">
                  <div class="api-card">
                    <h3>Library Preferences</h3>
                    <div style="display: flex; flex-direction: column; gap: 1.25rem">
                      <label style="display: flex; align-items: center; gap: 1rem; cursor: pointer">
                        <input type="checkbox" checked={strictLrc()} onChange={(e) => void toggleLyricsMode(e.currentTarget.checked, allowExplicit())} />
                        <span style="font-size: 0.95rem; font-weight: 500">Strict LRC Matching (Hide unsynced)</span>
                      </label>
                      <label style="display: flex; align-items: center; gap: 1rem; cursor: pointer">
                        <input type="checkbox" checked={allowExplicit()} onChange={(e) => void toggleLyricsMode(strictLrc(), e.currentTarget.checked)} />
                        <span style="font-size: 0.95rem; font-weight: 500">Allow Explicit Lyrics (Artist Vision)</span>
                      </label>
                    </div>
                  </div>

                  <div class="api-card">
                    <h3>AI Generation Model</h3>
                    <div style="display: flex; flex-direction: column; gap: 1rem">
                      <select
                        value={selectedModel()}
                        onChange={(e) => void updateModel(e.currentTarget.value)}
                        style="width: 100%"
                      >
                        <For each={models()}>
                          {(m) => <option value={m.id}>{m.name}</option>}
                        </For>
                      </select>
                      <p style="font-size: 0.85rem; color: var(--stone-100); opacity: 0.5; margin: 0">{models().find(m => m.id === selectedModel())?.description}</p>
                    </div>
                  </div>

                  <div class="api-card">
                    <h3>System Status</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem">
                      <div>
                        <p style="font-size: 0.75rem; font-weight: 800; color: #555; margin-bottom: 0.75rem; letter-spacing: 0.05em">BACKEND WORKER</p>
                        <span style={{
                          padding: "0.5rem 1rem",
                          "border-radius": "100px",
                          "font-size": "0.75rem",
                          "font-weight": "800",
                          background: workerStatus()?.running ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                          color: workerStatus()?.running ? "#4ade80" : "#f87171",
                          border: workerStatus()?.running ? "1px solid rgba(34,197,94,0.2)" : "1px solid rgba(239,68,68,0.2)"
                        }}>
                          {workerStatus()?.running ? "PULSING" : "STALLED"}
                        </span>
                      </div>
                      <div>
                        <p style="font-size: 0.75rem; font-weight: 800; color: #555; margin-bottom: 0.75rem; letter-spacing: 0.05em">YT-DLP BINARY</p>
                        <span style={{
                          padding: "0.5rem 1rem",
                          "border-radius": "100px",
                          "font-size": "0.75rem",
                          "font-weight": "800",
                          background: ytdlpStatus()?.version ? "rgba(255,255,255,0.05)" : "rgba(239,68,68,0.1)",
                          color: ytdlpStatus()?.version ? "#fff" : "#f87171",
                          border: "1px solid var(--glass-border)"
                        }}>
                          {ytdlpStatus()?.version || "NOT FOUND"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Show>

              <Show when={settingsTab() === "api"}>
                <div class="api-connection-grid">
                  <div class="api-card">
                    <div class="api-card-header">
                      <div class="api-card-title">Gemini AI</div>
                      <div class="api-indicator" classList={{ active: geminiStatus()?.configured }}></div>
                    </div>
                    <div style="display: flex; gap: 0.75rem">
                      <input type="password" placeholder="Enter Gemini Key" value={geminiInput()} onInput={(e) => setGeminiInput(e.currentTarget.value)} style="flex: 1" />
                      <button class="primary" onClick={() => void saveGeminiKey()} style="padding: 0 1.5rem">Save</button>
                    </div>
                    <Show when={geminiStatus()?.masked_key}>
                      <p style="font-size: 0.8rem; opacity: 0.4; margin: 0">Stored: <code style="color: var(--gold-400)">{geminiStatus()?.masked_key}</code></p>
                    </Show>
                  </div>

                  <div class="api-card">
                    <div class="api-card-header">
                      <div class="api-card-title">OpenAI</div>
                      <div class="api-indicator" classList={{ active: openaiStatus()?.configured }}></div>
                    </div>
                    <div style="display: flex; gap: 0.75rem">
                      <input type="password" placeholder="Enter OpenAI Key" value={openaiInput()} onInput={(e) => setOpenaiInput(e.currentTarget.value)} style="flex: 1" />
                      <button class="primary" onClick={() => void saveOpenaiKey()} style="padding: 0 1.5rem">Save</button>
                    </div>
                    <Show when={openaiStatus()?.masked_key}>
                      <p style="font-size: 0.8rem; opacity: 0.4; margin: 0">Stored: <code style="color: var(--gold-400)">{openaiStatus()?.masked_key}</code></p>
                    </Show>
                  </div>

                  <div class="api-card">
                    <div class="api-card-header">
                      <div class="api-card-title">Genius</div>
                      <div class="api-indicator" classList={{ active: geniusStatus()?.configured }}></div>
                    </div>
                    <p style="font-size: 0.85rem; opacity: 0.6; line-height: 1.6; margin: 0">
                      Standard for high-fidelity song metadata. Configuration required for automated lyric deep-search.
                    </p>
                    <Show when={!geniusStatus()?.configured}>
                      <button onClick={() => window.open('https://genius.com/api-clients', '_blank')} style="background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); padding: 0.75rem; border-radius: 12px; font-size: 0.8rem; cursor: pointer">Get API Credentials</button>
                    </Show>
                  </div>

                  <div class="api-card">
                    <div class="api-card-header">
                      <div class="api-card-title">MusicBrainz</div>
                      <div class="api-indicator" classList={{ active: mbStatus()?.configured }}></div>
                    </div>
                    <div style="display: flex; gap: 0.75rem">
                      <input type="text" placeholder="Username" value={mbUser()} onInput={(e) => setMbUser(e.currentTarget.value)} style="flex: 1" />
                      <input type="password" placeholder="Password" value={mbPass()} onInput={(e) => setMbPass(e.currentTarget.value)} style="flex: 1" />
                    </div>
                    <button class="primary" onClick={() => void saveMbCreds()}>Link account</button>
                  </div>
                </div>
              </Show>
            </div>
          </Show>
        </div>
      </main>

      <footer class="player-bar">
        <div class="player-left">
          <Show when={currentSong()} fallback={
            <div class="player-meta">
              <h3 class="song-title">Nothing Playing</h3>
              <p class="song-artist">Select a track</p>
            </div>
          }>
            <div style="width: 56px; height: 56px; border-radius: 12px; background: var(--stone-900); overflow: hidden; border: 1px solid var(--glass-border); flex-shrink: 0">
              <img src={currentSong()?.cover_url || ""} style="width:100%; height:100%; object-fit:cover" />
            </div>
            <div class="player-meta">
              <h3 class="song-title">{currentSong()?.title}</h3>
              <p class="song-artist">{currentSong()?.artist}</p>
            </div>
          </Show>
        </div>

        <div class="player-center">
          <div class="player-controls">
            <button class="icon-btn" classList={{ active: shuffle() }} onClick={() => setShuffle(!shuffle())}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 20px"><polyline points="16 3 21 3 21 8" /><line x1="4" x2="21" y1="20" y2="3" /><polyline points="21 16 21 21 16 21" /><line x1="15" x2="21" y1="15" y2="21" /><line x1="4" x2="9" y1="4" y2="9" /></svg>
            </button>
            <button class="icon-btn" title="Previous" disabled={!currentSong()} onClick={() => void playPrevious()}>
              <svg viewBox="0 0 24 24" fill="currentColor" style="width: 20px">
                <path d="M6 6h2v12H6zM9 12l9-6v12z" />
              </svg>
            </button>
            <button class="play-pause-btn" onClick={() => setPlaying(!playing())}>
              <svg viewBox="0 0 24 24" fill="currentColor" style="width: 24px; height: 24px; position: relative; z-index: 1">
                <Show when={playing()} fallback={<path d="M8 5v14l11-7z" />}>
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </Show>
              </svg>
              <svg class="playing-ring" classList={{ loading: audioLoading() }} viewBox="0 0 62 62">
                <circle cx="31" cy="31" r="30" style={{ "stroke-dashoffset": audioLoading() ? "100" : `${220 - progressRatio() * 220}` }} />
              </svg>
            </button>
            <button class="icon-btn" title="Next" disabled={!currentSong()} onClick={() => void playNext("manual")}>
              <svg viewBox="0 0 24 24" fill="currentColor" style="width: 20px">
                <path d="M16 6h2v12h-2zM6 6l9 6-9 6z" />
              </svg>
            </button>
            <button class="icon-btn" classList={{ active: repeat() }} onClick={() => setRepeat(!repeat())}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 20px"><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>
            </button>
          </div>

          <div class="progress-container">
            <span>{Math.floor(position() / 60)}:{String(Math.floor(position() % 60)).padStart(2, '0')}</span>
            <div class="progress-bar" onClick={seek}>
              <div class="progress-fill" style={{ width: `${progressRatio() * 100}%` }}></div>
            </div>
            <span>{Math.floor(duration() / 60)}:{String(Math.floor(duration() % 60)).padStart(2, '0')}</span>
          </div>
        </div>

        <div class="player-right">
          <div class="volume-container">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 20px"><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>
            <input type="range" class="volume-slider" min="0" max="1" step="0.01" value={volume()} onInput={(e) => setVolume(parseFloat(e.currentTarget.value))} />
          </div>
          <button class="icon-btn" title="Visualizer" classList={{ active: showVisualizer() }} onClick={() => setShowVisualizer(!showVisualizer())}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 20px"><path d="M12 20v-8M6 20V4M18 20v-4M3 20h18" /></svg>
          </button>
        </div>
      </footer>

      <VisualizerDeck
        analyser={analyser()}
        isPlaying={playing()}
        open={showVisualizer()}
        title={currentSong()?.title}
        artist={currentSong()?.artist}
        onClose={() => setShowVisualizer(false)}
      />

      <audio
        ref={audioRef}
        onTimeUpdate={() => setPosition(audioRef?.currentTime || 0)}
        onDurationChange={() => setDuration(audioRef?.duration || 0)}
        onEnded={() => void playNext("ended")}
        onCanPlay={() => setAudioLoading(false)}
        onWaiting={() => setAudioLoading(true)}
      />
    </div>
  );
}
