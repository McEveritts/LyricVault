import React, { useEffect, useRef, useState } from 'react';
import API_BASE from '../config/api';

const DiscoveryView = ({ onIngest, onQueueNext, onAddToQueue }) => {
    const [query, setQuery] = useState('');
    const [platform, setPlatform] = useState('youtube');
    const [socialSources, setSocialSources] = useState(['instagram', 'tiktok', 'facebook']);
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const isUrlQuery = /^https?:\/\//i.test(query.trim());
    const pendingJobActionsRef = useRef({});

    const socialOptions = [
        { id: 'instagram', label: 'Instagram' },
        { id: 'tiktok', label: 'TikTok' },
        { id: 'facebook', label: 'Facebook' },
    ];

    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                q: query,
                platform,
            });
            if (platform === 'social') {
                params.set('social_sources', socialSources.join(','));
            }

            const response = await fetch(`${API_BASE}/search?${params.toString()}`);
            if (response.ok) {
                const data = await response.json();
                setResults(data);
            } else {
                throw new Error("Search failed");
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const onEvent = async (e) => {
            const msg = e?.detail;
            if (!msg || msg.event !== 'job') return;
            const job = msg.data || {};
            const pending = pendingJobActionsRef.current[job.id];
            if (!pending) return;
            if (job.status !== 'completed' && job.status !== 'failed') return;

            delete pendingJobActionsRef.current[job.id];
            try { pending.setStatus('idle'); } catch { /* best-effort */ }

            if (job.status !== 'completed') return;

            let songId = null;
            try {
                const parsed = JSON.parse(job.result_json || '{}');
                songId = parsed.song_id;
            } catch { songId = null; }
            if (!songId) return;

            try {
                const songRes = await fetch(`${API_BASE}/song/${songId}`);
                if (!songRes.ok) return;
                const songData = await songRes.json();
                const callback = pending.actionType === 'queueNext' ? onQueueNext : onAddToQueue;
                if (callback && songData) callback(songData);
            } catch (err) {
                console.error('Failed to resolve song from SSE job:', err);
            }
        };

        window.addEventListener('lyricvault:event', onEvent);
        return () => window.removeEventListener('lyricvault:event', onEvent);
    }, [onQueueNext, onAddToQueue]);

    const registerPendingJob = (jobId, actionType, setStatus) => {
        pendingJobActionsRef.current[jobId] = { actionType, setStatus };
    };

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-500">
            <header className="p-8 border-b border-white/5 backdrop-blur-sm sticky top-0 z-30 bg-google-bg/80">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h2 className="text-3xl font-normal text-google-text tracking-tight">Discover</h2>
                        <p className="text-google-text-secondary text-sm mt-1">Search and ingest from across the web</p>
                    </div>

                    <form onSubmit={handleSearch} className="flex-1 max-w-2xl flex items-center bg-google-surface rounded-full border border-google-surface-high shadow-xl focus-within:ring-2 focus-within:ring-google-gold transition-all relative z-40">
                        <div className="relative group">
                            <PlatformSelector selected={platform} onChange={setPlatform} />
                        </div>
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={platform === 'social'
                                ? 'Search Social Media or paste a direct social URL...'
                                : `Search for music on ${platform.charAt(0).toUpperCase() + platform.slice(1)}...`}
                            className="flex-1 px-6 py-3 bg-transparent text-google-text placeholder-google-text-secondary/30 focus:outline-none text-sm"
                        />

                        <button
                            type="submit"
                            disabled={loading || !query.trim()}
                            className="mr-1.5 w-10 h-10 flex items-center justify-center rounded-full bg-google-gold text-black hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                            aria-label="Search"
                        >
                            {loading ? (
                                <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></span>
                            ) : (
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            )}
                        </button>
                    </form>
                </div>
                {platform === 'social' && (
                    <div className="max-w-6xl mx-auto mt-5 flex flex-wrap items-center gap-2">
                        <span className="text-[11px] uppercase tracking-widest text-google-text-secondary/70">Social Sources</span>
                        {socialOptions.map(source => {
                            const selected = socialSources.includes(source.id);
                            return (
                                <button
                                    key={source.id}
                                    type="button"
                                    onClick={() => {
                                        setSocialSources(prev => {
                                            if (prev.includes(source.id)) {
                                                if (prev.length === 1) return prev;
                                                return prev.filter(id => id !== source.id);
                                            }
                                            return [...prev, source.id];
                                        });
                                    }}
                                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${selected
                                        ? 'bg-google-gold/10 text-google-gold border-google-gold/20'
                                        : 'bg-white/5 text-google-text-secondary border-white/10 hover:text-google-text'}`}
                                >
                                    {source.label}
                                </button>
                            );
                        })}
                    </div>
                )}
            </header>

            <main className="flex-1 overflow-y-auto p-8">
                <div className="max-w-6xl mx-auto">
                    {error && (
                        <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm text-center flex items-center justify-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                            </svg>
                            {error}
                        </div>
                    )}

                    {loading && results.length === 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[1, 2, 3, 4, 5, 6].map(i => (
                                <div key={i} className="bg-google-surface rounded-3xl p-4 border border-white/5 animate-pulse h-64"></div>
                            ))}
                        </div>
                    )}

                    {!loading && results.length === 0 && !error && (
                        <div className="flex flex-col items-center justify-center py-32 opacity-30 text-google-text-secondary">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-24 h-24 mb-6">
                                <path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 100 13.5 6.75 6.75 0 000-13.5zM2.25 10.5a8.25 8.25 0 1114.59 5.28l4.69 4.69a.75.75 0 11-1.06 1.06l-4.69-4.69A8.25 8.25 0 012.25 10.5z" clipRule="evenodd" />
                            </svg>
                            <p className="text-xl">Search to find music to ingest</p>
                        </div>
                    )}

                    {platform === 'social' && !loading && results.length === 0 && query.trim() && !isUrlQuery && (
                        <div className="mb-8 p-4 bg-google-gold/10 border border-google-gold/20 rounded-2xl text-google-gold text-sm">
                            Social keyword search is currently best-effort. For reliable ingest, paste a direct Instagram, TikTok, or Facebook post/video URL.
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {results.map((result) => (
                            <SearchResultItem
                                key={result.id}
                                result={result}
                                onIngest={onIngest}
                                onQueueNext={onQueueNext}
                                onAddToQueue={onAddToQueue}
                                registerPendingJob={registerPendingJob}
                            />
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
};

const SearchResultItem = ({ result, onIngest, registerPendingJob }) => {
    const [status, setStatus] = useState('idle'); // 'idle', 'ingesting', 'queuing'

    const handleAction = async (actionType) => {
        setStatus(actionType === 'ingest' ? 'ingesting' : 'queuing');
        try {
            const response = await fetch(`${API_BASE}/ingest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: result.url }),
            });
            if (!response.ok) throw new Error(`Ingest failed`);
            const jobData = await response.json();
            if (onIngest) onIngest();
            if (actionType === 'queueNext' || actionType === 'addToQueue') {
                if (jobData?.id) {
                    registerPendingJob?.(jobData.id, actionType, setStatus);
                } else {
                    setStatus('idle');
                }
            }
        } catch (err) {
            console.error(`${actionType} failed:`, err);
        } finally {
            if (actionType === 'ingest') setStatus('idle');
        }
    };

    return (
        <div className="bg-google-surface hover:bg-google-surface-high border border-white/5 rounded-[2rem] p-4 transition-all group relative overflow-hidden flex flex-col h-full shadow-lg hover:shadow-google-gold/5">
            <div className="aspect-video rounded-2xl overflow-hidden mb-4 bg-black/40 relative">
                <img src={result.thumbnail} alt={result.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                <div className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-md text-[10px] font-bold text-white uppercase tracking-widest border border-white/10">
                    {result.duration ? `${Math.floor(result.duration / 60)}:${(result.duration % 60).toString().padStart(2, '0')}` : '--:--'}
                </div>
                <div className="absolute top-2 left-2 px-2 py-1 rounded-full bg-black/60 backdrop-blur-md flex items-center gap-1.5 border border-white/10 text-white shadow-lg">
                    {result.platform === 'youtube' && <><svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg><span className="text-[10px] font-bold uppercase tracking-wide">YouTube</span></>}
                    {result.platform === 'spotify' && <><svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.48.66.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" /></svg><span className="text-[10px] font-bold uppercase tracking-wide">Spotify</span></>}
                    {result.platform === 'soundcloud' && <><svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M1.175 12.225c-.155 0-.294-.035-.418-.105A.827.827 0 0 1 .15 11.45c.07-.35.295-.565.675-.65 2.505-.595 5.25.92 6.8 3.52 1.25 2.1 1.225 4.505.025 6.075-.15.2-.24.475-.275.825.1.845.545 1.35 1.325 1.525.755.165 1.485-.145 2.175-.925 1.835-2.07 1.88-5.325.2-8.325-.56-1 .04-1.745.85-2.075 2.45-1 6.575-1.025 8.275 1.95.4 1.325-1.425 4.45-6.175 4.675-1.15.05-1.95.5-2.4 1.325-.8 1.475.05 2.525 1.7 2.625 6.95.425 10.9-4.8 10.325-7.925-.8-4.325-6.65-4.475-10.4-3.575-1.375.325-1.825-.375-1.625-1.425.6-3.15 4.35-4.575 8.4-3.1 1.05.375 1.625.325 1.8-.175.225-.6-.05-1.125-.8-1.4-5.2-1.9-9.875 0-10.475 3.325-1.025 5.675-1.1 7.4-.2 5.175-.48 1.205-.826 2.015-1.037 2.433z" /></svg><span className="text-[10px] font-bold uppercase tracking-wide">SoundCloud</span></>}
                    {result.platform === 'tiktok' && <><svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.03 5.91-.05 8.81-.4 2.91-2.9 5.35-5.8 5.63-2.95.29-5.93-.56-8.15-2.41-1.93-1.61-2.51-4.26-1.57-6.53.94-2.27 3.32-3.79 5.79-3.71v4.07c-1.25.12-2.39 1.07-2.6 2.31-.22 1.24.47 2.47 1.63 2.93 1.16.46 2.53.07 3.23-.98.71-1.06.56-2.44.57-3.7-.01-5.06-.01-10.12 0-15.18h2.91v.01z" /></svg><span className="text-[10px] font-bold uppercase tracking-wide">TikTok</span></>}
                    {result.platform === 'instagram' && <><svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.069-4.85.069-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg><span className="text-[10px] font-bold uppercase tracking-wide">Instagram</span></>}
                    {result.platform === 'facebook' && <><svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg><span className="text-[10px] font-bold uppercase tracking-wide">Facebook</span></>}
                </div>
                <button
                    onClick={() => handleAction('ingest')}
                    disabled={status !== 'idle'}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-google-gold text-black flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100 shadow-xl z-20"
                >
                    {status === 'ingesting' ? (
                        <div className="w-6 h-6 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    ) : (
                        <svg className="w-7 h-7 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                    )}
                </button>
            </div>

            <h3 className="text-white font-medium truncate mb-1">{result.title}</h3>
            <p className="text-google-text-secondary text-xs truncate mb-4">{result.uploader || result.artist}</p>

            <div className="flex items-center gap-2 mt-auto">
                <button
                    onClick={() => handleAction('queueNext')}
                    disabled={status !== 'idle'}
                    className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-white transition-colors"
                >
                    Play Next
                </button>
                <button
                    onClick={() => handleAction('addToQueue')}
                    disabled={status !== 'idle'}
                    className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-white transition-colors"
                >
                    Add to Queue
                </button>
            </div>

            {(status === 'queuing' || status === 'ingesting') && (
                <div className="absolute inset-x-0 bottom-0 h-1 bg-google-gold/20">
                    <div className="h-full bg-google-gold animate-progress" style={{ width: '100%' }}></div>
                </div>
            )}
        </div>
    );
};

const PlatformSelector = ({ selected, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const platforms = [
        { id: 'youtube', label: 'YouTube', icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>, color: 'text-google-gold' },
        { id: 'spotify', label: 'Spotify', icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.48.66.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" /></svg>, color: 'text-[#1DB954]' },
        { id: 'soundcloud', label: 'SoundCloud', icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M1.175 12.225c-.155 0-.294-.035-.418-.105A.827.827 0 0 1 .15 11.45c.07-.35.295-.565.675-.65 2.505-.595 5.25.92 6.8 3.52 1.25 2.1 1.225 4.505.025 6.075-.15.2-.24.475-.275.825.1.845.545 1.35 1.325 1.525.755.165 1.485-.145 2.175-.925 1.835-2.07 1.88-5.325.2-8.325-.56-1 .04-1.745.85-2.075 2.45-1 6.575-1.025 8.275 1.95.4 1.325-1.425 4.45-6.175 4.675-1.15.05-1.95.5-2.4 1.325-.8 1.475.05 2.525 1.7 2.625 6.95.425 10.9-4.8 10.325-7.925-.8-4.325-6.65-4.475-10.4-3.575-1.375.325-1.825-.375-1.625-1.425.6-3.15 4.35-4.575 8.4-3.1 1.05.375 1.625.325 1.8-.175.225-.6-.05-1.125-.8-1.4-5.2-1.9-9.875 0-10.475 3.325-1.025 5.675-1.1 7.4-.2 5.175-.48 1.205-.826 2.015-1.037 2.433z" /></svg>, color: 'text-[#FF5500]' },
        { id: 'social', label: 'Social Media', icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M7.5 4.5A3 3 0 109 9.75a3 3 0 00-1.5-5.25zm9 0a3 3 0 100 6 3 3 0 000-6zM5.25 13.5a3.75 3.75 0 00-3.75 3.75v1.5a.75.75 0 00.75.75h9a.75.75 0 00.75-.75v-1.5a3.75 3.75 0 00-3.75-3.75h-3zm10.5 0A3.75 3.75 0 0012 17.25v1.5a.75.75 0 00.75.75h9a.75.75 0 00.75-.75v-1.5a3.75 3.75 0 00-3.75-3.75h-3z" /></svg>, color: 'text-google-gold' },
    ];

    const current = platforms.find(p => p.id === selected) || platforms[0];

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                onBlur={() => setTimeout(() => setIsOpen(false), 200)}
                className="flex items-center gap-3 pl-8 pr-10 h-12 border-r border-white/5 bg-transparent hover:bg-white/5 transition-colors group"
            >
                <span className="text-sm">{current.icon}</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-google-text-secondary group-hover:text-google-text transition-colors">
                    {current.label}
                </span>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-google-text-secondary group-hover:text-google-text transition-transform duration-300" style={{ transform: `translateY(-50%) rotate(${isOpen ? '180deg' : '0deg'})` }}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-48 bg-google-surface-high/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                    {platforms.map((p) => (
                        <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                                onChange(p.id);
                                setIsOpen(false);
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/5 ${selected === p.id ? 'bg-google-gold/10' : ''}`}
                        >
                            <span className="text-sm">{p.icon}</span>
                            <span className={`text-[10px] font-bold uppercase tracking-widest ${selected === p.id ? 'text-google-gold' : 'text-google-text-secondary hover:text-google-text'}`}>
                                {p.label}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default DiscoveryView;
