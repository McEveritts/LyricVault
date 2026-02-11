import React, { useState } from 'react';
import API_BASE from '../config/api';

const DiscoveryView = ({ onIngest, onQueueNext, onAddToQueue }) => {
    const [query, setQuery] = useState('');
    const [platform, setPlatform] = useState('youtube');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}&platform=${platform}`);
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
                            placeholder={`Search for music on ${platform.charAt(0).toUpperCase() + platform.slice(1)}...`}
                            className="flex-1 px-6 py-3 bg-transparent text-google-text placeholder-google-text-secondary/30 focus:outline-none text-sm"
                        />

                        <button
                            type="submit"
                            disabled={loading || !query.trim()}
                            className="mr-1.5 w-10 h-10 flex items-center justify-center rounded-full bg-google-gold text-black hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
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
            </header>

            <main className="flex-1 overflow-y-auto p-8">
                <div className="max-w-6xl mx-auto">
                    {error && (
                        <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm text-center">
                            ⚠️ {error}
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
                            <span className="text-6xl mb-6">🔍</span>
                            <p className="text-xl">Search to find music to ingest</p>
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
                            />
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
};

const SearchResultItem = ({ result, onIngest, onQueueNext, onAddToQueue }) => {
    const [status, setStatus] = useState('idle'); // 'idle', 'ingesting', 'queuing'

    const handleAction = async (actionType) => {
        setStatus(actionType === 'ingest' ? 'ingesting' : 'queuing');
        try {
            const response = await fetch(`${API_BASE}/ingest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: result.url }),
            });
            if (response.ok) {
                const songData = await response.json();
                // If it was just an ingest, call onIngest
                if (actionType === 'ingest') {
                    if (onIngest) onIngest();
                } else if (actionType === 'queueNext') {
                    if (onQueueNext) onQueueNext(songData);
                } else if (actionType === 'addToQueue') {
                    if (onAddToQueue) onAddToQueue(songData);
                }
            }
        } catch (err) {
            console.error(`${actionType} failed:`, err);
        } finally {
            setStatus('idle');
        }
    };

    return (
        <div className="bg-google-surface hover:bg-google-surface-high border border-white/5 rounded-[2rem] p-4 transition-all group relative overflow-hidden flex flex-col h-full shadow-lg hover:shadow-google-gold/5">
            <div className="aspect-video rounded-2xl overflow-hidden mb-4 bg-black/40 relative">
                <img
                    src={result.thumbnail}
                    alt={result.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-md text-[10px] font-bold text-white uppercase tracking-widest border border-white/10">
                    {result.duration ? `${Math.floor(result.duration / 60)}:${(result.duration % 60).toString().padStart(2, '0')}` : '--:--'}
                </div>
                {/* Platform Badge */}
                <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10">
                    <span className="text-[10px]">{result.platform === 'youtube' ? '🔴' : result.platform === 'spotify' ? '🟢' : '🟠'}</span>
                </div>
            </div>

            <div className="flex-1">
                <h4 className="text-base font-bold text-google-text line-clamp-2 leading-tight mb-1">{result.title}</h4>
                <p className="text-xs text-google-text-secondary truncate font-medium">{result.artist}</p>
            </div>

            <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => handleAction('queueNext')}
                        disabled={status !== 'idle'}
                        className="w-8 h-8 rounded-full bg-white/5 hover:bg-google-gold hover:text-black flex items-center justify-center transition-all disabled:opacity-50"
                        title="Play Next"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                            <path fillRule="evenodd" d="M2 10a.75.75 0 01.75-.75h12.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10z" clipRule="evenodd" />
                            <path fillRule="evenodd" d="M10.22 5.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L13.94 10l-3.72-3.72a.75.75 0 010-1.06z" clipRule="evenodd" />
                        </svg>
                    </button>
                    <button
                        onClick={() => handleAction('addToQueue')}
                        disabled={status !== 'idle'}
                        className="w-8 h-8 rounded-full bg-white/5 hover:bg-white hover:text-black flex items-center justify-center transition-all disabled:opacity-50"
                        title="Add to Queue"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                            <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                        </svg>
                    </button>
                </div>

                <button
                    onClick={() => handleAction('ingest')}
                    disabled={status !== 'idle'}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${status === 'ingesting'
                        ? 'bg-google-surface-high text-google-text-secondary'
                        : 'bg-white/5 text-white hover:bg-google-gold hover:text-black shadow-inner'
                        }`}
                >
                    {status === 'ingesting' ? (
                        <>
                            <span className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                            <span>Adding...</span>
                        </>
                    ) : (
                        <span>Add to Library</span>
                    )}
                </button>
            </div>
        </div>
    );
};

const PlatformSelector = ({ selected, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const platforms = [
        { id: 'youtube', label: 'YouTube', icon: '🔴', color: 'text-google-gold' },
        { id: 'spotify', label: 'Spotify', icon: '🟢', color: 'text-[#1DB954]' },
        { id: 'soundcloud', label: 'SoundCloud', icon: '🟠', color: 'text-[#FF5500]' },
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
