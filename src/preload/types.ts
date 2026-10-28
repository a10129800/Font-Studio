import {
  FontRecord,
  FontQueryResult,
  CollectionRecord,
  TagRecord,
  FontFilterOptions,
  ScanProgressUpdate,
  BatchTaskProgressUpdate,
  StorageAnalysisReport,
  BackupManifest,
} from '../shared/types';

export interface FontStudioAPI {
  fonts: {
    getAll: (options?: FontFilterOptions) => Promise<FontQueryResult>;
    getById: (id: string) => Promise<FontRecord | undefined>;
    startScan: (customPaths?: string[]) => Promise<void>;
    cancelScan: () => Promise<void>;
    onScanProgress: (callback: (progress: ScanProgressUpdate) => void) => () => void;
    toggleFavorite: (fontId: string) => Promise<boolean>;
    setFavoritesBatch: (fontIds: string[], favorite: boolean) => Promise<{ success: boolean; count: number }>;
    delete: (fontId: string) => Promise<void>;
  };
  collections: {
    getAll: () => Promise<CollectionRecord[]>;
    create: (name: string, description?: string) => Promise<CollectionRecord>;
    rename: (id: string, newName: string) => Promise<{ success: boolean }>;
    delete: (id: string) => Promise<{ success: boolean }>;
    addFont: (fontId: string, collectionId: string) => Promise<{ success: boolean }>;
    removeFont: (fontId: string, collectionId: string) => Promise<{ success: boolean }>;
    addFontsBatch: (fontIds: string[], collectionId: string) => Promise<{ success: boolean; count: number }>;
    removeFontsBatch: (fontIds: string[], collectionId: string) => Promise<{ success: boolean; count: number }>;
  };
  tags: {
    getAll: () => Promise<TagRecord[]>;
    create: (name: string) => Promise<TagRecord>;
    rename: (id: string, newName: string) => Promise<{ success: boolean }>;
    delete: (id: string) => Promise<{ success: boolean }>;
    addToFont: (fontId: string, tagId: string) => Promise<{ success: boolean }>;
    removeFromFont: (fontId: string, tagId: string) => Promise<{ success: boolean }>;
    addBatch: (fontIds: string[], tagId: string) => Promise<{ success: boolean; count: number }>;
    removeBatch: (fontIds: string[], tagId: string) => Promise<{ success: boolean; count: number }>;
  };
  install: {
    installFonts: (fontIds: string[], scope?: 'user' | 'system') => Promise<BatchTaskProgressUpdate>;
    uninstallFonts: (fontIds: string[]) => Promise<BatchTaskProgressUpdate>;
    cancelTask: (taskId: string) => Promise<{ success: boolean }>;
    onTaskProgress: (callback: (update: BatchTaskProgressUpdate) => void) => () => void;
    getScopeStatus: () => Promise<{
      isElevated: boolean;
      userFontsDir: string;
      canInstallUserScope: boolean;
      canInstallSystemScope: boolean;
    }>;
  };
  backup: {
    create: (destinationZipPath: string, fontIds?: string[]) => Promise<{ success: boolean; error?: string }>;
    verify: (zipPath: string) => Promise<{ valid: boolean; manifest?: BackupManifest; error?: string }>;
    restore: (zipPath: string, selectedSha256s?: string[]) => Promise<{ success: boolean; error?: string }>;
    onProgress: (callback: (update: any) => void) => () => void;
  };
  storage: {
    getAnalysis: () => Promise<StorageAnalysisReport>;
  };
  dialog: {
    selectFolder: () => Promise<string | null>;
    selectFile: (filters: { name: string; extensions: string[] }[]) => Promise<string | null>;
    saveFile: (defaultName: string, filters: { name: string; extensions: string[] }[]) => Promise<string | null>;
  };
  system: {
    getSystemInfo: () => Promise<{ platform: string; arch: string; isElevated: boolean }>;
    openPath: (p: string) => Promise<void>;
  };
}

declare global {
  interface Window {
    fontStudioAPI: FontStudioAPI;
  }
}

