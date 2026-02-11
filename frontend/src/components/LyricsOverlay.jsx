import React, { useEffect, useRef, useState, useMemo } from 'react';
import API_BASE from '../config/api';

const LyricsOverlay = ({ song, isOpen, onClose, currentTime }) => {
    const scrollContainerRef = useRef(null);
    const activeLineRef = useRef(null);
    const [isResearching, setIsResearching] = useState(false);
    const [userLyrics, setUserLyrics] = useState(null);

    useEffect(() => {
        document.body.style.overflow = isOpen ? 'hidden' : 'unset';
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    const handleResearch = async () => {
        setIsResearching(true);
        try {
            const response = await fetch(`${API_BASE}/research_lyrics/${song.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model_id: 'gemini-2.0-flash',
                    mode: 'auto'
                })
            });
            const data = await response.json();

            if (data.status === 'success') {
                setUserLyrics(data.lyrics);
            } else {
                alert(data.message || "AI could not find lyrics for this song.");
            }
        } catch (error) {
            console.error("Research failed:", error);
            alert("Failed to connect to research service.");
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

    // Auto-scroll logic
    useEffect(() => {
        if (activeIndex !== -1 && activeLineRef.current && scrollContainerRef.current) {
            activeLineRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    }, [activeIndex]);

    if (!isOpen || !song) return null;

    const showResearchButton = !currentLyrics ||
        currentLyrics.length < 50 ||
        currentLyrics === "Lyrics not found.";

    return (
        <div className="fixed inset-0 z-[100] bg-[#050505]/95 backdrop-blur-3xl animate-in fade-in duration-500 flex flex-col">
            {/* Header */}
            <div className="p-8 flex justify-between items-start bg-transparent relative z-20 max-w-6xl mx-auto w-full">
                <div className="flex gap-6 items-center">
                    {song.cover_url && (
                        <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-2xl border border-white/5">
                            <img src={song.cover_url} alt="" className="w-full h-full object-cover" />
                        </div>
                    )}
                    <div className="flex flex-col">
                        <h2 className="text-3xl font-bold text-white tracking-tight">{song.title}</h2>
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
                                className={`text-3xl md:text-5xl font-bold transition-all duration-700 leading-tight tracking-tight text-left max-w-3xl cursor-default
                                    ${isActive
                                        ? 'text-white scale-105 origin-left'
                                        : isPast
                                            ? 'text-white/20'
                                            : 'text-white/40 hover:text-white/60'
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
                    </div>
                )}

                <div className="h-[40vh] w-full flex-shrink-0"></div> {/* Bottom spacer for scroll logic */}
            </div>
        </div>
    );
};

export default LyricsOverlay;
