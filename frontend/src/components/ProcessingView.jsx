import React, { useEffect, useMemo, useState } from 'react';
import API_BASE from '../config/api';

const ACTIVE_STATUSES = ['pending', 'processing', 'retrying'];

const ProcessingView = () => {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        let debounce = null;

        const fetchTasks = async () => {
            try {
                const taskRes = await fetch(`${API_BASE}/jobs/active`);
                if (!taskRes.ok) return;
                const data = await taskRes.json();
                if (mounted) {
                    setTasks((data || []).filter(job => ACTIVE_STATUSES.includes(job.status)));
                }
            } catch (error) {
                console.error("Failed to fetch processing queue:", error);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        fetchTasks();

        const scheduleFetch = () => {
            if (debounce) clearTimeout(debounce);
            debounce = setTimeout(fetchTasks, 150);
        };

        const onEvent = (e) => {
            const msg = e?.detail;
            if (!msg || typeof msg !== 'object') return;
            if (msg.event === 'job') scheduleFetch();
        };
        window.addEventListener('lyricvault:event', onEvent);
        return () => {
            mounted = false;
            if (debounce) clearTimeout(debounce);
            window.removeEventListener('lyricvault:event', onEvent);
        };
    }, []);

    const counts = useMemo(() => ({
        pending: tasks.filter(task => task.status === 'pending').length,
        processing: tasks.filter(task => task.status === 'processing').length,
        retrying: tasks.filter(task => task.status === 'retrying').length,
    }), [tasks]);

    return (
        <>
            <header className="p-8 border-b border-white/5 backdrop-blur-sm sticky top-0 z-30 bg-[#0A0F1E]/80">
                <div className="max-w-4xl mx-auto">
                    <h2 className="text-2xl font-bold text-white">Processing Queue</h2>
                    <p className="text-slate-400 text-sm">Active jobs only: pending, processing, retrying</p>
                </div>
            </header>

            <main className="max-w-4xl mx-auto py-8 px-8 space-y-8">
                <div className="grid grid-cols-3 gap-4">
                    <StatCard value={counts.pending} label="Pending" className="text-sky-300 border-sky-500/20 bg-sky-500/10" />
                    <StatCard value={counts.processing} label="Processing" className="text-amber-300 border-amber-500/20 bg-amber-500/10" />
                    <StatCard value={counts.retrying} label="Retrying" className="text-rose-300 border-rose-500/20 bg-rose-500/10" />
                </div>

                <section>
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-google-gold animate-pulse"></span>
                        Live Activity
                    </h3>
                    {loading ? (
                        <div className="text-center py-8 text-slate-500">Loading queue...</div>
                    ) : tasks.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 border border-white/5 rounded-2xl bg-google-surface/20">
                            <p>No active jobs</p>
                            <p className="text-sm mt-1">Ingest a song to start processing.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {tasks.map(task => (
                                <LiveTaskItem key={task.id} task={task} />
                            ))}
                        </div>
                    )}
                </section>
            </main>
        </>
    );
};

const StatCard = ({ value, label, className }) => (
    <div className={`rounded-xl p-4 text-center border ${className}`}>
        <div className="text-3xl font-bold">{value}</div>
        <div className="text-sm opacity-70">{label}</div>
    </div>
);

const LiveTaskItem = ({ task }) => {
    const statusStyles = {
        pending: 'text-sky-300 bg-sky-500/10 border-sky-500/20',
        processing: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
        retrying: 'text-rose-300 bg-rose-500/10 border-rose-500/20',
    };

    return (
        <div className="bg-google-surface border border-white/5 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center gap-4 mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${statusStyles[task.status] || statusStyles.pending}`}>
                    <span className="text-xs font-bold uppercase">{task.status?.charAt(0) || 'P'}</span>
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="text-white font-bold truncate">{task.title || `Job #${task.id}`}</h4>
                    <p className="text-google-text-secondary text-xs font-medium uppercase tracking-widest">{task.status}</p>
                </div>
                <div className="text-xl font-black text-google-gold opacity-60">
                    {task.progress ?? 0}%
                </div>
            </div>

            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <div
                    className="h-full bg-google-gold transition-all duration-700 ease-out shadow-[0_0_15px_rgba(226,194,134,0.3)]"
                    style={{ width: `${task.progress ?? 0}%` }}
                ></div>
            </div>
        </div>
    );
};

export default ProcessingView;
