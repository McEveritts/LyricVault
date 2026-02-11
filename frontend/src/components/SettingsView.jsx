import React, { useState, useEffect } from 'react';

// Google Pixel "Monet" inspired pastel colors for badges
const TIER_COLORS = {
    recommended: { bg: 'bg-[#C4E7FF]/10', border: 'border-[#C4E7FF]/20', text: 'text-[#C4E7FF]', label: 'Recommended' },
    quality: { bg: 'bg-[#D3E3FD]/10', border: 'border-[#D3E3FD]/20', text: 'text-[#D3E3FD]', label: 'Quality' },
    fast: { bg: 'bg-[#FFD8E4]/10', border: 'border-[#FFD8E4]/20', text: 'text-[#FFD8E4]', label: 'Fast' },
    stable: { bg: 'bg-[#E2E2E6]/10', border: 'border-[#E2E2E6]/20', text: 'text-[#E2E2E6]', label: 'Stable' },
    preview: { bg: 'bg-[#E5DFF6]/10', border: 'border-[#E5DFF6]/20', text: 'text-[#E5DFF6]', label: 'Preview' },
};

const SettingsView = () => {
    const [apiKey, setApiKey] = useState('');
    const [keyStatus, setKeyStatus] = useState(null);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [message, setMessage] = useState(null);
    const [showKey, setShowKey] = useState(false);
    const [models, setModels] = useState([]);
    const [selectedModel, setSelectedModel] = useState('');
    const [savingModel, setSavingModel] = useState(false);

    useEffect(() => {
        fetchKeyStatus();
        fetchModels();
    }, []);

    const fetchKeyStatus = async () => {
        try {
            const res = await fetch('http://localhost:8000/settings/gemini-key');
            const data = await res.json();
            setKeyStatus(data);
        } catch (err) {
            console.error('Failed to fetch key status:', err);
        }
    };

    const fetchModels = async () => {
        try {
            const res = await fetch('http://localhost:8000/settings/models');
            const data = await res.json();
            setModels(data.models || []);
            setSelectedModel(data.selected || '');
        } catch (err) {
            console.error('Failed to fetch models:', err);
        }
    };

    const handleSave = async () => {
        if (!apiKey.trim()) return;
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch('http://localhost:8000/settings/gemini-key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ api_key: apiKey })
            });
            const data = await res.json();
            if (res.ok) {
                setMessage({ type: 'success', text: data.message });
                setApiKey('');
                fetchKeyStatus();
            } else {
                setMessage({ type: 'error', text: data.detail || 'Failed to save key' });
            }
        } catch {
            setMessage({ type: 'error', text: 'Connection error. Is the backend running?' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        setDeleting(true);
        setMessage(null);
        try {
            const res = await fetch('http://localhost:8000/settings/gemini-key', {
                method: 'DELETE'
            });
            const data = await res.json();
            if (res.ok) {
                setMessage({ type: 'success', text: data.message });
                fetchKeyStatus();
            }
        } catch {
            setMessage({ type: 'error', text: 'Failed to remove key.' });
        } finally {
            setDeleting(false);
        }
    };

    const handleModelSelect = async (modelId) => {
        setSavingModel(true);
        try {
            const res = await fetch('http://localhost:8000/settings/models', {
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

    return (
        <>
            <header className="px-8 py-6 border-b border-google-surface-high sticky top-0 z-30 bg-google-bg/95 backdrop-blur-md">
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-3xl font-normal text-google-text tracking-tight">Settings</h2>
                    <p className="text-google-text-secondary text-sm mt-1">Configure your LyricVault experience</p>
                </div>
            </header>

            <main className="max-w-3xl mx-auto py-8 px-8 space-y-8">

                {/* Gemini API Key Section */}
                <section className="bg-google-surface rounded-3xl p-6 border border-google-surface-high">
                    <div className="flex items-start gap-5">
                        <div className="w-12 h-12 rounded-full bg-google-surface-high flex items-center justify-center flex-shrink-0">
                            <span className="text-2xl">🔑</span>
                        </div>
                        <div className="flex-1">
                            <h3 className="text-xl font-medium text-google-text">Gemini API Key</h3>
                            <p className="text-sm text-google-text-secondary mt-1 leading-relaxed">
                                Connect your own Google Gemini API key to enable AI features.
                                Your key is stored locally on your device.
                            </p>
                        </div>
                    </div>

                    <div className="mt-6 space-y-4">
                        {/* Current Status */}
                        {keyStatus && (
                            <div className={`flex items-center gap-3 px-5 py-4 rounded-2xl border ${keyStatus.configured
                                ? 'bg-google-surface-high/50 border-google-surface-high'
                                : 'bg-amber-500/5 border-amber-500/10'
                                }`}>
                                <div className={`w-2 h-2 rounded-full ${keyStatus.configured ? 'bg-green-400' : 'bg-amber-500'}`}></div>
                                <div className="flex-1">
                                    <p className={`text-sm font-medium ${keyStatus.configured ? 'text-green-200' : 'text-amber-200'}`}>
                                        {keyStatus.configured ? 'API Key Active' : 'No API Key Configured'}
                                    </p>
                                    {keyStatus.masked_key && (
                                        <p className="text-xs text-google-text-secondary font-mono mt-0.5">{keyStatus.masked_key}</p>
                                    )}
                                </div>
                                {keyStatus.configured && (
                                    <button
                                        onClick={handleDelete}
                                        disabled={deleting}
                                        className="text-xs text-red-300 hover:text-red-200 px-3 py-2 rounded-full hover:bg-red-500/10 transition-colors"
                                    >
                                        {deleting ? 'Removing...' : 'Remove'}
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Input */}
                        <div className="space-y-4 pt-2">
                            <div className="relative">
                                <input
                                    type={showKey ? 'text' : 'password'}
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    placeholder="Paste your API key"
                                    className="w-full bg-google-surface-high border-none rounded-xl px-4 py-4 pr-12 text-sm text-google-text placeholder-google-text-secondary/50 focus:ring-2 focus:ring-google-gold focus:outline-none transition-all"
                                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                                />
                                <button
                                    onClick={() => setShowKey(prev => !prev)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-google-text-secondary hover:text-google-text transition-colors p-1"
                                >
                                    {showKey ? (
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                                    ) : (
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                    )}
                                </button>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={handleSave}
                                    disabled={saving || !apiKey.trim()}
                                    className="flex-1 py-3.5 px-6 rounded-full bg-google-gold text-black text-sm font-semibold hover:bg-google-gold-light transition-colors shadow-lg shadow-black/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {saving ? 'Validating...' : 'Save API Key'}
                                </button>
                            </div>
                        </div>

                        {/* Message */}
                        {message && (
                            <div className={`px-4 py-3 rounded-xl text-sm ${message.type === 'success'
                                ? 'bg-green-500/10 text-green-300'
                                : 'bg-red-500/10 text-red-300'
                                }`}>
                                {message.text}
                            </div>
                        )}

                        <div className="pt-2">
                            <a
                                href="https://aistudio.google.com/apikey"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-google-gold hover:text-google-gold-light transition-colors"
                            >
                                Get a free API key
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                            </a>
                        </div>
                    </div>
                </section>

                {/* Model Selection Section */}
                <section className="bg-google-surface rounded-3xl p-6 border border-google-surface-high">
                    <div className="flex items-start gap-5 mb-6">
                        <div className="w-12 h-12 rounded-full bg-google-surface-high flex items-center justify-center flex-shrink-0">
                            <span className="text-2xl">⚡</span>
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

                {/* About Link */}
                <div className="text-center pt-8 pb-4">
                    <p className="text-xs text-google-text-secondary opacity-50">LyricVault v0.1.1 • Designed for Pixel</p>
                </div>
            </main>
        </>
    );
};

export default SettingsView;
