import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/channels';
import { DatabaseService } from '../services/databaseService';
import { FontInstallService } from '../services/fontInstallService';
import { BatchJobQueue } from '../services/batchJobQueue';
import { BatchTaskProgressUpdate } from '../../shared/types';

export function registerInstallIpc(
  db: DatabaseService,
  installService: FontInstallService,
  batchQueue: BatchJobQueue,
  getMainWindow: () => BrowserWindow | null
): void {
  // Check scope status & elevation
  ipcMain.handle(IPC_CHANNELS.INSTALL_GET_SCOPE_STATUS, async () => {
    const isElevated = await installService.isElevated();
    return {
      isElevated,
      userFontsDir: installService.getUserFontsDir(),
      canInstallUserScope: true,
      canInstallSystemScope: isElevated,
    };
  });

  // Batch font installation
  ipcMain.handle(IPC_CHANNELS.INSTALL_FONTS, async (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Invalid install payload');
    }
    const { fontIds } = payload as { fontIds: string[] };
    if (!Array.isArray(fontIds) || fontIds.length === 0) {
      throw new Error('fontIds array is required and must not be empty');
    }

    // Retrieve fonts from database
    const fonts = [];
    for (const id of fontIds) {
      if (typeof id === 'string' && id.trim()) {
        const font = db.getFontById(id.trim());
        if (font) {
          fonts.push(font);
        }
      }
    }

    if (fonts.length === 0) {
      throw new Error('No valid fonts found for the provided IDs');
    }

    const mainWindow = getMainWindow();
    const onProgress = (update: BatchTaskProgressUpdate) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC_CHANNELS.INSTALL_TASK_PROGRESS, update);
      }
    };

    return batchQueue.executeInstallBatch(fonts, onProgress);
  });

  // Batch font uninstallation
  ipcMain.handle(IPC_CHANNELS.UNINSTALL_FONTS, async (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Invalid uninstall payload');
    }
    const { fontIds } = payload as { fontIds: string[] };
    if (!Array.isArray(fontIds) || fontIds.length === 0) {
      throw new Error('fontIds array is required and must not be empty');
    }

    const fonts = [];
    for (const id of fontIds) {
      if (typeof id === 'string' && id.trim()) {
        const font = db.getFontById(id.trim());
        if (font) {
          fonts.push(font);
        }
      }
    }

    if (fonts.length === 0) {
      throw new Error('No valid fonts found for the provided IDs');
    }

    const mainWindow = getMainWindow();
    const onProgress = (update: BatchTaskProgressUpdate) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC_CHANNELS.INSTALL_TASK_PROGRESS, update);
      }
    };

    return batchQueue.executeUninstallBatch(fonts, onProgress);
  });

  // Cancel running batch task
  ipcMain.handle(IPC_CHANNELS.INSTALL_CANCEL_TASK, async (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      return { success: false, error: 'Invalid payload' };
    }
    const { taskId } = payload as { taskId: string };
    if (!taskId || typeof taskId !== 'string') {
      return { success: false, error: 'taskId is required' };
    }
    const cancelled = batchQueue.cancelTask(taskId.trim());
    return { success: cancelled };
  });
}
