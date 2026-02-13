// Centralized API configuration
// All frontend components should import from here instead of hardcoding URLs
const desktopApiBase = globalThis?.lyricvault?.apiBase;
const API_BASE = desktopApiBase || import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export default API_BASE;
