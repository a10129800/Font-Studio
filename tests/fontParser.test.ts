import { describe, it, expect } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { FontParserService } from '../src/main/services/fontParserService';

describe('FontParserService', () => {
  const parser = new FontParserService();

  it('detects font formats accurately from extension', () => {
    expect(parser.detectFormat('arial.ttf')).toBe('ttf');
    expect(parser.detectFormat('helvetica.otf')).toBe('otf');
    expect(parser.detectFormat('webfont.woff')).toBe('woff');
    expect(parser.detectFormat('webfont.woff2')).toBe('woff2');
    expect(parser.detectFormat('collection.ttc')).toBe('ttc');
    expect(parser.detectFormat('unknown.bin')).toBe('unknown');
  });

  it('handles corrupted font files gracefully without throwing exception', async () => {
    const tempFile = path.join(os.tmpdir(), `corrupt_font_${Date.now()}.ttf`);
    fs.writeFileSync(tempFile, 'this is completely invalid binary font data');

    const records = await parser.parseFontFile(tempFile, 'imported');
    expect(records).toHaveLength(1);
    expect(records[0].scan_status).toBe('corrupted');
    expect(records[0].format).toBe('ttf');
    expect(records[0].file_size).toBeGreaterThan(0);

    fs.unlinkSync(tempFile);
  });

  it('parses real Windows system font if available', async () => {
    const arialPath = 'C:\\Windows\\Fonts\\arial.ttf';
    if (fs.existsSync(arialPath)) {
      const records = await parser.parseFontFile(arialPath, 'system');
      expect(records.length).toBeGreaterThanOrEqual(1);
      const font = records[0];
      expect(font.family_name).toBe('Arial');
      expect(font.format).toBe('ttf');
      expect(font.scan_status).toBe('valid');
      expect(font.source_type).toBe('system');
      expect(font.install_scope).toBe('system');
      expect(font.glyph_count).toBeGreaterThan(100);
      expect(font.character_count).toBeGreaterThan(100);
      expect(font.unicode_ranges).toContain('Latin');
    }
  });
});

