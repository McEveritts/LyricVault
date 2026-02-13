import React, { useEffect, useRef, useState, useMemo } from 'react';
import API_BASE from '../config/api';

const LyricsOverlay = ({ song, isOpen, onClose, currentTime, onSeek, isPlaying, onPlayPause, onNext, onPrevious }) => {
    const scrollContainerRef = useRef(null);
    const activeLineRef = useRef(null);
    const [isResearching, setIsResearching] = useState(false);
    const [userLyrics, setUserLyrics] = useState(null);
    const [selectedModel, setSelectedModel] = useState('gemini-2.0-flash');
    const [statusMsg, setStatusMsg] = useState(null);
    const [showControls, setShowControls] = useState(false);
    const hideTimeoutRef = useRef(null);

    useEffect(() => {
        document.body.style.overflow = isOpen ? 'hidden' : 'unset';
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return undefined;
        let isMounted = true;

        const fetchSelectedModel = async () => {
            try {
                const res = await fetch(`${API_BASE}/settings/models`);
                if (!res.ok) return;
                const data = await res.json();
                if (isMounted && data?.selected) {
                    setSelectedModel(data.selected);
                }
            } catch (error) {
                console.error('Failed to fetch selected model:', error);
            }
        };

        fetchSelectedModel();

        return () => {
            isMounted = false;
        };
    }, [isOpen]);

    const handleResearch = async () => {
        setIsResearching(true);
        setStatusMsg("Researching lyrics...");
        try {
            const response = await fetch(`${API_BASE}/research_lyrics/${song.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model_id: selectedModel,
                    mode: 'auto'
                })
            });
            const data = await response.json();

            if (data.status === 'success') {
                setUserLyrics(data.lyrics);
                setStatusMsg("Lyrics updated.");
            } else {
                setStatusMsg(data.message || "AI could not find lyrics for this song.");
            }
        } catch (error) {
            console.error("Research failed:", error);
            setStatusMsg("Failed to connect to research service.");
        }
        setIsResearching(false);
    };

    // Advanced LRC parsing
    const currentLyrics = useMemo(() => {
        if (userLyrics) return userLyrics;
        return song?.lyrics || null;
    }, [userLyrics, song]);

    const parsedLyrics = useMemo(() => {
        if (!currentLyrics || currentLyrics === "Lyrics not found.") return [];

        const lines = currentLyrics.split('\n');
        const lrcRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;
        const result = [];

        lines.forEach(line => {
            const match = line.match(lrcRegex);
            if (match) {
                const mins = parseInt(match[1]);
                const secs = parseInt(match[2]);
                const ms = parseInt(match[3]);
                const time = mins * 60 + secs + ms / (match[3].length === 3 ? 1000 : 100);
                const text = match[4].trim();
                if (text) result.push({ time, text });
            } else {
                const text = line.replace(/\[.*?\]/g, '').trim();
                if (text) result.push({ time: -1, text });
            }
        });

        return result;
    }, [currentLyrics]);

    const activeIndex = useMemo(() => {
        if (!currentTime || parsedLyrics.length === 0) return -1;

        // Only consider lines with timestamps
        const timedLines = parsedLyrics.filter(l => l.time >= 0);
        if (timedLines.length === 0) return -1;

        let index = -1;
        for (let i = 0; i < timedLines.length; i++) {
            if (currentTime >= timedLines[i].time) {
                index = i;
            } else {
                break;
            }
        }

        // Map back to original index
        if (index === -1) return -1;
        const activeTime = timedLines[index].time;
        return parsedLyrics.findIndex(l => l.time === activeTime);
    }, [currentTime, parsedLyrics]);

    useEffect(() => {
        if (activeIndex !== -1 && activeLineRef.current && scrollContainerRef.current) {
            activeLineRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    }, [activeIndex]);

    const handleMouseMove = () => {
        setShowControls(true);
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = setTimeout(() => {
            setShowControls(false);
        }, 3000);
    };

    if (!isOpen || !song) return null;

    const showResearchButton = !currentLyrics ||
        currentLyrics.length < 50 ||
        currentLyrics === "Lyrics not found.";

    return (
        <div
            onMouseMove={handleMouseMove}
            className="fixed inset-0 z-[100] bg-[#050505]/95 backdrop-blur-3xl animate-in fade-in duration-500 flex flex-col"
        >
            {/* Header */}
            <div className={`p-8 flex justify-between items-start bg-transparent relative z-20 max-w-6xl mx-auto w-full transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
                <div className="flex gap-6 items-center">
                    {song.cover_url && (
                        <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-2xl border border-white/5">
                            <img src={song.cover_url} alt="" className="w-full h-full object-cover" />
                        </div>
                    )}
                    <div className="flex flex-col">
                        <div className="flex items-center gap-3">
                            <h2 className="text-3xl font-bold text-white tracking-tight">{song.title}</h2>
                            {song.lyrics_source === 'syncedlyrics' && (
                                <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase tracking-wider border border-blue-500/20">
                                    Official
                                </span>
                            )}
                            {song.lyrics_source?.startsWith('gemini_research') && (
                                <span className="px-2 py-0.5 rounded-full bg-google-gold/10 text-google-gold text-[10px] font-bold uppercase tracking-wider border border-google-gold/20">
                                    AI Research
                                </span>
                            )}
                            {song.lyrics_source === 'gemini_transcription' && (
                                <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 text-[10px] font-bold uppercase tracking-wider border border-purple-500/20">
                                    AI Transcription
                                </span>
                            )}
                        </div>
                        <p className="text-google-gold/80 text-xl font-medium">{song.artist}</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="w-12 h-12 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all text-white active:scale-95 group"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 group-hover:rotate-90 transition-transform">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Lyrics Container */}
            <div
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto w-full max-w-4xl mx-auto px-8 py-20 remove-scrollbar flex flex-col items-start gap-12"
            >
                {parsedLyrics.length > 0 ? (
                    parsedLyrics.map((line, i) => {
                        const isActive = i === activeIndex;
                        const isPast = activeIndex !== -1 && i < activeIndex;

                        return (
                            <p
                                key={i}
                                ref={isActive ? activeLineRef : null}
                                onClick={() => line.time >= 0 && onSeek && onSeek(line.time)}
                                className={`text-3xl md:text-5xl font-bold transition-all duration-700 leading-tight tracking-tight text-left max-w-3xl
                                    ${line.time >= 0 ? 'cursor-pointer hover:text-google-gold/80 hover:translate-x-2' : 'cursor-default'}
                                    ${isActive
                                        ? 'text-white scale-105 origin-left'
                                        : isPast
                                            ? 'text-white/20'
                                            : 'text-white/40'
                                    }`}
                            >
                                {line.text}
                            </p>
                        );
                    })
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/20 text-2xl font-medium">
                        {showResearchButton ? "No lyrics found." : "Loading lyrics..."}
                    </div>
                )}

                {showResearchButton && (
                    <div className="mt-12 mb-20 self-center text-center">
                        <button
                            onClick={handleResearch}
                            disabled={isResearching}
                            className="flex items-center gap-3 px-8 py-4 bg-google-gold hover:bg-google-gold-light disabled:opacity-50 disabled:cursor-not-allowed rounded-full text-black font-bold transition-all shadow-xl shadow-google-gold/10 active:scale-95"
                        >
                            {isResearching ? (
                                <>
                                    <svg className="animate-spin h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Researching...
                                </>
                            ) : (
                                "Research Lyrics with AI"
                            )}
                        </button>
                        {statusMsg && (
                            <p className="mt-3 text-xs text-google-gold/90 tracking-wide uppercase">{statusMsg}</p>
                        )}
                    </div>
                )}

                <div className="h-[40vh] w-full flex-shrink-0"></div> {/* Bottom spacer for scroll logic */}
            </div>

            {/* Media Controls Bar */}
            <div className={`fixed bottom-0 left-0 right-0 p-12 bg-gradient-to-t from-black/80 to-transparent transition-all duration-500 z-50 ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}>
                <div className="max-w-4xl mx-auto flex flex-col gap-6">
                    {/* Progress Bar */}
                    <div className="flex items-center gap-8">
                        <div className="flex-1">
                            <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden cursor-pointer group relative" onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const x = e.clientX - rect.left;
                                onSeek(x / rect.width * (song.duration || 0));
                            }}>
                                <div
                                    className="h-full bg-google-gold transition-all duration-100"
                                    style={{ width: `${(currentTime / (song.duration || 1)) * 100}%` }}
                                />
                                <div className="absolute top-0 bottom-0 left-0 w-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
                                    <div className="h-4 w-4 bg-white rounded-full shadow-xl -ml-2" style={{ marginLeft: `calc(${(currentTime / (song.duration || 1)) * 100}% - 8px)` }} />
                                </div>
                            </div>
                            <div className="flex justify-between mt-2 font-mono text-xs text-white/40 tracking-widest">
                                <span>{Math.floor(currentTime / 60)}:{(Math.floor(currentTime % 60)).toString().padStart(2, '0')}</span>
                                <span>{Math.floor(song.duration / 60)}:{(Math.floor(song.duration % 60)).toString().padStart(2, '0')}</span>
                            </div>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center justify-center gap-12">
                        <button onClick={onPrevious} className="text-white/40 hover:text-white transition-colors active:scale-90">
                            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" /></svg>
                        </button>

                        <button
                            onClick={onPlayPause}
                            className="w-20 h-20 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-2xl shadow-white/10"
                        >
                            {isPlaying ? (
                                <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                            ) : (
                                <svg className="w-10 h-10 ml-2" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                            )}
                        </button>

                        <button onClick={onNext} className="text-white/40 hover:text-white transition-colors active:scale-90">
                            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LyricsOverlay;
