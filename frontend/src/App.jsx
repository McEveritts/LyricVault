import React, { useState } from 'react';
import API_BASE from './config/api';
import MagicPaste from './components/MagicPaste';
import LibraryGrid from './components/LibraryGrid';
import Player from './components/Player';
import LyricsOverlay from './components/LyricsOverlay';
import Sidebar from './components/Sidebar';
import ActivityView from './components/ActivityView';
import ProcessingView from './components/ProcessingView';
import SettingsView from './components/SettingsView';
import SongDetailView from './components/SongDetailView';
import DiscoveryView from './components/DiscoveryView';

export default function App() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState('home');
  const [rehydratingSongIds, setRehydratingSongIds] = useState([]);

  // Player State
  const [currentSong, setCurrentSong] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [queue, setQueue] = useState([]);
  const [playbackHistory, setPlaybackHistory] = useState([]);
  const [repeatMode, setRepeatMode] = useState('off'); // 'off', 'all', 'one'
  const [shuffleMode, setShuffleMode] = useState(false);

  // Audio Context / Visualizer State
  const [analyser, setAnalyser] = useState(null);
  const audioContextRef = React.useRef(null);
  const audioRef = React.useRef(null);
  const sourceRef = React.useRef(null);

  // View State
  const [viewedSong, setViewedSong] = useState(null);
  const [showLyrics, setShowLyrics] = useState(false); // Overlay lyrics

  // Web Audio API Setup
  React.useEffect(() => {
    if (isPlaying && !audioContextRef.current && audioRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const context = new AudioContext();
      const analyserNode = context.createAnalyser();
      analyserNode.fftSize = 256;

      const source = context.createMediaElementSource(audioRef.current);
      source.connect(analyserNode);
      analyserNode.connect(context.destination);

      audioContextRef.current = context;
      sourceRef.current = source;
      setAnalyser(analyserNode);
    }

    if (isPlaying && audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume();
    }
  }, [isPlaying]);

  const handleIngestSuccess = () => {
    setRefreshKey(prev => prev + 1);
  };

  const markRehydrating = (songId) => {
    if (!songId) return;
    setRehydratingSongIds(prev => (prev.includes(songId) ? prev : [...prev, songId]));
  };

  const clearRehydrating = (songId) => {
    setRehydratingSongIds(prev => prev.filter(id => id !== songId));
  };

  const requestRehydrate = async (song) => {
    if (!song?.source_url) return false;
    markRehydrating(song.id);

    try {
      const response = await fetch(`${API_BASE}/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: song.source_url,
          rehydrate: true,
          song_id: song.id,
        }),
      });
      if (!response.ok) {
        throw new Error(`Rehydration request failed (${response.status})`);
      }
      setRefreshKey(prev => prev + 1);
      return true;
    } catch (error) {
      console.error('Failed to request audio rehydration:', error);
      clearRehydrating(song.id);
      return false;
    }
  };

  const fetchSongDetails = async (song, signal) => {
    try {
      const response = await fetch(`${API_BASE}/song/${song.id}`, { signal });
      if (response.ok) {
        const data = await response.json();
        if (data.status === 're-downloading') {
          markRehydrating(data.id);
        }
        return data;
      }
    } catch (error) {
      if (error.name === 'AbortError') return null;
      console.error("Failed to fetch song details:", error);
    }
    return song;
  };

  const handlePlaySong = async (song, options = {}) => {
    const { addCurrentToHistory = true } = options;
    const previousSong = currentSong;

    // Race condition protection
    if (window._abortController) {
      window._abortController.abort();
    }
    window._abortController = new AbortController();

    const fullSong = await fetchSongDetails(song, window._abortController.signal);
    if (!fullSong) return;

    if (addCurrentToHistory && previousSong?.id && previousSong.id !== fullSong.id) {
      setPlaybackHistory(prev => [...prev, previousSong].slice(-100));
    }

    if (fullSong.status === 'cached' && fullSong.stream_url) {
      clearRehydrating(fullSong.id);
      setCurrentSong(fullSong);
      setIsPlaying(true);
      return;
    }

    if (fullSong.status === 'expired') {
      await requestRehydrate(fullSong);
    } else if (fullSong.status === 're-downloading') {
      markRehydrating(fullSong.id);
    }

    setCurrentSong({
      ...fullSong,
      status: fullSong.status === 'cached' ? 'cached' : (fullSong.source_url ? 're-downloading' : 'expired'),
      stream_url: fullSong.stream_url || '',
    });
    setIsPlaying(false);
  };

  const handleViewSong = async (song) => {
    const fullSong = await fetchSongDetails(song);
    if (fullSong?.status === 're-downloading') {
      markRehydrating(fullSong.id);
    }
    setViewedSong(fullSong);
    setActiveTab('song-detail');
  };

  const handleStreamError = async (song) => {
    if (!song) return;
    const didQueue = await requestRehydrate(song);
    if (!didQueue) return;
    setCurrentSong(prev => (
      prev && prev.id === song.id
        ? { ...prev, status: 're-downloading', stream_url: '' }
        : prev
    ));
    setIsPlaying(false);
  };

  React.useEffect(() => {
    if (rehydratingSongIds.length === 0) return undefined;

    const interval = setInterval(async () => {
      const pendingIds = [...rehydratingSongIds];
      for (const songId of pendingIds) {
        try {
          const response = await fetch(`${API_BASE}/song/${songId}`);
          if (!response.ok) continue;
          const song = await response.json();
          if (song.status === 'cached' && song.stream_url) {
            setRehydratingSongIds(prev => prev.filter(id => id !== songId));
            setRefreshKey(prev => prev + 1);
            setViewedSong(prev => (prev?.id === song.id ? song : prev));
            setCurrentSong(prev => {
              if (prev?.id !== song.id) return prev;
              return song;
            });
            if (currentSong?.id === song.id) {
              setIsPlaying(true);
            }
          } else if (song.status === 'expired') {
            setRehydratingSongIds(prev => prev.filter(id => id !== songId));
          }
        } catch (error) {
          console.error('Polling rehydration status failed:', error);
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [rehydratingSongIds, currentSong?.id]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (time) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const restartCurrentSong = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
    setCurrentTime(0);
    setIsPlaying(true);
  };

  const handleNext = (reason = 'manual') => {
    if (!currentSong) return;

    if (reason === 'ended' && repeatMode === 'one') {
      restartCurrentSong();
      return;
    }

    if (queue.length > 0) {
      const nextIndex = shuffleMode ? Math.floor(Math.random() * queue.length) : 0;
      const nextSong = queue[nextIndex];
      setQueue(prev => prev.filter((_, index) => index !== nextIndex));
      handlePlaySong(nextSong, { addCurrentToHistory: true });
      return;
    }

    if (repeatMode === 'one' || repeatMode === 'all') {
      restartCurrentSong();
      return;
    }

    setIsPlaying(false);
  };

  const handlePrevious = () => {
    if (!currentSong) return;

    if (audioRef.current && audioRef.current.currentTime > 3) {
      restartCurrentSong();
      return;
    }

    if (playbackHistory.length > 0) {
      const previousSong = playbackHistory[playbackHistory.length - 1];
      setPlaybackHistory(prev => prev.slice(0, -1));
      handlePlaySong(previousSong, { addCurrentToHistory: false });
      return;
    }

    restartCurrentSong();
  };

  const handleQueueNext = (song) => {
    setQueue(prev => {
      const deduped = prev.filter(item => item.id !== song.id);
      return [song, ...deduped];
    });
  };

  const handleAddToQueue = (song) => {
    setQueue(prev => [...prev, song]);
  };

  const handleSongDetailPlayPause = () => {
    if (viewedSong?.id === currentSong?.id) {
      handlePlayPause();
    } else if (viewedSong) {
      handlePlaySong(viewedSong);
    }
  };

  const handleSongUpdated = (updatedSong) => {
    setViewedSong(prev => (prev?.id === updatedSong.id ? updatedSong : prev));
    setCurrentSong(prev => (prev?.id === updatedSong.id ? updatedSong : prev));
    setRefreshKey(prev => prev + 1);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <>
            <header className="px-8 py-6 border-b border-google-surface-high sticky top-0 z-30 bg-google-bg/95 backdrop-blur-md">
              <div className="max-w-6xl mx-auto flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-normal text-google-text tracking-tight">Welcome Home</h2>
                  <p className="text-google-text-secondary text-sm mt-1">Your personal music sanctuary.</p>
                </div>
              </div>
            </header>
            <main className="max-w-6xl mx-auto py-10 px-8 space-y-12">
              <MagicPaste onIngestSuccess={handleIngestSuccess} />
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <h2 className="text-xl font-medium text-google-text">Recent Additions</h2>
                  <div className="h-px flex-1 bg-google-surface-high"></div>
                </div>
                <LibraryGrid
                  refreshTrigger={refreshKey}
                  rehydratingSongIds={rehydratingSongIds}
                  onPlay={handlePlaySong}
                  onView={handleViewSong}
                  onQueueNext={handleQueueNext}
                  onAddToQueue={handleAddToQueue}
                />
              </div>
            </main>
          </>
        );
      case 'library':
        return (
          <>
            <header className="px-8 py-6 border-b border-google-surface-high sticky top-0 z-30 bg-google-bg/95 backdrop-blur-md">
              <h2 className="text-3xl font-normal text-google-text tracking-tight">Your Library</h2>
            </header>
            <main className="max-w-6xl mx-auto py-8 px-8">
              <LibraryGrid
                refreshTrigger={refreshKey}
                rehydratingSongIds={rehydratingSongIds}
                onPlay={handlePlaySong}
                onView={handleViewSong}
                onQueueNext={handleQueueNext}
                onAddToQueue={handleAddToQueue}
              />
            </main>
          </>
        );
      case 'song-detail':
        return (
          <SongDetailView
            song={viewedSong}
            isPlaying={isPlaying && currentSong?.id === viewedSong?.id}
            onPlayPause={handleSongDetailPlayPause}
            onSongUpdated={handleSongUpdated}
            currentTime={currentSong?.id === viewedSong?.id ? currentTime : 0}
            analyser={analyser}
          />
        );
      case 'activity':
        return <ActivityView />;
      case 'processing':
        return <ProcessingView />;
      case 'settings':
        return <SettingsView />;
      case 'discover':
        return (
          <DiscoveryView
            onIngest={handleIngestSuccess}
            onQueueNext={handleQueueNext}
            onAddToQueue={handleAddToQueue}
          />
        );
      case 'playlists':
        return (
          <div className="flex items-center justify-center h-full text-google-text-secondary flex-col gap-4">
            <div className="w-16 h-16 rounded-3xl bg-google-surface border border-google-surface-high flex items-center justify-center">
              <span className="text-2xl opacity-50">🚧</span>
            </div>
            <h2 className="text-xl font-medium text-google-text capitalize">{activeTab}</h2>
            <p>This feature is coming soon to LyricVault Pro.</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen bg-google-bg font-sans text-google-text selection:bg-google-gold/30 selection:text-google-gold overflow-hidden">
      {/* Background Subtle Glow - Pixel Style */}
      <div className="fixed top-0 left-1/4 w-[800px] h-[800px] bg-google-gold/5 rounded-full blur-[128px] pointer-events-none z-0 opacity-20 animate-pulse-slow"></div>
      <div className="fixed bottom-0 right-1/4 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-[128px] pointer-events-none z-0 opacity-20 animate-float"></div>

      {/* Sidebar */}
      <Sidebar activeTab={activeTab === 'song-detail' ? 'library' : activeTab} onTabChange={setActiveTab} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative z-10 w-full">
        <div className="flex-1 overflow-y-auto pb-32 scroll-smooth w-full">
          {renderContent()}
        </div>
      </div>

      <Player
        currentSong={currentSong}
        isPlaying={isPlaying}
        onPlayPause={handlePlayPause}
        onNext={handleNext}
        onPrevious={handlePrevious}
        onStreamError={handleStreamError}
        volume={volume}
        onVolumeChange={setVolume}
        currentTime={currentTime}
        duration={duration}
        onTimeUpdate={(curr, dur) => {
          setCurrentTime(curr);
          setDuration(dur);
        }}
        onEnded={() => handleNext('ended')}
        onLyricsClick={() => setShowLyrics(true)}
        onSeek={handleSeek}
        analyser={analyser}
        audioRef={audioRef}
        queue={queue}
        setQueue={setQueue}
        shuffleMode={shuffleMode}
        setShuffleMode={setShuffleMode}
        repeatMode={repeatMode}
        setRepeatMode={setRepeatMode}
      />
      {rehydratingSongIds.length > 0 && (
        <div className="fixed top-6 right-6 z-[60] bg-google-surface/95 border border-google-surface-high rounded-2xl px-4 py-3 shadow-2xl backdrop-blur-md flex items-center gap-3">
          <span className="w-4 h-4 border-2 border-google-gold/40 border-t-google-gold rounded-full animate-spin"></span>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-google-text">Preparing Audio...</span>
            <span className="text-[11px] text-google-text-secondary">
              {rehydratingSongIds.length} track{rehydratingSongIds.length === 1 ? '' : 's'} in queue
            </span>
          </div>
        </div>
      )}
      <LyricsOverlay
        key={`${currentSong?.id ?? 'no-song'}-${showLyrics ? 'open' : 'closed'}`}
        song={currentSong}
        isOpen={showLyrics}
        onClose={() => setShowLyrics(false)}
        currentTime={currentTime}
      />
    </div>
  );
}
