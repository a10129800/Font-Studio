import { ipcMain, dialog, shell, BrowserWindow } from 'electron';
import * as path from 'path';
import { IPC_CHANNELS } from '../../shared/channels';
import { isValidFilePath, isValidDirectoryPath } from '../utils/pathValidator';

export function registerDialogIpc(getMainWindow: () => BrowserWindow | null): void {
  // Folder picker
  ipcMain.handle(IPC_CHANNELS.DIALOG_SELECT_FOLDER, async () => {
    const win = getMainWindow();
    if (!win) return null;
    const res = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
    });
    return res.canceled || res.filePaths.length === 0 ? null : res.filePaths[0];
  });

  // File picker
  ipcMain.handle(IPC_CHANNELS.DIALOG_SELECT_FILE, async (_event, filters: unknown) => {
    const win = getMainWindow();
    if (!win) return null;
    const safeFilters = Array.isArray(filters) ? filters : [];
    const res = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: safeFilters,
    });
    return res.canceled || res.filePaths.length === 0 ? null : res.filePaths[0];
  });

  // Save file picker
  ipcMain.handle(IPC_CHANNELS.DIALOG_SAVE_FILE, async (_event, payload: unknown) => {
    const win = getMainWindow();
    if (!win) return null;
    const { defaultName, filters } = (payload || {}) as { defaultName?: string; filters?: any[] };
    const res = await dialog.showSaveDialog(win, {
      defaultPath: typeof defaultName === 'string' ? defaultName : 'backup.zip',
      filters: Array.isArray(filters) ? filters : [],
    });
    return res.canceled || !res.filePath ? null : res.filePath;
  });

  // App open path safely
  ipcMain.handle(IPC_CHANNELS.APP_OPEN_PATH, async (_event, targetPath: unknown) => {
    if (typeof targetPath !== 'string') return;
    const resolved = path.resolve(targetPath);
    if (isValidFilePath(resolved) || isValidDirectoryPath(resolved)) {
      await shell.showItemInFolder(resolved);
    }
  });

  // System info
  ipcMain.handle(IPC_CHANNELS.APP_GET_SYSTEM_INFO, async () => {
    return {
      platform: process.platform,
      arch: process.arch,
      isElevated: false, // Normal user mode standard
    };
  });
}

