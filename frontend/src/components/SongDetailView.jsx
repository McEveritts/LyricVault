import React, { useEffect, useMemo, useRef, useState } from 'react';
import API_BASE from '../config/api';
import Visualizer from './Visualizer';

const SongDetailView = ({ song, isPlaying, onPlayPause, onNext, onPrevious, onSeek, onSongUpdated, onOpenSettings, isEmpty, currentTime, duration, analyser }) => {
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

    const canDisplayLyrics = ['ready', 'unsynced'].includes(song?.lyrics_status);

    const lyrics = useMemo(() => {
        if (!song?.lyrics || !canDisplayLyrics) return [];

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
    }, [song, canDisplayLyrics]);

    const hasLyrics = lyrics.length > 0 && song?.lyrics !== 'Lyrics not found.';
    const hasTimedLyrics = lyrics.some(line => line.time >= 0);

    const activeLineIndex = useMemo(() => {
        if (!lyrics.length || !hasTimedLyrics) return -1;

        for (let i = lyrics.length - 1; i >= 0; i -= 1) {
            if (lyrics[i].time >= 0 && lyrics[i].time <= currentTime) {
                return i;
            }
        }

        return -1;
    }, [lyrics, currentTime, hasTimedLyrics]);

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
                setStatusMsg(data.synced ? 'Synced lyrics updated.' : 'Unsynced lyrics saved.');
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
                <div className="w-24 h-24 bg-google-surface border border-google-surface-high rounded-full flex items-center justify-center mb-6 shadow-inner text-google-text-secondary">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12 opacity-50">
                        <path fillRule="evenodd" d="M19.952 1.651a.75.75 0 01.298.599V16.303a3 3 0 01-2.176 5.963l-1.385-.558a2.5 2.5 0 01-.132.062 4.418 4.418 0 01-4.041-.275l-4.731-2.583a2.49 2.49 0 01-1.282-2.193v-4.838a2.5 2.5 0 01.666-1.696l4.205-4.485C11.97 5.253 12.68 4.966 13.433 5c-.171-.235-.348-.465-.533-.687l-2.027-2.285A2.49 2.49 0 0110.198.243l6.502-3.82a.75.75 0 111.96.98l-3.326 1.954c.78.293 1.554.806 2.193 1.484l2.425 .81z" clipRule="evenodd" />
                    </svg>
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
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-google-surface to-google-surface-high z-10 relative text-google-text-secondary">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-32 h-32 opacity-20">
                                        <path fillRule="evenodd" d="M19.952 1.651a.75.75 0 01.298.599V16.303a3 3 0 01-2.176 5.963l-1.385-.558a2.5 2.5 0 01-.132.062 4.418 4.418 0 01-4.041-.275l-4.731-2.583a2.49 2.49 0 01-1.282-2.193v-4.838a2.5 2.5 0 01.666-1.696l4.205-4.485C11.97 5.253 12.68 4.966 13.433 5c-.171-.235-.348-.465-.533-.687l-2.027-2.285A2.49 2.49 0 0110.198.243l6.502-3.82a.75.75 0 111.96.98l-3.326 1.954c.78.293 1.554.806 2.193 1.484l2.425 .81z" clipRule="evenodd" />
                                    </svg>
                                </div>
                            )}

                            <div className="absolute inset-0 z-0 flex items-end justify-center opacity-40">
                                <Visualizer analyser={analyser} isPlaying={isPlaying} height={100} width={400} />
                            </div>

                            <div className={`absolute inset-0 bg-black/40 flex flex-col items-center justify-center transition-opacity duration-300 ${isPlaying ? 'opacity-0 hover:opacity-100' : 'opacity-100'}`}>
                                <div className="flex items-center gap-6 mb-6">
                                    <button onClick={(e) => { e.stopPropagation(); onPrevious(); }} className="text-white/70 hover:text-white transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10">
                                            <path d="M9.195 18.44c1.25.713 2.805-.19 2.805-1.629v-2.873h8.17s.63 0 .63-.63v-2.616c0-.63-.63-.63-.63-.63h-8.17V7.19c0-1.438-1.555-2.342-2.805-1.628l-8.682 6.095c-1.178.507-1.178 2.059 0 2.566l8.682 4.217z" />
                                            <path fillRule="evenodd" d="M3 12a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75A.75.75 0 013 12z" clipRule="evenodd" />
                                            <path d="M20.25 5.25a.75.75 0 01.75.75v12a.75.75 0 01-1.5 0v-12a.75.75 0 01.75-.75zM3.937 11.293l8.682-6.095a2.025 2.025 0 013.13 1.702v10.2c0 1.629-1.88 2.443-3.13 1.701l-8.682-6.095c-1.179-.828-1.179-2.385 0-3.213z" />
                                        </svg>
                                    </button>

                                    <button
                                        onClick={(e) => { e.stopPropagation(); onPlayPause(); }}
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

                                    <button onClick={(e) => { e.stopPropagation(); onNext(); }} className="text-white/70 hover:text-white transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10">
                                            <path d="M14.805 18.44a2.025 2.025 0 01-3.13-1.702v-2.873H3.5a.63.63 0 01-.63-.63v-2.616c0-.63.63-.63.63-.63h8.175V7.19a2.025 2.025 0 013.13-1.701l8.682 6.095c1.179.828 1.179 2.385 0 3.213l-8.682 6.095zM3 5.25a.75.75 0 01.75.75v12a.75.75 0 01-1.5 0v-12a.75.75 0 01.75-.75z" />
                                        </svg>
                                    </button>
                                </div>

                                <div className="w-3/4 max-w-xs flex items-center gap-3" onClick={e => e.stopPropagation()}>
                                    <span className="text-xs font-medium text-white/80 w-10 text-right">
                                        {Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, '0')}
                                    </span>
                                    <input
                                        type="range"
                                        min={0}
                                        max={duration || 100}
                                        value={currentTime}
                                        onChange={(e) => onSeek(Number(e.target.value))}
                                        className="flex-1 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-125"
                                    />
                                    <span className="text-xs font-medium text-white/80 w-10">
                                        {duration ? `${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, '0')}` : '--:--'}
                                    </span>
                                </div>
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
                                {(song.lyrics_status === 'unsynced') && (
                                    <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-300 text-xs font-medium border border-amber-500/20">
                                        Unsynced Lyrics
                                    </span>
                                )}
                                {hasLyrics && (
                                    <div className="flex items-center gap-2 border-l border-white/10 pl-3 ml-1">
                                        <button
                                            onClick={handleExportTxt}
                                            className="text-xs font-semibold text-google-text bg-google-surface-high hover:bg-google-gold hover:text-black transition-colors px-3 py-1.5 rounded-lg"
                                            title="Export TXT"
                                        >
                                            Export TXT
                                        </button>
                                        <button
                                            onClick={handleExportCsv}
                                            className="text-xs font-semibold text-google-text bg-google-surface-high hover:bg-google-gold hover:text-black transition-colors px-3 py-1.5 rounded-lg"
                                            title="Export CSV"
                                        >
                                            Export CSV
                                        </button>
                                    </div>
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


                                            {lyrics.map((line, i) => (
                                                <p
                                                    key={i}
                                                    ref={i === activeLineIndex ? activeLineRef : null}
                                                    className={`text-lg transition-all duration-300 cursor-pointer hover:opacity-80
                                                    ${activeLineIndex !== -1
                                                            ? (i === activeLineIndex
                                                                ? 'text-google-text font-bold scale-105 origin-center'
                                                                : 'text-google-text-secondary opacity-40 blur-[0.5px]')
                                                            : 'text-google-text-secondary opacity-85'}
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
                                            <div className="w-16 h-16 bg-google-surface rounded-2xl flex items-center justify-center mb-4 opacity-50 text-google-text-secondary">
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                                </svg>
                                            </div>
                                            <p className="text-google-text-secondary mb-8">
                                                {song.lyrics_status === 'unavailable'
                                                    ? 'Strict mode hides unsynced lyrics. Disable Strict LRC in Settings to view plain-text results.'
                                                    : 'No lyrics available yet.'}
                                            </p>
                                            {song.lyrics_status === 'unavailable' && (
                                                <button
                                                    onClick={() => onOpenSettings?.()}
                                                    className="mb-6 rounded-xl border border-google-gold/40 px-4 py-2 text-xs font-semibold text-google-gold hover:bg-google-gold/10 transition-colors"
                                                >
                                                    Open Settings
                                                </button>
                                            )}

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
