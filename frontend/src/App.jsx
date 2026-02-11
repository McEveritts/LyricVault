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

  // Player State
  const [currentSong, setCurrentSong] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // View State
  const [viewedSong, setViewedSong] = useState(null);
  const [showLyrics, setShowLyrics] = useState(false); // Overlay lyrics

  const handleIngestSuccess = () => {
    setRefreshKey(prev => prev + 1);
  };

  const fetchSongDetails = async (song) => {
    try {
      const response = await fetch(`${API_BASE}/song/${song.id}`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error("Failed to fetch song details:", error);
    }
    return song;
  };

  const handlePlaySong = async (song) => {
    const fullSong = await fetchSongDetails(song);
    setCurrentSong(fullSong);
    setIsPlaying(true);
  };

  const handleViewSong = async (song) => {
    const fullSong = await fetchSongDetails(song);
    setViewedSong(fullSong);
    setActiveTab('song-detail');
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleSongDetailPlayPause = () => {
    if (viewedSong?.id === currentSong?.id) {
      handlePlayPause();
    } else if (viewedSong) {
      handlePlaySong(viewedSong);
    }
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
                  onPlay={handlePlaySong}
                  onView={handleViewSong}
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
                onPlay={handlePlaySong}
                onView={handleViewSong}
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
            currentTime={currentSong?.id === viewedSong?.id ? currentTime : 0}
          />
        );
      case 'activity':
        return <ActivityView />;
      case 'processing':
        return <ProcessingView />;
      case 'settings':
        return <SettingsView />;
      case 'discover':
        return <DiscoveryView onIngest={handleIngestSuccess} />;
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
        volume={volume}
        onVolumeChange={setVolume}
        currentTime={currentTime}
        duration={duration}
        onTimeUpdate={(curr, dur) => {
          setCurrentTime(curr);
          setDuration(dur);
        }}
        onEnded={() => setIsPlaying(false)}
        onLyricsClick={() => setShowLyrics(true)}
      />
      <LyricsOverlay song={currentSong} isOpen={showLyrics} onClose={() => setShowLyrics(false)} />
    </div>
  );
}


