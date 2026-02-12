import React, { useState, useEffect } from 'react';

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
    onToggleVisualizer,
    showVisualizer,
    visualizerEnabled
}) => {
    const [showQueue, setShowQueue] = useState(false);
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
            <div className={`max-w-4xl mx-auto bg-google-surface/80 backdrop-blur-3xl rounded-[2.5rem] shadow-2xl border border-white/5 flex flex-col transition-all duration-500 ease-in-out ${showQueue ? 'h-[420px] pb-4' : 'h-[88px]'}`}>

                {/* Integrated Queue Panel */}
                <div className={`flex-1 overflow-hidden transition-all duration-500 ease-in-out ${showQueue ? 'opacity-100 translate-y-0 p-6' : 'opacity-0 translate-y-4 h-0 pointer-events-none'}`}>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-google-text opacity-60">Upcoming Queue</h3>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] bg-google-gold/10 text-google-gold px-2 py-0.5 rounded-full border border-google-gold/20">{queue.length} Tracks</span>
                            <button onClick={() => setShowQueue(false)} className="text-google-text-secondary hover:text-google-gold transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    <div className="h-full overflow-y-auto space-y-3 pr-2 custom-scrollbar pb-8">
                        {queue.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center opacity-30 gap-3">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12">
                                    <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 01.67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 11-.671-1.34l.041-.022zM12 9a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                                </svg>
                                <p className="text-sm">Your queue is currently empty</p>
                            </div>
                        ) : (
                            queue.map((song, idx) => (
                                <div key={`${song.id}-${idx}`} className="flex items-center gap-4 group/item p-2 hover:bg-white/5 rounded-2xl transition-all">
                                    <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-google-surface-high border border-white/5 shadow-md">
                                        {song.cover_url ? <img src={song.cover_url} className="w-full h-full object-cover" /> : (
                                            <div className="w-full h-full flex items-center justify-center text-google-text-secondary">
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 opacity-30">
                                                    <path fillRule="evenodd" d="M19.952 1.651a.75.75 0 01.298.599V16.303a3 3 0 01-2.176 5.963l-1.385-.558a2.5 2.5 0 01-.132.062 4.418 4.418 0 01-4.041-.275l-4.731-2.583a2.49 2.49 0 01-1.282-2.193v-4.838a2.5 2.5 0 01.666-1.696l4.205-4.485C11.97 5.253 12.68 4.966 13.433 5c-.171-.235-.348-.465-.533-.687l-2.027-2.285A2.49 2.49 0 0110.198.243l6.502-3.82a.75.75 0 111.96.98l-3.326 1.954c.78.293 1.554.806 2.193 1.484l2.425 .81z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-google-text truncate">{song.title}</p>
                                        <p className="text-xs text-google-text-secondary truncate opacity-60">{song.artist}</p>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setQueue(prev => prev.filter((_, i) => i !== idx));
                                        }}
                                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-red-500/10 text-red-100 opacity-0 group-hover/item:opacity-100 hover:bg-red-500/20 transition-all font-bold"
                                        aria-label="Remove from queue"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                                        </svg>
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Main Controls Row */}
                <div className="flex items-center gap-6 p-3 px-6 h-[88px]">
                    {/* Simplified Song Info */}
                    <div className="flex items-center gap-4 min-w-0 w-1/4 z-10">
                        {currentSong.cover_url ? (
                            <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-xl flex-shrink-0 group relative cursor-pointer" onClick={onLyricsClick}>
                                <img src={currentSong.cover_url} alt={currentSong.title} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-google-gold">
                                        <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
                                        <path fillRule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 010-1.113zM17.25 12a5.25 5.25 0 11-10.5 0 5.25 5.25 0 0110.5 0z" clipRule="evenodd" />
                                    </svg>
                                </div>
                            </div>
                        ) : (
                            <div className="w-14 h-14 bg-google-surface-high rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0 text-google-text-secondary">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 opacity-20">
                                    <path fillRule="evenodd" d="M19.952 1.651a.75.75 0 01.298.599V16.303a3 3 0 01-2.176 5.963l-1.385-.558a2.5 2.5 0 01-.132.062 4.418 4.418 0 01-4.041-.275l-4.731-2.583a2.49 2.49 0 01-1.282-2.193v-4.838a2.5 2.5 0 01.666-1.696l4.205-4.485C11.97 5.253 12.68 4.966 13.433 5c-.171-.235-.348-.465-.533-.687l-2.027-2.285A2.49 2.49 0 0110.198.243l6.502-3.82a.75.75 0 111.96.98l-3.326 1.954c.78.293 1.554.806 2.193 1.484l2.425 .81z" clipRule="evenodd" />
                                </svg>
                            </div>
                        )}
                        <div className="overflow-hidden">
                            <h4 className="text-google-text text-base font-bold truncate tracking-tight">{currentSong.title}</h4>
                            <p className="text-google-text-secondary text-xs truncate opacity-50">{currentSong.artist}</p>
                        </div>
                    </div>

                    {/* Main Controls & Progress */}
                    <div className="flex flex-col items-center flex-1 gap-1.5 z-10">
                        <div className="flex items-center gap-8">
                            <button
                                onClick={() => setShuffleMode(!shuffleMode)}
                                className={`transition-all hover:scale-110 active:scale-90 ${shuffleMode ? 'text-google-gold drop-shadow-[0_0_8px_rgba(226,194,134,0.3)]' : 'text-google-text-secondary/30 hover:text-google-text-secondary'}`}
                                title="Shuffle"
                                aria-label="Toggle shuffle"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                    <path fillRule="evenodd" d="M15.28 9.47a.75.75 0 010 1.06l-2.72 2.72a.75.75 0 11-1.06-1.06l1.44-1.44h-.89a5.5 5.5 0 00-4.48 2.31l-.14.21a.75.75 0 01-1.25-.83l.14-.21a7 7 0 015.73-2.94h.89l-1.44-1.44a.75.75 0 011.06-1.06l2.72 2.72zM4.72 9.47a.75.75 0 000 1.06l2.72 2.72a.75.75 0 101.06-1.06L7.06 10.75h.89a5.5 5.5 0 014.48-2.31l.14-.21a.75.75 0 10-1.25.83l-.14.21a7 7 0 00-5.73 2.94h-.89l1.44 1.44a.75.75 0 00-1.06 1.06L4.72 10.53z" clipRule="evenodd" />
                                </svg>
                            </button>

                            <button
                                onClick={onPrevious}
                                className="text-google-text-secondary hover:text-google-text transition-all hover:scale-110 active:scale-90"
                                aria-label="Previous track"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                                    <path d="M9.195 18.44c1.25.713 2.805-.19 2.805-1.629V14.15l8.11 4.628c1.25.714 2.805-.19 2.805-1.629V6.851c0-1.44-1.555-2.343-2.805-1.628L12 9.85V7.189c0-1.44-1.555-2.343-2.805-1.628l-7.108 4.061c-1.26.72-1.26 2.536 0 3.256l7.108 4.061z" />
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
                                className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-xl shadow-white/5"
                                disabled={!currentSong}
                            >
                                {isPreparingAudio ? (
                                    <span className="w-5 h-5 border-[3px] border-black/20 border-t-black rounded-full animate-spin"></span>
                                ) : isPlaying ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                                        <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" clipRule="evenodd" />
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 ml-1">
                                        <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                                    </svg>
                                )}
                            </button>

                            <button
                                onClick={onNext}
                                className="text-google-text-secondary hover:text-google-text transition-all hover:scale-110 active:scale-90"
                                aria-label="Next track"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                                    <path d="M5.055 7.062c-1.25-.714-2.805.189-2.805 1.628v8.123c0 1.44 1.555 2.343 2.805 1.628L12 14.15v2.66c0 1.44 1.555 2.343 2.805 1.628l7.108-4.061c1.26-.72 1.26-2.536 0-3.256L14.805 7.06c-1.25-.714-2.805.189-2.805 1.628v2.66L5.055 7.062z" />
                                </svg>
                            </button>

                            <button
                                onClick={toggleRepeat}
                                className={`transition-all hover:scale-110 active:scale-90 relative ${repeatMode !== 'off' ? 'text-google-gold drop-shadow-[0_0_8px_rgba(226,194,134,0.3)]' : 'text-google-text-secondary/30 hover:text-google-text-secondary'}`}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                    <path fillRule="evenodd" d="M4.755 10.059a.75.75 0 01.27 1.025 8.25 8.25 0 1013.95-1.025.75.75 0 111.295-.754 9.75 9.75 0 11-15.515 1.023.75.75 0 011.025-.27l1.023.27zm1.144-5.26a.75.75 0 01-.27 1.025L4.5 6.348l1.144.524a.75.75 0 01-.524 1.412L3.5 7.636a.75.75 0 01-.365-.638V5.059a.75.75 0 111.5 0v1.071l1.144-1.332a.75.75 0 011.144 0zM19.5 16.364v1.939a.75.75 0 11-1.5 0v-1.071l-1.144 1.332a.75.75 0 11-1.144-1.025l1.129-.524-1.144-.524a.75.75 0 11.524-1.412l1.623.648a.75.75 0 01.365.638z" clipRule="evenodd" />
                                </svg>
                                {repeatMode === 'one' && (
                                    <span className="absolute -top-1 -right-1 flex h-2 w-2 items-center justify-center rounded-full bg-google-gold text-[6px] font-bold text-black border border-black/20">1</span>
                                )}
                            </button>
                        </div>

                        <div className="w-full flex items-center gap-3 max-w-sm group/progress">
                            <span className="text-[10px] text-google-text-secondary w-10 text-right font-mono opacity-40">{formatTime(currentTime)}</span>
                            <div
                                className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden cursor-pointer relative"
                                onClick={handleProgressClick}
                            >
                                <div
                                    className="h-full bg-google-gold relative rounded-full transition-[width] duration-300 ease-linear"
                                    style={{ width: `${progress}%` }}
                                >
                                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity shadow-lg shadow-black/50 scale-125 border border-black/10"></div>
                                </div>
                            </div>
                            <span className="text-[10px] text-google-text-secondary w-10 font-mono opacity-40">{formatTime(duration)}</span>
                        </div>
                    </div>

                    {/* Right Controls */}
                    <div className="w-1/4 flex items-center justify-end gap-2 z-10">
                        <button
                            onClick={() => setShowQueue(!showQueue)}
                            className={`p-2.5 rounded-2xl transition-all ${showQueue ? 'bg-google-gold text-black shadow-lg shadow-google-gold/20' : 'hover:bg-white/5 text-google-text-secondary hover:text-google-text'}`}
                            title="Queue"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                <path fillRule="evenodd" d="M2 10a8 8 0 1116 0 8 8 0 01-16 0zm8-5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 10a.75.75 0 01.75-.75h3.5a.75.75 0 010 1.5h-3.5A.75.75 0 0110 15z" clipRule="evenodd" />
                            </svg>
                        </button>

                        <button
                            onClick={onToggleVisualizer}
                            disabled={!visualizerEnabled}
                            className={`p-2.5 rounded-2xl transition-all disabled:opacity-20 ${showVisualizer ? 'bg-google-gold text-black shadow-lg shadow-google-gold/20' : 'hover:bg-white/5 text-google-text-secondary hover:text-google-gold'}`}
                            title="Visualizer"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 9a.75.75 0 00-1.5 0v6a.75.75 0 001.5 0V9zM9 12a.75.75 0 00-1.5 0v3a.75.75 0 001.5 0v-3zm7.5 0a.75.75 0 00-1.5 0v3a.75.75 0 001.5 0v-3z" clipRule="evenodd" />
                            </svg>
                        </button>

                        <div className="flex items-center gap-2 group/vol bg-google-surface-high/30 px-3 py-2 rounded-2xl border border-white/5">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-google-text-secondary opacity-40 group-hover/vol:opacity-100 transition-opacity">
                                <path d="M10 3.75a.75.75 0 00-1.264-.546L5.203 6.5H3.75A1.75 1.75 0 002 8.25v3.5c0 .966.784 1.75 1.75 1.75h1.453l3.533 3.296A.75.75 0 0010 16.25V3.75z" />
                            </svg>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                value={volume}
                                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                                className="w-16 h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-google-text [&::-webkit-slider-thumb]:rounded-full shadow-sm"
                            />
                        </div>

                        <button
                            onClick={onLyricsClick}
                            className="p-2.5 rounded-2xl text-google-gold hover:bg-google-gold/10 transition-all font-black uppercase text-[10px] tracking-widest border border-google-gold/20"
                        >
                            LRC
                        </button>
                    </div>
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
