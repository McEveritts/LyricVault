const { contextBridge } = require('electron');

// Expose minimal app info to the renderer
contextBridge.exposeInMainWorld('lyricvault', {
    platform: process.platform,
    version: '0.4.2', // Hardcoded to avoid dev-mode resolution issues with require('../package.json')
    isDesktop: true,
});
