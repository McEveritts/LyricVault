import React, { useState, useEffect } from 'react';
import API_BASE from '../config/api';

const ActivityView = () => {
    const [tasks, setTasks] = useState([]);
    const [systemInfo, setSystemInfo] = useState({
        totalSongs: 0,
        totalStorage: '0 MB',
        lastActivity: null
    });

    useEffect(() => {
        // Fetch library to get stats
        fetch(`${API_BASE}/library`)
            .then(res => res.json())
            .then(data => {
                setSystemInfo(prev => ({
                    ...prev,
                    totalSongs: data.length,
                    lastActivity: new Date().toLocaleTimeString()
                }));

                // Create activity log from songs
                const activities = data.map(song => ({
                    id: song.id,
                    type: song.lyrics_status === 'ready' ? 'completed' : 'processing',
                    title: `Lyrics for "${song.title}"`,
                    status: song.lyrics_status === 'ready' ? 'Completed' : 'Processing',
                    timestamp: 'Recently'
                }));
                setTasks(activities);
            })
            .catch(err => console.error('Failed to fetch library:', err));
    }, []);

    return (
        <>
            <header className="p-8 border-b border-white/5 backdrop-blur-sm sticky top-0 z-30 bg-[#0A0F1E]/80">
                <div className="max-w-4xl mx-auto">
                    <h2 className="text-2xl font-bold text-white">Activity Log</h2>
                    <p className="text-slate-400 text-sm">Track your system tasks and processing status</p>
                </div>
            </header>

            <main className="max-w-4xl mx-auto py-8 px-8 space-y-8">
                {/* System Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <StatCard
                        icon="🎵"
                        label="Total Songs"
                        value={systemInfo.totalSongs}
                    />
                    <StatCard
                        icon="💾"
                        label="Storage Used"
                        value={systemInfo.totalStorage}
                    />
                    <StatCard
                        icon="🕐"
                        label="Last Activity"
                        value={systemInfo.lastActivity || 'Never'}
                    />
                </div>

                {/* Active Tasks Section */}
                <section>
                    <div className="flex items-center gap-3 mb-4">
                        <h3 className="text-lg font-semibold text-white">Recent Tasks</h3>
                        <span className="px-2 py-0.5 text-xs bg-purple-600/20 text-purple-400 rounded-full">
                            {tasks.filter(t => t.type === 'processing').length} active
                        </span>
                    </div>

                    <div className="space-y-3">
                        {tasks.length === 0 ? (
                            <div className="text-center py-12 text-slate-500">
                                <span className="text-4xl mb-4 block">📋</span>
                                <p>No recent activity</p>
                                <p className="text-sm">Ingest some songs to see activity here</p>
                            </div>
                        ) : (
                            tasks.map(task => (
                                <TaskItem key={task.id} task={task} />
                            ))
                        )}
                    </div>
                </section>

                {/* AI System Status */}
                <section>
                    <h3 className="text-lg font-semibold text-white mb-4">System Components</h3>
                    <div className="space-y-2">
                        <SystemComponent
                            name="Lyric Fetcher (syncedlyrics)"
                            status="online"
                            description="Fetches synced lyrics from multiple providers"
                        />
                        <SystemComponent
                            name="Audio Downloader (yt-dlp)"
                            status="online"
                            description="Downloads audio from YouTube, Spotify links"
                        />
                        <SystemComponent
                            name="Metadata Service (iTunes)"
                            status="online"
                            description="Fetches album art and track info"
                        />
                        <SystemComponent
                            name="FFmpeg Processor"
                            status="online"
                            description="Audio conversion and processing"
                        />
                    </div>
                </section>
            </main>
        </>
    );
};

const StatCard = ({ icon, label, value }) => (
    <div className="bg-slate-900/50 border border-white/5 rounded-xl p-4">
        <div className="flex items-center gap-3">
            <span className="text-2xl">{icon}</span>
            <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
                <p className="text-lg font-bold text-white">{value}</p>
            </div>
        </div>
    </div>
);

const TaskItem = ({ task }) => (
    <div className="bg-slate-900/50 border border-white/5 rounded-xl p-4 flex items-center gap-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${task.type === 'completed' ? 'bg-green-500/20' : 'bg-yellow-500/20'
            }`}>
            {task.type === 'completed' ? (
                <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
            ) : (
                <svg className="w-5 h-5 text-yellow-400 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            )}
        </div>
        <div className="flex-1">
            <p className="text-white font-medium">{task.title}</p>
            <p className="text-slate-500 text-sm">{task.status}</p>
        </div>
        <span className="text-xs text-slate-600">{task.timestamp}</span>
    </div>
);

const SystemComponent = ({ name, status, description }) => (
    <div className="bg-slate-900/30 border border-white/5 rounded-lg p-3 flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${status === 'online' ? 'bg-green-500' : 'bg-red-500'
            }`}></div>
        <div className="flex-1">
            <p className="text-white text-sm font-medium">{name}</p>
            <p className="text-slate-500 text-xs">{description}</p>
        </div>
        <span className={`text-xs px-2 py-1 rounded ${status === 'online'
            ? 'bg-green-500/10 text-green-400'
            : 'bg-red-500/10 text-red-400'
            }`}>
            {status}
        </span>
    </div>
);

export default ActivityView;
