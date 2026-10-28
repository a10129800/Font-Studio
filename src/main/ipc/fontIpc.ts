import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/channels';
import { DatabaseService } from '../services/databaseService';
import { FontScannerService } from '../services/fontScannerService';
import { FontFilterOptions, ScanProgressUpdate } from '../../shared/types';
import { isValidDirectoryPath } from '../utils/pathValidator';

export function registerFontIpc(
  db: DatabaseService,
  scanner: FontScannerService,
  getMainWindow: () => BrowserWindow | null
): void {
  // Get all fonts with validated filter options
  ipcMain.handle(IPC_CHANNELS.FONTS_GET_ALL, async (_event, options?: unknown) => {
    const safeOptions: FontFilterOptions = {};
    if (options && typeof options === 'object') {
      const opt = options as Record<string, any>;
      if (typeof opt.searchQuery === 'string') safeOptions.searchQuery = opt.searchQuery.slice(0, 100);
      if (typeof opt.format === 'string') safeOptions.format = opt.format as any;
      if (typeof opt.sourceType === 'string') safeOptions.sourceType = opt.sourceType as any;
      if (typeof opt.installScope === 'string') safeOptions.installScope = opt.installScope as any;
      if (typeof opt.scanStatus === 'string') safeOptions.scanStatus = opt.scanStatus as any;
      if (typeof opt.isFavorite === 'boolean') safeOptions.isFavorite = opt.isFavorite;
      if (typeof opt.collectionId === 'string') safeOptions.collectionId = opt.collectionId;
      if (typeof opt.tagId === 'string') safeOptions.tagId = opt.tagId;
      if (typeof opt.sortBy === 'string') safeOptions.sortBy = opt.sortBy as any;
      if (typeof opt.sortOrder === 'string') safeOptions.sortOrder = opt.sortOrder === 'desc' ? 'desc' : 'asc';
    }
    return db.getFonts(safeOptions);
  });

  // Get single font by ID
  ipcMain.handle(IPC_CHANNELS.FONTS_GET_BY_ID, async (_event, id: unknown) => {
    if (typeof id !== 'string' || !id.trim()) {
      throw new Error('Invalid font ID parameter');
    }
    return db.getFontById(id.trim());
  });

  // Start font scanning with progress events
  ipcMain.handle(IPC_CHANNELS.FONTS_START_SCAN, async (_event, customPaths?: unknown) => {
    let targetDirs: { path: string; source: 'system' | 'user' | 'imported' }[] | undefined;

    if (Array.isArray(customPaths)) {
      targetDirs = [];
      for (const p of customPaths) {
        if (typeof p === 'string' && isValidDirectoryPath(p)) {
          targetDirs.push({ path: p, source: 'imported' });
        }
      }
    }

    const mainWindow = getMainWindow();
    const onProgress = (update: ScanProgressUpdate) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC_CHANNELS.FONTS_SCAN_PROGRESS, update);
      }
    };

    return scanner.scanDirectories(targetDirs, onProgress);
  });

  // Cancel scanning
  ipcMain.handle(IPC_CHANNELS.FONTS_CANCEL_SCAN, async () => {
    scanner.cancel();
    return { cancelled: true };
  });

  // Toggle favorite
  ipcMain.handle(IPC_CHANNELS.FONTS_TOGGLE_FAVORITE, async (_event, fontId: unknown) => {
    if (typeof fontId !== 'string' || !fontId.trim()) {
      throw new Error('Invalid font ID');
    }
    return db.toggleFavorite(fontId.trim());
  });

  // Delete font from index
  ipcMain.handle(IPC_CHANNELS.FONTS_DELETE, async (_event, fontId: unknown) => {
    if (typeof fontId !== 'string' || !fontId.trim()) {
      throw new Error('Invalid font ID');
    }
    db.deleteFont(fontId.trim());
    return { success: true };
  });
}
