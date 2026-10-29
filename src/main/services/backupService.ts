import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import AdmZip from 'adm-zip';
import {
  FontRecord,
  BackupManifest,
  BackupManifestItem,
  BackupFailedItem,
  BackupResult,
  BackupVerificationResult,
  BackupProgressUpdate,
  RestoreOptions,
  RestoreResult,
} from '../../shared/types';
import { DatabaseService } from './databaseService';
import { calculateFileSha256, calculateSha256 } from '../utils/hash';
import { isSafeArchivePath, isSystemFontPath, isValidDirectoryPath, sanitizeWindowsFilename } from '../utils/pathValidator';

export class BackupService {
  private db: DatabaseService;
  private activeCancellations: Set<string> = new Set();

  constructor(db: DatabaseService) {
    this.db = db;
  }

  /**
   * Cancels an active backup or restore task.
   */
  public cancelTask(taskId: string): boolean {
    this.activeCancellations.add(taskId);
    return true;
  }

  /**
   * Creates a comprehensive font archive ZIP with manifest and metadata.
   */
  public async createBackup(
    destinationZipPath: string,
    options?: {
      fontIds?: string[];
      collectionId?: string;
      includeAll?: boolean;
    },
    onProgress?: (update: BackupProgressUpdate) => void
  ): Promise<BackupResult> {
    const taskId = crypto.randomUUID();

    // 1. Validate destination path
    if (!destinationZipPath || typeof destinationZipPath !== 'string') {
      return {
        success: false,
        fontCount: 0,
        failedCount: 0,
        failedItems: [],
        error: '請提供有效的目標備份路徑。',
      };
    }

    if (destinationZipPath.includes('\0')) {
      return {
        success: false,
        fontCount: 0,
        failedCount: 0,
        failedItems: [],
        error: '目標路徑包含不合法的控制字元。',
      };
    }

    const normalizedZipPath = path.resolve(destinationZipPath);
    const parentDir = path.dirname(normalizedZipPath);
    if (!fs.existsSync(parentDir)) {
      try {
        fs.mkdirSync(parentDir, { recursive: true });
      } catch (err: any) {
        return {
          success: false,
          fontCount: 0,
          failedCount: 0,
          failedItems: [],
          error: `無法建立目標資料夾: ${err.message}`,
        };
      }
    }

    // 2. Select fonts to back up
    let targetFonts: FontRecord[] = [];
    if (options?.fontIds && options.fontIds.length > 0) {
      for (const id of options.fontIds) {
        const f = this.db.getFontById(id);
        if (f) targetFonts.push(f);
      }
    } else if (options?.collectionId) {
      const colFonts = this.db.getFonts({ collectionId: options.collectionId, pageSize: 100000 });
      targetFonts = colFonts.fonts;
    } else {
      targetFonts = this.db.getAllFonts();
    }

    const total = targetFonts.length;
    const progress: BackupProgressUpdate = {
      taskId,
      type: 'backup',
      phase: 'preparing',
      total,
      current: 0,
      currentItem: '',
      successCount: 0,
      failedCount: 0,
      skippedCount: 0,
      errors: [],
    };
    onProgress?.({ ...progress });

    const zip = new AdmZip();
    const manifestFiles: BackupManifestItem[] = [];
    const failedItems: BackupFailedItem[] = [];
    const includedFontIds = new Set<string>();

    progress.phase = 'processing';

    // 3. Process each font file
    for (let i = 0; i < total; i++) {
      if (this.activeCancellations.has(taskId)) {
        this.activeCancellations.delete(taskId);
        progress.phase = 'cancelled';
        onProgress?.({ ...progress });
        return {
          success: false,
          fontCount: manifestFiles.length,
          failedCount: failedItems.length,
          failedItems,
          error: '使用者已中止備份工作。',
        };
      }

      const font = targetFonts[i];
      const fontLabel = font.localized_name || font.family_name || font.file_path;
      progress.current = i + 1;
      progress.currentItem = fontLabel;
      onProgress?.({ ...progress });

      // Check file accessibility
      if (!fs.existsSync(font.file_path)) {
        failedItems.push({
          font_id: font.id,
          family_name: font.family_name,
          file_path: font.file_path,
          error: '字體原始實體檔案不存在或已被移動。',
        });
        progress.failedCount++;
        progress.errors.push({ item: fontLabel, error: '字體原始檔案不存在' });
        continue;
      }

      let fileBuffer: Buffer;
      try {
        fileBuffer = fs.readFileSync(font.file_path);
      } catch (readErr: any) {
        failedItems.push({
          font_id: font.id,
          family_name: font.family_name,
          file_path: font.file_path,
          error: `無法讀取檔案: ${readErr.message}`,
        });
        progress.failedCount++;
        progress.errors.push({ item: fontLabel, error: readErr.message });
        continue;
      }

      const fileSha256 = calculateSha256(fileBuffer);

      // Safe archive path generation (avoids collisions and ensures clean relative path)
      const ext = path.extname(font.file_path).toLowerCase() || `.${font.format}`;
      const safeFamily = (font.family_name || 'font').replace(/[^a-zA-Z0-9_\-\.]/g, '_').slice(0, 32);
      const safeArchiveName = `fonts/${safeFamily}_${fileSha256.slice(0, 8)}${ext}`;

      // Avoid adding duplicate binary file entries if TTC multi-faces share the file
      const existingEntry = zip.getEntry(safeArchiveName);
      if (!existingEntry) {
        zip.addFile(safeArchiveName, fileBuffer);
      }

      manifestFiles.push({
        font_id: font.id,
        original_path: font.file_path,
        archive_path: safeArchiveName,
        sha256: fileSha256,
        file_size: fileBuffer.length,
        family_name: font.family_name,
        localized_name: font.localized_name,
        style_name: font.style_name,
        postscript_name: font.postscript_name,
        format: font.format,
        face_index: font.face_index || 0,
        face_count: font.face_count || 1,
        source_type: font.source_type,
        install_scope: font.install_scope,
      });

      includedFontIds.add(font.id);
      progress.successCount++;
    }

    // 4. Gather associated metadata (collections, tags, favorites, settings)
    progress.phase = 'finalizing';
    progress.currentItem = '產生中繼資料清單 (manifest.json)...';
    onProgress?.({ ...progress });

    const allCollections = this.db.getAllCollections();
    const allFontCollections = this.db.getAllFontCollections();
    const allTags = this.db.getAllTags();
    const allFontTags = this.db.getAllFontTags();
    const allFavorites = this.db.getAllFavorites();
    const allSettings = this.db.getAllSettings();

    // Filter associations to only include backed up fonts
    const filteredFontCollections = allFontCollections.filter((fc) => includedFontIds.has(fc.font_id));
    const activeColIds = new Set(filteredFontCollections.map((fc) => fc.collection_id));
    const filteredCollections = allCollections.filter((c) => activeColIds.has(c.id));

    const filteredFontTags = allFontTags.filter((ft) => includedFontIds.has(ft.font_id));
    const activeTagIds = new Set(filteredFontTags.map((ft) => ft.tag_id));
    const filteredTags = allTags.filter((t) => activeTagIds.has(t.id));

    const filteredFavorites = allFavorites.filter((fav) => includedFontIds.has(fav.font_id));

    // Exclude sensitive settings
    const safeSettings: Record<string, string> = {};
    for (const [k, v] of Object.entries(allSettings)) {
      if (!k.toLowerCase().includes('pass') && !k.toLowerCase().includes('token') && !k.toLowerCase().includes('secret')) {
        safeSettings[k] = v;
      }
    }

    const manifestData: Omit<BackupManifest, 'checksum'> = {
      manifest_version: '1.0.0',
      app_version: '0.1.0',
      created_at: new Date().toISOString(),
      font_count: manifestFiles.length,
      files: manifestFiles,
      failed_items: failedItems.length > 0 ? failedItems : undefined,
      collections: filteredCollections,
      font_collections: filteredFontCollections,
      tags: filteredTags,
      font_tags: filteredFontTags,
      favorites: filteredFavorites,
      settings: safeSettings,
    };

    // Calculate deterministic checksum of manifest data
    const manifestJsonString = JSON.stringify(manifestData, null, 2);
    const manifestChecksum = calculateSha256(manifestJsonString);

    const fullManifest: BackupManifest = {
      ...manifestData,
      checksum: manifestChecksum,
      manifestSha256: manifestChecksum,
    };

    zip.addFile('manifest.json', Buffer.from(JSON.stringify(fullManifest, null, 2), 'utf-8'));

    // 5. Write ZIP file to target path
    try {
      zip.writeZip(normalizedZipPath);
    } catch (writeErr: any) {
      progress.phase = 'error';
      onProgress?.({ ...progress });
      return {
        success: false,
        fontCount: manifestFiles.length,
        failedCount: failedItems.length,
        failedItems,
        error: `無法寫入 ZIP 備份檔案: ${writeErr.message}`,
      };
    }

    // 6. Verify written ZIP file integrity & calculate whole-file SHA-256
    const zipStats = fs.statSync(normalizedZipPath);
    const archiveSha256 = await calculateFileSha256(normalizedZipPath);

    this.activeCancellations.delete(taskId);
    progress.phase = 'completed';
    progress.currentItem = '備份完成';
    onProgress?.({ ...progress });

    return {
      success: true,
      archivePath: normalizedZipPath,
      archiveSize: zipStats.size,
      fontCount: manifestFiles.length,
      sha256: archiveSha256,
      failedCount: failedItems.length,
      failedItems,
    };
  }

