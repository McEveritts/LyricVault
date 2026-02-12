const { contextBridge } = require('electron');

const portArg = process.argv.find(arg => arg && arg.startsWith('--backend-port='));
const portFromArg = portArg ? portArg.split('=')[1] : null;
const backendPort = Number.parseInt(portFromArg || process.env.LYRICVAULT_BACKEND_PORT || '8000', 10) || 8000;

// Expose minimal app info to the renderer
contextBridge.exposeInMainWorld('lyricvault', {
    platform: process.platform,
    version: '0.4.3', // Hardcoded to avoid dev-mode resolution issues with require('../package.json')
    isDesktop: true,
    backendPort,
    apiBase: `http://127.0.0.1:${backendPort}`,
});
