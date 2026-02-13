import React, { useEffect, useMemo, useState } from 'react';
import API_BASE from '../config/api';

const categories = ['All', 'Songs', 'Artists', 'Albums', 'Playlists'];

const LibraryGrid = ({ refreshTrigger, rehydratingSongIds = [], onPlay, onQueueNext, onAddToQueue, onView, recentOnly = false }) => {
    const [songs, setSongs] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('date_added'); // title, artist, date_added
    const [isSortOpen, setIsSortOpen] = useState(false);

    useEffect(() => {
        let isMounted = true;
        let debounce = null;

        const fetchLibrary = async () => {
            try {
                const response = await fetch(`${API_BASE}/library`);
                if (!response.ok) return;
                const data = await response.json();
                if (isMounted) {
                    setSongs(data);
                }
            } catch (error) {
                console.error('Failed to fetch library:', error);
            }
        };

        fetchLibrary();

        const scheduleFetch = () => {
            if (debounce) clearTimeout(debounce);
            debounce = setTimeout(fetchLibrary, 250);
        };

        const onEvent = (e) => {
            const msg = e?.detail;
            if (!msg || typeof msg !== 'object') return;
            if (msg.event === 'job' || msg.event === 'song') {
                scheduleFetch();
            }
        };
        window.addEventListener('lyricvault:event', onEvent);

        return () => {
            isMounted = false;
            if (debounce) clearTimeout(debounce);
            window.removeEventListener('lyricvault:event', onEvent);
        };
    }, [refreshTrigger]);

    const [category, setCategory] = useState('All');

    const filteredAndSortedSongs = useMemo(() => {
        let result = [...songs];

        if (recentOnly) {
            // For recent only, strictly sort by date added (newest first) and take top 4
            return result.sort((a, b) => (b.id || 0) - (a.id || 0)).slice(0, 4);
        }

        // Category Filter
        if (category !== 'All') {
            if (category === 'Artists') {
                if (category !== 'Songs') {
                    result = [];
                }
            } else if (category === 'Albums' || category === 'Playlists') {
                result = [];
            }
        }

        // Filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(song =>
                song.title.toLowerCase().includes(query) ||
                song.artist.toLowerCase().includes(query)
            );
        }

        // Sort
        result.sort((a, b) => {
            if (sortBy === 'title') return a.title.localeCompare(b.title);
            if (sortBy === 'artist') return a.artist.localeCompare(b.artist);
            if (sortBy === 'date_added') return (b.id || 0) - (a.id || 0);
            return 0;
        });

        return result;
    }, [songs, searchQuery, sortBy, recentOnly, category]);

    const sortOptions = {
        'date_added': 'Recently Added',
        'title': 'Title',
        'artist': 'Artist'
    };

    if (songs.length === 0 && !searchQuery) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center animate-in fade-in zoom-in duration-500">
                {!recentOnly && (
                    <div className="flex items-center gap-2 mb-20 bg-google-surface/50 p-1.5 rounded-full border border-white/5 backdrop-blur-md">
                        {categories.map((cat) => (
                            <button
                                key={cat}
                                onClick={() => setCategory(cat)}
                                className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 ${category === cat
                                    ? 'bg-google-surface-high text-white shadow-lg shadow-black/20'
                                    : 'text-google-text-secondary hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                )}

                <h3 className="text-3xl font-bold text-white mb-4 tracking-tight">Your Library is Empty</h3>
                <p className="text-google-text-secondary text-lg max-w-md mx-auto leading-relaxed">
                    Follow artists, save albums, like tracks, or create playlists to see them here.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Library Header / Controls - Only shown when NOT recentOnly */}
            {!recentOnly && (
                <div className="flex flex-col gap-4 -mt-24">
                    {/* Filter Tabs */}
                    <div className="flex justify-center">
                        <div className="flex items-center gap-2 bg-google-surface/50 p-1.5 rounded-full border border-white/5 backdrop-blur-md">
                            {categories.map((cat) => (
                                <button
                                    key={cat}
                                    onClick={() => setCategory(cat)}
                                    className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 ${category === cat
                                        ? 'bg-google-surface-high text-white shadow-lg shadow-black/20'
                                        : 'text-google-text-secondary hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-google-surface/40 p-3 rounded-[2rem] border border-white/5 backdrop-blur-xl pl-6 relative z-30">
                        <div className="relative flex-1 max-w-md group">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-google-text-secondary pointer-events-none group-focus-within:text-google-gold transition-colors">
                                <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                            </svg>
                            <input
                                type="text"
                                placeholder={`Search in ${category}...`}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-google-surface-high/50 border-none rounded-2xl py-3 pl-11 pr-4 text-sm text-google-text placeholder-google-text-secondary/40 focus:ring-2 focus:ring-google-gold/30 focus:outline-none transition-all"
                            />
                        </div>

                        <div className="flex items-center gap-3 relative z-[45]">
                            <span className="text-xs font-bold text-google-text-secondary uppercase tracking-widest opacity-60">Sort By</span>
                            <div className="relative">
                                <button
                                    onClick={() => setIsSortOpen(!isSortOpen)}
                                    className="bg-google-surface-high/50 hover:bg-google-surface-high rounded-2xl py-3 px-6 text-sm text-google-text font-medium flex items-center gap-2 min-w-[160px] justify-between transition-colors"
                                >
                                    {sortOptions[sortBy]}
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-4 h-4 transition-transform ${isSortOpen ? 'rotate-180' : ''}`}>
                                        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                                    </svg>
                                </button>

                                {isSortOpen && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setIsSortOpen(false)} />
                                        <div className="absolute right-0 top-full mt-2 w-full bg-google-surface-high border border-white/5 rounded-2xl shadow-xl overflow-hidden z-20 flex flex-col p-1">
                                            {Object.entries(sortOptions).map(([value, label]) => (
                                                <button
                                                    key={value}
                                                    onClick={() => {
                                                        setSortBy(value);
                                                        setIsSortOpen(false);
                                                    }}
                                                    className={`text-left px-4 py-3 text-sm rounded-xl transition-colors ${sortBy === value ? 'bg-white/10 text-white font-medium' : 'text-google-text-secondary hover:text-white hover:bg-white/5'}`}
                                                >
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Grid */}
            <div className={`grid gap-8 ${recentOnly ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'}`}>
                {filteredAndSortedSongs.map((song) => {
                    const isRehydrating = song.status === 're-downloading' || rehydratingSongIds.includes(song.id);
                    const isExpired = song.status === 'expired' && !isRehydrating;

                    return (
                        <div
                            key={song.id}
                            onClick={() => onView && onView(song)}
                            className="group flex flex-col cursor-pointer"
                        >
                            {/* Artwork with Elevation Effect */}
                            <div className="aspect-square bg-google-surface rounded-[2rem] relative overflow-hidden mb-4 shadow-lg group-hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] transition-all duration-500 ease-out group-hover:-translate-y-2 border border-white/5">
                                {song.cover_url ? (
                                    <img
                                        src={song.cover_url}
                                        alt={song.title}
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-google-surface-high to-google-surface text-google-text-secondary">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-16 h-16 opacity-20">
                                            <path fillRule="evenodd" d="M19.952 1.651a.75.75 0 01.298.599V16.303a3 3 0 01-2.176 5.963l-1.385-.558a2.5 2.5 0 01-.132.062 4.418 4.418 0 01-4.041-.275l-4.731-2.583a2.49 2.49 0 01-1.282-2.193v-4.838a2.5 2.5 0 01.666-1.696l4.205-4.485C11.97 5.253 12.68 4.966 13.433 5c-.171-.235-.348-.465-.533-.687l-2.027-2.285A2.49 2.49 0 0110.198.243l6.502-3.82a.75.75 0 111.96.98l-3.326 1.954c.78.293 1.554.806 2.193 1.484l2.425 .81z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                )}

                                {/* Apple Music style Play Button Overlay */}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center backdrop-blur-sm gap-4">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onPlay && onPlay(song);
                                        }}
                                        className="w-16 h-16 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white scale-90 group-hover:scale-100 transition-all duration-300 border border-white/20"
                                        title="Play Now"
                                        aria-label="Play Now"
                                    >
                                        {isRehydrating ? (
                                            <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 ml-1">
                                                <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                    </button>

                                    <div className="flex items-center gap-3 scale-90 group-hover:scale-100 transition-all duration-300 delay-75">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onQueueNext && onQueueNext(song);
                                            }}
                                            className="w-10 h-10 bg-white/5 hover:bg-google-gold hover:text-black hover:border-google-gold backdrop-blur-md rounded-2xl flex items-center justify-center text-white border border-white/10 transition-all"
                                            title="Play Next"
                                            aria-label="Play Next"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                                <path fillRule="evenodd" d="M2 10a.75.75 0 01.75-.75h12.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10z" clipRule="evenodd" />
                                                <path fillRule="evenodd" d="M10.22 5.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L13.94 10l-3.72-3.72a.75.75 0 010-1.06z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onAddToQueue && onAddToQueue(song);
                                            }}
                                            className="w-10 h-10 bg-white/5 hover:bg-white hover:text-black backdrop-blur-md rounded-2xl flex items-center justify-center text-white border border-white/10 transition-all"
                                            title="Add to Queue"
                                            aria-label="Add to Queue"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                                <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Song Info */}
                            <div className="px-2">
                                <h3 className="font-semibold text-google-text text-lg truncate group-hover:text-google-gold transition-colors">{song.title}</h3>
                                <p className="text-google-text-secondary text-sm truncate opacity-60 mb-3">{song.artist}</p>

                                <div className="flex items-center gap-3">
                                    {song.lyrics_status === 'ready' && (
                                        <span className="px-2.5 py-1 rounded-md bg-google-gold/10 text-google-gold text-[10px] font-black uppercase tracking-widest border border-google-gold/20">
                                            LRC
                                        </span>
                                    )}
                                    {song.lyrics_status === 'unsynced' && (
                                        <span className="px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-300 text-[10px] font-black uppercase tracking-widest border border-amber-500/30">
                                            Unsynced
                                        </span>
                                    )}
                                    {isRehydrating && (
                                        <span className="px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-300 text-[10px] font-black uppercase tracking-widest border border-blue-500/30">
                                            Preparing
                                        </span>
                                    )}
                                    {isExpired && (
                                        <span className="px-2.5 py-1 rounded-md bg-slate-500/15 text-slate-300 text-[10px] font-black uppercase tracking-widest border border-slate-500/30">
                                            Expired
                                        </span>
                                    )}
                                    <span className="text-[11px] font-mono text-google-text-secondary opacity-40">
                                        {song.duration ? `${Math.floor(song.duration / 60)}:${String(song.duration % 60).padStart(2, '0')}` : '--:--'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {filteredAndSortedSongs.length === 0 && (
                <div className="space-y-8 animate-in fade-in duration-700">
                    {!recentOnly && (
                        <div className="flex flex-col items-center mb-12">
                            <div className="flex items-center gap-2 bg-google-surface/50 p-1.5 rounded-full border border-white/5 backdrop-blur-md">
                                {categories.map((cat) => (
                                    <button
                                        key={cat}
                                        onClick={() => setCategory(cat)}
                                        className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 ${category === cat
                                            ? 'bg-google-surface-high text-white shadow-lg shadow-black/20'
                                            : 'text-google-text-secondary hover:text-white hover:bg-white/5'
                                            }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
                        <h3 className="text-2xl font-bold text-white mb-2 tracking-tight">
                            {searchQuery ? `No results for "${searchQuery}"` : `No ${category} found`}
                        </h3>
                        <p className="text-google-text-secondary text-base max-w-sm mx-auto">
                            Try adjusting your filters or search query.
                        </p>
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="text-google-gold text-sm font-medium mt-4 hover:underline"
                            >
                                Clear search
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div >
    );
};

export default LibraryGrid;
