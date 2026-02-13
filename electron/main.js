const { app, BrowserWindow, dialog, protocol } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const net = require('net');

protocol.registerSchemesAsPrivileged([
    {
        scheme: 'app',
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            corsEnabled: true,
        },
    },
]);

// Paths
const isDev = !app.isPackaged;

function getResourcePath(...segments) {
    if (isDev) {
        return path.join(__dirname, '..', ...segments);
    }
    return path.join(process.resourcesPath, ...segments);
}

// Python executable - embedded distribution in packaged app, venv in dev
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

function getWindowIconPath() {
    if (isDev) {
        return path.join(__dirname, '..', 'assets', 'icon.ico');
    }
    return getResourcePath('assets', 'icon.ico');
}

function registerAppProtocol() {
    const distDir = path.join(__dirname, '..', 'frontend', 'dist');
    const distRoot = path.resolve(distDir);
    const distRootLower = distRoot.toLowerCase();

    protocol.registerFileProtocol('app', (request, callback) => {
        try {
            const url = new URL(request.url);
            let pathname = decodeURIComponent(url.pathname || '');
            if (pathname === '/' || pathname === '') {
                pathname = '/index.html';
            }

            // Strip leading slash so path.resolve can't escape to filesystem root on Windows.
            const relativePath = pathname.replace(/^\/+/, '');
            const filePath = path.resolve(distRoot, relativePath);

            if (!filePath.toLowerCase().startsWith(distRootLower + path.sep)) {
                callback({ error: -10 }); // ACCESS_DENIED
                return;
            }

            callback({ path: filePath });
        } catch (err) {
            console.error('Failed to resolve app:// URL', request.url, err);
            callback({ error: -6 }); // FILE_NOT_FOUND
        }
    });
}

// Backend process
let backendProcess = null;
let backendPort = 8000;

function buildBackendBase(port) {
    return `http://127.0.0.1:${port}`;
}

function canListenOnPort(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.unref();
        server.once('error', () => resolve(false));
        server.listen(port, '127.0.0.1', () => {
            server.close(() => resolve(true));
        });
    });
}

async function findAvailablePort(preferredPort = 8000, maxAttempts = 100) {
    for (let offset = 0; offset < maxAttempts; offset += 1) {
        const candidate = preferredPort + offset;
        // eslint-disable-next-line no-await-in-loop
        if (await canListenOnPort(candidate)) {
            return candidate;
        }
    }
    throw new Error(`No available backend port found starting at ${preferredPort}`);
}

function startBackend(port) {
    const pythonPath = getPythonPath();
    const backendScript = getBackendPath();
    const backendDir = path.dirname(backendScript);

    const env = { ...process.env };
    env.LYRICVAULT_BACKEND_PORT = String(port);
    env.LYRICVAULT_APP_VERSION = app.getVersion();
    process.env.LYRICVAULT_BACKEND_PORT = String(port);
    process.env.LYRICVAULT_APP_VERSION = app.getVersion();

    // Set ffmpeg path for packaged app
    const ffmpegDir = getFfmpegDir();
    if (ffmpegDir) {
        env.FFMPEG_DIR = ffmpegDir;
        // Also add to PATH so yt-dlp can find it
        if (env.PATH) {
            env.PATH = `${ffmpegDir}${path.delimiter}${env.PATH}`;
        } else {
            env.PATH = ffmpegDir;
        }
    }

    console.log(`Starting backend on port ${port}: ${pythonPath} ${backendScript}`);

    backendProcess = spawn(pythonPath, [backendScript], {
        cwd: backendDir,
        env: env,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
        shell: false, // Ensure we don't use shell interpolation for security
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
function waitForBackend(port, maxRetries = 30, interval = 500) {
    return new Promise((resolve, reject) => {
        const backendBase = buildBackendBase(port);
        let attempts = 0;
        const check = () => {
            attempts++;
            const req = http.get(`${backendBase}/`, (res) => {
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

// Window
let mainWindow = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 900,
        minHeight: 600,
        title: 'LyricVault',
        autoHideMenuBar: true,
        backgroundColor: '#0A0F1E',
        show: false, // Don't show until ready
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            additionalArguments: [
                `--backend-port=${backendPort}`,
                `--app-version=${app.getVersion()}`,
            ],
        },
        // Frameless with custom titlebar feel
        titleBarStyle: 'default',
        icon: getWindowIconPath(),
    });

    // Load the frontend
    if (isDev) {
        // In dev, load from Vite dev server
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    } else {
        // In production, load built files
        mainWindow.loadURL('app://./index.html');
    }

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// App lifecycle

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
    if (!isDev) {
        registerAppProtocol();
    }

    try {
        backendPort = await findAvailablePort(8000, 100);
    } catch (err) {
        dialog.showErrorBox(
            'Startup Error',
            `Could not find an available backend port.\n\n${err.message}`
        );
        app.quit();
        return;
    }

    // Start the Python backend
    startBackend(backendPort);

    try {
        // Wait for backend to be ready (up to 15 seconds)
        await waitForBackend(backendPort, 30, 500);
        console.log(`Backend is ready on port ${backendPort}!`);
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

