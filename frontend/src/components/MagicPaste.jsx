import React, { useState } from 'react';
import API_BASE from '../config/api';

const MagicPaste = ({ onIngestSuccess }) => {
    const [url, setUrl] = useState('');
    const [status, setStatus] = useState('idle'); // idle, submitting, queued, error
    const [errorMessage, setErrorMessage] = useState(null);

    const handleIngest = async (e) => {
        e.preventDefault();
        setStatus('submitting');
        setErrorMessage(null);

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

            // Explicit "Queued" state
            setStatus('queued');
            setUrl('');

            if (onIngestSuccess) onIngestSuccess(data);

            // Reset after delay
            setTimeout(() => {
                setStatus('idle');
            }, 3000);

        } catch (err) {
            setErrorMessage(err.message);
            setStatus('error');
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto">
            <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-google-surface-high mb-6 shadow-lg shadow-black/20 text-google-text">
                    {status === 'queued' ? (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-green-400 animate-in zoom-in duration-300">
                            <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 transition-transform duration-500 hover:scale-110">
                            <path fillRule="evenodd" d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813a3.75 3.75 0 002.576-2.576l.813-2.846A.75.75 0 019 4.5zM9 15a.75.75 0 01.75.75v1.5h1.5a.75.75 0 010 1.5h-1.5v1.5a.75.75 0 01-1.5 0v-1.5h-1.5a.75.75 0 010-1.5h1.5v-1.5A.75.75 0 019 15z" clipRule="evenodd" />
                        </svg>
                    )}
                </div>
                <h2 className="text-4xl font-normal text-google-text tracking-tight mb-3">
                    {status === 'queued' ? 'Added to Queue' : 'Magic Paste'}
                </h2>
                <p className="text-google-text-secondary text-base max-w-md mx-auto leading-relaxed">
                    {status === 'queued'
                        ? 'Your song is being processed and will appear in your library shortly.'
                        : 'Paste a link from YouTube, Spotify, or SoundCloud to instantly add it to your library.'}
                </p>
            </div>

            <form onSubmit={handleIngest} className="relative max-w-xl mx-auto">
                <div className={`relative flex items-center bg-google-surface rounded-full border shadow-xl shadow-black/10 transition-all focus-within:ring-2 focus-within:ring-google-gold focus-within:border-transparent ${status === 'error' ? 'border-red-500/50 ring-2 ring-red-500/20' : 'border-google-surface-high'}`}>
                    <div className="pl-6 text-google-text-secondary">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                    </div>
                    <input
                        type="text"
                        value={url}
                        onChange={(e) => {
                            setUrl(e.target.value);
                            if (status === 'error') setStatus('idle');
                        }}
                        placeholder="Paste a link here..."
                        className="flex-1 px-4 py-4 bg-transparent text-google-text placeholder-google-text-secondary/50 focus:outline-none font-medium h-14"
                        disabled={status === 'submitting' || status === 'queued'}
                    />
                    <div className="pr-1.5">
                        <button
                            type="submit"
                            disabled={status === 'submitting' || status === 'queued' || !url}
                            className={`h-11 px-6 rounded-full font-semibold text-sm text-black transition-all shadow-md hover:shadow-lg flex items-center gap-2 ${status === 'queued'
                                    ? 'bg-green-500 hover:bg-green-400 text-white'
                                    : 'bg-google-gold hover:bg-google-gold-light disabled:opacity-50 disabled:cursor-not-allowed'
                                }`}
                        >
                            {status === 'submitting' ? (
                                <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></span>
                            ) : status === 'queued' ? (
                                <span className="flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                    </svg>
                                    Queued
                                </span>
                            ) : (
                                <span>Ingest</span>
                            )}
                        </button>
                    </div>
                </div>
            </form>

            {status === 'error' && errorMessage && (
                <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-300 text-sm text-center max-w-xl mx-auto flex items-center justify-center gap-2 animate-in slide-in-from-top-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                        <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                    </svg>
                    {errorMessage}
                </div>
            )}
        </div>
    );
};

export default MagicPaste;
