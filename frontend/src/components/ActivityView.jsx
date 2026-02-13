import React, { useState, useEffect } from 'react';
import API_BASE from '../config/api';

const ActivityView = ({ onViewSong, onTabChange }) => {
    const [tasks, setTasks] = useState([]);
    const [systemInfo, setSystemInfo] = useState({
        totalSongs: 0,
        totalStorage: '0 MB',
        lastActivity: null
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch library stats
                const libRes = await fetch(`${API_BASE}/library`);
                if (libRes.ok) {
                    const data = await libRes.json();
                    setSystemInfo(prev => ({
                        ...prev,
                        totalSongs: data.length,
                        lastActivity: new Date().toLocaleTimeString()
                    }));
                }

                // Fetch real job history
                const jobsRes = await fetch(`${API_BASE}/jobs/history`);
                if (jobsRes.ok) {
                    const data = await jobsRes.json();
                    setTasks((data || []).filter(task => task.status === 'completed' || task.status === 'failed'));
                }
            } catch (error) {
                console.error("Failed to load activity view:", error);
            }
        };
        fetchData();

        let debounce = null;
        const scheduleFetch = () => {
            if (debounce) clearTimeout(debounce);
            debounce = setTimeout(fetchData, 250);
        };

        const onEvent = (e) => {
            const msg = e?.detail;
            if (!msg || typeof msg !== 'object') return;
            if (msg.event === 'job' || msg.event === 'song') scheduleFetch();
        };

        window.addEventListener('lyricvault:event', onEvent);
        return () => {
            if (debounce) clearTimeout(debounce);
            window.removeEventListener('lyricvault:event', onEvent);
        };
    }, []);

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-500 overflow-hidden">
            <header className="p-8 border-b border-white/5 backdrop-blur-sm sticky top-0 z-30 bg-[#0A0F1E]/80">
                <div className="max-w-4xl mx-auto">
                    <h2 className="text-2xl font-bold text-white">Activity Log</h2>
                    <p className="text-slate-400 text-sm">Track your system tasks and processing status</p>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto w-full">
                <div className="max-w-4xl mx-auto py-8 px-8 space-y-8">
                    {/* System Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <StatCard
                            icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>}
                            label="Total Songs"
                            value={systemInfo.totalSongs}
                        />
                        <StatCard
                            icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>}
                            label="Storage Used"
                            value={systemInfo.totalStorage}
                        />
                        <StatCard
                            icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                            label="Last Activity"
                            value={systemInfo.lastActivity || 'Never'}
                        />
                    </div>

                    {/* Active Tasks Section */}
                    <section>
                        <div className="flex items-center gap-3 mb-4">
                            <h3 className="text-lg font-semibold text-white">Recent Tasks</h3>
                            <span className="px-2 py-0.5 text-xs bg-google-gold/10 text-google-gold rounded-full border border-google-gold/20">
                                {tasks.length} entries
                            </span>
                        </div>

                        <div className="space-y-3">
                            {tasks.length === 0 ? (
                                <div className="text-center py-12 text-slate-500">
                                    <span className="mb-4 block">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 mx-auto opacity-50">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </span>
                                    <p>No recent activity</p>
                                    <p className="text-sm">Ingest some songs to see activity here</p>
                                </div>
                            ) : (
                                tasks.map(task => (
                                    <TaskItem key={task.id} task={task} onClick={() => {
                                        try {
                                            const result = JSON.parse(task.result_json || '{}');
                                            if (result.song_id) {
                                                if (onViewSong) onViewSong({ id: result.song_id });
                                            } else {
                                                if (onTabChange) onTabChange('library');
                                            }
                                        } catch {
                                            if (onTabChange) onTabChange('library');
                                        }
                                    }} />
                                ))
                            )}
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
};

const StatCard = ({ icon, label, value }) => (
    <div className="bg-slate-900/50 border border-white/5 rounded-xl p-4 transition-all hover:bg-slate-900/80 group">
        <div className="flex items-center gap-3">
            <span className="text-2xl text-slate-400 group-hover:text-google-gold transition-colors">{icon}</span>
            <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
                <p className="text-lg font-bold text-white tracking-tight">{value}</p>
            </div>
        </div>
    </div>
);

const TaskItem = ({ task, onClick }) => {
    let sourceBadge = null;
    try {
        const result = JSON.parse(task.result_json || '{}');
        if (task.type === 'generate_lyrics' && task.status === 'completed') {
            const source = result.source;
            if (source === 'syncedlyrics') {
                sourceBadge = (
                    <span className="px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-400 text-[9px] font-bold uppercase tracking-tight border border-blue-500/20">
                        Official Web
                    </span>
                );
            } else if (source?.startsWith('gemini')) {
                sourceBadge = (
                    <span className="px-1.5 py-0.5 rounded-md bg-google-gold/10 text-google-gold text-[9px] font-bold uppercase tracking-tight border border-google-gold/20">
                        AI Generated
                    </span>
                );
            }
        }
    } catch {
        // Ignore malformed result_json.
    }

    return (
        <div
            onClick={onClick}
            className="bg-slate-900/50 border border-white/5 rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:bg-slate-800/80 hover:border-google-gold/30 transition-all group active:scale-[0.99]"
        >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${task.status === 'completed' ? 'bg-green-500/10 group-hover:bg-green-500/20' : 'bg-red-500/10 group-hover:bg-red-500/20'
                }`}>
                {task.status === 'completed' ? (
                    <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                ) : (
                    <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-white font-medium truncate group-hover:text-google-gold transition-colors">{task.title}</p>
                    {sourceBadge}
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 uppercase font-bold tracking-tighter opacity-70">{task.type}</span>
                    <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${task.status === 'completed' ? 'text-green-500 bg-green-500/5' : 'text-red-500 bg-red-500/5'}`}>
                        {task.status}
                    </span>
                </div>
            </div>
            <div className="text-right flex-shrink-0">
                <span className="text-xs text-slate-500 block">
                    {new Date(task.updated_at || task.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-[10px] text-slate-700 block uppercase tracking-tighter">
                    {new Date(task.updated_at || task.created_at).toLocaleDateString()}
                </span>
            </div>
        </div>
    );
};

export default ActivityView;
