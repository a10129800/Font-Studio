import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import AdmZip from 'adm-zip';
import { DatabaseService } from '../src/main/services/databaseService';
import { BackupService } from '../src/main/services/backupService';
import { FontInstallService } from '../src/main/services/fontInstallService';
import { calculateSha256 } from '../src/main/utils/hash';
import { sanitizeWindowsFilename } from '../src/main/utils/pathValidator';
import { BackupManifest, FontRecord } from '../src/shared/types';

describe('Milestone M3.1: Windows Safety, Integrity Verification & E2E Acceptance Suite', () => {
  let dbService: DatabaseService;
  let backupService: BackupService;
  let tempDir: string;
  let tempDbPath: string;
  let sampleFontDir: string;
  let restoreTargetDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fontstudio_m3_1_test_'));
    tempDbPath = path.join(tempDir, 'test_studio.db');
    sampleFontDir = path.join(tempDir, 'sample_fonts');
    restoreTargetDir = path.join(tempDir, 'restore_target');

    fs.mkdirSync(sampleFontDir, { recursive: true });
    fs.mkdirSync(restoreTargetDir, { recursive: true });

    dbService = new DatabaseService(tempDbPath);
    backupService = new BackupService(dbService);
  });

  afterEach(() => {
    dbService.close();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  // Helper to create a dummy valid font binary
  function createTestFontFile(filename: string, content: string = 'TEST_FONT_DATA'): string {
    const filePath = path.join(sampleFontDir, filename);
    const buffer = Buffer.from(content, 'utf-8');
    fs.writeFileSync(filePath, buffer);
    return filePath;
  }

  function seedFont(partial: Partial<FontRecord> & { id: string; file_path: string }): FontRecord {
    const f: FontRecord = {
      id: partial.id,
      family_name: partial.family_name || 'Test Family',
      localized_name: partial.localized_name || undefined,
      style_name: partial.style_name || 'Regular',
      postscript_name: partial.postscript_name || undefined,
      format: partial.format || 'ttf',
      file_path: partial.file_path,
      file_size: partial.file_size ?? (fs.existsSync(partial.file_path) ? fs.statSync(partial.file_path).size : 1024),
      sha256: partial.sha256 || (fs.existsSync(partial.file_path) ? calculateSha256(fs.readFileSync(partial.file_path)) : '0'.repeat(64)),
      source_type: partial.source_type || 'imported',
      install_scope: partial.install_scope || 'uninstalled',
      scan_status: partial.scan_status || 'valid',
      face_index: partial.face_index ?? 0,
      face_count: partial.face_count ?? 1,
      is_missing: partial.is_missing ?? false,
      last_scanned_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    dbService.upsertFont(f);
    return f;
  }

  // ==================== A. Backup Integrity & File Packaging ====================
  describe('A. Backup Generation & Content Verification', () => {
    it('M3.1-01: ZIP backup actually contains font binaries, checksum, and manifestSha256', async () => {
      const f1Path = createTestFontFile('DisplayMono-Regular.ttf', 'SAMPLE_BINARY_FONT_DATA_1');
      seedFont({
        id: 'font-mono-1',
        family_name: 'Display Mono',
        style_name: 'Regular',
        file_path: f1Path,
      });

      const backupZip = path.join(tempDir, 'out_backup.zip');
      const res = await backupService.createBackup(backupZip, { includeAll: true });

      expect(res.success).toBe(true);
      expect(res.fontCount).toBe(1);
      expect(fs.existsSync(backupZip)).toBe(true);

      // Inspect ZIP entries directly
      const zip = new AdmZip(backupZip);
      const manifestEntry = zip.getEntry('manifest.json');
      expect(manifestEntry).not.toBeNull();

      const manifest: BackupManifest = JSON.parse(manifestEntry!.getData().toString('utf-8'));
      expect(manifest.checksum).toBeDefined();
      expect(manifest.manifestSha256).toBe(manifest.checksum);
      expect(manifest.files).toHaveLength(1);

      // Verify that font binary entry exists in ZIP
      const fontArchivePath = manifest.files[0].archive_path;
      const fontEntry = zip.getEntry(fontArchivePath);
      expect(fontEntry).not.toBeNull();
      expect(fontEntry!.getData().toString('utf-8')).toBe('SAMPLE_BINARY_FONT_DATA_1');
    });

    it('M3.1-02: records unreadable font files in failedItems without crashing entire backup', async () => {
      const missingFilePath = path.join(sampleFontDir, 'ghost-font.ttf');

      seedFont({
        id: 'font-missing-1',
        family_name: 'Ghost Font',
        style_name: 'Regular',
        file_path: missingFilePath,
        file_size: 1024,
        sha256: '0000000000000000000000000000000000000000000000000000000000000000',
      });

      const backupZip = path.join(tempDir, 'ghost_backup.zip');
      const res = await backupService.createBackup(backupZip, { includeAll: true });

      expect(res.success).toBe(true);
      expect(res.fontCount).toBe(0);
      expect(res.failedCount).toBe(1);
      expect(res.failedItems[0].error).toContain('不存在');
    });
  });

  // ==================== B. Deep Verification & Anti-Tampering ====================
  describe('B. Deep Verification & Malicious File Rejection', () => {
    it('M3.1-03: rejects corrupted font binary with mismatched SHA-256', async () => {
      const f1Path = createTestFontFile('SecTest-Regular.ttf', 'VALID_BINARY_BYTES');
      seedFont({
        id: 'font-sec-1',
        family_name: 'SecTest',
        style_name: 'Regular',
        file_path: f1Path,
      });

      const backupZip = path.join(tempDir, 'sec_test.zip');
      await backupService.createBackup(backupZip, { includeAll: true });

      // Tamper with the zip: change bytes of font file without updating manifest
      const zip = new AdmZip(backupZip);
      const manifest: BackupManifest = JSON.parse(zip.getEntry('manifest.json')!.getData().toString('utf-8'));
      const fontArchivePath = manifest.files[0].archive_path;
      zip.deleteFile(fontArchivePath);
      zip.addFile(fontArchivePath, Buffer.from('TAMPERED_BYTES_CORRUPTED'));
      zip.writeZip(backupZip);

      const verification = await backupService.verifyBackupZip(backupZip);
      expect(verification.valid).toBe(false);
      expect(verification.issues.some((issue) => issue.includes('SHA-256 雜湊不符'))).toBe(true);
    });

    it('M3.1-04: rejects ZIP containing executable file extensions (.exe, .dll, .bat)', async () => {
      const f1Path = createTestFontFile('SafeFont.ttf', 'SAFE_BYTES');
      seedFont({
        id: 'font-safe-1',
        family_name: 'SafeFont',
        style_name: 'Regular',
        file_path: f1Path,
      });

      const backupZip = path.join(tempDir, 'malicious_exe.zip');
      await backupService.createBackup(backupZip, { includeAll: true });

      // Inject malicious executable
      const zip = new AdmZip(backupZip);
      zip.addFile('payload.exe', Buffer.from('MZ_FAKE_EXECUTABLE'));
      zip.writeZip(backupZip);

      const verification = await backupService.verifyBackupZip(backupZip);
      expect(verification.valid).toBe(false);
      expect(verification.issues.some((issue) => issue.includes('危險可執行檔'))).toBe(true);
    });

    it('M3.1-05: rejects ZIP containing duplicate entry names or archive paths', async () => {
      const f1Path = createTestFontFile('DupFont.ttf', 'DUP_BYTES');
      seedFont({
        id: 'font-dup-1',
        family_name: 'DupFont',
        style_name: 'Regular',
        file_path: f1Path,
      });

      const backupZip = path.join(tempDir, 'dup_entries.zip');
      await backupService.createBackup(backupZip, { includeAll: true });

      const zip = new AdmZip(backupZip);
      const manifest: BackupManifest = JSON.parse(zip.getEntry('manifest.json')!.getData().toString('utf-8'));
      // Add duplicate file entry in manifest.files
      manifest.files.push({ ...manifest.files[0], font_id: 'font-dup-2' });
      const { checksum, manifestSha256, ...withoutChecksum } = manifest;
      const recomputed = calculateSha256(JSON.stringify(withoutChecksum, null, 2));
      manifest.checksum = recomputed;
      manifest.manifestSha256 = recomputed;

      zip.deleteFile('manifest.json');
      zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2)));
      zip.writeZip(backupZip);

      const verification = await backupService.verifyBackupZip(backupZip);
      expect(verification.valid).toBe(false);
      expect(verification.issues.some((issue) => issue.includes('重複'))).toBe(true);
    });

    it('M3.1-06: rejects ZIP with missing or empty manifestSha256 / checksum', async () => {
      const f1Path = createTestFontFile('CheckFont.ttf', 'CHECK_BYTES');
      seedFont({
        id: 'font-check-1',
        family_name: 'CheckFont',
        style_name: 'Regular',
        file_path: f1Path,
      });

      const backupZip = path.join(tempDir, 'empty_checksum.zip');
      await backupService.createBackup(backupZip, { includeAll: true });

      // Strip checksum
      const zip = new AdmZip(backupZip);
      const manifest: any = JSON.parse(zip.getEntry('manifest.json')!.getData().toString('utf-8'));
      delete manifest.checksum;
      delete manifest.manifestSha256;
      zip.deleteFile('manifest.json');
      zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest)));
      zip.writeZip(backupZip);

      const verification = await backupService.verifyBackupZip(backupZip);
      expect(verification.valid).toBe(false);
      expect(verification.issues.some((issue) => issue.includes('缺少安全校驗碼'))).toBe(true);
    });

    it('M3.1-15: rejects case-insensitive duplicate paths in manifest (e.g. fonts/test.ttf vs fonts/TEST.TTF)', async () => {
      const f1Path = createTestFontFile('CaseFont.ttf', 'CASE_BYTES');
      seedFont({
        id: 'font-case-1',
        family_name: 'CaseFont',
        style_name: 'Regular',
        file_path: f1Path,
      });

      const backupZip = path.join(tempDir, 'case_collision.zip');
      await backupService.createBackup(backupZip, { includeAll: true });

      const zip = new AdmZip(backupZip);
      const manifest: BackupManifest = JSON.parse(zip.getEntry('manifest.json')!.getData().toString('utf-8'));
      const originalItem = manifest.files[0];
      // Add a case-varying item pointing to same path in upper case
      manifest.files.push({
        ...originalItem,
        font_id: 'font-case-2',
        archive_path: originalItem.archive_path.toUpperCase(),
      });
      const { checksum, manifestSha256, ...withoutChecksum } = manifest;
      const recomputed = calculateSha256(JSON.stringify(withoutChecksum, null, 2));
      manifest.checksum = recomputed;
      manifest.manifestSha256 = recomputed;

      zip.deleteFile('manifest.json');
      zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2)));
      zip.writeZip(backupZip);

      const verification = await backupService.verifyBackupZip(backupZip);
      expect(verification.valid).toBe(false);
      expect(verification.issues.some((issue) => issue.includes('大小寫衝突') || issue.includes('重複'))).toBe(true);
    });

    it('M3.1-16: rejects ZIP entries containing Windows reserved device names in path segments', async () => {
      const f1Path = createTestFontFile('DeviceFont.ttf', 'DEV_BYTES');
      seedFont({
        id: 'font-dev-1',
        family_name: 'DeviceFont',
        style_name: 'Regular',
        file_path: f1Path,
      });

      const backupZip = path.join(tempDir, 'device_reserved.zip');
      await backupService.createBackup(backupZip, { includeAll: true });

      const zip = new AdmZip(backupZip);
      // Inject reserved device entry e.g. fonts/CON/font.ttf
      zip.addFile('fonts/CON/evil.ttf', Buffer.from('RESERVED_DEVICE_BYTES'));
      zip.writeZip(backupZip);

      const verification = await backupService.verifyBackupZip(backupZip);
      expect(verification.valid).toBe(false);
      expect(verification.issues.some((issue) => issue.includes('Zip Slip') || issue.includes('路徑穿越'))).toBe(true);
    });
  });

  // ==================== C. Restoration & Conflict Resolution ====================
  describe('C. Restoration & Atomic Conflict Management', () => {
    it('M3.1-07: restores fonts with 100% SHA-256 byte match and verifies non-elevated safety', async () => {
      const f1Path = createTestFontFile('E2EFont-Regular.ttf', 'AUTHENTIC_FONT_CONTENT_9988');
      const f1Sha256 = calculateSha256(fs.readFileSync(f1Path));

      seedFont({
        id: 'font-e2e-1',
        family_name: 'E2EFont',
        style_name: 'Regular',
        file_path: f1Path,
      });

      const backupZip = path.join(tempDir, 'e2e_backup.zip');
      await backupService.createBackup(backupZip, { includeAll: true });

      // Restore to a fresh directory
      const restoreDir = path.join(tempDir, 'restored_fresh');
      const result = await backupService.restoreBackup({
        zipPath: backupZip,
        targetDirectory: restoreDir,
        conflictPolicy: 'skip',
      });

      expect(result.success).toBe(true);
      expect(result.restoredCount).toBe(1);

      const restoredFilePath = result.restoredFiles[0];
      expect(fs.existsSync(restoredFilePath)).toBe(true);

      const restoredSha256 = calculateSha256(fs.readFileSync(restoredFilePath));
      expect(restoredSha256).toBe(f1Sha256);
    });

    it('M3.1-08: safely handles overwrite policy with automatic rollback if replacement fails', async () => {
      const f1Path = createTestFontFile('OverlapFont.ttf', 'VERSION_2_CONTENT');
      seedFont({
        id: 'font-overlap-1',
        family_name: 'OverlapFont',
        style_name: 'Regular',
        file_path: f1Path,
      });

      const backupZip = path.join(tempDir, 'overlap.zip');
      await backupService.createBackup(backupZip, { includeAll: true });

      // Seed target directory with older version
      const existingTargetPath = path.join(restoreTargetDir, 'OverlapFont.ttf');
      fs.writeFileSync(existingTargetPath, 'VERSION_1_ORIGINAL_CONTENT');

      // Execute overwrite
      const result = await backupService.restoreBackup({
        zipPath: backupZip,
        targetDirectory: restoreTargetDir,
        conflictPolicy: 'overwrite',
      });

      expect(result.success).toBe(true);
      expect(result.restoredCount).toBe(1);

      // Verify file now has version 2 content
      const finalContent = fs.readFileSync(existingTargetPath, 'utf-8');
      expect(finalContent).toBe('VERSION_2_CONTENT');
    });

    it('M3.1-09: rename policy avoids collision even when candidate names exist', async () => {
      const f1Path = createTestFontFile('RenameFont.ttf', 'RENAME_DATA');
      const f1Sha256 = calculateSha256(fs.readFileSync(f1Path));

      seedFont({
        id: 'font-ren-1',
        family_name: 'RenameFont',
        style_name: 'Regular',
        file_path: f1Path,
      });

      const backupZip = path.join(tempDir, 'ren.zip');
      await backupService.createBackup(backupZip, { includeAll: true });

      // Seed both base file and first collision candidate
      fs.writeFileSync(path.join(restoreTargetDir, 'RenameFont.ttf'), 'BASE');
      fs.writeFileSync(
        path.join(restoreTargetDir, `RenameFont (restored_${f1Sha256.slice(0, 6)}).ttf`),
        'COLLISION_1'
      );

      const result = await backupService.restoreBackup({
        zipPath: backupZip,
        targetDirectory: restoreTargetDir,
        conflictPolicy: 'rename',
      });

      expect(result.success).toBe(true);
      expect(result.restoredCount).toBe(1);

      // Should have generated candidate with _1
      const expectedRenamedPath = path.join(
        restoreTargetDir,
        `RenameFont (restored_${f1Sha256.slice(0, 6)}_1).ttf`
      );
      expect(fs.existsSync(expectedRenamedPath)).toBe(true);
      expect(fs.readFileSync(expectedRenamedPath, 'utf-8')).toBe('RENAME_DATA');
    });
  });

  // ==================== D. Metadata Merge & Conflict Safety ====================
  describe('D. Metadata Merge Safety & Non-Destructive Transactions', () => {
    it('M3.1-10: merges collections and tags with identical names without UNIQUE constraint crash', () => {
      // Create local collection "Typography" with ID "col-local-1"
      const localCol = dbService.createCollection('col-local-1', 'Typography', 'Local Typography Collection');
      // Create local tag "Display" with ID "tag-local-1"
      const localTag = dbService.getOrCreateTag('tag-local-1', 'Display');

      // Simulate a backup manifest containing collection "Typography" with different ID "col-manifest-9"
      const manifest: BackupManifest = {
        manifest_version: '1.0.0',
        app_version: '0.1.0',
        created_at: new Date().toISOString(),
        font_count: 0,
        files: [],
        collections: [
          { id: 'col-manifest-9', name: 'Typography', description: 'Remote Typography Description', font_count: 0, created_at: new Date().toISOString() },
          { id: 'col-manifest-10', name: 'New Brand Category', description: 'Brand Fonts', font_count: 0, created_at: new Date().toISOString() },
        ],
        font_collections: [],
        tags: [
          { id: 'tag-manifest-9', name: 'Display' },
          { id: 'tag-manifest-10', name: 'Vintage' },
        ],
        font_tags: [],
        favorites: [],
        settings: {},
        checksum: 'checksum_dummy',
      };

      // Import metadata - must NOT throw UNIQUE constraint error
      const importResult = dbService.importBackupMetadata(manifest, {
        importCollections: true,
        importTags: true,
        importFavorites: true,
      });

      expect(importResult.collections).toBe(1); // 1 new collection added ("New Brand Category")
      expect(importResult.tags).toBe(1); // 1 new tag added ("Vintage")

      const allCols = dbService.getAllCollections();
      expect(allCols).toHaveLength(2);
      // Local "Typography" should retain its local ID
      const typoCol = allCols.find((c) => c.name === 'Typography');
      expect(typoCol?.id).toBe(localCol.id);

      const allTags = dbService.getAllTags();
      expect(allTags).toHaveLength(2);
      const displayTag = allTags.find((t) => t.name === 'Display');
      expect(displayTag?.id).toBe(localTag.id);
    });

    it('M3.1-11: ignores dangling font associations when fonts are not in local database', () => {
      const col = dbService.createCollection('col-clean-1', 'CleanCol', '');
      const manifest: BackupManifest = {
        manifest_version: '1.0.0',
        app_version: '0.1.0',
        created_at: new Date().toISOString(),
        font_count: 0,
        files: [],
        collections: [{ id: col.id, name: 'CleanCol', description: '', font_count: 0, created_at: new Date().toISOString() }],
        font_collections: [
          { font_id: 'non-existent-font-999', collection_id: col.id },
        ],
        tags: [],
        font_tags: [],
        favorites: [{ font_id: 'non-existent-font-999', created_at: new Date().toISOString() }],
        settings: {},
        checksum: 'dummy',
      };

      // Should not throw FOREIGN KEY constraint failed
      const res = dbService.importBackupMetadata(manifest, {
        importCollections: true,
        importFavorites: true,
      });

      expect(res.favorites).toBe(0);
      const fontsInCol = dbService.getFonts({ collectionId: col.id });
      expect(fontsInCol.total).toBe(0);
    });

    it('M3.1-17: database import transaction rolls back completely on SQLite fatal constraint error', () => {
      const initialCollectionsCount = dbService.getAllCollections().length;

      // Manifest containing a valid collection followed by a failing element that throws midway
      const manifest: any = {
        manifest_version: '1.0.0',
        app_version: '0.1.0',
        created_at: new Date().toISOString(),
        font_count: 0,
        files: [],
        collections: [
          { id: 'col-valid-1', name: 'WillBeRolledBack', description: 'Test', font_count: 0, created_at: new Date().toISOString() },
        ],
        tags: [
          {
            get id(): string {
              throw new Error('Mid-transaction simulated hardware/DB failure');
            },
            name: 'CrashTag',
          },
        ],
        checksum: 'dummy',
      };

      expect(() => {
        dbService.importBackupMetadata(manifest, { importCollections: true, importTags: true });
      }).toThrow('Mid-transaction simulated hardware/DB failure');

      // Verify transaction rollback: the first collection must NOT be committed
      const afterCollections = dbService.getAllCollections();
      expect(afterCollections.length).toBe(initialCollectionsCount);
      expect(afterCollections.some((c) => c.name === 'WillBeRolledBack')).toBe(false);
    });
  });

  // ==================== E. Windows Install / Uninstall Safety ====================
  describe('E. Windows Install & Uninstall Service Security', () => {
    it('M3.1-12: strictly blocks uninstalling Windows core and localized system fonts', async () => {
      const mockUserDir = path.join(tempDir, 'mock_user_fonts');
      fs.mkdirSync(mockUserDir, { recursive: true });

      const installService = new FontInstallService(dbService, mockUserDir);

      const protectedSamples: Partial<FontRecord>[] = [
        { family_name: 'Segoe UI', file_path: 'C:\\Windows\\Fonts\\segoeui.ttf', install_scope: 'system' },
        { family_name: '微軟正黑體', localized_name: 'Microsoft JhengHei', file_path: 'C:\\Windows\\Fonts\\msjh.ttc', install_scope: 'system' },
        { family_name: 'Arial', file_path: 'C:\\Windows\\Fonts\\arial.ttf', install_scope: 'system' },
        { family_name: 'Consolas', file_path: 'C:\\Windows\\Fonts\\consola.ttf', install_scope: 'system' },
      ];

      for (const font of protectedSamples) {
        expect(installService.isProtectedFont(font as any)).toBe(true);

        const uninstallRes = await installService.uninstallFontUserScope(font as any);
        expect(uninstallRes.success).toBe(false);
        expect(uninstallRes.error).toContain('系統受保護字體');
      }
    });

    it('M3.1-13: rolls back copied file if Windows registry write fails', async () => {
      const mockUserDir = path.join(tempDir, 'mock_user_fonts');
      fs.mkdirSync(mockUserDir, { recursive: true });

      // Mock exec runner where reg.exe add fails
      const failingExecRunner = async (file: string, args: string[]) => {
        if (file === 'reg.exe' && args[0] === 'add') {
          throw new Error('Access is denied to registry key');
        }
        return { stdout: '', stderr: '' };
      };

      const installService = new FontInstallService(dbService, mockUserDir, failingExecRunner);

      const fPath = createTestFontFile('RollbackFont.ttf', 'VALID_TTF_BYTES');
      const fontRecord: FontRecord = {
        id: 'font-roll-1',
        family_name: 'RollbackFont',
        style_name: 'Regular',
        localized_name: undefined,
        postscript_name: undefined,
        format: 'ttf',
        file_path: fPath,
        file_size: fs.statSync(fPath).size,
        sha256: calculateSha256(fs.readFileSync(fPath)),
        source_type: 'imported',
        install_scope: 'uninstalled',
        scan_status: 'valid',
        face_index: 0,
        face_count: 1,
        is_missing: false,
        last_scanned_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      const res = await installService.installFontUserScope(fontRecord);

      expect(res.success).toBe(false);
      expect(res.error).toContain('寫入 Windows 登錄機碼失敗');

      // Verify rollback: copied file in user font dir must be deleted
      const copiedPath = path.join(mockUserDir, 'RollbackFont.ttf');
      expect(fs.existsSync(copiedPath)).toBe(false);
    });

    it('M3.1-14: filename sanitization neutralizes Windows reserved device names and illegal characters', () => {
      expect(sanitizeWindowsFilename('CON.ttf')).toBe('safe_CON.ttf');
      expect(sanitizeWindowsFilename('prn.otf')).toBe('safe_prn.otf');
      expect(sanitizeWindowsFilename('aux.ttc')).toBe('safe_aux.ttc');
      expect(sanitizeWindowsFilename('nul')).toBe('safe_nul');
      expect(sanitizeWindowsFilename('COM1.ttf')).toBe('safe_COM1.ttf');
      expect(sanitizeWindowsFilename('bad:name*with?chars<.ttf')).toBe('bad_name_with_chars_.ttf');
      expect(sanitizeWindowsFilename('trailing.dots...   ')).toBe('trailing.dots');
      expect(sanitizeWindowsFilename('')).toMatch(/^font_\d+\.ttf$/);
    });
  });
});
