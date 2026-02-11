import React, { useState } from 'react';

const DiscoveryView = ({ onIngest }) => {
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
            const response = await fetch(`http://localhost:8000/search?q=${encodeURIComponent(query)}&platform=${platform}`);
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

                    <form onSubmit={handleSearch} className="flex-1 max-w-2xl flex items-center bg-google-surface rounded-full border border-google-surface-high shadow-lg focus-within:ring-2 focus-within:ring-google-gold transition-all relative">
                        <div className="relative group">
                            <select
                                value={platform}
                                onChange={(e) => setPlatform(e.target.value)}
                                className="appearance-none bg-transparent text-google-text-secondary text-[10px] font-bold uppercase tracking-widest pl-8 pr-12 focus:outline-none border-r border-white/5 h-12 cursor-pointer hover:text-google-text transition-colors z-10 relative"
                            >
                                <option value="youtube">YouTube</option>
                                <option value="spotify">Spotify</option>
                                <option value="soundcloud">SoundCloud</option>
                            </select>
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-xs">
                                {platform === 'youtube' ? '🔴' : platform === 'spotify' ? '🟢' : '🟠'}
                            </div>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-google-text-secondary group-hover:text-google-text transition-colors">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
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
                            />
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
};

const SearchResultItem = ({ result, onIngest }) => {
    const [ingesting, setIngesting] = useState(false);

    const handleIngest = async () => {
        setIngesting(true);
        try {
            const response = await fetch('http://localhost:8000/ingest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: result.url }),
            });
            if (response.ok) {
                if (onIngest) onIngest();
            }
        } catch (err) {
            console.error("Ingestion failed:", err);
        } finally {
            setIngesting(false);
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
                    {Math.floor(result.duration / 60)}:{(result.duration % 60).toString().padStart(2, '0')}
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

            <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-bold uppercase tracking-widest text-google-text-secondary hover:text-google-gold transition-colors"
                >
                    View Source
                </a>
                <button
                    onClick={handleIngest}
                    disabled={ingesting}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${ingesting
                        ? 'bg-google-surface-high text-google-text-secondary'
                        : 'bg-white/5 text-white hover:bg-google-gold hover:text-black shadow-inner'
                        }`}
                >
                    {ingesting ? (
                        <>
                            <span className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                            <span>Adding...</span>
                        </>
                    ) : (
                        <>
                            <span>Add to Library</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default DiscoveryView;