  /**
   * Verifies the integrity of a backup ZIP archive, validating manifest, files, hashes, and Zip Slip defenses.
   */
  public async verifyBackupZip(zipPath: string): Promise<BackupVerificationResult> {
    const issues: string[] = [];
    const disclaimer =
      'SHA-256 可用於校驗檔案在傳輸或儲存過程中未發生隨機位元翻轉或意外損毀；但因備份檔未包含非對稱密碼學簽章，若備份檔曾於不受信任的管道傳輸，無法排除惡意竄改之可能性。';

    if (!zipPath || typeof zipPath !== 'string') {
      return {
        valid: false,
        fontCount: 0,
        totalSizeBytes: 0,
        issues: ['未提供有效的 ZIP 檔案路徑。'],
        disclaimer,
      };
    }

    if (!fs.existsSync(zipPath)) {
      return {
        valid: false,
        fontCount: 0,
        totalSizeBytes: 0,
        issues: [`找不到備份檔案: ${zipPath}`],
        disclaimer,
      };
    }

    let zip: AdmZip;
    try {
      zip = new AdmZip(zipPath);
    } catch (err: any) {
      return {
        valid: false,
        fontCount: 0,
        totalSizeBytes: 0,
        issues: [`ZIP 檔案損毀或非有效之 ZIP 壓縮格式: ${err.message}`],
        disclaimer,
      };
    }

    const dummyDest = path.resolve('C:\\SafeDummyDir');

    // 0. Check ZIP entry structure, Zip Slip, bomb risks, and forbidden files
    const zipEntries = zip.getEntries();
    if (zipEntries.length > 10000) {
      issues.push('ZIP 內檔案數量過大 (超過 10,000 個條目)，超出安全上限。');
    }

    const seenEntryNames = new Set<string>();
    let totalUncompressedBytes = 0;
    const dangerousExtensions = ['.exe', '.dll', '.bat', '.cmd', '.vbs', '.scr', '.ps1', '.msi', '.com', '.pif'];

    for (const entry of zipEntries) {
      // Check entry name duplicates inside ZIP (case-insensitive for Windows safety)
      const normalizedEntryKey = entry.entryName.toLowerCase();
      if (seenEntryNames.has(normalizedEntryKey)) {
        issues.push(`ZIP 檔案內存在重複或大小寫衝突的檔案路徑條目: ${entry.entryName}`);
      }
      seenEntryNames.add(normalizedEntryKey);

      // Check for symbolic link entries
      const unixMode = (entry.header.attr >>> 16) & 0o170000;
      if (unixMode === 0o120000) {
        issues.push(`ZIP 條目偵測到符號連結 (Symlink)，基於 Windows 安全性已拒絕驗證: ${entry.entryName}`);
      }

      // Check zip slip on every entry in zip
      if (!isSafeArchivePath(dummyDest, entry.entryName)) {
        issues.push(`ZIP 條目偵測到潛在 Zip Slip 路徑穿越攻擊: ${entry.entryName}`);
      }

      // Check dangerous extensions
      const lowerEntryName = entry.entryName.toLowerCase();
      if (dangerousExtensions.some((ext) => lowerEntryName.endsWith(ext))) {
        issues.push(`ZIP 壓縮包內包含危險可執行檔，已拒絕驗證: ${entry.entryName}`);
      }

      // Single file uncompressed size limit: 500 MB
      if (entry.header.size > 500 * 1024 * 1024) {
        issues.push(`單一檔案解壓縮大小超出安全上限 (500MB): ${entry.entryName}`);
      }

      // Decompression bomb check (high ratio and uncompressed size > 10MB)
      if (entry.header.compressedSize > 0 && entry.header.size > 10 * 1024 * 1024) {
        const ratio = entry.header.size / entry.header.compressedSize;
        if (ratio > 100) {
          issues.push(`偵測到潛在 ZIP 炸彈 (異常壓縮比 > 100:1): ${entry.entryName}`);
        }
      }

      totalUncompressedBytes += entry.header.size;
    }

    // Total uncompressed size limit: 2 GB
    if (totalUncompressedBytes > 2 * 1024 * 1024 * 1024) {
      issues.push('ZIP 總解壓縮大小超過 2GB 安全上限。');
    }

    // 1. Read and parse manifest.json
    const manifestEntry = zip.getEntry('manifest.json');
    if (!manifestEntry) {
      return {
        valid: false,
        fontCount: 0,
        totalSizeBytes: 0,
        issues: ['ZIP 檔案中缺少 manifest.json 備份中繼清單。'],
        disclaimer,
      };
    }

    let manifest: BackupManifest;
    try {
      const manifestText = manifestEntry.getData().toString('utf-8');
      manifest = JSON.parse(manifestText);
    } catch (parseErr: any) {
      return {
        valid: false,
        fontCount: 0,
        totalSizeBytes: 0,
        issues: [`manifest.json 格式無效 (JSON 解析失敗): ${parseErr.message}`],
        disclaimer,
      };
    }

    // 2. Validate manifest version
    if (!manifest.manifest_version || !manifest.manifest_version.startsWith('1.')) {
      issues.push(`不支援的備份清單版本: ${manifest.manifest_version} (目前支援版本 1.x)`);
    }

    // 3. Verify manifest checksum / manifestSha256
    const expectedChecksum = manifest.checksum || manifest.manifestSha256;
    if (expectedChecksum && typeof expectedChecksum === 'string' && expectedChecksum.trim()) {
      const { checksum, manifestSha256, ...manifestWithoutChecksum } = manifest;
      const recomputedChecksum = calculateSha256(JSON.stringify(manifestWithoutChecksum, null, 2));
      if (recomputedChecksum !== expectedChecksum.trim()) {
        issues.push('manifest.json 校驗碼不符，中繼資料清單可能遭到修改。');
      }
    } else {
      issues.push('manifest.json 缺少安全校驗碼 (checksum / manifestSha256)。');
    }

    // 4. Validate each file in manifest
    let totalSizeBytes = 0;
    const seenArchivePaths = new Set<string>();

    if (Array.isArray(manifest.files)) {
      for (const item of manifest.files) {
        totalSizeBytes += item.file_size || 0;

        // Duplicate or case-collision check in manifest
        const normalizedArchivePath = item.archive_path.toLowerCase();
        if (seenArchivePaths.has(normalizedArchivePath)) {
          issues.push(`manifest 中包含重複或大小寫衝突的封裝路徑: ${item.archive_path}`);
        }
        seenArchivePaths.add(normalizedArchivePath);

        // Zip Slip defense: archive_path must strictly stay inside destination
        if (!isSafeArchivePath(dummyDest, item.archive_path)) {
          issues.push(`偵測到潛在 Zip Slip 路徑穿越攻擊: ${item.archive_path}`);
          continue;
        }

        const entry = zip.getEntry(item.archive_path);
        if (!entry) {
          issues.push(`ZIP 內缺少清單標註之字體檔案: ${item.archive_path}`);
          continue;
        }

        const data = entry.getData();
        if (data.length !== item.file_size) {
          issues.push(`檔案大小不符: ${item.archive_path} (預期 ${item.file_size} 位元組，實際 ${data.length} 位元組)`);
        }

        const actualSha256 = calculateSha256(data);
        if (actualSha256 !== item.sha256) {
          issues.push(`檔案 SHA-256 雜湊不符: ${item.archive_path}`);
        }
      }
    } else {
      issues.push('manifest.json 中的檔案清單結構無效。');
    }

    // Compute archive-level SHA-256
    let archiveSha256: string | undefined;
    try {
      archiveSha256 = await calculateFileSha256(zipPath);
    } catch {}

    const isValid = issues.length === 0;

    return {
      valid: isValid,
      manifest,
      manifestVersion: manifest.manifest_version,
      appVersion: manifest.app_version,
      fontCount: manifest.files?.length || 0,
      totalSizeBytes,
      archiveSha256,
      issues,
      disclaimer,
    };
  }

