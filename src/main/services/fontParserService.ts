import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as fontkit from 'fontkit';
import { FontRecord, FontFormat, ScanStatus, InstallScope, FontSourceType } from '../../shared/types';
import { calculateFileSha256 } from '../utils/hash';
import { isSystemFontPath } from '../utils/pathValidator';

export class FontParserService {
  /**
   * Identifies font format from file extension and header bytes.
   */
  public detectFormat(filePath: string): FontFormat {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.ttf':
        return 'ttf';
      case '.otf':
        return 'otf';
      case '.woff':
        return 'woff';
      case '.woff2':
        return 'woff2';
      case '.ttc':
        return 'ttc';
      default:
        return 'unknown';
    }
  }

  /**
   * Parses a font file. Returns an array of FontRecord because TTC files contain multiple faces.
   */
  public async parseFontFile(filePath: string, sourceType: FontSourceType = 'imported'): Promise<FontRecord[]> {
    const stats = await fs.promises.stat(filePath);
    const fileSize = stats.size;
    const sha256 = await calculateFileSha256(filePath);
    const format = this.detectFormat(filePath);
    const isSys = isSystemFontPath(filePath);
    const installScope: InstallScope = isSys ? 'system' : (sourceType === 'user' ? 'user' : 'uninstalled');
    const source: FontSourceType = isSys ? 'system' : sourceType;
    const now = new Date().toISOString();

    try {
      const opened = fontkit.openSync(filePath);
      const fonts: fontkit.Font[] = (opened as any).fonts ? (opened as any).fonts : [opened];

      const records: FontRecord[] = [];

      for (let i = 0; i < fonts.length; i++) {
        const f = fonts[i];
        const familyName = f.familyName || path.basename(filePath, path.extname(filePath));
        const styleName = f.subfamilyName || (fonts.length > 1 ? `Style ${i + 1}` : 'Regular');
        const postscriptName = f.postscriptName || undefined;
        const version = f.version || undefined;
        const copyright = f.copyright || undefined;

        // Character count and unicode ranges
        let characterCount = 0;
        const unicodeRanges: string[] = [];
        if (f.characterSet) {
          characterCount = f.characterSet.length;
          this.detectUnicodeRanges(f.characterSet, unicodeRanges);
        }

        // Generate deterministic internal ID based on file path and face index / style
        const idSource = `${filePath}::${i}::${familyName}::${styleName}`;
        const id = crypto.createHash('md5').update(idSource).digest('hex');

        records.push({
          id,
          family_name: familyName,
          style_name: styleName,
          postscript_name: postscriptName,
          file_path: filePath,
          format,
          file_size: fileSize,
          sha256,
          source_type: source,
          install_scope: installScope,
          scan_status: 'valid',
          version,
          copyright,
          glyph_count: f.numGlyphs || 0,
          character_count: characterCount,
          unicode_ranges: unicodeRanges.length > 0 ? unicodeRanges : undefined,
          last_scanned_at: now,
          created_at: now,
        });
      }

      return records;
    } catch (err: any) {
      // Corrupted, unreadable or unsupported font file - record gracefully without failing batch
      const fallbackName = path.basename(filePath, path.extname(filePath));
      const fallbackId = crypto.createHash('md5').update(`${filePath}::corrupted`).digest('hex');

      return [
        {
          id: fallbackId,
          family_name: fallbackName,
          style_name: 'Unknown',
          file_path: filePath,
          format,
          file_size: fileSize,
          sha256,
          source_type: source,
          install_scope: installScope,
          scan_status: err.message?.includes('unsupported') ? 'unsupported' : 'corrupted',
          version: undefined,
          last_scanned_at: now,
          created_at: now,
        },
      ];
    }
  }

  private detectUnicodeRanges(characterSet: number[], ranges: string[]): void {
    let hasLatin = false;
    let hasCjk = false;
    let hasCjkExt = false;
    let hasKana = false;
    let hasHangul = false;
    let hasCyrillic = false;
    let hasArabic = false;

    for (const cp of characterSet) {
      if (cp <= 0x024f) hasLatin = true;
      else if (cp >= 0x0400 && cp <= 0x04ff) hasCyrillic = true;
      else if (cp >= 0x0600 && cp <= 0x06ff) hasArabic = true;
      else if (cp >= 0x3040 && cp <= 0x30ff) hasKana = true;
      else if (cp >= 0xac00 && cp <= 0xd7af) hasHangul = true;
      else if (cp >= 0x4e00 && cp <= 0x9fff) hasCjk = true;
      else if (cp >= 0x3400 && cp <= 0x4dbf) hasCjkExt = true;
    }

    if (hasLatin) ranges.push('Latin');
    if (hasCjk) ranges.push('CJK Unified Ideographs');
    if (hasCjkExt) ranges.push('CJK Extension');
    if (hasKana) ranges.push('Japanese (Kana)');
    if (hasHangul) ranges.push('Korean (Hangul)');
    if (hasCyrillic) ranges.push('Cyrillic');
    if (hasArabic) ranges.push('Arabic');
  }
}

