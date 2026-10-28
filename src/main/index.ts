import { app, BrowserWindow, protocol, net } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { DatabaseService } from './services/databaseService';
import { FontScannerService } from './services/fontScannerService';
import { registerAllIpcHandlers } from './ipc';
import { isValidFilePath } from './utils/pathValidator';

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
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#0f172a',
    title: 'Font Studio',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, '../preload/index.js'),
    },
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
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    const distPath = path.join(__dirname, '../../dist-renderer/index.html');
    if (fs.existsSync(distPath)) {
      mainWindow.loadFile(distPath);
    } else {
      // Fallback for development if dev server URL not passed
      mainWindow.loadURL('http://localhost:5173');
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

app.whenReady().then(() => {
  setupFontPreviewProtocol();

  // Initialize SQLite database and services
  dbService = new DatabaseService();
  scannerService = new FontScannerService(dbService);

  // Register all secure IPC channels
  registerAllIpcHandlers(dbService, scannerService, () => mainWindow);

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
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

