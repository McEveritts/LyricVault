import React, { useEffect, useMemo, useState } from 'react';
import API_BASE from '../config/api';

const LibraryGrid = ({ refreshTrigger, rehydratingSongIds = [], onPlay, onQueueNext, onAddToQueue, onView }) => {
    const [songs, setSongs] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('date_added'); // title, artist, date_added

    useEffect(() => {
        let isMounted = true;

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
        const interval = setInterval(fetchLibrary, 5000);

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [refreshTrigger]);

    const filteredAndSortedSongs = useMemo(() => {
        let result = [...songs];

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
            if (sortBy === 'date_added') return (b.id || 0) - (a.id || 0); // Assuming higher ID is newer
            return 0;
        });

        return result;
    }, [songs, searchQuery, sortBy]);

    if (songs.length === 0) {
        return (
            <div className="text-center py-24 border border-dashed border-google-surface-high rounded-[2.5rem] bg-google-surface/30 backdrop-blur-sm">
                <div className="w-20 h-20 bg-google-surface-high rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                    <span className="text-3xl opacity-40">💿</span>
                </div>
                <h3 className="text-xl font-medium text-google-text mb-2">Your library is empty</h3>
                <p className="text-google-text-secondary text-sm max-w-sm mx-auto opacity-70">
                    Your personal sanctuary is ready. Paste a song link to start your collection.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Library Header / Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-google-surface/40 p-6 rounded-[2rem] border border-white/5 backdrop-blur-xl">
                <div className="relative flex-1 max-w-md group">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-google-text-secondary pointer-events-none group-focus-within:text-google-gold transition-colors">
                        <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search your library..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-google-surface-high/50 border-none rounded-2xl py-3 pl-11 pr-4 text-sm text-google-text placeholder-google-text-secondary/40 focus:ring-2 focus:ring-google-gold/30 focus:outline-none transition-all"
                    />
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-google-text-secondary uppercase tracking-widest opacity-60">Sort By</span>
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="bg-google-surface-high/50 border-none rounded-2xl py-3 px-6 text-sm text-google-text font-medium focus:ring-2 focus:ring-google-gold/30 focus:outline-none cursor-pointer appearance-none pr-10 relative"
                        style={{
                            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%23E2E2E6'%3E%3Cpath fill-rule='evenodd' d='M5.23 7.21l4.47 4.48a.75.75 0 001.06 0l4.47-4.48a.75.75 0 111.06 1.06l-5 5a.75.75 0 01-1.06 0l-5-5a.75.75 0 111.06-1.06z' clip-rule='evenodd'/%3E%3C/svg%3E")`,
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'right 1rem center',
                            backgroundSize: '1.25rem'
                        }}
                    >
                        <option value="date_added">Recently Added</option>
                        <option value="title">Title</option>
                        <option value="artist">Artist</option>
                    </select>
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-8">
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
                                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-google-surface-high to-google-surface">
                                        <span className="text-6xl opacity-20">🎵</span>
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

            {filteredAndSortedSongs.length === 0 && songs.length > 0 && (
                <div className="text-center py-20">
                    <p className="text-google-text-secondary opacity-50">No results matching "{searchQuery}"</p>
                    <button
                        onClick={() => setSearchQuery('')}
                        className="text-google-gold text-sm font-medium mt-2 hover:underline"
                    >
                        Clear search
                    </button>
                </div>
            )}
        </div>
    );
};

export default LibraryGrid;
