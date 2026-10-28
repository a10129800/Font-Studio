import { ipcMain, BrowserWindow } from 'electron';
import { DatabaseService } from '../services/databaseService';
import { FontScannerService } from '../services/fontScannerService';
import { registerFontIpc } from './fontIpc';
import { registerCollectionIpc } from './collectionIpc';
import { registerDialogIpc } from './dialogIpc';
import { IPC_CHANNELS } from '../../shared/channels';

export function registerAllIpcHandlers(
  db: DatabaseService,
  scanner: FontScannerService,
  getMainWindow: () => BrowserWindow | null
): void {
  registerFontIpc(db, scanner, getMainWindow);
  registerCollectionIpc(db);
  registerDialogIpc(getMainWindow);

  // Storage Analysis handler
  ipcMain.handle(IPC_CHANNELS.STORAGE_GET_ANALYSIS, async () => {
    const fonts = db.getAllFonts();
    const exactDupes = db.getExactDuplicates();
    const familyDupes = db.getPotentialFamilyDuplicates();

    let totalSizeBytes = 0;
    let systemFontCount = 0;
    let systemSizeBytes = 0;
    let userFontCount = 0;
    let userSizeBytes = 0;
    let importedFontCount = 0;
    let importedSizeBytes = 0;

    const formatBreakdown: Record<string, { count: number; sizeBytes: number }> = {
      ttf: { count: 0, sizeBytes: 0 },
      otf: { count: 0, sizeBytes: 0 },
      woff: { count: 0, sizeBytes: 0 },
      woff2: { count: 0, sizeBytes: 0 },
      ttc: { count: 0, sizeBytes: 0 },
      unknown: { count: 0, sizeBytes: 0 },
    };

    const corruptedOrUnsupported = [];

    for (const f of fonts) {
      totalSizeBytes += f.file_size;
      if (f.source_type === 'system') {
        systemFontCount++;
        systemSizeBytes += f.file_size;
      } else if (f.source_type === 'user') {
        userFontCount++;
        userSizeBytes += f.file_size;
      } else {
        importedFontCount++;
        importedSizeBytes += f.file_size;
      }

      if (formatBreakdown[f.format]) {
        formatBreakdown[f.format].count++;
        formatBreakdown[f.format].sizeBytes += f.file_size;
      }

      if (f.scan_status === 'corrupted' || f.scan_status === 'unsupported') {
        corruptedOrUnsupported.push(f);
      }
    }

    return {
      totalFonts: fonts.length,
      totalSizeBytes,
      systemFontCount,
      systemSizeBytes,
      userFontCount,
      userSizeBytes,
      importedFontCount,
      importedSizeBytes,
      formatBreakdown,
      exactDuplicates: exactDupes,
      potentialFamilyDuplicates: familyDupes,
      corruptedOrUnsupported,
    };
  });

  // Placeholder handlers for M2/M3 with clear status reporting
  ipcMain.handle(IPC_CHANNELS.INSTALL_FONTS, async () => {
    throw new Error('Font installation service is scheduled for Milestone M2');
  });

  ipcMain.handle(IPC_CHANNELS.UNINSTALL_FONTS, async () => {
    throw new Error('Font uninstallation service is scheduled for Milestone M2');
  });

  ipcMain.handle(IPC_CHANNELS.INSTALL_CANCEL_TASK, async () => {
    return { cancelled: true };
  });

  ipcMain.handle(IPC_CHANNELS.BACKUP_CREATE, async () => {
    throw new Error('Backup creation service is scheduled for Milestone M3');
  });

  ipcMain.handle(IPC_CHANNELS.BACKUP_VERIFY, async () => {
    throw new Error('Backup verification service is scheduled for Milestone M3');
  });

  ipcMain.handle(IPC_CHANNELS.BACKUP_RESTORE, async () => {
    throw new Error('Backup restore service is scheduled for Milestone M3');
  });
}

