const { contextBridge } = require('electron');

const portArg = process.argv.find(arg => arg && arg.startsWith('--backend-port='));
const portFromArg = portArg ? portArg.split('=')[1] : null;
const backendPort = Number.parseInt(portFromArg || process.env.LYRICVAULT_BACKEND_PORT || '8000', 10) || 8000;

const versionArg = process.argv.find(arg => arg && arg.startsWith('--app-version='));
const versionFromArg = versionArg ? versionArg.split('=')[1] : null;
const appVersion = (versionFromArg || process.env.LYRICVAULT_APP_VERSION || '').trim() || 'unknown';
const apiToken = (process.env.LYRICVAULT_API_TOKEN || '').trim();

// Expose minimal app info to the renderer
contextBridge.exposeInMainWorld('lyricvault', {
    platform: process.platform,
    version: appVersion,
    isDesktop: true,
    backendPort,
    apiBase: `http://127.0.0.1:${backendPort}`,
    apiToken,
});
