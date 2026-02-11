import React, { useEffect } from 'react';
import Visualizer from './Visualizer';

const Player = ({
    currentSong,
    isPlaying,
    onPlayPause,
    onNext,
    onPrevious,
    onStreamError,
    volume,
    onVolumeChange,
    onTimeUpdate,
    onEnded,
    onLyricsClick,
    currentTime,
    duration,
    audioRef,
    onSeek,
    queue = [],
    setQueue,
    shuffleMode,
    setShuffleMode,
    repeatMode,
    setRepeatMode,
    analyser
}) => {
    const [showQueue, setShowQueue] = React.useState(false);
    const isPreparingAudio = currentSong?.status === 're-downloading' || currentSong?.status === 'expired';

    // Sync Play/Pause
    useEffect(() => {
        if (currentSong && audioRef.current) {
            const canPlay = currentSong.status === 'cached' && !!currentSong.stream_url;
            if (!canPlay) {
                audioRef.current.pause();
                return;
            }
            if (isPlaying) {
                const playPromise = audioRef.current.play();
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        console.error("Playback failed:", error);
                    });
                }
            } else {
                audioRef.current.pause();
            }
        }
    }, [isPlaying, currentSong, audioRef]);

    // Sync Volume
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = volume;
        }
    }, [volume, audioRef]);

    // Handle Song Change
    useEffect(() => {
        if (currentSong && audioRef.current) {
            if (currentSong.stream_url) {
                audioRef.current.src = currentSong.stream_url;
                audioRef.current.load();
            } else {
                audioRef.current.removeAttribute('src');
                audioRef.current.load();
            }
        }
    }, [currentSong, audioRef]);

    const handleTimeUpdate = () => {
        if (audioRef.current && onTimeUpdate) {
            const current = audioRef.current.currentTime;
            const duration = audioRef.current.duration;
            onTimeUpdate(current, duration);
        }
    };

    const formatTime = (seconds) => {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleProgressClick = (e) => {
        if (!onSeek || !duration) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const clickedProgress = (x / rect.width);
        onSeek(clickedProgress * duration);
    };

    const toggleRepeat = () => {
        const modes = ['off', 'all', 'one'];
        const nextIndex = (modes.indexOf(repeatMode) + 1) % modes.length;
        setRepeatMode(modes[nextIndex]);
    };

    if (!currentSong) return null;

    // Calculate progress for UI
    const progress = (duration > 0) ? (currentTime / duration) * 100 : 0;

    return (
        <div className="fixed bottom-6 left-6 right-6 z-50 animate-in slide-in-from-bottom-20 duration-500">
            {/* Queue Overlay */}
            {showQueue && (
                <div className="absolute bottom-full mb-4 right-0 w-80 bg-google-surface/95 backdrop-blur-3xl rounded-[2.5rem] border border-white/10 shadow-2xl p-6 animate-in slide-in-from-bottom-4 fade-in duration-300 overflow-hidden max-h-[400px] flex flex-col z-[60]">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-google-text opacity-60">Next Up</h3>
                        <span className="text-[10px] bg-google-gold/10 text-google-gold px-2 py-0.5 rounded-full border border-google-gold/20">{queue.length} Tracks</span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                        {queue.length === 0 ? (
                            <div className="py-10 text-center opacity-30">
                                <span className="text-2xl mb-2 block">💿</span>
                                <p className="text-xs">Queue is empty</p>
                            </div>
                        ) : (
                            queue.map((song, idx) => (
                                <div key={`${song.id}-${idx}`} className="flex items-center gap-3 group/item">
                                    <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-google-surface-high border border-white/5 text-[10px] flex items-center justify-center">
                                        {song.cover_url ? <img src={song.cover_url} className="w-full h-full object-cover" /> : "🎵"}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-google-text truncate">{song.title}</p>
                                        <p className="text-[10px] text-google-text-secondary truncate">{song.artist}</p>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setQueue(prev => prev.filter((_, i) => i !== idx));
                                        }}
                                        className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-500/20 text-google-text-secondary hover:text-red-400 opacity-0 group-hover/item:opacity-100 transition-all font-bold"
                                    >
                                        ×
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
            <div className="max-w-4xl mx-auto bg-google-surface/80 backdrop-blur-3xl rounded-3xl p-3 px-6 shadow-2xl border border-white/5 flex items-center gap-6 overflow-hidden relative">
                {/* Background Visualizer */}
                <div className="absolute inset-0 opacity-20 pointer-events-none">
                    {analyser && <Visualizer analyser={analyser} isPlaying={isPlaying} />}
                </div>

                {/* Simplified Song Info */}
                <div className="flex items-center gap-3 min-w-0 w-1/4 z-10 transition-all">
                    {currentSong.cover_url ? (
                        <div className="w-12 h-12 rounded-xl overflow-hidden shadow-lg flex-shrink-0">
                            <img src={currentSong.cover_url} alt={currentSong.title} className="w-full h-full object-cover" />
                        </div>
                    ) : (
                        <div className="w-12 h-12 bg-google-surface-high rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                            <span className="text-lg">🎵</span>
                        </div>
                    )}
                    <div className="overflow-hidden">
                        <h4 className="text-google-text text-sm font-medium truncate">{currentSong.title}</h4>
                        <p className="text-google-text-secondary text-[10px] truncate">{currentSong.artist}</p>
                    </div>
                </div>

                {/* Main Controls & Progress */}
                <div className="flex flex-col items-center flex-1 gap-1 z-10">
                    <div className="flex items-center gap-6">
                        <button
                            onClick={() => setShuffleMode(!shuffleMode)}
                            className={`transition-colors ${shuffleMode ? 'text-google-gold' : 'text-google-text-secondary/40 hover:text-google-text-secondary'}`}
                            title="Shuffle"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                <path fillRule="evenodd" d="M15.28 9.47a.75.75 0 010 1.06l-2.72 2.72a.75.75 0 11-1.06-1.06l1.44-1.44h-.89a5.5 5.5 0 00-4.48 2.31l-.14.21a.75.75 0 01-1.25-.83l.14-.21a7 7 0 015.73-2.94h.89l-1.44-1.44a.75.75 0 011.06-1.06l2.72 2.72zM4.72 9.47a.75.75 0 000 1.06l2.72 2.72a.75.75 0 101.06-1.06L7.06 10.75h.89a5.5 5.5 0 014.48-2.31l.14-.21a.75.75 0 10-1.25.83l-.14.21a7 7 0 00-5.73 2.94h-.89l1.44 1.44a.75.75 0 00-1.06 1.06L4.72 10.53z" clipRule="evenodd" />
                            </svg>
                        </button>

                        <button
                            onClick={onPrevious}
                            className="text-google-text-secondary hover:text-google-text transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                <path d="M7 10L14 15V5L7 10Z" />
                                <rect x="5" y="5" width="2" height="10" />
                            </svg>
                        </button>

                        <button
                            onClick={() => {
                                if (isPreparingAudio) {
                                    onStreamError?.(currentSong);
                                    return;
                                }
                                onPlayPause?.();
                            }}
                            className="w-10 h-10 bg-google-text text-google-bg rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-md disabled:opacity-60"
                            disabled={!currentSong}
                        >
                            {isPreparingAudio ? (
                                <span className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin"></span>
                            ) : isPlaying ? (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                    <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" clipRule="evenodd" />
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 ml-0.5">
                                    <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                                </svg>
                            )}
                        </button>

                        <button
                            onClick={onNext}
                            className="text-google-text-secondary hover:text-google-text transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                <path d="M13 10L6 15V5L13 10Z" />
                                <rect x="13" y="5" width="2" height="10" />
                            </svg>
                        </button>

                        <button
                            onClick={toggleRepeat}
                            className={`transition-colors relative ${repeatMode !== 'off' ? 'text-google-gold' : 'text-google-text-secondary/40 hover:text-google-text-secondary'}`}
                            title={`Repeat State: ${repeatMode}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                <path fillRule="evenodd" d="M4.755 10.059a.75.75 0 01.27 1.025 8.25 8.25 0 1013.95-1.025.75.75 0 111.295-.754 9.75 9.75 0 11-15.515 1.023.75.75 0 011.025-.27l1.023.27zm1.144-5.26a.75.75 0 01-.27 1.025L4.5 6.348l1.144.524a.75.75 0 01-.524 1.412L3.5 7.636a.75.75 0 01-.365-.638V5.059a.75.75 0 111.5 0v1.071l1.144-1.332a.75.75 0 011.144 0zM19.5 16.364v1.939a.75.75 0 11-1.5 0v-1.071l-1.144 1.332a.75.75 0 11-1.144-1.025l1.129-.524-1.144-.524a.75.75 0 11.524-1.412l1.623.648a.75.75 0 01.365.638z" clipRule="evenodd" />
                            </svg>
                            {repeatMode === 'one' && (
                                <span className="absolute -top-1 -right-1 flex h-2 w-2 items-center justify-center rounded-full bg-google-gold text-[6px] font-bold text-black">1</span>
                            )}
                        </button>
                    </div>

                    <div className="w-full flex items-center gap-2 max-w-sm">
                        <span className="text-[9px] text-google-text-secondary w-8 text-right font-mono opacity-60">{formatTime(currentTime)}</span>
                        <div
                            className="flex-1 h-1 bg-google-surface-high/50 rounded-full overflow-hidden cursor-pointer group relative"
                            onClick={handleProgressClick}
                        >
                            <div
                                className="h-full bg-google-gold relative rounded-full"
                                style={{ width: `${progress}%` }}
                            >
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm scale-150"></div>
                            </div>
                        </div>
                        <span className="text-[9px] text-google-text-secondary w-8 font-mono opacity-60">{formatTime(duration)}</span>
                    </div>
                    {isPreparingAudio && (
                        <p className="text-[10px] text-google-gold uppercase tracking-wider font-semibold mt-1">
                            Preparing Audio...
                        </p>
                    )}
                </div>

                <div className="w-1/4 flex items-center justify-end gap-3 z-10">
                    <button
                        onClick={() => setShowQueue(!showQueue)}
                        className={`p-2 rounded-xl transition-all ${showQueue ? 'bg-google-gold/20 text-google-gold' : 'hover:bg-white/5 text-google-text-secondary'}`}
                        title="Open Queue"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                            <path fillRule="evenodd" d="M2 10a8 8 0 1116 0 8 8 0 01-16 0zm8-5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 10a.75.75 0 01.75-.75h3.5a.75.75 0 010 1.5h-3.5A.75.75 0 0110 15z" clipRule="evenodd" />
                        </svg>
                    </button>

                    <div className="flex items-center gap-2 group/vol bg-white/5 px-2 py-1 rounded-2xl border border-white/5">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-google-text-secondary">
                            <path d="M10 3.75a.75.75 0 00-1.264-.546L5.203 6.5H3.75A1.75 1.75 0 002 8.25v3.5c0 .966.784 1.75 1.75 1.75h1.453l3.533 3.296A.75.75 0 0010 16.25V3.75z" />
                        </svg>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={volume}
                            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                            className="w-12 h-1 bg-google-surface-high rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:bg-google-text [&::-webkit-slider-thumb]:rounded-full"
                        />
                    </div>

                    <button
                        onClick={onLyricsClick}
                        className="p-2 rounded-xl hover:bg-white/5 transition-colors group"
                        title="Show Lyrics"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-google-gold group-hover:scale-110 transition-transform">
                            <path fillRule="evenodd" d="M10 2c-2.236 0-4.43.18-6.57.524C2.137 2.735 1 3.852 1 5.201v6.598c0 1.35 1.137 2.466 2.43 2.677a29.049 29.049 0 002.57.341v2.184a.75.75 0 001.25.556l3.705-3.088c.118-.01.236-.021.353-.031 2.14-.144 4.333-.324 6.57-.324a.75.75 0 000-1.5c-2.146 0-4.257.172-6.313.308l-.513.034a.75.75 0 01-.48-.152l-2.071-1.725V5.201c0-.528.441-1.026 1.057-1.125a27.542 27.542 0 0111.132 0c.616.099 1.057.597 1.057 1.125v6.598c0 .528-.441 1.026-1.057 1.125-1.18.19-2.4.322-3.643.393a.75.75 0 00.086 1.498 31.626 31.626 0 003.957-.442c1.293-.21 2.43-1.327 2.43-2.677V5.201c0-1.35-1.137-2.466-2.43-2.677a28.98 28.98 0 00-6.57-.524z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>
            </div>

            <audio
                ref={audioRef}
                onTimeUpdate={handleTimeUpdate}
                onEnded={onEnded}
                onError={() => {
                    if (currentSong?.stream_url) {
                        onStreamError?.(currentSong);
                    }
                }}
                crossOrigin="anonymous"
            />
        </div>
    );
};

export default Player;
