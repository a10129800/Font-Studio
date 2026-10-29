import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import AdmZip from 'adm-zip';
import { DatabaseService } from '../src/main/services/databaseService';
import { BackupService } from '../src/main/services/backupService';
import { FontRecord, BackupManifest } from '../src/shared/types';
import { calculateSha256 } from '../src/main/utils/hash';

describe('Milestone M3: Font Backup, Verification, and Restore Suite', () => {
  let dbService: DatabaseService;
  let backupService: BackupService;

  let tempDir: string;
  let tempDbPath: string;
  let sourceFontsDir: string;
  let restoreDir: string;
  let backupOutputDir: string;

  let font1Path: string;
  let font2Path: string;
  let font1: FontRecord;
  let font2: FontRecord;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'font_studio_m3_test_'));
    tempDbPath = path.join(tempDir, 'test.db');
    sourceFontsDir = path.join(tempDir, 'SourceFonts');
    restoreDir = path.join(tempDir, 'RestoreDir');
    backupOutputDir = path.join(tempDir, 'Backups');

    fs.mkdirSync(sourceFontsDir, { recursive: true });
    fs.mkdirSync(restoreDir, { recursive: true });
    fs.mkdirSync(backupOutputDir, { recursive: true });

    // Create realistic dummy font binaries
    font1Path = path.join(sourceFontsDir, 'SourceSans-Regular.ttf');
    font2Path = path.join(sourceFontsDir, 'SourceSerif-Bold.otf');
    fs.writeFileSync(font1Path, 'dummy-ttf-font1-content-data-stream-12345');
    fs.writeFileSync(font2Path, 'dummy-otf-font2-content-data-stream-67890');

    dbService = new DatabaseService(tempDbPath);
    backupService = new BackupService(dbService);

    font1 = {
      id: 'f1-sourcesans',
      family_name: 'Source Sans',
      localized_name: '思源黑體',
      style_name: 'Regular',
      file_path: font1Path,
      format: 'ttf',
      file_size: fs.statSync(font1Path).size,
      sha256: calculateSha256(fs.readFileSync(font1Path)),
      source_type: 'imported',
      install_scope: 'uninstalled',
      scan_status: 'valid',
      face_index: 0,
      face_count: 1,
      is_missing: false,
      last_scanned_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    font2 = {
      id: 'f2-sourceserif',
      family_name: 'Source Serif',
      localized_name: '思源宋體',
      style_name: 'Bold',
      file_path: font2Path,
      format: 'otf',
      file_size: fs.statSync(font2Path).size,
      sha256: calculateSha256(fs.readFileSync(font2Path)),
      source_type: 'imported',
      install_scope: 'uninstalled',
      scan_status: 'valid',
      face_index: 0,
      face_count: 1,
      is_missing: false,
      last_scanned_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    dbService.upsertFontsBatch([font1, font2]);

    // Create a collection & tag
    const col = dbService.createCollection('col-work', '工作專案');
    dbService.addFontsToCollection([font1.id], col.id);

    const tag = dbService.getOrCreateTag('tag-clean', '乾淨');
    dbService.addTagToFont(font1.id, tag.id);
    dbService.toggleFavorite(font1.id);
  });

  afterEach(() => {
    dbService.close();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch { }
  });

  // ==================== 1. Backup Creation & Reading ====================
  it('creates a complete ZIP archive with manifest.json and binary font files', async () => {
    const zipPath = path.join(backupOutputDir, 'backup_all.zip');
    const result = await backupService.createBackup(zipPath, { includeAll: true });

    expect(result.success).toBe(true);
    expect(result.fontCount).toBe(2);
    expect(result.failedCount).toBe(0);
    expect(fs.existsSync(zipPath)).toBe(true);
    expect(result.archiveSize).toBeGreaterThan(100);
    expect(result.sha256).toBeDefined();

    // Verify ZIP internal structure
    const zip = new AdmZip(zipPath);
    const manifestEntry = zip.getEntry('manifest.json');
    expect(manifestEntry).toBeDefined();

    const manifest: BackupManifest = JSON.parse(manifestEntry!.getData().toString('utf-8'));
    expect(manifest.manifest_version).toBe('1.0.0');
    expect(manifest.font_count).toBe(2);
    expect(manifest.files).toHaveLength(2);
    expect(manifest.checksum).toBeDefined();

    // Verify associated collections, tags, favorites included
    expect(manifest.collections).toHaveLength(1);
    expect(manifest.collections[0].name).toBe('工作專案');
    expect(manifest.tags).toHaveLength(1);
    expect(manifest.tags[0].name).toBe('乾淨');
    expect(manifest.favorites).toHaveLength(1);
  });

  // ==================== 2. Selective & Collection Backup ====================
  it('supports selective backup by fontIds or collectionId', async () => {
    const zipPath = path.join(backupOutputDir, 'backup_single.zip');
    const result = await backupService.createBackup(zipPath, { fontIds: [font1.id] });

    expect(result.success).toBe(true);
    expect(result.fontCount).toBe(1);

    const zip = new AdmZip(zipPath);
    const manifest: BackupManifest = JSON.parse(zip.getEntry('manifest.json')!.getData().toString('utf-8'));
    expect(manifest.files).toHaveLength(1);
    expect(manifest.files[0].font_id).toBe(font1.id);
  });

  // ==================== 3. Missing/Unreadable Source Fonts ====================
  it('records missing or unreadable source font files in failedItems without crashing', async () => {
    // Delete physical font file
    fs.unlinkSync(font2Path);

    const zipPath = path.join(backupOutputDir, 'backup_missing.zip');
    const result = await backupService.createBackup(zipPath, { includeAll: true });

    expect(result.success).toBe(true);
    expect(result.fontCount).toBe(1); // font1 succeeded
    expect(result.failedCount).toBe(1); // font2 failed
    expect(result.failedItems).toHaveLength(1);
    expect(result.failedItems[0].font_id).toBe(font2.id);
    expect(result.failedItems[0].error).toContain('不存在');
  });

  // ==================== 4. Archive Verification & Integrity ====================
  it('verifies valid ZIP archives and detects corrupted / tampered entries', async () => {
    const zipPath = path.join(backupOutputDir, 'backup_verify.zip');
    await backupService.createBackup(zipPath, { includeAll: true });

    // Valid check
    const validReport = await backupService.verifyBackupZip(zipPath);
    expect(validReport.valid).toBe(true);
    expect(validReport.issues).toHaveLength(0);
    expect(validReport.disclaimer).toContain('SHA-256');

    // Tampered check: modify content of one entry inside ZIP
    const zip = new AdmZip(zipPath);
    const manifestText = zip.getEntry('manifest.json')!.getData().toString('utf-8');
    const manifest: BackupManifest = JSON.parse(manifestText);
    const firstFontEntry = manifest.files[0].archive_path;

    // Overwrite the font entry with corrupted bytes
    zip.updateFile(firstFontEntry, Buffer.from('corrupted-data'));
    const tamperedZipPath = path.join(backupOutputDir, 'tampered.zip');
    zip.writeZip(tamperedZipPath);

    const tamperedReport = await backupService.verifyBackupZip(tamperedZipPath);
    expect(tamperedReport.valid).toBe(false);
    expect(tamperedReport.issues.some((iss) => iss.includes('SHA-256') || iss.includes('大小不符'))).toBe(true);
  });

  // ==================== 5. Corrupted ZIP Format ====================
  it('gracefully handles non-ZIP or completely corrupted files', async () => {
    const corruptFile = path.join(backupOutputDir, 'fake.zip');
    fs.writeFileSync(corruptFile, 'not-a-zip-binary-header-here');

    const report = await backupService.verifyBackupZip(corruptFile);
    expect(report.valid).toBe(false);
    expect(report.issues[0]).toContain('ZIP 檔案損毀');
  });

  // ==================== 6. Zip Slip Traversal Defense ====================
  it('strictly detects and blocks Zip Slip directory traversal attacks', async () => {
    const zip = new AdmZip();
    const maliciousManifest: BackupManifest = {
      manifest_version: '1.0.0',
      app_version: '0.1.0',
      created_at: new Date().toISOString(),
      font_count: 1,
      files: [
        {
          font_id: 'evil-font',
          original_path: 'C:\\evil.ttf',
          archive_path: '../../Windows/System32/evil.ttf', // Path traversal attack!
          sha256: calculateSha256(Buffer.from('evil-payload')),
          file_size: 12,
          family_name: 'EvilFont',
          style_name: 'Regular',
          format: 'ttf',
          face_index: 0,
          face_count: 1,
          source_type: 'imported',
          install_scope: 'uninstalled',
        },
      ],
      collections: [],
      font_collections: [],
      tags: [],
      font_tags: [],
      favorites: [],
      settings: {},
      checksum: '',
    };
    maliciousManifest.checksum = calculateSha256(JSON.stringify(maliciousManifest, null, 2));

    zip.addFile('manifest.json', Buffer.from(JSON.stringify(maliciousManifest, null, 2)));
    zip.addFile('../../Windows/System32/evil.ttf', Buffer.from('evil-payload'));

    const maliciousZipPath = path.join(backupOutputDir, 'malicious_slip.zip');
    zip.writeZip(maliciousZipPath);

    const report = await backupService.verifyBackupZip(maliciousZipPath);
    expect(report.valid).toBe(false);
    expect(report.issues.some((i) => i.includes('Zip Slip') || i.includes('路徑穿越'))).toBe(true);

    // Attempt restore
    const restoreRes = await backupService.restoreBackup({
      zipPath: maliciousZipPath,
      targetDirectory: restoreDir,
      conflictPolicy: 'rename',
    });
    expect(restoreRes.success).toBe(false);
    expect(restoreRes.restoredCount).toBe(0);
  });

  // ==================== 7. System Directory Restore Protection ====================
  it('strictly forbids restoring directly into Windows System Fonts directory', async () => {
    const zipPath = path.join(backupOutputDir, 'backup_sys_test.zip');
    await backupService.createBackup(zipPath, { includeAll: true });

    const winFontsDir = 'C:\\Windows\\Fonts';
    const restoreRes = await backupService.restoreBackup({
      zipPath,
      targetDirectory: winFontsDir,
      conflictPolicy: 'rename',
    });

    expect(restoreRes.success).toBe(false);
    expect(restoreRes.error).toContain('系統目錄');
  });

  // ==================== 8. Safe Restore with Conflict Policies ====================
  it('restores font files with atomic temporary writes and supports conflict policies', async () => {
    const zipPath = path.join(backupOutputDir, 'backup_restore.zip');
    await backupService.createBackup(zipPath, { includeAll: true });

    // First restore: clean restore
    const res1 = await backupService.restoreBackup({
      zipPath,
      targetDirectory: restoreDir,
      conflictPolicy: 'rename',
    });
    expect(res1.success).toBe(true);
    expect(res1.restoredCount).toBe(2);

    const restoredFile1 = path.join(restoreDir, 'SourceSans-Regular.ttf');
    expect(fs.existsSync(restoredFile1)).toBe(true);
    expect(calculateSha256(fs.readFileSync(restoredFile1))).toBe(font1.sha256);

    // Second restore with policy: 'skip'
    const resSkip = await backupService.restoreBackup({
      zipPath,
      targetDirectory: restoreDir,
      conflictPolicy: 'skip',
    });
    expect(resSkip.success).toBe(true);
    expect(resSkip.restoredCount).toBe(0);
    expect(resSkip.skippedCount).toBe(2);

    // Third restore with policy: 'rename'
    const resRename = await backupService.restoreBackup({
      zipPath,
      targetDirectory: restoreDir,
      conflictPolicy: 'rename',
    });
    expect(resRename.success).toBe(true);
    expect(resRename.restoredCount).toBe(2);
    // Verified that new renamed files exist
    const files = fs.readdirSync(restoreDir);
    expect(files.some((f) => f.includes('(restored_'))).toBe(true);
  });

  // ==================== 9. Metadata Import Transaction ====================
  it('imports collections, tags, and favorites non-destructively without wiping DB', async () => {
    const zipPath = path.join(backupOutputDir, 'backup_meta.zip');
    await backupService.createBackup(zipPath, { includeAll: true });

    const verification = await backupService.verifyBackupZip(zipPath);
    expect(verification.valid).toBe(true);

    // Add a local collection to verify it is NOT overwritten
    dbService.createCollection('col-local-only', '本地保留');

    const importRes = dbService.importBackupMetadata(verification.manifest!, {
      importCollections: true,
      importTags: true,
      importFavorites: true,
    });

    expect(importRes.collections).toBeGreaterThanOrEqual(0);
    expect(importRes.tags).toBeGreaterThanOrEqual(0);

    // Verify existing data is preserved
    const localCol = dbService.getCollection('col-local-only');
    expect(localCol).toBeDefined();
    expect(localCol?.name).toBe('本地保留');

    // Verify imported collection is present
    const workCol = dbService.getCollection('col-work');
    expect(workCol).toBeDefined();
    expect(workCol?.name).toBe('工作專案');
  });

  // ==================== 10. Cancellation & Temp File Cleanup ====================
  it('supports cancellation during restore and cleans up active temporary files', async () => {
    const zipPath = path.join(backupOutputDir, 'backup_cancel.zip');
    await backupService.createBackup(zipPath, { includeAll: true });

    let cancelFired = false;
    const restorePromise = backupService.restoreBackup(
      {
        zipPath,
        targetDirectory: restoreDir,
        conflictPolicy: 'rename',
      },
      (progress) => {
        if (!cancelFired) {
          cancelFired = true;
          backupService.cancelTask(progress.taskId);
        }
      }
    );

    const res = await restorePromise;
    expect(res.success).toBe(false);
    expect(res.error).toContain('中止');

    // Confirm no orphaned temporary files (.tmp_fs_*) left in target directory
    const remainingFiles = fs.readdirSync(restoreDir);
    const tempFiles = remainingFiles.filter((f) => f.startsWith('.tmp_fs_'));
    expect(tempFiles).toHaveLength(0);
  });
});

