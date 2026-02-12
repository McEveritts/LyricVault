import React, { useState } from 'react';
import API_BASE from '../config/api';

const MagicPaste = ({ onIngestSuccess }) => {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleIngest = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`${API_BASE}/ingest`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || 'Ingestion failed');
            }

            const data = await response.json();
            if (onIngestSuccess) onIngestSuccess(data);
            setUrl(''); // Clear input
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto">
            <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-google-surface-high mb-6 shadow-lg shadow-black/20 text-google-text">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
                        <path fillRule="evenodd" d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813a3.75 3.75 0 002.576-2.576l.813-2.846A.75.75 0 019 4.5zM9 15a.75.75 0 01.75.75v1.5h1.5a.75.75 0 010 1.5h-1.5v1.5a.75.75 0 01-1.5 0v-1.5h-1.5a.75.75 0 010-1.5h1.5v-1.5A.75.75 0 019 15z" clipRule="evenodd" />
                    </svg>
                </div>
                <h2 className="text-4xl font-normal text-google-text tracking-tight mb-3">
                    Magic Paste
                </h2>
                <p className="text-google-text-secondary text-base max-w-md mx-auto leading-relaxed">
                    Paste a link from YouTube, Spotify, or SoundCloud to instantly add it to your library.
                </p>
            </div>

            <form onSubmit={handleIngest} className="relative max-w-xl mx-auto">
                <div className="relative flex items-center bg-google-surface rounded-full border border-google-surface-high shadow-xl shadow-black/10 transition-all focus-within:ring-2 focus-within:ring-google-gold focus-within:border-transparent">
                    <div className="pl-6 text-google-text-secondary">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                    </div>
                    <input
                        type="text"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="Paste a link here..."
                        className="flex-1 px-4 py-4 bg-transparent text-google-text placeholder-google-text-secondary/50 focus:outline-none font-medium h-14"
                        disabled={loading}
                    />
                    <div className="pr-1.5">
                        <button
                            type="submit"
                            disabled={loading || !url}
                            className="h-11 px-6 rounded-full font-semibold text-sm text-black bg-google-gold hover:bg-google-gold-light disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg flex items-center gap-2"
                        >
                            {loading ? (
                                <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></span>
                            ) : (
                                <span>Ingest</span>
                            )}
                        </button>
                    </div>
                </div>
            </form>

            {error && (
                <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-300 text-sm text-center max-w-xl mx-auto flex items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                        <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                    </svg>
                    {error}
                </div>
            )}
        </div>
    );
};

export default MagicPaste;
