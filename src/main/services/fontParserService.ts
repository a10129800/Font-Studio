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
    let fileSize = 0;
    let sha256 = '';
    const format = this.detectFormat(filePath);
    const isSys = isSystemFontPath(filePath);
    const installScope: InstallScope = isSys ? 'system' : (sourceType === 'user' ? 'user' : 'uninstalled');
    const source: FontSourceType = isSys ? 'system' : sourceType;
    const now = new Date().toISOString();

    try {
      const stats = await fs.promises.stat(filePath);
      fileSize = stats.size;
      sha256 = await calculateFileSha256(filePath);
    } catch (fsErr: any) {
      // Unreadable or permission denied
      const fallbackName = path.basename(filePath, path.extname(filePath));
      const fallbackId = crypto.createHash('md5').update(`${filePath}::unreadable`).digest('hex');
      return [
        {
          id: fallbackId,
          family_name: fallbackName,
          style_name: 'Unknown',
          file_path: filePath,
          format,
          file_size: fileSize,
          sha256: sha256 || '0'.repeat(64),
          source_type: source,
          install_scope: installScope,
          scan_status: 'unreadable',
          face_index: 0,
          face_count: 1,
          is_missing: false,
          last_scanned_at: now,
          created_at: now,
        },
      ];
    }

    try {
      const opened = fontkit.openSync(filePath);
      const fonts: fontkit.Font[] = (opened as any).fonts ? (opened as any).fonts : [opened];
      const records: FontRecord[] = [];

      for (let i = 0; i < fonts.length; i++) {
        const f = fonts[i];
        const nameRecords = (f as any)['name']?.records || {};

        // Localized name resolution (e.g. Traditional Chinese "微軟正黑體")
        const localizedFamily = this.extractLocalizedName(nameRecords.fontFamily);
        const localizedFull = this.extractLocalizedName(nameRecords.fullName);
        const localizedName = localizedFamily || localizedFull || undefined;

        // English / Primary name resolution
        const englishFamily = this.extractPrimaryName(nameRecords.fontFamily, f.familyName || path.basename(filePath, path.extname(filePath)));
        const englishFull = this.extractPrimaryName(nameRecords.fullName, '');

        const familyName = englishFamily;
        const fullName = englishFull || (localizedName ? `${familyName} (${localizedName})` : familyName);
        const styleName = f.subfamilyName || (fonts.length > 1 ? `Style ${i + 1}` : 'Regular');
        const postscriptName = f.postscriptName || undefined;
        const version = f.version || undefined;
        const copyright = f.copyright || undefined;
        const designer = this.extractPrimaryName(nameRecords.designer, (f as any).designer || '');

        // Character count and unicode ranges
        let characterCount = 0;
        const unicodeRanges: string[] = [];
        if (f.characterSet) {
          characterCount = f.characterSet.length;
          this.detectUnicodeRanges(f.characterSet, unicodeRanges);
        }

        // Generate deterministic internal ID based on file path and face index
        const id = crypto.createHash('md5').update(`${filePath}::${i}`).digest('hex');

        records.push({
          id,
          family_name: familyName,
          localized_name: localizedName,
          full_name: fullName,
          style_name: styleName,
          postscript_name: postscriptName,
          file_path: filePath,
          format,
          file_size: fileSize,
          sha256,
          source_type: source,
          install_scope: installScope,
          scan_status: 'valid',
          face_index: i,
          face_count: fonts.length,
          is_missing: false,
          version,
          designer: designer || undefined,
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
      const fallbackId = crypto.createHash('md5').update(`${filePath}::0`).digest('hex');

      const isSupportedFormat = format === 'ttf' || format === 'otf' || format === 'ttc' || format === 'woff' || format === 'woff2';
      const scanStatus: ScanStatus = isSupportedFormat ? 'corrupted' : 'unsupported';

      return [
        {
          id: fallbackId,
          family_name: fallbackName,
          style_name: 'Unknown',
          file_path: filePath,
          format,
          file_size: fileSize,
          sha256: sha256,
          source_type: source,
          install_scope: installScope,
          scan_status: scanStatus,
          face_index: 0,
          face_count: 1,
          is_missing: false,
          version: undefined,
          last_scanned_at: now,
          created_at: now,
        },
      ];
    }
  }

  private extractLocalizedName(recordObj: any): string | undefined {
    if (!recordObj || typeof recordObj !== 'object') return undefined;
    // Priority: Traditional Chinese (zh-TW, zh-HK, zh-Hant), Simplified Chinese (zh-CN, zh-Hans, zh), Japanese (ja)
    return (
      recordObj['zh-TW'] ||
      recordObj['zh-HK'] ||
      recordObj['zh-Hant'] ||
      recordObj['zh-CN'] ||
      recordObj['zh-Hans'] ||
      recordObj['zh'] ||
      recordObj['ja'] ||
      undefined
    );
  }

  private extractPrimaryName(recordObj: any, fallback: string): string {
    if (!recordObj || typeof recordObj !== 'object') return fallback;
    return recordObj['en'] || recordObj['en-US'] || recordObj['en-GB'] || (Object.values(recordObj)[0] as string) || fallback;
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
    if (hasCjk) ranges.push('CJK Unified Ideographs (繁簡漢字)');
    if (hasCjkExt) ranges.push('CJK Extension (漢字擴展)');
    if (hasKana) ranges.push('Japanese (Kana 日文假名)');
    if (hasHangul) ranges.push('Korean (Hangul 韓文諺文)');
    if (hasCyrillic) ranges.push('Cyrillic (西里爾字母)');
    if (hasArabic) ranges.push('Arabic (阿拉伯文)');
  }
}
