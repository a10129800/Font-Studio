import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { FontScannerService } from '../src/main/services/fontScannerService';
import { DatabaseService } from '../src/main/services/databaseService';
import { ScanProgressUpdate } from '../src/shared/types';

describe('FontScannerService', () => {
  let dbService: DatabaseService;
  let tempDbPath: string;
  let tempScanDir: string;
  let scanner: FontScannerService;

  beforeEach(() => {
    tempDbPath = path.join(os.tmpdir(), `scanner_db_${Date.now()}_${Math.random().toString(36).slice(2)}.db`);
    dbService = new DatabaseService(tempDbPath);
    scanner = new FontScannerService(dbService);

    tempScanDir = path.join(os.tmpdir(), `scanner_test_dir_${Date.now()}`);
    fs.mkdirSync(tempScanDir, { recursive: true });
  });

  afterEach(() => {
    dbService.close();
    if (fs.existsSync(tempDbPath)) {
      try { fs.unlinkSync(tempDbPath); } catch {}
    }
    if (fs.existsSync(tempScanDir)) {
      try { fs.rmSync(tempScanDir, { recursive: true, force: true }); } catch {}
    }
  });

  it('detects default Windows system font directory', () => {
    const dirs = scanner.getDefaultFontDirectories();
    expect(dirs.length).toBeGreaterThanOrEqual(1);
    expect(dirs.some((d) => d.source === 'system')).toBe(true);
  });

  it('scans directory and reports real progress events', async () => {
    // Create one corrupted font and copy Arial if exists
    const corruptFile = path.join(tempScanDir, 'corrupt.ttf');
    fs.writeFileSync(corruptFile, 'not a real font');

    const progressUpdates: ScanProgressUpdate[] = [];

    const result = await scanner.scanDirectories(
      [{ path: tempScanDir, source: 'imported' }],
      (progress) => progressUpdates.push(progress)
    );

    expect(result.total).toBe(1);
    expect(result.failedCount).toBe(1); // Corrupt font identified
    expect(progressUpdates.length).toBeGreaterThan(0);
    expect(progressUpdates[progressUpdates.length - 1].phase).toBe('complete');

    // Font in DB should have status corrupted
    const fonts = dbService.getFonts();
    expect(fonts.length).toBe(1);
    expect(fonts[0].scan_status).toBe('corrupted');
  });

  it('supports cancellation during scanning', async () => {
    // Create multiple mock files
    for (let i = 0; i < 5; i++) {
      fs.writeFileSync(path.join(tempScanDir, `font_${i}.ttf`), `mock font data ${i}`);
    }

    let progressCount = 0;
    const scanPromise = scanner.scanDirectories(
      [{ path: tempScanDir, source: 'imported' }],
      () => {
        progressCount++;
        if (progressCount === 2) {
          scanner.cancel();
        }
      }
    );

    const result = await scanPromise;
    expect(result.total).toBe(5);
    // Scanning was stopped early
    expect(result.successCount + result.failedCount).toBeLessThan(5);
  });
});

