import React, { useState, useEffect } from 'react';

const ProcessingView = () => {
    const [songs, setSongs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const response = await fetch('http://localhost:8000/library');
                if (response.ok) {
                    const data = await response.json();
                    setSongs(data);
                }
            } catch (error) {
                console.error("Failed to fetch library:", error);
            }
            setLoading(false);
        };

        fetchStatus();
        // Poll every 3 seconds for updates
        const interval = setInterval(fetchStatus, 3000);
        return () => clearInterval(interval);
    }, []);

    const processingCount = songs.filter(s => s.lyrics_status === 'processing').length;
    const readyCount = songs.filter(s => s.lyrics_status === 'ready').length;
    const unavailableCount = songs.filter(s => s.lyrics_status === 'unavailable').length;

    return (
        <>
            <header className="p-8 border-b border-white/5 backdrop-blur-sm sticky top-0 z-30 bg-[#0A0F1E]/80">
                <div className="max-w-4xl mx-auto">
                    <h2 className="text-2xl font-bold text-white">Processing Queue</h2>
                    <p className="text-slate-400 text-sm">Monitor lyrics fetching and transcription status</p>
                </div>
            </header>

            <main className="max-w-4xl mx-auto py-8 px-8 space-y-8">
                {/* Status Overview */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-center">
                        <div className="text-3xl font-bold text-amber-400">{processingCount}</div>
                        <div className="text-sm text-amber-400/70">Processing</div>
                    </div>
                    <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
                        <div className="text-3xl font-bold text-green-400">{readyCount}</div>
                        <div className="text-sm text-green-400/70">Ready</div>
                    </div>
                    <div className="bg-slate-500/10 border border-slate-500/20 rounded-xl p-4 text-center">
                        <div className="text-3xl font-bold text-slate-400">{unavailableCount}</div>
                        <div className="text-sm text-slate-400/70">Unavailable</div>
                    </div>
                </div>

                {/* Processing Queue */}
                {processingCount > 0 && (
                    <section>
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                            Currently Processing
                        </h3>
                        <div className="space-y-2">
                            {songs.filter(s => s.lyrics_status === 'processing').map(song => (
                                <ProcessingItem key={song.id} song={song} />
                            ))}
                        </div>
                    </section>
                )}

                {/* All Songs Status */}
                <section>
                    <h3 className="text-lg font-semibold text-white mb-4">All Songs</h3>
                    {loading ? (
                        <div className="text-center py-8 text-slate-500">Loading...</div>
                    ) : songs.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            <span className="text-4xl mb-4 block">📋</span>
                            <p>No songs yet</p>
                            <p className="text-sm">Ingest songs from the Home tab</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {songs.map(song => (
                                <SongStatusItem key={song.id} song={song} />
                            ))}
                        </div>
                    )}
                </section>
            </main>
        </>
    );
};

const ProcessingItem = ({ song }) => (
    <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-amber-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
        </div>
        <div className="flex-1">
            <p className="text-white font-medium truncate">{song.title}</p>
            <p className="text-amber-400/70 text-sm">{song.artist}</p>
        </div>
        <div className="text-xs text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full">
            Fetching lyrics...
        </div>
    </div>
);

const SongStatusItem = ({ song }) => {
    const statusConfig = {
        ready: { bg: 'bg-green-500/10', border: 'border-green-500/20', dot: 'bg-green-400', text: 'text-green-400', label: 'Ready' },
        processing: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', dot: 'bg-amber-400 animate-pulse', text: 'text-amber-400', label: 'Processing' },
        unavailable: { bg: 'bg-slate-500/10', border: 'border-slate-500/20', dot: 'bg-slate-400', text: 'text-slate-400', label: 'Unavailable' }
    };
    const config = statusConfig[song.lyrics_status] || statusConfig.unavailable;

    return (
        <div className={`${config.bg} border ${config.border} rounded-lg p-3 flex items-center gap-3`}>
            <div className={`w-2 h-2 rounded-full ${config.dot}`}></div>
            <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{song.title}</p>
                <p className="text-slate-500 text-xs truncate">{song.artist}</p>
            </div>
            <span className={`text-xs ${config.text}`}>{config.label}</span>
        </div>
    );
};

export default ProcessingView;
