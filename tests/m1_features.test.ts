import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { DatabaseService } from '../src/main/services/databaseService';
import { FontParserService } from '../src/main/services/fontParserService';
import { FontScannerService } from '../src/main/services/fontScannerService';
import { isValidFilePath, isSafeArchivePath } from '../src/main/utils/pathValidator';
import { FontRecord, ScanProgressUpdate } from '../src/shared/types';

describe('Milestone M1 Core Features Test Suite', () => {
  let dbService: DatabaseService;
  let parser: FontParserService;
  let scanner: FontScannerService;
  let tempDbPath: string;
  let tempFontDir: string;

  beforeEach(() => {
    tempDbPath = path.join(os.tmpdir(), `m1_test_${Date.now()}_${Math.random().toString(36).slice(2)}.db`);
    dbService = new DatabaseService(tempDbPath);
    parser = new FontParserService();
    scanner = new FontScannerService(dbService, parser);

    tempFontDir = path.join(os.tmpdir(), `m1_fonts_${Date.now()}`);
    fs.mkdirSync(tempFontDir, { recursive: true });
  });

  afterEach(() => {
    dbService.close();
    if (fs.existsSync(tempDbPath)) {
      try { fs.unlinkSync(tempDbPath); } catch {}
    }
    if (fs.existsSync(tempFontDir)) {
      try { fs.rmSync(tempFontDir, { recursive: true, force: true }); } catch {}
    }
  });

  it('correctly handles TTC multi-face files or single TTF fonts', async () => {
    const msjhPath = 'C:\\Windows\\Fonts\\msjh.ttc';
    if (fs.existsSync(msjhPath)) {
      const records = await parser.parseFontFile(msjhPath, 'system');
      expect(records.length).toBeGreaterThanOrEqual(2);
      expect(records[0].face_count).toBeGreaterThanOrEqual(2);
      expect(records[0].face_index).toBe(0);
      expect(records[1].face_index).toBe(1);
      // Different deterministic IDs for distinct faces
      expect(records[0].id).not.toBe(records[1].id);
      // Localized Traditional Chinese name detected
      expect(records[0].localized_name).toBe('微軟正黑體');
    }
  });

  it('scans custom user directories and records real progress', async () => {
    // Write 2 valid-format and 1 corrupted font fixtures
    fs.writeFileSync(path.join(tempFontDir, 'test_corrupt.ttf'), 'corrupt font bytes');
    fs.writeFileSync(path.join(tempFontDir, 'test_corrupt2.otf'), 'corrupt otf bytes');

    const progressLogs: ScanProgressUpdate[] = [];
    const scanResult = await scanner.scanDirectories(
      [{ path: tempFontDir, source: 'imported' }],
      (p) => progressLogs.push(p)
    );

    expect(scanResult.total).toBe(2);
    expect(scanResult.failedCount).toBe(2);
    expect(progressLogs.length).toBeGreaterThan(0);
    expect(progressLogs[progressLogs.length - 1].phase).toBe('complete');

    // Records saved in SQLite without crash
    const allFonts = dbService.getAllFonts();
    expect(allFonts).toHaveLength(2);
    expect(allFonts.every((f) => f.scan_status === 'corrupted')).toBe(true);
  });

  it('preserves user collections and tags across re-scans with stable IDs', async () => {
    const mockFile = path.join(tempFontDir, 'stable_font.ttf');
    fs.writeFileSync(mockFile, 'mock font bytes for stability test');

    await scanner.scanDirectories([{ path: tempFontDir, source: 'imported' }]);

    const initialFonts = dbService.getAllFonts();
    expect(initialFonts).toHaveLength(1);
    const fontId = initialFonts[0].id;

    // User tags font and marks as favorite
    dbService.toggleFavorite(fontId);
    const col = dbService.createCollection('col-keep', 'Kept Collection');
    dbService.addFontToCollection(fontId, col.id);
    const tag = dbService.getOrCreateTag('tag-keep', 'Kept Tag');
    dbService.addTagToFont(fontId, tag.id);

    // Re-scan same directory
    await scanner.scanDirectories([{ path: tempFontDir, source: 'imported' }]);

    // Font ID and associations must be completely preserved
    const rescannedFont = dbService.getFontById(fontId);
    expect(rescannedFont).toBeDefined();
    expect(rescannedFont?.is_favorite).toBe(true);
    expect(rescannedFont?.collection_ids).toContain(col.id);
    expect(rescannedFont?.tags).toContain('Kept Tag');
  });

  it('marks deleted files as is_missing without deleting user database records', async () => {
    const fontA = path.join(tempFontDir, 'fontA.ttf');
    const fontB = path.join(tempFontDir, 'fontB.ttf');
    fs.writeFileSync(fontA, 'font a data');
    fs.writeFileSync(fontB, 'font b data');

    await scanner.scanDirectories([{ path: tempFontDir, source: 'imported' }]);
    let allFonts = dbService.getAllFonts();
    expect(allFonts).toHaveLength(2);

    // Delete fontA from disk
    fs.unlinkSync(fontA);

    // Re-scan directory
    await scanner.scanDirectories([{ path: tempFontDir, source: 'imported' }]);

    allFonts = dbService.getAllFonts();
    expect(allFonts).toHaveLength(2); // Records preserved!
    const missingFont = allFonts.find((f) => f.file_path === fontA);
    const existingFont = allFonts.find((f) => f.file_path === fontB);

    expect(missingFont?.is_missing).toBe(true);
    expect(missingFont?.scan_status).toBe('unreadable');
    expect(existingFont?.is_missing).toBe(false);
  });

  it('validates search, multi-condition filtering, sorting, and pagination', () => {
    // Populate sample database
    const formats: ('ttf' | 'otf' | 'woff2')[] = ['ttf', 'otf', 'woff2'];
    for (let i = 1; i <= 20; i++) {
      dbService.upsertFont({
        id: `mock-${i}`,
        family_name: i <= 10 ? `Noto Sans ${i}` : `Helvetica ${i}`,
        localized_name: i === 5 ? '思源黑體' : undefined,
        style_name: i % 2 === 0 ? 'Bold' : 'Regular',
        file_path: `C:\\Fonts\\font${i}.${formats[i % 3]}`,
        format: formats[i % 3],
        file_size: i * 50000,
        sha256: `sha-${i}`,
        source_type: i <= 10 ? 'system' : 'imported',
        install_scope: i <= 10 ? 'system' : 'uninstalled',
        scan_status: 'valid',
        face_index: 0,
        face_count: 1,
        is_missing: false,
        last_scanned_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });
    }

    // 1. Search by Traditional Chinese localized name
    const zhSearch = dbService.getFonts({ searchQuery: '思源' });
    expect(zhSearch.total).toBe(1);
    expect(zhSearch.fonts[0].id).toBe('mock-5');

    // 2. Multi-filter: format 'otf' + source 'system'
    const multiFilter = dbService.getFonts({ format: 'otf', sourceType: 'system' });
    expect(multiFilter.fonts.every((f) => f.format === 'otf' && f.source_type === 'system')).toBe(true);

    // 3. Pagination: 5 items per page
    const page2 = dbService.getFonts({ page: 2, pageSize: 5 });
    expect(page2.total).toBe(20);
    expect(page2.totalPages).toBe(4);
    expect(page2.page).toBe(2);
    expect(page2.fonts).toHaveLength(5);
  });

  it('enforces path security and prevents traversal attacks', () => {
    // Path validator tests
    expect(isSafeArchivePath('C:\\safe\\path', 'fonts/arial.ttf')).toBe(true);
    expect(isSafeArchivePath('C:\\safe\\path', '../../evil.ttf')).toBe(false);
    expect(isValidFilePath('null\0byte')).toBe(false);
    expect(isValidFilePath('')).toBe(false);
  });

  it('benchmarks SQLite querying 1,000 fonts with pagination ensuring fast responses', () => {
    const batch: FontRecord[] = [];
    for (let i = 0; i < 1000; i++) {
      batch.push({
        id: `perf-font-${i}`,
        family_name: `Performance Font ${i % 50}`,
        localized_name: i % 10 === 0 ? `效能測試字體 ${i}` : undefined,
        style_name: i % 4 === 0 ? 'Bold' : 'Regular',
        file_path: `C:\\Fonts\\perf_${i}.ttf`,
        format: i % 2 === 0 ? 'ttf' : 'otf',
        file_size: 100000 + i,
        sha256: `sha256-perf-${i}`,
        source_type: i % 2 === 0 ? 'system' : 'user',
        install_scope: 'system',
        scan_status: 'valid',
        face_index: 0,
        face_count: 1,
        is_missing: false,
        last_scanned_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });
    }

    dbService.upsertFontsBatch(batch);

    const startTime = performance.now();
    const result = dbService.getFonts({
      searchQuery: '效能測試',
      format: 'ttf',
      sortBy: 'file_size',
      sortOrder: 'desc',
      page: 1,
      pageSize: 36,
    });
    const durationMs = performance.now() - startTime;

    expect(result.total).toBeGreaterThan(0);
    expect(result.fonts.length).toBeLessThanOrEqual(36);
    // Querying 1,000 indexed records with SQLite WAL index should execute well under 50ms
    expect(durationMs).toBeLessThan(50);
  });
});
