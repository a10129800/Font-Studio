import { ipcMain, dialog, shell, BrowserWindow } from 'electron';
import * as path from 'path';
import { IPC_CHANNELS } from '../../shared/channels';
import { isValidFilePath, isValidDirectoryPath } from '../utils/pathValidator';

export function registerDialogIpc(getMainWindow: () => BrowserWindow | null): void {
  const getSafeWindow = (event?: Electron.IpcMainInvokeEvent): BrowserWindow | null => {
    try {
      if (event?.sender) {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win && !win.isDestroyed()) return win;
      }
      const mainWin = getMainWindow();
      if (mainWin && !mainWin.isDestroyed()) return mainWin;
      const focused = BrowserWindow.getFocusedWindow();
      if (focused && !focused.isDestroyed()) return focused;
    } catch {}
    return null;
  };

  // Folder picker
  ipcMain.handle(IPC_CHANNELS.DIALOG_SELECT_FOLDER, async (event) => {
    try {
      const win = getSafeWindow(event);
      const options: Electron.OpenDialogOptions = {
        title: '選擇字體資料夾',
        properties: ['openDirectory', 'dontAddToRecent'],
      };
      const res = win
        ? await dialog.showOpenDialog(win, options)
        : await dialog.showOpenDialog(options);
      return res.canceled || res.filePaths.length === 0 ? null : res.filePaths[0];
    } catch (err) {
      console.error('Failed to open directory dialog:', err);
      return null;
    }
  });

  // Single file picker
  ipcMain.handle(IPC_CHANNELS.DIALOG_SELECT_FILE, async (event, filters: unknown) => {
    try {
      const win = getSafeWindow(event);
      const safeFilters = Array.isArray(filters) ? filters : [];
      const options: Electron.OpenDialogOptions = {
        title: '選取檔案',
        properties: ['openFile'],
        filters: safeFilters,
      };
      const res = win
        ? await dialog.showOpenDialog(win, options)
        : await dialog.showOpenDialog(options);
      return res.canceled || res.filePaths.length === 0 ? null : res.filePaths[0];
    } catch (err) {
      console.error('Failed to open file dialog:', err);
      return null;
    }
  });

  // Multiple files picker (e.g. for fonts)
  ipcMain.handle(IPC_CHANNELS.DIALOG_SELECT_FILES, async (event, filters: unknown) => {
    try {
      const win = getSafeWindow(event);
      const safeFilters = Array.isArray(filters) && filters.length > 0
        ? filters
        : [
            { name: '字體檔案 (*.ttf;*.otf;*.woff;*.woff2;*.ttc)', extensions: ['ttf', 'otf', 'woff', 'woff2', 'ttc'] },
            { name: '所有檔案 (*.*)', extensions: ['*'] },
          ];
      const options: Electron.OpenDialogOptions = {
        title: '選擇要匯入的字體檔案 (可多選)',
        properties: ['openFile', 'multiSelections', 'dontAddToRecent'],
        filters: safeFilters,
      };
      const res = win
        ? await dialog.showOpenDialog(win, options)
        : await dialog.showOpenDialog(options);
      return res.canceled || res.filePaths.length === 0 ? null : res.filePaths;
    } catch (err) {
      console.error('Failed to open files dialog:', err);
      return null;
    }
  });

  // Save file picker
  ipcMain.handle(IPC_CHANNELS.DIALOG_SAVE_FILE, async (event, payload: unknown) => {
    try {
      const win = getSafeWindow(event);
      const { defaultName, filters } = (payload || {}) as { defaultName?: string; filters?: any[] };
      const options: Electron.SaveDialogOptions = {
        title: '另存檔案',
        defaultPath: typeof defaultName === 'string' ? defaultName : 'backup.zip',
        filters: Array.isArray(filters) ? filters : [],
      };
      const res = win
        ? await dialog.showSaveDialog(win, options)
        : await dialog.showSaveDialog(options);
      return res.canceled || !res.filePath ? null : res.filePath;
    } catch (err) {
      console.error('Failed to open save dialog:', err);
      return null;
    }
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

