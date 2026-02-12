import React, { useEffect, useMemo, useRef, useState } from 'react';
import API_BASE from '../config/api';
import Visualizer from './Visualizer';

const SongDetailView = ({ song, isPlaying, onPlayPause, onSongUpdated, isEmpty, currentTime, analyser }) => {
    const [activeTab, setActiveTab] = useState('lyrics');
    const [researching, setResearching] = useState(false);
    const [selectedModel, setSelectedModel] = useState('gemini-2.0-flash');
    const [transcriptionMode, setTranscriptionMode] = useState(false);
    const [availableModels, setAvailableModels] = useState([]);
    const [statusMsg, setStatusMsg] = useState(null);
    const activeLineRef = useRef(null);

    useEffect(() => {
        const fetchModels = async () => {
            try {
                const res = await fetch(`${API_BASE}/settings/models`);
                if (!res.ok) return;
                const data = await res.json();
                const models = data.models || [];
                setAvailableModels(models);

                if (data.selected) {
                    setSelectedModel(data.selected);
                } else if (models.length > 0) {
                    setSelectedModel(models[0].id);
                }
            } catch (err) {
                console.error('Failed to fetch models:', err);
            }
        };

        fetchModels();
    }, []);

    const modelOptions = availableModels.length > 0
        ? availableModels
        : [{ id: selectedModel, name: selectedModel }];

    const lyrics = useMemo(() => {
        if (!song?.lyrics) return [];

        const lines = song.lyrics.split('\n');
        const parsed = [];
        const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;

        for (const line of lines) {
            const match = line.match(timeRegex);
            if (match) {
                const minutes = parseInt(match[1], 10);
                const seconds = parseInt(match[2], 10);
                const fractions = parseInt(match[3], 10);
                const time = minutes * 60 + seconds + fractions / (match[3].length === 3 ? 1000 : 100);
                const content = line.replace(timeRegex, '').trim();
                if (content) {
                    parsed.push({ time, content });
                }
            } else {
                const content = line.trim();
                if (content) {
                    parsed.push({ time: -1, content });
                }
            }
        }

        return parsed;
    }, [song]);

    const hasLyrics = lyrics.length > 0 && song?.lyrics !== 'Lyrics not found.';

    const activeLineIndex = useMemo(() => {
        if (!lyrics.length) return -1;
        const hasTimestamps = lyrics.some(line => line.time >= 0);
        if (!hasTimestamps) return -1;

        for (let i = lyrics.length - 1; i >= 0; i -= 1) {
            if (lyrics[i].time >= 0 && lyrics[i].time <= currentTime) {
                return i;
            }
        }

        return -1;
    }, [lyrics, currentTime]);

    useEffect(() => {
        if (activeLineIndex !== -1 && activeLineRef.current && typeof activeLineRef.current.scrollIntoView === 'function') {
            activeLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [activeLineIndex]);

    const handleExportTxt = () => {
        if (!song?.lyrics) return;

        const blob = new Blob([song.lyrics], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const filename = `${song.title} - ${song.artist}`.replace(/[<>:"/\\|?*]/g, '_');

        link.href = url;
        link.download = `${filename}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleExportCsv = () => {
        if (!lyrics.length) return;

        const formatTime = (seconds) => {
            if (seconds < 0) return '';
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            const ms = Math.floor((seconds % 1) * 1000);
            return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
        };

        let csvContent = 'Time,Lyric\n';
        lyrics.forEach((line) => {
            const escapedContent = `"${line.content.replace(/"/g, '""')}"`;
            csvContent += `${formatTime(line.time)},${escapedContent}\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const filename = `${song.title} - ${song.artist}`.replace(/[<>:"/\\|?*]/g, '_');

        link.href = url;
        link.download = `${filename}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const refreshSongDetails = async () => {
        if (!song?.id) return null;

        const response = await fetch(`${API_BASE}/song/${song.id}`);
        if (!response.ok) return null;

        const latestSong = await response.json();
        onSongUpdated?.(latestSong);
        return latestSong;
    };

    const handleResearch = async ({ mode, message }) => {
        if (!song?.id) return;

        setResearching(true);
        setStatusMsg(message);

        try {
            const response = await fetch(`${API_BASE}/research_lyrics/${song.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model_id: selectedModel,
                    mode,
                }),
            });

            const data = await response.json();
            if (data.status === 'success') {
                await refreshSongDetails();
                setStatusMsg('Lyrics updated.');
            } else {
                setStatusMsg(data.message || 'Research failed.');
            }
        } catch (err) {
            console.error('Research failed:', err);
            setStatusMsg('Connection error.');
        } finally {
            setResearching(false);
        }
    };

    if (!song && isEmpty) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-google-text-secondary animate-in fade-in zoom-in duration-300">
                <div className="w-24 h-24 bg-google-surface border border-google-surface-high rounded-full flex items-center justify-center mb-6 shadow-inner">
                    <span className="text-2xl opacity-50">LV</span>
                </div>
                <h2 className="text-xl font-medium text-google-text">No song selected</h2>
                <p>Select a song from your library to view details.</p>
            </div>
        );
    }

    if (!song) return null;

    return (
        <div className="h-full flex flex-col animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex-1 overflow-hidden">
                <div className="h-full flex flex-col lg:flex-row gap-8 p-8 max-w-7xl mx-auto">
                    <div className="lg:w-1/3 flex flex-col gap-6">
                        <div className="aspect-square rounded-[2rem] overflow-hidden shadow-2xl bg-google-surface-high border border-white/5 relative group">
                            {song.cover_url ? (
                                <img src={song.cover_url} alt={song.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 z-10 relative" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-google-surface to-google-surface-high z-10 relative">
                                    <span className="text-4xl opacity-20">MUSIC</span>
                                </div>
                            )}

                            <div className="absolute inset-0 z-0 flex items-end justify-center opacity-40">
                                <Visualizer analyser={analyser} isPlaying={isPlaying} height={100} width={400} />
                            </div>

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

                    <div className="flex-1 flex flex-col bg-google-surface/30 rounded-[2rem] border border-google-surface-high backdrop-blur-sm overflow-hidden">
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

                        <div className="flex-1 overflow-y-auto p-6 relative scroll-smooth">
                            {activeTab === 'lyrics' && (
                                <div className="space-y-6 text-center py-10 relative group">
                                    {hasLyrics ? (
                                        <>
                                            <div className="absolute top-0 right-0 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={handleExportTxt}
                                                    className="px-2 py-1 bg-google-surface-high rounded-lg text-[10px] font-bold text-google-text-secondary hover:text-google-gold transition-colors"
                                                    title="Export as TXT"
                                                >
                                                    TXT
                                                </button>
                                                <button
                                                    onClick={handleExportCsv}
                                                    className="px-2 py-1 bg-google-surface-high rounded-lg text-[10px] font-bold text-google-text-secondary hover:text-google-gold transition-colors"
                                                    title="Export as CSV"
                                                >
                                                    CSV
                                                </button>
                                            </div>

                                            {lyrics.map((line, i) => (
                                                <p
                                                    key={i}
                                                    ref={i === activeLineIndex ? activeLineRef : null}
                                                    className={`text-lg transition-all duration-300 cursor-pointer hover:opacity-80
                                                    ${i === activeLineIndex
                                                            ? 'text-google-text font-bold scale-105 origin-center'
                                                            : 'text-google-text-secondary opacity-40 blur-[0.5px]'}
                                                    `}
                                                >
                                                    {line.content}
                                                </p>
                                            ))}

                                            <div className="mt-12 pt-8 border-t border-white/5">
                                                <div className="mt-8 flex flex-col items-center">
                                                    <p className="text-xs text-google-text-secondary mb-4 uppercase tracking-wider">Manual Research</p>
                                                    <div className="bg-google-surface/50 border border-white/5 p-6 rounded-[2rem] max-w-sm w-full space-y-4">
                                                        <div className="space-y-1 text-left">
                                                            <label className="text-[10px] font-bold text-google-text-secondary uppercase tracking-widest pl-1">Research Model</label>
                                                            <select
                                                                value={selectedModel}
                                                                onChange={(e) => setSelectedModel(e.target.value)}
                                                                className="w-full bg-google-surface border border-white/10 rounded-xl px-4 py-2 text-sm text-google-text focus:outline-none focus:ring-1 focus:ring-google-gold"
                                                            >
                                                                {modelOptions.map(model => (
                                                                    <option key={model.id} value={model.id}>{model.name}</option>
                                                                ))}
                                                            </select>
                                                        </div>

                                                        <button
                                                            onClick={() => handleResearch({ mode: 'auto', message: 'AI is researching...' })}
                                                            disabled={researching}
                                                            className="w-full py-3 bg-google-gold text-black rounded-xl font-bold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                                        >
                                                            {researching ? (
                                                                <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></span>
                                                            ) : (
                                                                <span>Research with Gemini</span>
                                                            )}
                                                        </button>
                                                        {statusMsg && <p className="text-[10px] text-center text-google-gold font-medium uppercase tracking-wider">{statusMsg}</p>}
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-20">
                                            <div className="w-16 h-16 bg-google-surface rounded-2xl flex items-center justify-center mb-4 opacity-50">
                                                <span className="text-xs">LRC</span>
                                            </div>
                                            <p className="text-google-text-secondary mb-8">No lyrics available yet.</p>

                                            <div className="bg-google-surface/50 border border-white/5 p-6 rounded-[2rem] max-w-sm w-full space-y-4">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-google-text-secondary uppercase tracking-widest pl-1">Research Model</label>
                                                    <select
                                                        value={selectedModel}
                                                        onChange={(e) => setSelectedModel(e.target.value)}
                                                        className="w-full bg-google-surface border border-white/10 rounded-xl px-4 py-2 text-sm text-google-text focus:outline-none focus:ring-1 focus:ring-google-gold"
                                                    >
                                                        {modelOptions.map(model => (
                                                            <option key={model.id} value={model.id}>{model.name}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <label className="flex items-center gap-2 cursor-pointer group">
                                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${transcriptionMode ? 'bg-google-gold border-google-gold' : 'border-google-text-secondary group-hover:border-google-text'}`}>
                                                        {transcriptionMode && (
                                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-black">
                                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                    <input
                                                        type="checkbox"
                                                        className="hidden"
                                                        checked={transcriptionMode}
                                                        onChange={(e) => setTranscriptionMode(e.target.checked)}
                                                    />
                                                    <span className={`text-xs ${transcriptionMode ? 'text-google-gold font-medium' : 'text-google-text-secondary group-hover:text-google-text'}`}>
                                                        Force Audio Transcription (Listen to file)
                                                    </span>
                                                </label>

                                                <button
                                                    onClick={() => handleResearch({
                                                        mode: transcriptionMode ? 'transcribe' : 'auto',
                                                        message: transcriptionMode ? 'Listening and transcribing...' : 'AI is researching...'
                                                    })}
                                                    disabled={researching}
                                                    className="w-full py-3 bg-google-gold text-black rounded-xl font-bold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                                >
                                                    {researching ? (
                                                        <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></span>
                                                    ) : (
                                                        <span>Research with Gemini</span>
                                                    )}
                                                </button>
                                                {statusMsg && <p className="text-[10px] text-center text-google-gold font-medium uppercase tracking-wider">{statusMsg}</p>}
                                            </div>
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
                                        <p className="text-sm">Path: <span className="text-google-text font-mono break-all">{song.file_path || 'Unknown'}</span></p>
                                    </div>
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
