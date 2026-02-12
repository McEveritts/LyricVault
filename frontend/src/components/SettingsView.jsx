import React, { useState, useEffect } from 'react';
import API_BASE from '../config/api';

// Google Pixel "Monet" inspired pastel colors for badges
const TIER_COLORS = {
    recommended: { bg: 'bg-[#C4E7FF]/10', border: 'border-[#C4E7FF]/20', text: 'text-[#C4E7FF]', label: 'Recommended' },
    quality: { bg: 'bg-[#D3E3FD]/10', border: 'border-[#D3E3FD]/20', text: 'text-[#D3E3FD]', label: 'Quality' },
    fast: { bg: 'bg-[#FFD8E4]/10', border: 'border-[#FFD8E4]/20', text: 'text-[#FFD8E4]', label: 'Fast' },
    stable: { bg: 'bg-[#E2E2E6]/10', border: 'border-[#E2E2E6]/20', text: 'text-[#E2E2E6]', label: 'Stable' },
    preview: { bg: 'bg-[#E5DFF6]/10', border: 'border-[#E5DFF6]/20', text: 'text-[#E5DFF6]', label: 'Preview' },
};

const SettingsView = () => {
    const [activeTab, setActiveTab] = useState('api');
    const [geminiKey, setGeminiKey] = useState('');
    const [geniusKey, setGeniusKey] = useState('');
    const [keyStatus, setKeyStatus] = useState(null);
    const [geniusStatus, setGeniusStatus] = useState(null);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [message, setMessage] = useState(null);
    const [showKey, setShowKey] = useState(false);
    const [showGeniusKey, setShowGeniusKey] = useState(false);
    const [models, setModels] = useState([]);
    const [selectedModel, setSelectedModel] = useState('');
    const [savingModel, setSavingModel] = useState(false);
    const [testing, setTesting] = useState(false);

    useEffect(() => {
        fetchKeyStatuses();
        fetchModels();
    }, []);

    const fetchKeyStatuses = async () => {
        try {
            const [geminiRes, geniusRes] = await Promise.all([
                fetch(`${API_BASE}/settings/gemini-key`),
                fetch(`${API_BASE}/settings/genius-key`)
            ]);

            if (geminiRes.ok) setKeyStatus(await geminiRes.json());
            if (geniusRes.ok) setGeniusStatus(await geniusRes.json());
        } catch (err) {
            console.error('Failed to fetch key statuses:', err);
        }
    };

    const fetchModels = async () => {
        try {
            const res = await fetch(`${API_BASE}/settings/models`);
            const data = await res.json();
            setModels(data.models || []);
            setSelectedModel(data.selected || '');
        } catch (err) {
            console.error('Failed to fetch models:', err);
        }
    };

    const handleSaveGemini = async () => {
        if (!geminiKey.trim()) return;
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch(`${API_BASE}/settings/gemini-key`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ api_key: geminiKey })
            });
            const data = await res.json();
            if (res.ok) {
                setMessage({ type: 'success', text: data.message });
                setGeminiKey('');
                fetchKeyStatuses();
            } else {
                setMessage({ type: 'error', text: data.detail || 'Failed to save key' });
            }
        } catch {
            setMessage({ type: 'error', text: 'Connection error.' });
        } finally {
            setSaving(false);
        }
    };

    const handleSaveGenius = async () => {
        if (!geniusKey.trim()) return;
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch(`${API_BASE}/settings/genius-key`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ api_key: geniusKey })
            });
            const data = await res.json();
            if (res.ok) {
                setMessage({ type: 'success', text: data.message });
                setGeniusKey('');
                fetchKeyStatuses();
            } else {
                setMessage({ type: 'error', text: data.detail || 'Failed to save key' });
            }
        } catch {
            setMessage({ type: 'error', text: 'Connection error.' });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteGemini = async () => {
        setDeleting(true);
        try {
            await fetch(`${API_BASE}/settings/gemini-key`, { method: 'DELETE' });
            fetchKeyStatuses();
            setMessage({ type: 'success', text: 'Gemini API key removed' });
        } catch {
            setMessage({ type: 'error', text: 'Failed to remove key.' });
        } finally {
            setDeleting(false);
        }
    };

    const handleDeleteGenius = async () => {
        setDeleting(true);
        try {
            await fetch(`${API_BASE}/settings/genius-key`, { method: 'DELETE' });
            fetchKeyStatuses();
            setMessage({ type: 'success', text: 'Genius API key removed' });
        } catch {
            setMessage({ type: 'error', text: 'Failed to remove key.' });
        } finally {
            setDeleting(false);
        }
    };

    const handleTestKey = async () => {
        if (!geminiKey.trim()) return;
        setTesting(true);
        setMessage(null);
        try {
            const res = await fetch(`${API_BASE}/settings/test-gemini-key`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ api_key: geminiKey })
            });
            const data = await res.json();
            if (res.ok) {
                setMessage({ type: 'success', text: data.message });
            } else {
                setMessage({ type: 'error', text: data.detail || 'Test failed' });
            }
        } catch {
            setMessage({ type: 'error', text: 'Connection error.' });
        } finally {
            setTesting(false);
        }
    };

    const handleModelSelect = async (modelId) => {
        setSavingModel(true);
        try {
            const res = await fetch(`${API_BASE}/settings/models`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model_id: modelId })
            });
            if (res.ok) {
                setSelectedModel(modelId);
            }
        } catch (err) {
            console.error('Failed to save model:', err);
        } finally {
            setSavingModel(false);
        }
    };

    const tabs = [
        { id: 'api', label: 'API Keys' },
        { id: 'models', label: 'AI Models' },
        { id: 'system', label: 'System' },
    ];

    return (
        <>
            <header className="px-8 pt-6 pb-0 border-b border-google-surface-high sticky top-0 z-30 bg-google-bg/95 backdrop-blur-md">
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-3xl font-normal text-google-text tracking-tight mb-6">Settings</h2>

                    {/* Tabs */}
                    <div className="flex gap-6">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => { setActiveTab(tab.id); setMessage(null); }}
                                className={`pb-3 text-sm font-medium transition-colors relative ${activeTab === tab.id
                                        ? 'text-google-gold'
                                        : 'text-google-text-secondary hover:text-google-text'
                                    }`}
                            >
                                {tab.label}
                                {activeTab === tab.id && (
                                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-google-gold rounded-t-full" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto py-8 px-8 space-y-8">
                {message && (
                    <div className={`px-4 py-3 rounded-xl text-sm mb-6 ${message.type === 'success'
                        ? 'bg-green-500/10 text-green-300'
                        : 'bg-red-500/10 text-red-300'
                        }`}>
                        {message.text}
                    </div>
                )}

                {activeTab === 'api' && (
                    <div className="space-y-6">
                        {/* Gemini Section */}
                        <section className="bg-google-surface rounded-3xl p-6 border border-google-surface-high">
                            <div className="flex items-start gap-5">
                                <div className="w-12 h-12 rounded-full bg-google-surface-high flex items-center justify-center flex-shrink-0 text-google-text">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                                        <path fillRule="evenodd" d="M15.75 1.5a6.75 6.75 0 00-6.651 7.906c-1.057.813-2.025 1.762-2.396 2.87l-.536 1.608-1.396.465a3.75 3.75 0 00-2 2L2.25 18V21a.75.75 0 00.75.75h2.25l1.08-1.08a3.75 3.75 0 100-5.303l1.838-.613.56-1.68c.245-.734.796-1.372 1.5-1.74l.43-.215A6.75 6.75 0 1015.75 1.5zM12.985 8.441a2.25 2.25 0 113.196 3.018 2.25 2.25 0 01-3.196-3.018z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-xl font-medium text-google-text">Gemini API Key</h3>
                                    <p className="text-sm text-google-text-secondary mt-1 leading-relaxed">
                                        Required for AI research and lyrics transcription.
                                    </p>
                                </div>
                            </div>

                            <div className="mt-6 space-y-4">
                                <KeyStatus status={keyStatus} onDelete={handleDeleteGemini} deleting={deleting} name="Gemini Key" />

                                <div className="relative">
                                    <input
                                        type={showKey ? 'text' : 'password'}
                                        value={geminiKey}
                                        onChange={(e) => setGeminiKey(e.target.value)}
                                        placeholder="Paste Gemini API key"
                                        className="w-full bg-google-surface-high border-none rounded-xl px-4 py-4 pr-12 text-sm text-google-text placeholder-google-text-secondary/50 focus:ring-2 focus:ring-google-gold focus:outline-none transition-all"
                                    />
                                    <button
                                        onClick={() => setShowKey(!showKey)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-google-text-secondary hover:text-google-text p-1"
                                    >
                                        {showKey ? <EyeIcon /> : <EyeOffIcon />}
                                    </button>
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        onClick={handleSaveGemini}
                                        disabled={saving || !geminiKey.trim()}
                                        className="flex-1 py-3 px-6 rounded-full bg-google-gold text-black text-sm font-semibold hover:bg-google-gold-light transition-colors shadow-lg shadow-black/20 disabled:opacity-50"
                                    >
                                        {saving ? 'Saving...' : 'Save Gemini Key'}
                                    </button>
                                    <button
                                        onClick={handleTestKey}
                                        disabled={testing || !geminiKey.trim()}
                                        className="py-3 px-6 rounded-full border border-google-surface-high text-google-text text-sm font-medium hover:bg-google-surface-high transition-colors disabled:opacity-50"
                                    >
                                        {testing ? 'Testing...' : 'Test'}
                                    </button>
                                </div>

                                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="inline-block text-xs font-medium text-google-gold hover:text-google-gold-light mt-2">
                                    Get a free Gemini API key &rarr;
                                </a>
                            </div>
                        </section>

                        {/* Genius Section */}
                        <section className="bg-google-surface rounded-3xl p-6 border border-google-surface-high">
                            <div className="flex items-start gap-5">
                                <div className="w-12 h-12 rounded-full bg-[#FFFF64] flex items-center justify-center flex-shrink-0 text-black font-bold text-xl">
                                    G
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-xl font-medium text-google-text">Genius API Key</h3>
                                    <p className="text-sm text-google-text-secondary mt-1 leading-relaxed">
                                        Optional. Improves lyric search accuracy.
                                    </p>
                                </div>
                            </div>

                            <div className="mt-6 space-y-4">
                                <KeyStatus status={geniusStatus} onDelete={handleDeleteGenius} deleting={deleting} name="Genius Key" />

                                <div className="relative">
                                    <input
                                        type={showGeniusKey ? 'text' : 'password'}
                                        value={geniusKey}
                                        onChange={(e) => setGeniusKey(e.target.value)}
                                        placeholder="Paste Genius Access Token"
                                        className="w-full bg-google-surface-high border-none rounded-xl px-4 py-4 pr-12 text-sm text-google-text placeholder-google-text-secondary/50 focus:ring-2 focus:ring-[#FFFF64] focus:ring-opacity-50 focus:outline-none transition-all"
                                    />
                                    <button
                                        onClick={() => setShowGeniusKey(!showGeniusKey)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-google-text-secondary hover:text-google-text p-1"
                                    >
                                        {showGeniusKey ? <EyeIcon /> : <EyeOffIcon />}
                                    </button>
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        onClick={handleSaveGenius}
                                        disabled={saving || !geniusKey.trim()}
                                        className="flex-1 py-3 px-6 rounded-full bg-[#FFFF64] text-black text-sm font-semibold hover:bg-[#FFFF64]/90 transition-colors shadow-lg shadow-black/20 disabled:opacity-50"
                                    >
                                        {saving ? 'Saving...' : 'Save Genius Key'}
                                    </button>
                                </div>

                                <a href="https://genius.com/api-clients" target="_blank" rel="noopener noreferrer" className="inline-block text-xs font-medium text-[#FFFF64] hover:text-[#FFFF64]/80 mt-2">
                                    Get a Genius Access Token &rarr;
                                </a>
                            </div>
                        </section>
                    </div>
                )}

                {activeTab === 'models' && (
                    <section className="bg-google-surface rounded-3xl p-6 border border-google-surface-high">
                        <div className="flex items-start gap-5 mb-6">
                            <div className="w-12 h-12 rounded-full bg-google-surface-high flex items-center justify-center flex-shrink-0 text-google-text">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                                    <path fillRule="evenodd" d="M14.615 1.595a.75.75 0 01.359.852L12.982 9.75h7.268a.75.75 0 01.548 1.262l-10.5 11.25a.75.75 0 01-1.272-.71l1.992-7.302H3.75a.75.75 0 01-.548-1.262l10.5-11.25a.75.75 0 01.913-.143z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-xl font-medium text-google-text">AI Model</h3>
                                <p className="text-sm text-google-text-secondary mt-1">
                                    Choose which Gemini model powers your research.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {models.map((model) => {
                                const isSelected = model.id === selectedModel;
                                const tier = TIER_COLORS[model.tier] || TIER_COLORS.stable;
                                return (
                                    <button
                                        key={model.id}
                                        onClick={() => handleModelSelect(model.id)}
                                        disabled={savingModel}
                                        className={`w-full text-left px-5 py-4 rounded-2xl border transition-all duration-200 group relative overflow-hidden ${isSelected
                                            ? 'bg-google-gold/5 border-google-gold shadow-[0_0_15px_rgba(226,194,134,0.05)]'
                                            : 'bg-google-surface-high/30 border-transparent hover:bg-google-surface-high'
                                            }`}
                                    >
                                        <div className="flex items-center gap-4 relative z-10">
                                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${isSelected
                                                ? 'border-google-gold'
                                                : 'border-google-text-secondary group-hover:border-google-text'
                                                }`}>
                                                {isSelected && (
                                                    <div className="w-2.5 h-2.5 rounded-full bg-google-gold"></div>
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-3 mb-1">
                                                    <span className={`text-base font-medium ${isSelected ? 'text-google-text' : 'text-google-text/80'}`}>
                                                        {model.name}
                                                    </span>
                                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${tier.bg} ${tier.text} ${tier.border} border`}>
                                                        {tier.label}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-google-text-secondary line-clamp-1">{model.description}</p>
                                            </div>

                                            <div className="text-right flex-shrink-0 hidden sm:block">
                                                <p className="text-[10px] text-google-text-secondary font-mono bg-black/20 px-2 py-1 rounded-md">{model.rate_limit}</p>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                )}

                {activeTab === 'system' && (
                    <section className="bg-google-surface rounded-3xl p-6 border border-google-surface-high">
                        <div className="flex items-start gap-5 mb-6">
                            <div className="w-12 h-12 rounded-full bg-google-surface-high flex items-center justify-center flex-shrink-0 text-google-text">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                                    <path fillRule="evenodd" d="M11.828 2.25c-.916 0-1.699.663-1.85 1.567l-.091.549a.798.798 0 01-.517.608 7.45 7.45 0 00-.478.198.798.798 0 01-.796-.064l-.453-.324a1.875 1.875 0 00-2.416.2l-.043.044a1.875 1.875 0 00-.205 2.415l.323.454a.798.798 0 01.064.796 7.448 7.448 0 00-.198.478.798.798 0 01-.608.517l-.55.092a1.875 1.875 0 00-1.566 1.849v.06c0 .916.663 1.699 1.567 1.85l.549.091c.281.047.508.25.608.517.06.162.127.321.198.478a.798.798 0 01-.064.796l-.324.453a1.875 1.875 0 00.2 2.416l.044.043a1.875 1.875 0 002.415.205l.454-.323a.798.798 0 01.796-.064c.157.071.316.137.478.198.267.1.47.327.517.608l.092.55c.15.903.932 1.566 1.849 1.566h-.06c.916 0 1.699-.663 1.85-1.567l.091-.549a.798.798 0 01.517-.608 7.45 7.45 0 00.478-.198.798.798 0 01.796.064l.453.324a1.875 1.875 0 002.416-.2l.043-.044a1.875 1.875 0 00.205-2.415l-.323-.454a.798.798 0 01-.064-.796c.071-.157.137-.316.198-.478.1-.267.327-.47.608-.517l.55-.092a1.875 1.875 0 001.566-1.849v-.06c0-.916-.663-1.699-1.567-1.85l-.549-.091a.798.798 0 01-.608-.517 7.45 7.45 0 00-.198-.478.798.798 0 01.064-.796l.324-.453a1.875 1.875 0 00-.2-2.416l-.044-.043a1.875 1.875 0 00-2.415-.205l-.454.323a.798.798 0 01-.796.064 7.448 7.448 0 00-.478-.198.798.798 0 01-.517-.608l-.092-.55a1.875 1.875 0 00-1.849-1.566h-.06zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-xl font-medium text-google-text">System Status</h3>
                                <p className="text-sm text-google-text-secondary mt-1">
                                    Check the status of core LyricVault services.
                                </p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <SystemComponent name="API Server" status="online" description="Handles backend requests." />
                            <SystemComponent name="Lyric Fetcher" status="online" description="syncedlyrics engine." />
                            <SystemComponent name="Audio Core" status="online" description="yt-dlp binary." />
                            <SystemComponent name="Database" status="online" description="SQLite storage." />
                        </div>
                    </section>
                )}

                <div className="text-center pt-8 pb-4">
                    <p className="text-xs text-google-text-secondary opacity-50">LyricVault v0.3.5 &bull; Designed for Pixel</p>
                </div>
            </main>
        </>
    );
};

const KeyStatus = ({ status, onDelete, deleting, name }) => {
    if (!status) return null;
    return (
        <div className={`flex items-center gap-3 px-5 py-4 rounded-2xl border ${status.configured
            ? 'bg-google-surface-high/50 border-google-surface-high'
            : 'bg-amber-500/5 border-amber-500/10'
            }`}>
            <div className={`w-2 h-2 rounded-full ${status.configured ? 'bg-green-400' : 'bg-amber-500'}`}></div>
            <div className="flex-1">
                <p className={`text-sm font-medium ${status.configured ? 'text-green-200' : 'text-amber-200'}`}>
                    {status.configured ? `${name} Active` : `No ${name} Configured`}
                </p>
                {status.masked_key && (
                    <p className="text-xs text-google-text-secondary font-mono mt-0.5">{status.masked_key}</p>
                )}
            </div>
            {status.configured && (
                <button
                    onClick={onDelete}
                    disabled={deleting}
                    className="text-xs text-red-300 hover:text-red-200 px-3 py-2 rounded-full hover:bg-red-500/10 transition-colors"
                >
                    {deleting ? 'Removing...' : 'Remove'}
                </button>
            )}
        </div>
    );
};

const SystemComponent = ({ name, status, description }) => (
    <div className="bg-google-surface-high/30 border border-white/5 rounded-2xl p-4 flex items-center gap-4">
        <div className={`w-2.5 h-2.5 rounded-full ${status === 'online' ? 'bg-green-400' : 'bg-red-400'} shadow-[0_0_8px_rgba(74,222,128,0.2)]`}></div>
        <div className="flex-1 min-w-0">
            <p className="text-google-text text-sm font-medium">{name}</p>
            <p className="text-google-text-secondary text-[10px] truncate">{description}</p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${status === 'online'
            ? 'bg-green-400/10 text-green-400 border border-green-400/20'
            : 'bg-red-400/10 text-red-400 border border-red-400/20'
            }`}>
            {status}
        </span>
    </div>
);

const EyeIcon = () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
);

const EyeOffIcon = () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
);

export default SettingsView;
