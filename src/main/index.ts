import { app, BrowserWindow, protocol, net, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { DatabaseService } from './services/databaseService';
import { FontScannerService } from './services/fontScannerService';
import { registerAllIpcHandlers } from './ipc';
import { isValidFilePath } from './utils/pathValidator';

// Diagnostic logger for startup failures
function logFatalError(context: string, err: any): void {
  try {
    const errorMsg = `[${new Date().toISOString()}] [${context}] ${err?.stack || err?.message || String(err)}\n`;
    const tempLog = path.join(process.env.TEMP || 'C:\\Temp', 'fontstudio_startup.log');
    fs.appendFileSync(tempLog, errorMsg, 'utf-8');

    const appData = process.env.APPDATA;
    if (appData) {
      const logDir = path.join(appData, 'font-studio');
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      fs.appendFileSync(path.join(logDir, 'startup_error.log'), errorMsg, 'utf-8');
    }
  } catch {}
}

process.on('uncaughtException', (err) => {
  logFatalError('uncaughtException', err);
  try {
    dialog.showErrorBox('Font Studio 啟動錯誤', `應用程式發生未預期的錯誤：\n\n${err?.message || String(err)}`);
  } catch {}
});

process.on('unhandledRejection', (reason) => {
  logFatalError('unhandledRejection', reason);
});

// Register privileged custom scheme for zero-install font preview
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'font-preview',
    privileges: {
      standard: true,
      secure: true,
      bypassCSP: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

let mainWindow: BrowserWindow | null = null;
let dbService: DatabaseService | null = null;
let scannerService: FontScannerService | null = null;

function createWindow(): void {
  const preloadCandidates = [
    path.join(__dirname, '../preload/index.js'),
    path.join(app.getAppPath(), 'dist-electron', 'preload', 'index.js'),
    path.join(__dirname, '../../dist-electron/preload/index.js'),
  ];
  let preloadPath = preloadCandidates[0];
  for (const cand of preloadCandidates) {
    if (fs.existsSync(cand)) {
      preloadPath = cand;
      break;
    }
  }

  // Resolve application icon for window and taskbar
  const iconCandidates = [
    path.join(app.getAppPath(), 'resources', 'icon.ico'),
    path.join(app.getAppPath(), 'resources', 'icon.png'),
    path.join(process.resourcesPath, 'icon.ico'),
    path.join(__dirname, '../../resources/icon.ico'),
    path.join(__dirname, '../../resources/icon.png'),
    path.join(__dirname, '../resources/icon.ico'),
    path.join(__dirname, '../resources/icon.png'),
    path.join(__dirname, '../../build/icon.ico'),
    path.join(__dirname, '../../build/icon.png'),
  ];
  let windowIcon: string | undefined = undefined;
  for (const candidate of iconCandidates) {
    if (fs.existsSync(candidate)) {
      windowIcon = candidate;
      break;
    }
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#0f172a',
    title: 'Font Studio',
    ...(windowIcon ? { icon: windowIcon } : {}),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: preloadPath,
    },
  });

  mainWindow.webContents.on('preload-error', (_event, failedPath, error) => {
    logFatalError('preload-error', new Error(`Preload script failed at ${failedPath}: ${error?.stack || error?.message || String(error)}`));
  });

  // Security: block unauthorized navigation
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsed = new URL(navigationUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'file:' && parsed.protocol !== 'font-preview:') {
      event.preventDefault();
    }
  });

  // Security: block unauthorized window openings
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // Load renderer
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL).catch((err) => {
      logFatalError('loadURL(dev)', err);
    });
  } else {
    const candidates = [
      path.join(app.getAppPath(), 'dist-renderer', 'index.html'),
      path.join(__dirname, '../../dist-renderer/index.html'),
      path.join(__dirname, '../dist-renderer/index.html'),
    ];
    let loaded = false;
    for (const distPath of candidates) {
      if (fs.existsSync(distPath)) {
        mainWindow.loadFile(distPath).catch((err) => {
          logFatalError('loadFile', err);
        });
        loaded = true;
        break;
      }
    }
    if (!loaded) {
      logFatalError('rendererNotFound', new Error(`Could not find index.html in candidates: ${candidates.join(', ')}`));
      mainWindow.loadURL('http://localhost:5173').catch((err) => {
        logFatalError('loadURL(fallback)', err);
      });
    }
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function setupFontPreviewProtocol(): void {
  protocol.handle('font-preview', async (request) => {
    try {
      const url = new URL(request.url);
      const rawPath = url.searchParams.get('path');
      if (!rawPath) {
        return new Response('Missing font path parameter', { status: 400 });
      }

      const decodedPath = decodeURIComponent(rawPath);
      if (!isValidFilePath(decodedPath)) {
        return new Response('Invalid or non-existent font file path', { status: 403 });
      }

      const ext = path.extname(decodedPath).toLowerCase();
      const allowedExts: Record<string, string> = {
        '.ttf': 'font/ttf',
        '.otf': 'font/otf',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttc': 'font/collection',
      };

      const mimeType = allowedExts[ext];
      if (!mimeType) {
        return new Response('Unsupported font format for preview', { status: 415 });
      }

      const buffer = await fs.promises.readFile(decodedPath);
      return new Response(buffer, {
        headers: {
          'Content-Type': mimeType,
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (err: any) {
      return new Response(`Failed to load font: ${err.message}`, { status: 500 });
    }
  });
}

app.whenReady().then(async () => {
  try {
    if (process.platform === 'win32') {
      app.setAppUserModelId('com.fontstudio.app');
    }

    setupFontPreviewProtocol();

    // Initialize SQLite database in Electron standard userData directory
    const userDataDir = app.getPath('userData');
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
    }
    const dbPath = path.join(userDataDir, 'font_studio.db');

    try {
      dbService = new DatabaseService(dbPath);
      scannerService = new FontScannerService(dbService);
      registerAllIpcHandlers(dbService, scannerService, () => mainWindow);
    } catch (dbErr: any) {
      logFatalError('databaseServiceInit', dbErr);
      dialog.showErrorBox(
        'Font Studio 資料庫初始化失敗',
        `無法初始化字體資料庫 (${dbPath})：\n${dbErr?.message || String(dbErr)}\n\n請檢查磁碟空間或權限。應用程式仍將嘗試開啟主視窗。`
      );
    }

    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  } catch (startupErr: any) {
    logFatalError('appWhenReady', startupErr);
    dialog.showErrorBox(
      'Font Studio 啟動錯誤',
      `應用程式啟動時發生未預期的錯誤：\n${startupErr?.message || String(startupErr)}`
    );
  }
}).catch((err) => {
  logFatalError('whenReadyPromiseRejected', err);
});

app.on('window-all-closed', () => {
  if (dbService) {
    try {
      dbService.close();
    } catch {}
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

