import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import type { FontStudioAPI } from './types';
import type {
  FontFilterOptions,
  ScanProgressUpdate,
  BatchTaskProgressUpdate,
  BackupProgressUpdate,
  RestoreOptions,
  BackupManifest,
} from '../shared/types';

// Inlined IPC channel definitions:
// In Electron sandboxed preload (sandbox: true), runtime relative require() calls are prohibited.
// Inlining constants ensures this preload script has zero external Node module dependencies and loads cleanly.
const IPC_CHANNELS = {
  // Fonts
  FONTS_GET_ALL: 'fonts:get-all',
  FONTS_GET_BY_ID: 'fonts:get-by-id',
  FONTS_START_SCAN: 'fonts:start-scan',
  FONTS_CANCEL_SCAN: 'fonts:cancel-scan',
  FONTS_SCAN_PROGRESS: 'fonts:scan-progress',
  FONTS_TOGGLE_FAVORITE: 'fonts:toggle-favorite',
  FONTS_SET_FAVORITES_BATCH: 'fonts:set-favorites-batch',
  FONTS_DELETE: 'fonts:delete',

  // Collections
  COLLECTIONS_GET_ALL: 'collections:get-all',
  COLLECTIONS_CREATE: 'collections:create',
  COLLECTIONS_RENAME: 'collections:rename',
  COLLECTIONS_DELETE: 'collections:delete',
  COLLECTIONS_ADD_FONT: 'collections:add-font',
  COLLECTIONS_REMOVE_FONT: 'collections:remove-font',
  COLLECTIONS_ADD_FONTS_BATCH: 'collections:add-fonts-batch',
  COLLECTIONS_REMOVE_FONTS_BATCH: 'collections:remove-fonts-batch',

  // Tags
  TAGS_GET_ALL: 'tags:get-all',
  TAGS_CREATE: 'tags:create',
  TAGS_RENAME: 'tags:rename',
  TAGS_DELETE: 'tags:delete',
  TAGS_ADD_TO_FONT: 'tags:add-to-font',
  TAGS_REMOVE_FROM_FONT: 'tags:remove-from-font',
  TAGS_ADD_BATCH: 'tags:add-batch',
  TAGS_REMOVE_BATCH: 'tags:remove-batch',

  // Installation
  INSTALL_FONTS: 'install:fonts',
  UNINSTALL_FONTS: 'install:uninstall-fonts',
  INSTALL_TASK_PROGRESS: 'install:task-progress',
  INSTALL_CANCEL_TASK: 'install:cancel-task',
  INSTALL_GET_SCOPE_STATUS: 'install:get-scope-status',

  // Backup & Restore
  BACKUP_CREATE: 'backup:create',
  BACKUP_VERIFY: 'backup:verify',
  BACKUP_RESTORE: 'backup:restore',
  BACKUP_PROGRESS: 'backup:progress',
  BACKUP_CANCEL: 'backup:cancel',
  BACKUP_IMPORT_METADATA: 'backup:import-metadata',

  // Storage Analysis
  STORAGE_GET_ANALYSIS: 'storage:get-analysis',

  // Dialogs
  DIALOG_SELECT_FOLDER: 'dialog:select-folder',
  DIALOG_SELECT_FILE: 'dialog:select-file',
  DIALOG_SELECT_FILES: 'dialog:select-files',
  DIALOG_SAVE_FILE: 'dialog:save-file',

  // System
  APP_GET_SYSTEM_INFO: 'app:get-system-info',
  APP_OPEN_PATH: 'app:open-path',
} as const;

