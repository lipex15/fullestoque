/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const { app, BrowserWindow, Tray, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let tray;
let serverProcess;

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  return;
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    mainWindow.show();
  }
});

function startServer() {
  // In production compiled package, start the bundled express server
  const isPackaged = app.isPackaged;
  if (isPackaged) {
    const serverPath = path.join(process.resourcesPath, 'app', 'dist', 'server.cjs');
    serverProcess = spawn(process.execPath, [serverPath], {
      env: { ...process.env, NODE_ENV: 'production', IS_ELECTRON: 'true', ELECTRON_RUN_AS_NODE: '1' },
      stdio: ['pipe', 'pipe', 'pipe', 'ipc']
    });

    serverProcess.stdout.on('data', (data) => {
      console.log(`[Express stdout]: ${data}`);
      require('fs').appendFileSync('C:\\Users\\felip\\Desktop\\error.log', `[STDOUT] ${data}\n`);
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(`[Express stderr]: ${data}`);
      require('fs').appendFileSync('C:\\Users\\felip\\Desktop\\error.log', `[STDERR] ${data}\n`);
    });

    serverProcess.on('error', (err) => {
      require('fs').appendFileSync('C:\\Users\\felip\\Desktop\\error.log', `[SPAWN ERROR] ${err.message}\n`);
    });

    serverProcess.on('exit', (code, signal) => {
      require('fs').appendFileSync('C:\\Users\\felip\\Desktop\\error.log', `[EXIT] code: ${code}, signal: ${signal}\n`);
    });
  }
}

function createWindow() {
  require('fs').appendFileSync('C:\\Users\\felip\\Desktop\\error.log', `[MAIN] createWindow called. execPath: ${process.execPath}\n`);
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1000,
    minHeight: 600,
    title: 'deathstuffs brain v1.0',
    icon: path.join(__dirname, 'assets', 'logo.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  // Suppress standard menu bar (File, Edit, View...) on Windows
  mainWindow.setMenu(null);

  // Custom user agent
  mainWindow.webContents.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

  // Load Express address
  mainWindow.loadURL('http://localhost:3000');

  // Retry loading if connection fails (e.g. server booting up)
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    if (validatedURL.startsWith('http://localhost:3000')) {
      console.log('Aguardando inicialização do servidor local. Tentando novamente em 500ms...');
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadURL('http://localhost:3000');
        }
      }, 500);
    }
  });

  // Handle window close event to hide in tray instead of completely exiting
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });
}

function createTray() {
  // Create system tray icon
  const iconPath = path.join(__dirname, 'assets', 'logo.png');
  tray = new Tray(iconPath);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Abrir Painel',
      click: () => {
        mainWindow.show();
      }
    },
    { type: 'separator' },
    {
      label: 'Sair Completamente',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('deathstuffs brain v1.0 - Monitor de Webhooks');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    mainWindow.show();
  });
}

app.whenReady().then(() => {
  startServer();
  createWindow();

  // Tray creation can fail if icon doesn't exist yet, catch gracefully
  try {
    createTray();
  } catch (e) {
    console.log("Tray icon ignored during sandbox testing.");
  }

  // Setup auto-updater in production packaging
  if (app.isPackaged) {
    try {
      autoUpdater.logger = {
        info: (msg) => require('fs').appendFileSync('C:\\Users\\felip\\Desktop\\error.log', `[AUTOUPDATER INFO] ${msg}\n`),
        warn: (msg) => require('fs').appendFileSync('C:\\Users\\felip\\Desktop\\error.log', `[AUTOUPDATER WARN] ${msg}\n`),
        error: (msg) => require('fs').appendFileSync('C:\\Users\\felip\\Desktop\\error.log', `[AUTOUPDATER ERROR] ${msg}\n`)
      };

      autoUpdater.autoDownload = true;
      autoUpdater.autoInstallOnAppQuit = true;

      // Event Listeners for the IPC bridge
      autoUpdater.on('checking-for-update', () => {
        if (serverProcess) serverProcess.send({ type: 'updater_state', data: { status: 'checking', progress: 0 } });
      });

      autoUpdater.on('update-available', (info) => {
        if (serverProcess) serverProcess.send({ type: 'updater_state', data: { status: 'available', progress: 0 } });
      });

      autoUpdater.on('update-not-available', (info) => {
        if (serverProcess) serverProcess.send({ type: 'updater_state', data: { status: 'none', progress: 0 } });
      });

      autoUpdater.on('error', (err) => {
        if (serverProcess) serverProcess.send({ type: 'updater_state', data: { status: 'error', progress: 0, error: err.message } });
        require('fs').appendFileSync('C:\\Users\\felip\\Desktop\\error.log', `[AUTOUPDATER EMIT ERROR] ${err.message}\n`);
      });

      autoUpdater.on('download-progress', (progressObj) => {
        if (serverProcess) serverProcess.send({
          type: 'updater_state', data: {
            status: 'downloading',
            progress: progressObj.percent,
            bytesPerSecond: progressObj.bytesPerSecond
          }
        });
      });

      autoUpdater.on('update-downloaded', (info) => {
        if (serverProcess) serverProcess.send({ type: 'updater_state', data: { status: 'ready', progress: 100 } });
      });

      // IPC listener to receive commands from React via Express
      if (serverProcess) {
        serverProcess.on('message', (msg) => {
          if (msg && msg.type === 'updater_action') {
            if (msg.action === 'check') {
              autoUpdater.checkForUpdatesAndNotify().catch(e => console.error(e));
            } else if (msg.action === 'install') {
              autoUpdater.quitAndInstall(true, true);
            }
          }
        });
      }

      autoUpdater.checkForUpdatesAndNotify().catch(err => {
        require('fs').appendFileSync('C:\\Users\\felip\\Desktop\\error.log', `[AUTOUPDATER FATAL] ${err.message}\n`);
      });
    } catch (err) {
      require('fs').appendFileSync('C:\\Users\\felip\\Desktop\\error.log', `[AUTOUPDATER DECLARATION ERROR] ${err.message}\n`);
    }
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
