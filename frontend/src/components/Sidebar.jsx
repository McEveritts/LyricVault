import React from 'react';
import logo from '../assets/logo.svg';

const Sidebar = ({ activeTab, onTabChange }) => {
    return (
        <aside className="w-72 h-screen sticky top-0 bg-google-surface/60 backdrop-blur-xl border-r border-white/5 flex flex-col p-6 hidden md:flex z-40">
            {/* Logo Area - Geometric / Abstract Pixel Pro Style */}
            <div className="flex items-center gap-4 px-2 py-4 mb-8">
                <div className="w-12 h-12 relative group cursor-pointer">
                    {/* Subtle Gold Rotation Effect */}
                    <div className="absolute inset-0 bg-google-gold/20 rounded-xl rotate-6 group-hover:rotate-12 transition-transform duration-500 blur-sm"></div>
                    <div className="relative w-full h-full bg-google-surface-high border border-white/10 rounded-xl flex items-center justify-center overflow-hidden shadow-lg p-2">
                        <img src={logo} alt="LyricVault Logo" className="w-full h-full object-contain" />
                    </div>
                </div>
                <div>
                    <h1 className="text-xl font-bold text-google-text tracking-wide font-sans">
                        LYRIC<span className="text-google-gold">VAULT</span>
                    </h1>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-2">
                <div className="px-4 pb-2 pt-2">
                    <p className="text-[10px] font-bold text-google-text-secondary uppercase tracking-widest opacity-70">Library</p>
                </div>
                <SidebarItem
                    icon="home"
                    label="Home"
                    active={activeTab === 'home'}
                    onClick={() => onTabChange('home')}
                />
                <SidebarItem
                    icon="library"
                    label="My Library"
                    active={activeTab === 'library'}
                    onClick={() => onTabChange('library')}
                />
                <SidebarItem
                    icon="list"
                    label="Playlists"
                    active={activeTab === 'playlists'}
                    onClick={() => onTabChange('playlists')}
                />

                <div className="px-4 pb-2 pt-8">
                    <p className="text-[10px] font-bold text-google-text-secondary uppercase tracking-widest opacity-70">Discovery</p>
                </div>
                <SidebarItem
                    icon="search"
                    label="Explore"
                    active={activeTab === 'discover'}
                    onClick={() => onTabChange('discover')}
                />

                <div className="px-4 pb-2 pt-8">
                    <p className="text-[10px] font-bold text-google-text-secondary uppercase tracking-widest opacity-70">System</p>
                </div>
                <SidebarItem
                    icon="processing"
                    label="Processing Queue"
                    active={activeTab === 'processing'}
                    onClick={() => onTabChange('processing')}
                />
                <SidebarItem
                    icon="activity"
                    label="Activity Log"
                    active={activeTab === 'activity'}
                    onClick={() => onTabChange('activity')}
                />
                <SidebarItem
                    icon="settings"
                    label="Settings"
                    active={activeTab === 'settings'}
                    onClick={() => onTabChange('settings')}
                />
            </nav>

            {/* User Profile / Status - Clean Tech */}
            <button
                onClick={() => onTabChange('settings')}
                className="w-full text-left bg-google-surface-high/50 backdrop-blur-md rounded-2xl p-4 mt-4 border border-white/5 relative overflow-hidden group hover:bg-google-surface-high transition-colors duration-300"
            >
                <div className="flex items-center gap-3 relative z-10">
                    <div className="w-9 h-9 rounded-full bg-google-gold flex items-center justify-center shadow-lg shadow-google-gold/20">
                        <span className="text-xs font-bold text-black">LV</span>
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <p className="text-sm font-bold text-google-text truncate">Local Admin</p>
                        <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                            <span className="text-[10px] text-google-text-secondary truncate uppercase tracking-wider">Online</span>
                        </div>
                    </div>
                </div>
            </button>
        </aside>
    );
};

const SidebarItem = ({ icon, label, active, onClick }) => {
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300 group relative overflow-hidden ${active
                ? 'bg-google-gold/10 text-google-gold shadow-[0_0_20px_rgba(226,194,134,0.05)] border border-google-gold/10'
                : 'text-google-text-secondary hover:text-google-text hover:bg-white/5'
                }`}
        >
            <Icon name={icon} filled={active} className={`w-5 h-5 relative z-10 transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`} />
            <span className={`text-sm tracking-wide relative z-10 ${active ? 'font-medium' : 'font-normal'}`}>{label}</span>
        </button>
    );
};

const Icon = ({ name, className, filled }) => {
    const icons = {
        home: <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" stroke="currentColor" strokeWidth={filled ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round" />,
        library: <path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" stroke="currentColor" strokeWidth={filled ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round" />,
        search: <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke="currentColor" strokeWidth={filled ? 2.5 : 1.5} strokeLinecap="round" strokeLinejoin="round" />,
        list: <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth={filled ? 2.5 : 1.5} strokeLinecap="round" strokeLinejoin="round" />,
        settings: <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" stroke="currentColor" strokeWidth={filled ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round" />,
        activity: <path d="M13 10V3L4 14h7v7l9-11h-7z" stroke="currentColor" strokeWidth={filled ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round" />,
        processing: <path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" stroke="currentColor" strokeWidth={filled ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round" />
    };

    return (
        <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24">
            {icons[name]}
        </svg>
    );
};

export default Sidebar;