const api: FontStudioAPI = {
  fonts: {
    getAll: (options?: FontFilterOptions) =>
      ipcRenderer.invoke(IPC_CHANNELS.FONTS_GET_ALL, options),
    getById: (id: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.FONTS_GET_BY_ID, id),
    startScan: (customPaths?: string[]) =>
      ipcRenderer.invoke(IPC_CHANNELS.FONTS_START_SCAN, customPaths),
    cancelScan: () =>
      ipcRenderer.invoke(IPC_CHANNELS.FONTS_CANCEL_SCAN),
    onScanProgress: (callback: (progress: ScanProgressUpdate) => void) => {
      const handler = (_event: IpcRendererEvent, data: ScanProgressUpdate) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.FONTS_SCAN_PROGRESS, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.FONTS_SCAN_PROGRESS, handler);
    },
    toggleFavorite: (fontId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.FONTS_TOGGLE_FAVORITE, fontId),
    setFavoritesBatch: (fontIds: string[], favorite: boolean) =>
      ipcRenderer.invoke(IPC_CHANNELS.FONTS_SET_FAVORITES_BATCH, { fontIds, favorite }),
    delete: (fontId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.FONTS_DELETE, fontId),
  },

  collections: {
    getAll: () =>
      ipcRenderer.invoke(IPC_CHANNELS.COLLECTIONS_GET_ALL),
    create: (name: string, description?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.COLLECTIONS_CREATE, { name, description }),
    rename: (id: string, newName: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.COLLECTIONS_RENAME, { id, newName }),
    delete: (id: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.COLLECTIONS_DELETE, id),
    addFont: (fontId: string, collectionId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.COLLECTIONS_ADD_FONT, { fontId, collectionId }),
    removeFont: (fontId: string, collectionId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.COLLECTIONS_REMOVE_FONT, { fontId, collectionId }),
    addFontsBatch: (fontIds: string[], collectionId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.COLLECTIONS_ADD_FONTS_BATCH, { fontIds, collectionId }),
    removeFontsBatch: (fontIds: string[], collectionId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.COLLECTIONS_REMOVE_FONTS_BATCH, { fontIds, collectionId }),
  },

  tags: {
    getAll: () =>
      ipcRenderer.invoke(IPC_CHANNELS.TAGS_GET_ALL),
    create: (name: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.TAGS_CREATE, name),
    rename: (id: string, newName: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.TAGS_RENAME, { id, newName }),
    delete: (id: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.TAGS_DELETE, id),
    addToFont: (fontId: string, tagId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.TAGS_ADD_TO_FONT, { fontId, tagId }),
    removeFromFont: (fontId: string, tagId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.TAGS_REMOVE_FROM_FONT, { fontId, tagId }),
    addBatch: (fontIds: string[], tagId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.TAGS_ADD_BATCH, { fontIds, tagId }),
    removeBatch: (fontIds: string[], tagId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.TAGS_REMOVE_BATCH, { fontIds, tagId }),
  },

  install: {
    installFonts: (fontIds: string[], scope?: 'user' | 'system') =>
      ipcRenderer.invoke(IPC_CHANNELS.INSTALL_FONTS, { fontIds, scope }),
    uninstallFonts: (fontIds: string[]) =>
      ipcRenderer.invoke(IPC_CHANNELS.UNINSTALL_FONTS, { fontIds }),
    cancelTask: (taskId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.INSTALL_CANCEL_TASK, { taskId }),
    onTaskProgress: (callback: (update: BatchTaskProgressUpdate) => void) => {
      const handler = (_event: IpcRendererEvent, data: BatchTaskProgressUpdate) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.INSTALL_TASK_PROGRESS, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.INSTALL_TASK_PROGRESS, handler);
    },
    getScopeStatus: () =>
      ipcRenderer.invoke(IPC_CHANNELS.INSTALL_GET_SCOPE_STATUS),
  },

  backup: {
    create: (
      destinationZipPath: string,
      options?: { fontIds?: string[]; collectionId?: string; includeAll?: boolean }
    ) => ipcRenderer.invoke(IPC_CHANNELS.BACKUP_CREATE, { destinationZipPath, ...options }),
    verify: (zipPath: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.BACKUP_VERIFY, zipPath),
    restore: (options: RestoreOptions) =>
      ipcRenderer.invoke(IPC_CHANNELS.BACKUP_RESTORE, options),
    cancelTask: (taskId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.BACKUP_CANCEL, { taskId }),
    importMetadata: (
      manifest: BackupManifest,
      options?: { importCollections?: boolean; importTags?: boolean; importFavorites?: boolean }
    ) => ipcRenderer.invoke(IPC_CHANNELS.BACKUP_IMPORT_METADATA, { manifest, options }),
    onProgress: (callback: (update: BackupProgressUpdate) => void) => {
      const handler = (_event: IpcRendererEvent, data: BackupProgressUpdate) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.BACKUP_PROGRESS, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.BACKUP_PROGRESS, handler);
    },
  },

  storage: {
    getAnalysis: () =>
      ipcRenderer.invoke(IPC_CHANNELS.STORAGE_GET_ANALYSIS),
  },

  dialog: {
    selectFolder: () =>
      ipcRenderer.invoke(IPC_CHANNELS.DIALOG_SELECT_FOLDER),
    selectFile: (filters: { name: string; extensions: string[] }[]) =>
      ipcRenderer.invoke(IPC_CHANNELS.DIALOG_SELECT_FILE, filters),
    selectFiles: (filters?: { name: string; extensions: string[] }[]) =>
      ipcRenderer.invoke(IPC_CHANNELS.DIALOG_SELECT_FILES, filters),
    saveFile: (defaultName: string, filters: { name: string; extensions: string[] }[]) =>
      ipcRenderer.invoke(IPC_CHANNELS.DIALOG_SAVE_FILE, { defaultName, filters }),
  },

  system: {
    getSystemInfo: () =>
      ipcRenderer.invoke(IPC_CHANNELS.APP_GET_SYSTEM_INFO),
    openPath: (p: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.APP_OPEN_PATH, p),
  },
};

// Securely expose in renderer's window context
contextBridge.exposeInMainWorld('fontStudioAPI', api);

