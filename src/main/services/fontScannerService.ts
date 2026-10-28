import * as fs from 'fs';
import * as path from 'path';
import { FontParserService } from './fontParserService';
import { DatabaseService } from './databaseService';
import { ScanProgressUpdate, FontRecord } from '../../shared/types';

export class FontScannerService {
  private parser: FontParserService;
  private db: DatabaseService;
  private isCancelled: boolean = false;

  constructor(db: DatabaseService, parser?: FontParserService) {
    this.db = db;
    this.parser = parser || new FontParserService();
  }

  /**
   * Discovers font files in Windows system directories and user directories.
   */
  public getDefaultFontDirectories(): { path: string; source: 'system' | 'user' }[] {
    const dirs: { path: string; source: 'system' | 'user' }[] = [];

    // System fonts: C:\Windows\Fonts
    const winDir = process.env.WINDIR || 'C:\\Windows';
    const sysFonts = path.join(winDir, 'Fonts');
    if (fs.existsSync(sysFonts)) {
      dirs.push({ path: sysFonts, source: 'system' });
    }

    // User fonts: %LOCALAPPDATA%\Microsoft\Windows\Fonts
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
      const userFonts = path.join(localAppData, 'Microsoft', 'Windows', 'Fonts');
      if (fs.existsSync(userFonts)) {
        dirs.push({ path: userFonts, source: 'user' });
      }
    }

    return dirs;
  }

  public cancel(): void {
    this.isCancelled = true;
  }

  /**
   * Scans font directories, parses files, updates database, and reports real progress.
   */
  public async scanDirectories(
    targetDirs?: { path: string; source: 'system' | 'user' | 'imported' }[],
    onProgress?: (progress: ScanProgressUpdate) => void
  ): Promise<{ successCount: number; failedCount: number; skippedCount: number; total: number }> {
    this.isCancelled = false;

    const dirsToScan = targetDirs && targetDirs.length > 0 ? targetDirs : this.getDefaultFontDirectories();

    // 1. Discover all candidate font files
    const fileEntries: { filePath: string; source: 'system' | 'user' | 'imported' }[] = [];

    onProgress?.({
      phase: 'discovering',
      total: 0,
      current: 0,
      currentFile: '正在搜尋字體檔案...',
      successCount: 0,
      failedCount: 0,
      skippedCount: 0,
    });

    const supportedExts = new Set(['.ttf', '.otf', '.woff', '.woff2', '.ttc']);

    for (const dir of dirsToScan) {
      if (!fs.existsSync(dir.path)) continue;
      try {
        const files = await this.collectFilesRecursively(dir.path, supportedExts);
        for (const f of files) {
          fileEntries.push({ filePath: f, source: dir.source });
        }
      } catch (err) {
        console.error(`Error discovering files in ${dir.path}:`, err);
      }
    }

    const total = fileEntries.length;
    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    // 2. Parse and index each file
    const batchSize = 25;
    const parsedBatch: FontRecord[] = [];

    for (let i = 0; i < total; i++) {
      if (this.isCancelled) {
        // Flush remaining before exiting
        if (parsedBatch.length > 0) {
          this.db.upsertFontsBatch(parsedBatch);
          parsedBatch.length = 0;
        }

        onProgress?.({
          phase: 'cancelled',
          total,
          current: i,
          currentFile: '使用者已取消掃描',
          successCount,
          failedCount,
          skippedCount,
        });
        return { successCount, failedCount, skippedCount, total };
      }

      const { filePath, source } = fileEntries[i];

      onProgress?.({
        phase: 'parsing',
        total,
        current: i + 1,
        currentFile: path.basename(filePath),
        successCount,
        failedCount,
        skippedCount,
      });

      try {
        const fontRecords = await this.parser.parseFontFile(filePath, source);

        for (const font of fontRecords) {
          // Check if this font face already exists to preserve stable ID & user collections/favorites
          const existing =
            this.db.findFontByPathAndFace(font.file_path, font.face_index) ||
            this.db.findFontByPathAndStyle(font.file_path, font.style_name);

          if (existing) {
            font.id = existing.id;
            font.created_at = existing.created_at;
          }

          if (font.scan_status === 'corrupted' || font.scan_status === 'unsupported' || font.scan_status === 'unreadable') {
            failedCount++;
          } else {
            successCount++;
          }

          parsedBatch.push(font);
        }

        // Flush batch to SQLite periodically inside single transactions
        if (parsedBatch.length >= batchSize || i === total - 1) {
          this.db.upsertFontsBatch(parsedBatch);
          parsedBatch.length = 0;
        }
      } catch (err) {
        failedCount++;
        console.error(`Failed parsing ${filePath}:`, err);
      }
    }

    // 3. Mark missing files in scanned scopes
    const discoveredPaths = new Set(fileEntries.map((e) => e.filePath));
    for (const dir of dirsToScan) {
      this.db.markMissingFonts(discoveredPaths, dir.source);
    }

    onProgress?.({
      phase: 'complete',
      total,
      current: total,
      currentFile: '掃描完成！',
      successCount,
      failedCount,
      skippedCount,
    });

    return { successCount, failedCount, skippedCount, total };
  }

  private async collectFilesRecursively(dir: string, supportedExts: Set<string>): Promise<string[]> {
    const results: string[] = [];
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const lowerName = entry.name.toLowerCase();
        // Skip system/hidden metadata dirs
        if (lowerName !== '$recycle.bin' && lowerName !== 'system volume information' && !lowerName.startsWith('.')) {
          try {
            const subFiles = await this.collectFilesRecursively(fullPath, supportedExts);
            results.push(...subFiles);
          } catch {
            // Gracefully ignore folders without read permissions
          }
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (supportedExts.has(ext)) {
          results.push(fullPath);
        }
      }
    }

    return results;
  }
}
