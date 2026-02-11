import React, { useEffect, useRef, useState } from 'react';
import API_BASE from '../config/api';

const LyricsOverlay = ({ song, isOpen, onClose }) => {
    const contentRef = useRef(null);
    const [isResearching, setIsResearching] = useState(false);
    const [currentLyrics, setCurrentLyrics] = useState(null);

    const [visualizerBars, setVisualizerBars] = useState([]);

    useEffect(() => {
        setVisualizerBars(Array.from({ length: 20 }).map(() => ({ // eslint-disable-line react-hooks/set-state-in-effect
            height: Math.random() * 40 + 10,
            duration: Math.random() * 0.5 + 0.5
        })));
    }, []);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            setCurrentLyrics(song?.lyrics); // eslint-disable-line react-hooks/set-state-in-effect
        } else {
            document.body.style.overflow = 'unset';
            setIsResearching(false);
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, song]);

    if (!isOpen || !song) return null;

    // Determine if we should show the research button
    // Show if lyrics are missing, empty, or literally "Lyrics not found."
    const showResearchButton = !currentLyrics ||
        currentLyrics.length < 50 ||
        currentLyrics === "Lyrics not found.";

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
                setCurrentLyrics(data.lyrics);
            } else {
                alert(data.message || "AI could not find lyrics for this song. Try checking the title/artist metadata.");
            }
        } catch (error) {
            console.error("Research failed:", error);
            alert("Failed to connect to research service.");
        }
        setIsResearching(false);
    };

    // Simple parsing for LRC lines if synced, else just raw text
    const parseLyrics = (text) => {
        if (!text || text === "Lyrics not found.") return ["Lyrics not found."];
        // Basic check if it looks like LRC
        if (text.includes('[')) {
            return text.split('\n').map(line => line.replace(/\[.*?\]/g, '').trim()).filter(Boolean);
        }
        return text.split('\n').filter(Boolean);
    };

    const lines = parseLyrics(currentLyrics);


    return (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-3xl animate-in fade-in duration-300 flex flex-col">
            {/* Header */}
            <div className="p-6 flex justify-between items-center bg-transparent relative z-20">
                <div className="flex flex-col">
                    <h2 className="text-2xl font-bold text-white">{song.title}</h2>
                    <p className="text-slate-400 text-lg">{song.artist}</p>
                </div>
                <button
                    onClick={onClose}
                    className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Content centered */}
            <div ref={contentRef} className="flex-1 overflow-y-auto w-full max-w-2xl mx-auto px-6 py-12 text-center remove-scrollbar scroll-smooth flex flex-col items-center">
                {lines.map((line, i) => (
                    <p
                        key={i}
                        className="text-2xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-white to-slate-400 mb-8 leading-relaxed hover:text-purple-400 transition-colors cursor-default"
                    >
                        {line}
                    </p>
                ))}

                {showResearchButton && (
                    <div className="mt-8 mb-12">
                        <button
                            onClick={handleResearch}
                            disabled={isResearching}
                            className="flex items-center gap-3 px-6 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 disabled:cursor-not-allowed rounded-full text-white font-medium transition-all shadow-lg shadow-purple-500/20"
                        >
                            {isResearching ? (
                                <>
                                    <svg className="animate-spin -ml-1 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Researching with Gemini AI...
                                </>
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                        <path d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm.5 14.25h-1v-4.5h1v4.5zm0-6h-1v-1h1v1z" />
                                        <path fillRule="evenodd" d="M9.315 7.584c.15-.353.376-.665.654-.925A4.47 4.47 0 0112 5.25a4.47 4.47 0 014.249 3.013.75.75 0 01-1.396.543 2.97 2.97 0 00-5.75-.411.75.75 0 01-1.396-.543z" clipRule="evenodd" />
                                    </svg>
                                    Research Lyrics with AI
                                </>
                            )}
                        </button>
                        <p className="mt-4 text-slate-500 text-sm max-w-sm mx-auto">
                            Uses Google Gemini to research the web or Transcribe the audio directly.
                        </p>
                    </div>
                )}

                <div className="h-32"></div> {/* Bottom spacers */}
            </div>

            {/* Simple visualizer bars bottom */}
            <div className="h-2 w-full flex items-end justify-center gap-1 pb-1 opacity-20">
                {visualizerBars.map((bar, i) => (
                    <div
                        key={i}
                        className="w-2 bg-white rounded-t-full animate-bounce"
                        style={{
                            height: `${bar.height}px`,
                            animationDuration: `${bar.duration}s`
                        }}
                    ></div>
                ))}
            </div>
        </div>
    );
};

export default LyricsOverlay;
