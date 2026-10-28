import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DatabaseService } from '../src/main/services/databaseService';
import { FontInstallService } from '../src/main/services/fontInstallService';
import { BatchJobQueue } from '../src/main/services/batchJobQueue';
import { FontRecord } from '../src/shared/types';

describe('Milestone M2-B & M2-C: Font Installation Safety & Batch Queue Suite', () => {
  let dbService: DatabaseService;
  let installService: FontInstallService;
  let batchQueue: BatchJobQueue;

  let tempDir: string;
  let tempDbPath: string;
  let mockUserFontsDir: string;
  let mockSourceDir: string;

  // Mock in-memory registry table
  let mockRegistry: Map<string, string>;
  let mockExecCalls: { file: string; args: string[] }[];

  const mockExecRunner = async (file: string, args: string[]) => {
    mockExecCalls.push({ file, args });

    if (file === 'reg.exe') {
      const subCommand = args[0];
      const key = args[1];

      if (subCommand === 'add') {
        const vIdx = args.indexOf('/v');
        const dIdx = args.indexOf('/d');
        const valueName = args[vIdx + 1];
        const valueData = args[dIdx + 1];
        mockRegistry.set(`${key}::${valueName}`, valueData);
        return { stdout: 'The operation completed successfully.', stderr: '' };
      }

      if (subCommand === 'query') {
        const vIdx = args.indexOf('/v');
        const valueName = args[vIdx + 1];
        const keyName = `${key}::${valueName}`;
        if (mockRegistry.has(keyName)) {
          return { stdout: `${valueName}    REG_SZ    ${mockRegistry.get(keyName)}`, stderr: '' };
        }
        throw new Error('ERROR: The system was unable to find the specified registry key or value.');
      }

      if (subCommand === 'delete') {
        const vIdx = args.indexOf('/v');
        const valueName = args[vIdx + 1];
        mockRegistry.delete(`${key}::${valueName}`);
        return { stdout: 'The operation completed successfully.', stderr: '' };
      }
    }

    if (file === 'net.exe') {
      // Simulate standard non-elevated user
      throw new Error('System error 5 has occurred. Access is denied.');
    }

    return { stdout: '', stderr: '' };
  };

  const mockNotifier = async () => {
    // No-op for unit tests
  };

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'font_studio_m2_test_'));
    tempDbPath = path.join(tempDir, 'test.db');
    mockUserFontsDir = path.join(tempDir, 'UserFonts');
    mockSourceDir = path.join(tempDir, 'SourceFonts');
    fs.mkdirSync(mockUserFontsDir, { recursive: true });
    fs.mkdirSync(mockSourceDir, { recursive: true });

    mockRegistry = new Map();
    mockExecCalls = [];

    dbService = new DatabaseService(tempDbPath);
    installService = new FontInstallService(
      dbService,
      mockUserFontsDir,
      mockExecRunner,
      mockNotifier
    );
    batchQueue = new BatchJobQueue(dbService, installService);
  });

  afterEach(() => {
    dbService.close();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  // ==================== System Font Protection ====================
  it('strictly blocks protected Windows core system fonts from uninstallation', async () => {
    // 1. Segoe UI
    const segoeFont: FontRecord = {
      id: 'font-segoe',
      family_name: 'Segoe UI',
      style_name: 'Regular',
      file_path: 'C:\\Windows\\Fonts\\segoeui.ttf',
      format: 'ttf',
      file_size: 500000,
      sha256: 'sha-segoe',
      source_type: 'system',
      install_scope: 'system',
      scan_status: 'valid',
      face_index: 0,
      face_count: 1,
      is_missing: false,
      last_scanned_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    expect(installService.isProtectedFont(segoeFont)).toBe(true);
    const segoeUninstall = await installService.uninstallFontUserScope(segoeFont);
    expect(segoeUninstall.success).toBe(false);
    expect(segoeUninstall.error).toContain('受保護');

    // 2. Microsoft JhengHei (微軟正黑體)
    const jhengHeiFont: FontRecord = {
      id: 'font-msjh',
      family_name: 'Microsoft JhengHei',
      localized_name: '微軟正黑體',
      style_name: 'Regular',
      file_path: 'C:\\Windows\\Fonts\\msjh.ttc',
      format: 'ttc',
      file_size: 15000000,
      sha256: 'sha-msjh',
      source_type: 'system',
      install_scope: 'system',
      scan_status: 'valid',
      face_index: 0,
      face_count: 2,
      is_missing: false,
      last_scanned_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    expect(installService.isProtectedFont(jhengHeiFont)).toBe(true);
    const jhUninstall = await installService.uninstallFontUserScope(jhengHeiFont);
    expect(jhUninstall.success).toBe(false);

    // 3. Third-party font in user folder is NOT protected
    const thirdPartyFont: FontRecord = {
      id: 'font-custom',
      family_name: 'My Custom Brand Font',
      style_name: 'Regular',
      file_path: path.join(mockUserFontsDir, 'MyCustomFont.ttf'),
      format: 'ttf',
      file_size: 40000,
      sha256: 'sha-custom',
      source_type: 'user',
      install_scope: 'user',
      scan_status: 'valid',
      face_index: 0,
      face_count: 1,
      is_missing: false,
      last_scanned_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    expect(installService.isProtectedFont(thirdPartyFont)).toBe(false);
  });

  // ==================== Format Validation ====================
  it('rejects WOFF and WOFF2 with explicit actionable feedback', async () => {
    const woffFont: FontRecord = {
      id: 'font-woff',
      family_name: 'Web Font Light',
      style_name: 'Regular',
      file_path: path.join(mockSourceDir, 'webfont.woff2'),
      format: 'woff2',
      file_size: 20000,
      sha256: 'sha-woff',
      source_type: 'imported',
      install_scope: 'uninstalled',
      scan_status: 'valid',
      face_index: 0,
      face_count: 1,
      is_missing: false,
      last_scanned_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    const res = await installService.installFontUserScope(woffFont);
    expect(res.success).toBe(false);
    expect(res.error).toContain('WOFF2');
    expect(res.error).toContain('網頁字體格式');
  });

  // ==================== User Scope Installation ====================
  it('installs a TTF font into User Scope and registers in HKCU Registry', async () => {
    const fontFile = path.join(mockSourceDir, 'BrandSans-Regular.ttf');
    fs.writeFileSync(fontFile, 'fake ttf content for test');

    const fontRecord: FontRecord = {
      id: 'font-brand-sans',
      family_name: 'Brand Sans',
      style_name: 'Regular',
      file_path: fontFile,
      format: 'ttf',
      file_size: 24,
      sha256: 'sha-brand-sans',
      source_type: 'imported',
      install_scope: 'uninstalled',
      scan_status: 'valid',
      face_index: 0,
      face_count: 1,
      is_missing: false,
      last_scanned_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    dbService.upsertFont(fontRecord);

    const result = await installService.installFontUserScope(fontRecord);
    expect(result.success).toBe(true);
    expect(result.installedPath).toBe(path.join(mockUserFontsDir, 'BrandSans-Regular.ttf'));
    expect(fs.existsSync(result.installedPath!)).toBe(true);

    // Verify registry entry was written
    const regKey = 'HKCU\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Fonts::Brand Sans (TrueType)';
    expect(mockRegistry.get(regKey)).toBe(result.installedPath);

    // Verify SQLite record updated
    const updatedFont = dbService.getFontById('font-brand-sans');
    expect(updatedFont?.install_scope).toBe('user');
    expect(updatedFont?.file_path).toBe(result.installedPath);
  });

  // ==================== Rollback on Registry Failure ====================
  it('rolls back and unlinks copied file if registry operation fails', async () => {
    const failingExecRunner = async (file: string, args: string[]) => {
      if (file === 'reg.exe' && args[0] === 'add') {
        throw new Error('Access denied to registry key');
      }
      return { stdout: '', stderr: '' };
    };

    const failingService = new FontInstallService(
      dbService,
      mockUserFontsDir,
      failingExecRunner,
      mockNotifier
    );

    const fontFile = path.join(mockSourceDir, 'FailingFont.ttf');
    fs.writeFileSync(fontFile, 'content');

    const fontRecord: FontRecord = {
      id: 'font-fail',
      family_name: 'Failing Font',
      style_name: 'Regular',
      file_path: fontFile,
      format: 'ttf',
      file_size: 7,
      sha256: 'sha-fail',
      source_type: 'imported',
      install_scope: 'uninstalled',
      scan_status: 'valid',
      face_index: 0,
      face_count: 1,
      is_missing: false,
      last_scanned_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    dbService.upsertFont(fontRecord);

    const result = await failingService.installFontUserScope(fontRecord);
    expect(result.success).toBe(false);
    expect(result.error).toContain('寫入 Windows 登錄機碼失敗');

    // Confirm copied file was unlinked (rollback)
    const targetFile = path.join(mockUserFontsDir, 'FailingFont.ttf');
    expect(fs.existsSync(targetFile)).toBe(false);
  });

  // ==================== User Scope Uninstallation ====================
  it('uninstalls user font, cleans registry and file, and updates database', async () => {
    const targetPath = path.join(mockUserFontsDir, 'MyFont.otf');
    fs.writeFileSync(targetPath, 'otf-binary');

    const regKey = 'HKCU\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Fonts::MyFont Bold (OpenType)';
    mockRegistry.set(regKey, targetPath);

    const fontRecord: FontRecord = {
      id: 'font-myfont',
      family_name: 'MyFont',
      style_name: 'Bold',
      file_path: targetPath,
      format: 'otf',
      file_size: 10,
      sha256: 'sha-myfont',
      source_type: 'user',
      install_scope: 'user',
      scan_status: 'valid',
      face_index: 0,
      face_count: 1,
      is_missing: false,
      last_scanned_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    dbService.upsertFont(fontRecord);

    const result = await installService.uninstallFontUserScope(fontRecord);
    expect(result.success).toBe(true);
    expect(mockRegistry.has(regKey)).toBe(false);
    expect(fs.existsSync(targetPath)).toBe(false);

    const updated = dbService.getFontById('font-myfont');
    expect(updated?.install_scope).toBe('uninstalled');
  });

  // ==================== BatchJobQueue & Cancellation ====================
  it('executes batch installation with progress, logs, and cancellation support', async () => {
    const f1File = path.join(mockSourceDir, 'BatchFont1.ttf');
    const f2File = path.join(mockSourceDir, 'BatchFont2.ttf');
    const f3File = path.join(mockSourceDir, 'BatchFont3.ttf');
    fs.writeFileSync(f1File, 'font 1');
    fs.writeFileSync(f2File, 'font 2');
    fs.writeFileSync(f3File, 'font 3');

    const f1: FontRecord = {
      id: 'bf-1',
      family_name: 'BatchFont 1',
      style_name: 'Regular',
      file_path: f1File,
      format: 'ttf',
      file_size: 6,
      sha256: 's1',
      source_type: 'imported',
      install_scope: 'uninstalled',
      scan_status: 'valid',
      face_index: 0,
      face_count: 1,
      is_missing: false,
      last_scanned_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    const f2: FontRecord = {
      id: 'bf-2',
      family_name: 'BatchFont 2',
      style_name: 'Regular',
      file_path: f2File,
      format: 'ttf',
      file_size: 6,
      sha256: 's2',
      source_type: 'imported',
      install_scope: 'uninstalled',
      scan_status: 'valid',
      face_index: 0,
      face_count: 1,
      is_missing: false,
      last_scanned_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    const f3: FontRecord = {
      id: 'bf-3',
      family_name: 'BatchFont 3',
      style_name: 'Regular',
      file_path: f3File,
      format: 'ttf',
      file_size: 6,
      sha256: 's3',
      source_type: 'imported',
      install_scope: 'uninstalled',
      scan_status: 'valid',
      face_index: 0,
      face_count: 1,
      is_missing: false,
      last_scanned_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    dbService.upsertFontsBatch([f1, f2, f3]);

    const progressUpdates: any[] = [];
    const res = await batchQueue.executeInstallBatch([f1, f2, f3], (update) => {
      progressUpdates.push(update);
    });

    expect(res.phase).toBe('completed');
    expect(res.successCount).toBe(3);
    expect(res.failedCount).toBe(0);
    expect(progressUpdates.length).toBeGreaterThanOrEqual(4);

    // Verify operations table in SQLite
    const op = dbService.getRecentOperations(1)[0];
    expect(op.id).toBe(res.taskId);
    expect(op.operation_type).toBe('install');
    expect(op.status).toBe('completed');
    expect(op.success_count).toBe(3);

    // Verify operation_logs table in SQLite
    const logs = dbService.getOperationLogs(res.taskId);
    expect(logs).toHaveLength(3);
    expect(logs[0].status).toBe('success');

    // Test cancellation on uninstallation queue
    let cancelledFired = false;
    const cancelRes = await batchQueue.executeUninstallBatch([f1, f2, f3], (update) => {
      if (update.current === 1 && !cancelledFired) {
        cancelledFired = true;
        batchQueue.cancelTask(update.taskId);
      }
    });

    expect(cancelRes.phase).toBe('cancelled');
    const cancelOp = dbService.getRecentOperations(1)[0];
    expect(cancelOp.status).toBe('cancelled');
  });
});
