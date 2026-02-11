import React, { useEffect, useState } from 'react';

const LibraryGrid = ({ refreshTrigger, onPlay, onView }) => {
    const [songs, setSongs] = useState([]);

    useEffect(() => {
        const fetchLibrary = async () => {
            try {
                const response = await fetch('http://localhost:8000/library');
                if (response.ok) {
                    const data = await response.json();
                    setSongs(data);
                }
            } catch (error) {
                console.error("Failed to fetch library:", error);
            }
        };

        fetchLibrary();
    }, [refreshTrigger]);

    if (songs.length === 0) {
        return (
            <div className="text-center py-20 border border-dashed border-google-surface-high rounded-[2rem] bg-google-surface/50">
                <div className="w-16 h-16 bg-google-surface-high rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl opacity-50">💿</span>
                </div>
                <h3 className="text-lg font-medium text-google-text mb-1">Your library is empty</h3>
                <p className="text-google-text-secondary text-sm max-w-xs mx-auto">
                    Paste a link above to start building your collection.
                </p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {songs.map((song) => (
                <div
                    key={song.id}
                    onClick={() => onView && onView(song)}
                    className="group relative bg-google-surface rounded-[1.5rem] overflow-hidden hover:bg-google-surface-high/50 transition-all duration-300 border border-transparent hover:border-google-surface-high cursor-pointer"
                >
                    {/* Image / Gradient Cover */}
                    <div className="aspect-square bg-google-surface-high relative overflow-hidden m-2 rounded-2xl">
                        {song.cover_url ? (
                            <img src={song.cover_url} alt={song.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center bg-google-surface-highest">
                                <span className="text-5xl opacity-20">
                                    🎵
                                </span>
                            </div>
                        )}

                        {/* Play Overlay */}
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onPlay && onPlay(song);
                                }}
                                className="w-12 h-12 bg-google-text rounded-full flex items-center justify-center text-google-bg hover:scale-105 transition-transform shadow-lg shadow-black/20"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 ml-0.5">
                                    <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    <div className="px-5 pb-5 pt-2">
                        <h3 className="font-medium text-google-text text-base truncate mb-0.5">{song.title}</h3>
                        <p className="text-google-text-secondary text-sm truncate mb-4">{song.artist}</p>

                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-1.5 text-[11px] text-google-text-secondary font-medium uppercase tracking-wide opacity-70">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                                    <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z" clipRule="evenodd" />
                                </svg>
                                {song.duration ? `${Math.floor(song.duration / 60)}:${String(song.duration % 60).padStart(2, '0')}` : '--:--'}
                            </div>

                            {song.lyrics_status === 'ready' ? (
                                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#C4E7FF]/10 text-[#C4E7FF] text-[10px] font-bold uppercase tracking-wider border border-[#C4E7FF]/20">
                                    Lyrics
                                </span>
                            ) : (
                                <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${song.lyrics_status === 'processing'
                                    ? 'bg-[#FFD8E4]/10 text-[#FFD8E4] border-[#FFD8E4]/20'
                                    : 'bg-[#E2E2E6]/10 text-[#E2E2E6] border-[#E2E2E6]/20'
                                    }`}>
                                    {song.lyrics_status || 'Unavailable'}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default LibraryGrid;
