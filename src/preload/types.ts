import {
  FontRecord,
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
    getAll: (options?: FontFilterOptions) => Promise<FontRecord[]>;
    getById: (id: string) => Promise<FontRecord | undefined>;
    startScan: (customPaths?: string[]) => Promise<void>;
    cancelScan: () => Promise<void>;
    onScanProgress: (callback: (progress: ScanProgressUpdate) => void) => () => void;
    toggleFavorite: (fontId: string) => Promise<boolean>;
    delete: (fontId: string) => Promise<void>;
  };
  collections: {
    getAll: () => Promise<CollectionRecord[]>;
    create: (name: string, description?: string) => Promise<CollectionRecord>;
    rename: (id: string, newName: string) => Promise<void>;
    delete: (id: string) => Promise<void>;
    addFont: (fontId: string, collectionId: string) => Promise<void>;
    removeFont: (fontId: string, collectionId: string) => Promise<void>;
  };
  tags: {
    getAll: () => Promise<TagRecord[]>;
    create: (name: string) => Promise<TagRecord>;
    addToFont: (fontId: string, tagId: string) => Promise<void>;
    removeFromFont: (fontId: string, tagId: string) => Promise<void>;
  };
  install: {
    installFonts: (fontIds: string[], scope: 'user' | 'system') => Promise<void>;
    uninstallFonts: (fontIds: string[]) => Promise<void>;
    cancelTask: (taskId: string) => Promise<void>;
    onTaskProgress: (callback: (update: BatchTaskProgressUpdate) => void) => () => void;
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

