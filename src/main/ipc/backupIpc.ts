import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/channels';
import { BackupService } from '../services/backupService';
import { DatabaseService } from '../services/databaseService';
import {
  BackupProgressUpdate,
  RestoreOptions,
  BackupManifest,
} from '../../shared/types';
import { isValidFilePath } from '../utils/pathValidator';

export function registerBackupIpc(
  backupService: BackupService,
  db: DatabaseService,
  getMainWindow: () => BrowserWindow | null
): void {
  // Create backup ZIP
  ipcMain.handle(IPC_CHANNELS.BACKUP_CREATE, async (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Invalid backup create payload');
    }

    const { destinationZipPath, fontIds, collectionId, includeAll } = payload as {
      destinationZipPath: string;
      fontIds?: string[];
      collectionId?: string;
      includeAll?: boolean;
    };

    if (!destinationZipPath || typeof destinationZipPath !== 'string' || destinationZipPath.includes('\0')) {
      throw new Error('Valid destinationZipPath is required');
    }

    const mainWindow = getMainWindow();
    const onProgress = (update: BackupProgressUpdate) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC_CHANNELS.BACKUP_PROGRESS, update);
      }
    };

    return backupService.createBackup(
      destinationZipPath.trim(),
      {
        fontIds: Array.isArray(fontIds) ? fontIds : undefined,
        collectionId: typeof collectionId === 'string' ? collectionId : undefined,
        includeAll: Boolean(includeAll),
      },
      onProgress
    );
  });

  // Verify backup ZIP
  ipcMain.handle(IPC_CHANNELS.BACKUP_VERIFY, async (_event, zipPath: unknown) => {
    if (typeof zipPath !== 'string' || !zipPath.trim() || zipPath.includes('\0')) {
      throw new Error('Valid zipPath is required');
    }
    return backupService.verifyBackupZip(zipPath.trim());
  });

  // Restore backup ZIP
  ipcMain.handle(IPC_CHANNELS.BACKUP_RESTORE, async (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Invalid backup restore payload');
    }

    const options = payload as RestoreOptions;
    if (!options.zipPath || typeof options.zipPath !== 'string' || options.zipPath.includes('\0')) {
      throw new Error('Valid zipPath is required');
    }

    if (!options.targetDirectory || typeof options.targetDirectory !== 'string' || options.targetDirectory.includes('\0')) {
      throw new Error('Valid targetDirectory is required');
    }

    const mainWindow = getMainWindow();
    const onProgress = (update: BackupProgressUpdate) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC_CHANNELS.BACKUP_PROGRESS, update);
      }
    };

    return backupService.restoreBackup(options, onProgress);
  });

  // Cancel backup or restore task
  ipcMain.handle(IPC_CHANNELS.BACKUP_CANCEL, async (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      return { success: false, error: 'Invalid payload' };
    }
    const { taskId } = payload as { taskId: string };
    if (!taskId || typeof taskId !== 'string') {
      return { success: false, error: 'Valid taskId is required' };
    }
    const cancelled = backupService.cancelTask(taskId.trim());
    return { success: cancelled };
  });

  // Import metadata from manifest
  ipcMain.handle(IPC_CHANNELS.BACKUP_IMPORT_METADATA, async (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Invalid metadata import payload');
    }

    const { manifest, options } = payload as {
      manifest: BackupManifest;
      options?: { importCollections?: boolean; importTags?: boolean; importFavorites?: boolean };
    };

    if (!manifest || !Array.isArray(manifest.files)) {
      throw new Error('Valid manifest object is required');
    }

    return db.importBackupMetadata(manifest, options);
  });
}
