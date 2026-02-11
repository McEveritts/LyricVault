const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

// ── Paths ────────────────────────────────────────────────────────────
const isDev = !app.isPackaged;

function getResourcePath(...segments) {
    if (isDev) {
        return path.join(__dirname, '..', ...segments);
    }
    return path.join(process.resourcesPath, ...segments);
}

// Python executable — embedded distribution in packaged app, venv in dev
function getPythonPath() {
    if (isDev) {
        return path.join(__dirname, '..', 'backend', 'venv', 'Scripts', 'python.exe');
    }
    return path.join(process.resourcesPath, 'python-embed', 'python.exe');
}

function getBackendPath() {
    return getResourcePath('backend', 'main.py');
}

function getFfmpegDir() {
    if (isDev) {
        // Use system ffmpeg or the WinGet-installed one
        return null; // Let backend use its own configured path
    }
    return getResourcePath('ffmpeg');
}

// ── Backend Process ──────────────────────────────────────────────────
let backendProcess = null;

function startBackend() {
    const pythonPath = getPythonPath();
    const backendScript = getBackendPath();
    const backendDir = path.dirname(backendScript);

    const env = { ...process.env };

    // Set ffmpeg path for packaged app
    const ffmpegDir = getFfmpegDir();
    if (ffmpegDir) {
        env.FFMPEG_DIR = ffmpegDir;
        // Also add to PATH so yt-dlp can find it
        env.PATH = ffmpegDir + ';' + env.PATH;
    }

    console.log(`Starting backend: ${pythonPath} ${backendScript}`);

    backendProcess = spawn(pythonPath, [backendScript], {
        cwd: backendDir,
        env: env,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
    });

    backendProcess.stdout.on('data', (data) => {
        console.log(`[backend] ${data.toString().trim()}`);
    });

    backendProcess.stderr.on('data', (data) => {
        console.error(`[backend] ${data.toString().trim()}`);
    });

    backendProcess.on('error', (err) => {
        console.error('Failed to start backend:', err);
        dialog.showErrorBox(
            'Backend Error',
            `Failed to start the backend server.\n\n${err.message}\n\nPlease check that all dependencies are installed.`
        );
    });

    backendProcess.on('exit', (code) => {
        console.log(`Backend process exited with code ${code}`);
        backendProcess = null;
    });
}

function stopBackend() {
    if (backendProcess) {
        console.log('Stopping backend...');
        backendProcess.kill('SIGTERM');
        // Force kill after 3 seconds if still running
        setTimeout(() => {
            if (backendProcess) {
                backendProcess.kill('SIGKILL');
            }
        }, 3000);
    }
}

// Wait for the backend to respond to health checks
function waitForBackend(maxRetries = 30, interval = 500) {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const check = () => {
            attempts++;
            const req = http.get('http://localhost:8000/', (res) => {
                if (res.statusCode === 200) {
                    resolve();
                } else {
                    retry();
                }
            });
            req.on('error', retry);
            req.setTimeout(1000, () => {
                req.destroy();
                retry();
            });
        };
        const retry = () => {
            if (attempts >= maxRetries) {
                reject(new Error('Backend failed to start after ' + maxRetries + ' attempts'));
            } else {
                setTimeout(check, interval);
            }
        };
        check();
    });
}

// ── Window ───────────────────────────────────────────────────────────
let mainWindow = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 900,
        minHeight: 600,
        title: 'LyricVault',
        backgroundColor: '#0A0F1E',
        show: false, // Don't show until ready
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        // Frameless with custom titlebar feel
        titleBarStyle: 'default',
        icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    });

    // Load the frontend
    if (isDev) {
        // In dev, load from Vite dev server
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    } else {
        // In production, load built files
        const indexPath = path.join(__dirname, '..', 'frontend', 'dist', 'index.html');
        mainWindow.loadFile(indexPath);
    }

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// ── App Lifecycle ────────────────────────────────────────────────────

// Single instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
}

app.whenReady().then(async () => {
    // Start the Python backend
    startBackend();

    try {
        // Wait for backend to be ready (up to 15 seconds)
        await waitForBackend(30, 500);
        console.log('Backend is ready!');
    } catch (err) {
        console.error('Backend startup timeout:', err.message);
        dialog.showErrorBox(
            'Startup Error',
            'The backend server did not start in time.\n\nPlease check the console for errors.'
        );
    }

    createWindow();
});

app.on('window-all-closed', () => {
    stopBackend();
    app.quit();
});

app.on('before-quit', () => {
    stopBackend();
});
