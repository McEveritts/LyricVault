import React, { useState, useEffect, useRef } from 'react';

const SongDetailView = ({ song, isPlaying, onPlayPause, isEmpty, currentTime }) => {
    const [activeTab, setActiveTab] = useState('lyrics');
    const lyricsContainerRef = useRef(null);



    // --- Lyrics Logic ---
    const parseLyrics = (text) => {
        if (!text) return [];
        const lines = text.split('\n');
        const parsed = [];
        const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;

        for (let line of lines) {
            const match = line.match(timeRegex);
            if (match) {
                const minutes = parseInt(match[1]);
                const seconds = parseInt(match[2]);
                const milliseconds = parseInt(match[3]);
                const time = minutes * 60 + seconds + milliseconds / 1000;
                const content = line.replace(timeRegex, '').trim();
                parsed.push({ time, content });
            } else {
                // If no timestamp, standard line (handle differently if creating a pure LRC view)
                parsed.push({ time: -1, content: line.trim() });
            }
        }
        return parsed.length > 0 ? parsed : lines.map(l => ({ time: -1, content: l }));
    };

    const lyrics = React.useMemo(() => parseLyrics(song?.lyrics || ""), [song]);

    // Find active line
    const activeLineIndex = React.useMemo(() => {
        if (!lyrics.length) return -1;
        // Find the last line that has a time <= currentTime
        // If no timestamps, this logic won't work well (returns -1 or 0)
        // We only sync if we have timestamps
        const hasTimestamps = lyrics.some(l => l.time > -1);
        if (!hasTimestamps) return -1;

        for (let i = lyrics.length - 1; i >= 0; i--) {
            if (lyrics[i].time !== -1 && lyrics[i].time <= currentTime) {
                return i;
            }
        }
        return -1;
    }, [lyrics, currentTime]);

    // Auto-scroll to active line
    useEffect(() => {
        if (activeLineIndex !== -1 && lyricsContainerRef.current) {
            const activeEl = lyricsContainerRef.current.children[activeLineIndex];
            if (activeEl) {
                activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [activeLineIndex]);



    if (!song && isEmpty) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-google-text-secondary animate-in fade-in zoom-in duration-300">
                <div className="w-24 h-24 bg-google-surface border border-google-surface-high rounded-full flex items-center justify-center mb-6 shadow-inner">
                    <span className="text-4xl opacity-50">🎵</span>
                </div>
                <h2 className="text-xl font-medium text-google-text">No song selected</h2>
                <p>Select a song from your library to view details.</p>
            </div>
        );
    }

    if (!song) return null;

    return (
        <div className="h-full flex flex-col animate-in slide-in-from-bottom-4 duration-500">
            {/* Header / Breadcrumb area could go here if needed, provided by parent layout */}

            <div className="flex-1 overflow-hidden">
                <div className="h-full flex flex-col lg:flex-row gap-8 p-8 max-w-7xl mx-auto">

                    {/* Left Column: Metadata & Visuals */}
                    <div className="lg:w-1/3 flex flex-col gap-6">
                        <div className="aspect-square rounded-[2rem] overflow-hidden shadow-2xl bg-google-surface-high border border-white/5 relative group">
                            {song.cover_url ? (
                                <img src={song.cover_url} alt={song.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-google-surface to-google-surface-high">
                                    <span className="text-8xl opacity-20">🎵</span>
                                </div>
                            )}
                            {/* Play Overlay (Big) */}
                            <div className={`absolute inset-0 bg-black/20 flex items-center justify-center transition-opacity duration-300 ${isPlaying ? 'opacity-0 hover:opacity-100' : 'opacity-100'}`}>
                                <button
                                    onClick={onPlayPause}
                                    className="w-20 h-20 bg-google-text text-google-bg rounded-full flex items-center justify-center hover:scale-110 transition-all shadow-xl shadow-black/30 backdrop-blur-md"
                                >
                                    {isPlaying ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10">
                                            <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" clipRule="evenodd" />
                                        </svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 ml-1">
                                            <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <h1 className="text-3xl font-bold text-google-text leading-tight">{song.title}</h1>
                            <p className="text-xl text-google-text-secondary font-medium">{song.artist}</p>
                            <div className="flex items-center gap-3 mt-4">
                                <span className="px-3 py-1 rounded-full bg-google-surface text-xs font-medium text-google-text-secondary border border-google-surface-high">
                                    {song.duration ? `${Math.floor(song.duration / 60)}:${String(song.duration % 60).padStart(2, '0')}` : '--:--'}
                                </span>
                                {(song.lyrics_status === 'ready') && (
                                    <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-medium border border-blue-500/20">
                                        Synced Lyrics
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Tabs (Lyrics / Info) */}
                    <div className="flex-1 flex flex-col bg-google-surface/30 rounded-[2rem] border border-google-surface-high backdrop-blur-sm overflow-hidden">
                        {/* Tabs Header */}
                        <div className="flex border-b border-google-surface-high">
                            <button
                                onClick={() => setActiveTab('lyrics')}
                                className={`flex-1 py-4 text-sm font-medium transition-colors ${activeTab === 'lyrics' ? 'bg-google-surface-high text-google-text' : 'text-google-text-secondary hover:text-google-text hover:bg-google-surface/50'}`}
                            >
                                Lyrics
                            </button>
                            <button
                                onClick={() => setActiveTab('info')}
                                className={`flex-1 py-4 text-sm font-medium transition-colors ${activeTab === 'info' ? 'bg-google-surface-high text-google-text' : 'text-google-text-secondary hover:text-google-text hover:bg-google-surface/50'}`}
                            >
                                Information
                            </button>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 overflow-y-auto p-6 relative scroll-smooth" ref={lyricsContainerRef}>
                            {activeTab === 'lyrics' && (
                                <div className="space-y-6 text-center py-10">
                                    {lyrics.length > 0 ? (
                                        lyrics.map((line, i) => (
                                            <p
                                                key={i}
                                                className={`text-lg transition-all duration-300 cursor-pointer hover:opacity-80
                                                    ${i === activeLineIndex
                                                        ? 'text-google-text font-bold scale-105 origin-center'
                                                        : 'text-google-text-secondary opacity-40 blur-[0.5px]'
                                                    }
                                                `}
                                                onClick={() => {
                                                    // Optional: Seek to this line
                                                    // onSeek(line.time) 
                                                }}
                                            >
                                                {line.content}
                                            </p>
                                        ))
                                    ) : (
                                        <div className="flex flex-col items-center justify-center opacity-50 py-20">
                                            <span className="text-4xl mb-4">😶</span>
                                            <p>No lyrics available</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'info' && (
                                <div className="space-y-6 text-google-text-secondary">
                                    <div className="p-4 bg-google-surface rounded-xl">
                                        <h3 className="text-sm font-bold text-google-text mb-2 uppercase tracking-wider">File Details</h3>
                                        <p className="text-sm">Format: <span className="text-google-text">MP3</span></p>
                                        <p className="text-sm">Bitrate: <span className="text-google-text">320kbps</span></p>
                                        <p className="text-sm">Path: <span className="text-google-text font-mono break-all">{song.file_path || "Unknown"}</span></p>
                                    </div>

                                    {/* Add more analysis data here later */}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SongDetailView;
