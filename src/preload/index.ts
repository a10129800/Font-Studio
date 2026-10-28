import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { IPC_CHANNELS } from '../shared/channels';
import { FontStudioAPI } from './types';
import {
  FontFilterOptions,
  ScanProgressUpdate,
  BatchTaskProgressUpdate,
} from '../shared/types';

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
    create: (destinationZipPath: string, fontIds?: string[]) =>
      ipcRenderer.invoke(IPC_CHANNELS.BACKUP_CREATE, { destinationZipPath, fontIds }),
    verify: (zipPath: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.BACKUP_VERIFY, zipPath),
    restore: (zipPath: string, selectedSha256s?: string[]) =>
      ipcRenderer.invoke(IPC_CHANNELS.BACKUP_RESTORE, { zipPath, selectedSha256s }),
    onProgress: (callback: (update: any) => void) => {
      const handler = (_event: IpcRendererEvent, data: any) => callback(data);
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

