import React, { useState, useEffect } from 'react';
import API_BASE from '../config/api';

const ProcessingView = () => {
    const [songs, setSongs] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch library for overall status
                const libRes = await fetch(`${API_BASE}/library`);
                if (libRes.ok) {
                    const data = await libRes.json();
                    setSongs(data);
                }

                // Fetch active tasks for live progress
                const taskRes = await fetch(`${API_BASE}/jobs/active`);
                if (taskRes.ok) {
                    const data = await taskRes.json();
                    setTasks(data);
                }
            } catch (error) {
                console.error("Failed to fetch data:", error);
            }
            setLoading(false);
        };

        fetchData();
        const interval = setInterval(fetchData, 1500); // Poll faster for "Live" feel
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

                {/* Live Tasks */}
                {tasks.length > 0 && (
                    <section className="animate-in slide-in-from-top-4 duration-500">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-google-gold animate-pulse"></span>
                            Live Activity
                        </h3>
                        <div className="space-y-4">
                            {tasks.map(task => (
                                <LiveTaskItem key={task.id} task={task} />
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
                            <span className="mb-4 block">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 mx-auto opacity-50">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                                </svg>
                            </span>
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

const LiveTaskItem = ({ task }) => (
    <div className="bg-google-surface border border-white/5 rounded-2xl p-5 shadow-xl relative overflow-hidden group">
        <div className="flex items-center gap-4 mb-4 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-google-gold/10 flex items-center justify-center border border-google-gold/20">
                <svg className="w-6 h-6 text-google-gold animate-spin-slow" fill="none" viewBox="0 0 24 24">
                    <path stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" d="M12 3v3m0 12v3M3 12h3m12 0h3" />
                </svg>
            </div>
            <div className="flex-1 min-w-0">
                <h4 className="text-white font-bold truncate">{task.title}</h4>
                <p className="text-google-gold/70 text-xs font-medium uppercase tracking-widest">{task.status}</p>
            </div>
            <div className="text-xl font-black text-google-gold opacity-40">
                {task.progress}%
            </div>
        </div>

        {/* Progress Bar Container */}
        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden relative z-10">
            <div
                className="h-full bg-google-gold transition-all duration-700 ease-out shadow-[0_0_15px_rgba(226,194,134,0.3)]"
                style={{ width: `${task.progress}%` }}
            ></div>
        </div>

        {/* Subtle Background Glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-google-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
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
