/**
 * Shared Type Definitions for Font Studio
 */

export type FontFormat = 'ttf' | 'otf' | 'woff' | 'woff2' | 'ttc' | 'unknown';
export type FontSourceType = 'system' | 'user' | 'imported';
export type InstallScope = 'system' | 'user' | 'uninstalled';
export type ScanStatus = 'valid' | 'corrupted' | 'unsupported' | 'unreadable';

export interface FontRecord {
  id: string;
  family_name: string;
  localized_name?: string;
  full_name?: string;
  style_name: string;
  postscript_name?: string;
  file_path: string;
  format: FontFormat;
  file_size: number;
  sha256: string;
  source_type: FontSourceType;
  install_scope: InstallScope;
  scan_status: ScanStatus;
  face_index: number;
  face_count: number;
  is_missing: boolean;
  version?: string;
  designer?: string;
  copyright?: string;
  glyph_count?: number;
  character_count?: number;
  unicode_ranges?: string[];
  last_scanned_at: string;
  created_at: string;
  is_favorite?: boolean;
  collection_ids?: string[];
  tags?: string[];
}

export interface FontQueryResult {
  fonts: FontRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CollectionRecord {
  id: string;
  name: string;
  description: string;
  created_at: string;
  font_count?: number;
}

export interface TagRecord {
  id: string;
  name: string;
  font_count?: number;
}

export type OperationType = 'install' | 'uninstall' | 'scan' | 'backup' | 'restore';
export type OperationStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface OperationRecord {
  id: string;
  operation_type: OperationType;
  status: OperationStatus;
  total_count: number;
  success_count: number;
  failed_count: number;
  skipped_count: number;
  started_at: string;
  completed_at?: string;
  error_summary?: string;
}

export interface OperationLogEntry {
  id: string;
  operation_id: string;
  item_target: string;
  status: 'success' | 'failed' | 'skipped';
  message?: string;
  created_at: string;
}

export interface BackupManifestItem {
  original_path: string;
  archive_path: string;
  sha256: string;
  file_size: number;
  family_name: string;
  style_name: string;
}

export interface BackupManifest {
  manifest_version: string;
  app_version: string;
  created_at: string;
  font_count: number;
  files: BackupManifestItem[];
  collections: CollectionRecord[];
  font_collections: { font_id: string; collection_id: string }[];
  tags: TagRecord[];
  font_tags: { font_id: string; tag_id: string }[];
  favorites: { font_id: string; created_at: string }[];
  settings: Record<string, string>;
  checksum: string; // SHA-256 of manifest data excluding checksum
}

export interface ScanProgressUpdate {
  phase: 'discovering' | 'parsing' | 'saving' | 'complete' | 'cancelled';
  total: number;
  current: number;
  currentFile: string;
  successCount: number;
  failedCount: number;
  skippedCount: number;
}

export interface BatchTaskProgressUpdate {
  taskId: string;
  type: OperationType;
  phase: 'preparing' | 'processing' | 'completed' | 'cancelled' | 'error';
  total: number;
  current: number;
  currentItem: string;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  errors: { item: string; error: string }[];
}

export interface FontFilterOptions {
  searchQuery?: string;
  format?: FontFormat | 'all';
  sourceType?: FontSourceType | 'all';
  installScope?: InstallScope | 'installed' | 'all';
  isFavorite?: boolean;
  collectionId?: string;
  tagId?: string;
  scanStatus?: ScanStatus | 'all';
  sortBy?: 'family_name' | 'localized_name' | 'file_size' | 'last_scanned_at' | 'created_at' | 'format';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface StorageAnalysisReport {
  totalFonts: number;
  totalSizeBytes: number;
  systemFontCount: number;
  systemSizeBytes: number;
  userFontCount: number;
  userSizeBytes: number;
  importedFontCount: number;
  importedSizeBytes: number;
  formatBreakdown: Record<FontFormat, { count: number; sizeBytes: number }>;
  exactDuplicates: {
    sha256: string;
    count: number;
    sizeBytes: number;
    wastedBytes: number;
    fonts: FontRecord[];
  }[];
  potentialFamilyDuplicates: {
    family_name: string;
    fonts: FontRecord[];
  }[];
  corruptedOrUnsupported: FontRecord[];
}

export interface LanguageCoverage {
  language: string;
  code: string;
  totalChars: number;
  supportedChars: number;
  percentage: number;
  missingChars: string[];
}