  /**
   * Safely restores font files and optional metadata from a verified backup.
   * Restores to user-selected folder with atomic temporary write, SHA-256 verification, and conflict protection.
   * Does NOT auto-install into Windows system fonts.
   */
  public async restoreBackup(
    options: RestoreOptions,
    onProgress?: (update: BackupProgressUpdate) => void
  ): Promise<RestoreResult> {
    const taskId = crypto.randomUUID();

    // 1. Validate destination directory
    if (!options.targetDirectory || typeof options.targetDirectory !== 'string') {
      return {
        success: false,
        restoredCount: 0,
        skippedCount: 0,
        failedCount: 0,
        restoredFiles: [],
        errors: [{ item: 'destination', error: '請提供有效的還原目的地目錄。' }],
        error: '目的地目錄無效',
      };
    }

    if (isSystemFontPath(options.targetDirectory)) {
      return {
        success: false,
        restoredCount: 0,
        skippedCount: 0,
        failedCount: 0,
        restoredFiles: [],
        errors: [{ item: 'destination', error: '嚴格禁止將備份字體直接還原寫入 Windows 系統目錄。' }],
        error: '禁止還原至系統目錄',
      };
    }

    const resolvedTargetDir = path.resolve(options.targetDirectory);
    if (!fs.existsSync(resolvedTargetDir)) {
      try {
        fs.mkdirSync(resolvedTargetDir, { recursive: true });
      } catch (err: any) {
        return {
          success: false,
          restoredCount: 0,
          skippedCount: 0,
          failedCount: 0,
          restoredFiles: [],
          errors: [{ item: 'destination', error: `無法建立目的地目錄: ${err.message}` }],
          error: '無法建立目的地目錄',
        };
      }
    }

    // 2. Verify ZIP before restoring
    const verification = await this.verifyBackupZip(options.zipPath);
    if (!verification.valid || !verification.manifest) {
      return {
        success: false,
        restoredCount: 0,
        skippedCount: 0,
        failedCount: 0,
        restoredFiles: [],
        errors: verification.issues.map((issue) => ({ item: 'verification', error: issue })),
        error: `備份壓縮包驗證未通過: ${verification.issues.join('; ')}`,
      };
    }

    const zip = new AdmZip(options.zipPath);
    const manifest = verification.manifest;

    // Filter files if selectedSha256s provided
    let itemsToRestore = manifest.files;
    if (options.selectedSha256s && options.selectedSha256s.length > 0) {
      const selectedSet = new Set(options.selectedSha256s);
      itemsToRestore = itemsToRestore.filter((f) => selectedSet.has(f.sha256));
    }

    const total = itemsToRestore.length;
    const progress: BackupProgressUpdate = {
      taskId,
      type: 'restore',
      phase: 'preparing',
      total,
      current: 0,
      currentItem: '',
      successCount: 0,
      failedCount: 0,
      skippedCount: 0,
      errors: [],
    };
    onProgress?.({ ...progress });

    progress.phase = 'processing';
    const restoredFiles: string[] = [];
    const errors: { item: string; error: string }[] = [];
    let skippedCount = 0;

    // Track created temporary files for cleanup on failure
    const activeTempFiles: string[] = [];

    // 3. Extract and write each font file
    for (let i = 0; i < total; i++) {
      if (this.activeCancellations.has(taskId)) {
        this.activeCancellations.delete(taskId);
        // Clean up any remaining temporary files
        for (const tmp of activeTempFiles) {
          try {
            if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
          } catch {}
        }
        progress.phase = 'cancelled';
        onProgress?.({ ...progress });
        return {
          success: false,
          restoredCount: restoredFiles.length,
          skippedCount,
          failedCount: errors.length,
          restoredFiles,
          errors,
          error: '使用者已中止還原作業。',
        };
      }

      const item = itemsToRestore[i];
      const fontLabel = item.localized_name || item.family_name || item.archive_path;
      progress.current = i + 1;
      progress.currentItem = fontLabel;
      onProgress?.({ ...progress });

      const entry = zip.getEntry(item.archive_path);
      if (!entry) {
        errors.push({ item: fontLabel, error: `找不到 ZIP 內部字體檔案: ${item.archive_path}` });
        progress.failedCount++;
        continue;
      }

      // Determine final destination filename
      const rawBaseName = path.basename(item.original_path || item.archive_path);
      const baseName = sanitizeWindowsFilename(rawBaseName, `font_${item.font_id}`);
      let finalDestPath = path.join(resolvedTargetDir, baseName);

      // Handle file collision
      if (fs.existsSync(finalDestPath)) {
        if (options.conflictPolicy === 'skip') {
          skippedCount++;
          progress.skippedCount++;
          continue;
        } else if (options.conflictPolicy === 'rename') {
          const ext = path.extname(baseName);
          const nameWithoutExt = path.basename(baseName, ext);
          let candidate = path.join(resolvedTargetDir, `${nameWithoutExt} (restored_${item.sha256.slice(0, 6)})${ext}`);
          let counter = 1;
          while (fs.existsSync(candidate)) {
            candidate = path.join(resolvedTargetDir, `${nameWithoutExt} (restored_${item.sha256.slice(0, 6)}_${counter})${ext}`);
            counter++;
          }
          finalDestPath = candidate;
        }
        // If 'overwrite', finalDestPath remains unchanged
      }

      // Atomic write using temporary file
      const tempFileName = `.tmp_fs_${Date.now()}_${Math.random().toString(36).slice(2)}.tmp`;
      const tempFilePath = path.join(resolvedTargetDir, tempFileName);
      activeTempFiles.push(tempFilePath);

      try {
        const data = entry.getData();
        fs.writeFileSync(tempFilePath, data);

        // Verify SHA-256 of the written file
        const writtenSha256 = calculateSha256(fs.readFileSync(tempFilePath));
        if (writtenSha256 !== item.sha256) {
          try {
            if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
          } catch {}
          const idx = activeTempFiles.indexOf(tempFilePath);
          if (idx !== -1) activeTempFiles.splice(idx, 1);
          errors.push({ item: fontLabel, error: '寫入暫存檔校驗碼不符，已安全抹除。' });
          progress.failedCount++;
          continue;
        }

        // Safe atomic overwrite with backup & rollback
        if (fs.existsSync(finalDestPath) && options.conflictPolicy === 'overwrite') {
          const backupDestPath = `${finalDestPath}.fs_bak_${Date.now()}_${Math.random().toString(36).slice(2)}`;
          try {
            fs.renameSync(finalDestPath, backupDestPath);
            fs.renameSync(tempFilePath, finalDestPath);
            try {
              if (fs.existsSync(backupDestPath)) fs.unlinkSync(backupDestPath);
            } catch {}
          } catch (renameErr: any) {
            // Rollback if destination backup exists
            let rollbackFailed = false;
            if (fs.existsSync(backupDestPath) && !fs.existsSync(finalDestPath)) {
              try {
                fs.renameSync(backupDestPath, finalDestPath);
              } catch (rollbackErr: any) {
                rollbackFailed = true;
                errors.push({ item: fontLabel, error: `覆蓋寫入失敗且自動還原舊檔失敗: ${rollbackErr.message}` });
              }
            }
            if (!rollbackFailed) {
              throw renameErr;
            }
          }
        } else {
          fs.renameSync(tempFilePath, finalDestPath);
        }

        restoredFiles.push(finalDestPath);
        progress.successCount++;

        // Remove from tracking
        const idx = activeTempFiles.indexOf(tempFilePath);
        if (idx !== -1) activeTempFiles.splice(idx, 1);
      } catch (writeErr: any) {
        if (fs.existsSync(tempFilePath)) {
          try {
            fs.unlinkSync(tempFilePath);
          } catch {}
        }
        const idx = activeTempFiles.indexOf(tempFilePath);
        if (idx !== -1) activeTempFiles.splice(idx, 1);
        errors.push({ item: fontLabel, error: `寫入失敗: ${writeErr.message}` });
        progress.failedCount++;
      }
    }

    // 4. Optional Metadata Import (Collections, Tags, Favorites)
    let metadataImportResult: { collections: number; tags: number; favorites: number } | undefined;
    if (options.importMetadata && (options.importMetadata.collections || options.importMetadata.tags || options.importMetadata.favorites)) {
      progress.phase = 'finalizing';
      progress.currentItem = '匯入自訂分類、標籤與收藏中繼資料...';
      onProgress?.({ ...progress });

      try {
        metadataImportResult = this.db.importBackupMetadata(manifest, {
          importCollections: options.importMetadata.collections,
          importTags: options.importMetadata.tags,
          importFavorites: options.importMetadata.favorites,
        });
      } catch (metaErr: any) {
        errors.push({ item: 'metadata_import', error: `匯入中繼資料失敗: ${metaErr.message}` });
      }
    }

    this.activeCancellations.delete(taskId);
    progress.phase = 'completed';
    progress.currentItem = '還原作業完成';
    onProgress?.({ ...progress });

    return {
      success: errors.length === 0,
      restoredCount: restoredFiles.length,
      skippedCount,
      failedCount: errors.length,
      restoredFiles,
      errors,
      metadataImported: metadataImportResult,
    };
  }
}

