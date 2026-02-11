import React, { useRef, useEffect } from 'react';

const Player = ({
    currentSong,
    isPlaying,
    onPlayPause,
    volume,
    onVolumeChange,
    onTimeUpdate,
    onEnded,
    onLyricsClick,
    currentTime,
    duration
}) => {
    const audioRef = useRef(null);

    // Sync Play/Pause
    useEffect(() => {
        if (currentSong && audioRef.current) {
            if (isPlaying) {
                const playPromise = audioRef.current.play();
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        console.error("Playback failed:", error);
                        // Optional: onPlayPause(false); // Revert state if play fails?
                    });
                }
            } else {
                audioRef.current.pause();
            }
        }
    }, [isPlaying, currentSong]);

    // Sync Volume
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = volume;
        }
    }, [volume]);

    // Handle Song Change
    useEffect(() => {
        if (currentSong && audioRef.current) {
            audioRef.current.src = currentSong.stream_url;
            audioRef.current.load();
        }
    }, [currentSong]);

    const handleTimeUpdate = () => {
        if (audioRef.current && onTimeUpdate) {
            const current = audioRef.current.currentTime;
            const duration = audioRef.current.duration;
            onTimeUpdate(current, duration);
        }
    };

    if (!currentSong) return null;

    // Calculate progress for UI
    const progress = (duration > 0) ? (currentTime / duration) * 100 : 0;

    return (
        <div className="fixed bottom-6 left-6 right-6 z-50 animate-in slide-in-from-bottom-20 duration-500">
            <div className="max-w-5xl mx-auto bg-google-surface-high/90 backdrop-blur-2xl rounded-[2rem] p-4 pr-8 shadow-2xl shadow-black/40 border border-white/5 flex items-center gap-6">
                {/* Song Info */}
                <div className="flex items-center gap-4 min-w-0 w-1/4">
                    {currentSong.cover_url ? (
                        <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-md flex-shrink-0">
                            <img src={currentSong.cover_url} alt={currentSong.title} className="w-full h-full object-cover" />
                        </div>
                    ) : (
                        <div className="w-14 h-14 bg-google-surface rounded-2xl flex items-center justify-center shadow-md flex-shrink-0">
                            <span className="text-xl">🎵</span>
                        </div>
                    )}
                    <div className="overflow-hidden">
                        <h4 className="text-google-text font-medium truncate">{currentSong.title}</h4>
                        <p className="text-google-text-secondary text-xs truncate">{currentSong.artist}</p>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex flex-col items-center flex-1 gap-2">
                    <div className="flex items-center gap-6">
                        <button className="text-google-text-secondary hover:text-google-text transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                                <path d="M9.195 18.44c1.25.713 2.805-.19 2.805-1.629v-2.873h8.17c.266 0 .52-.103.707-.29.188-.187.292-.44.292-.707V11.201c0-.266-.104-.52-.292-.707-.187-.187-.44-.29-.707-.29H12V7.189c0-1.44-1.555-2.342-2.805-1.628L2.81 9.771a1.88 1.88 0 00.324 3.016l6.06 3.653z" />
                            </svg>
                        </button>

                        <button
                            onClick={onPlayPause}
                            className="w-12 h-12 bg-google-text text-google-bg rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-lg shadow-white/10"
                        >
                            {isPlaying ? (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                                    <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" clipRule="evenodd" />
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 ml-0.5">
                                    <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                                </svg>
                            )}
                        </button>

                        <button className="text-google-text-secondary hover:text-google-text transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                                <path d="M5.055 7.06c-1.25-.714-2.805.189-2.805 1.628v2.873H-5.918c-.266 0-.52.103-.707.29-.187.187-.292.44-.292.707v.592c0 .265.105.519.292.707.187.187.441.29.707.29H2.25v3.189c0 1.44 1.555 2.342 2.805 1.628l6.384-4.212a1.88 1.88 0 00-.324-3.016L5.055 7.06z" />
                                <path fillRule="evenodd" d="M14.008 12c0-2.61 1.498-4.887 3.69-6 .319-.162.708-.047.87.27.163.319.048.707-.27.87a5.503 5.503 0 000 9.72c.318.163.433.551.27.87-.162.318-.551.432-.87.27-2.192-1.113-3.69-3.39-3.69-6z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>
                    {/* Progress */}
                    <div className="w-full h-1 bg-google-surface/50 rounded-full overflow-hidden cursor-pointer group max-w-xs relative">
                        {/* We use a simple visual progress here, but for interactivity we'd need to emit onSeek */}
                        <div
                            className="h-full bg-google-text relative"
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                </div>

                {/* Volume & Lyrics */}
                <div className="w-1/4 flex items-center justify-end gap-5">
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={volume}
                        onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                        className="w-20 h-1 bg-google-surface rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-google-text [&::-webkit-slider-thumb]:rounded-full"
                        style={{
                            background: `linear-gradient(to right, #E3E3E3 0%, #E3E3E3 ${volume * 100}%, #1E1F20 ${volume * 100}%, #1E1F20 100%)`
                        }}
                    />

                    <button
                        onClick={onLyricsClick}
                        className="text-[10px] font-bold tracking-wider text-google-bg bg-google-gold px-3 py-1.5 rounded-full hover:bg-google-gold-light transition-colors"
                    >
                        LYRICS
                    </button>
                </div>
            </div>

            <audio
                ref={audioRef}
                onTimeUpdate={handleTimeUpdate}
                onEnded={onEnded}
            />
        </div>
    );
};

export default Player;
