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
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-google-surface-high mb-6 shadow-lg shadow-black/20">
                    <span className="text-3xl">✨</span>
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
                <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-300 text-sm text-center max-w-xl mx-auto">
                    ⚠️ {error}
                </div>
            )}
        </div>
    );
};

export default MagicPaste;
