import { describe, it, expect } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { calculateSha256, calculateFileSha256 } from '../src/main/utils/hash';
import {
  isValidFilePath,
  isValidDirectoryPath,
  isSafeArchivePath,
  isSystemFontPath,
  normalizeWindowsPath,
} from '../src/main/utils/pathValidator';

describe('Hash Utilities', () => {
  it('calculates sha256 for strings and buffers correctly', () => {
    const input = 'Font Studio Test String';
    const hash1 = calculateSha256(input);
    const hash2 = calculateSha256(Buffer.from(input, 'utf-8'));
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it('calculates sha256 for actual files accurately', async () => {
    const tempFile = path.join(os.tmpdir(), `hash_test_${Date.now()}.txt`);
    fs.writeFileSync(tempFile, 'Hello Typography World', 'utf-8');

    const fileHash = await calculateFileSha256(tempFile);
    const directHash = calculateSha256('Hello Typography World');
    expect(fileHash).toBe(directHash);

    fs.unlinkSync(tempFile);
  });
});

describe('Path Validator Utilities', () => {
  it('identifies valid and invalid files', () => {
    const tempFile = path.join(os.tmpdir(), `path_test_${Date.now()}.txt`);
    fs.writeFileSync(tempFile, 'dummy', 'utf-8');

    expect(isValidFilePath(tempFile)).toBe(true);
    expect(isValidFilePath(tempFile + '_non_existent')).toBe(false);
    expect(isValidFilePath('')).toBe(false);
    expect(isValidFilePath('null\0byte')).toBe(false);

    fs.unlinkSync(tempFile);
  });

  it('identifies valid directories', () => {
    expect(isValidDirectoryPath(os.tmpdir())).toBe(true);
    expect(isValidDirectoryPath(path.join(os.tmpdir(), 'non_existent_folder_abc'))).toBe(false);
  });

  it('prevents Zip Slip path traversal attacks', () => {
    const baseDir = path.resolve(os.tmpdir(), 'font_restore_test');

    // Safe paths
    expect(isSafeArchivePath(baseDir, 'fonts/arial.ttf')).toBe(true);
    expect(isSafeArchivePath(baseDir, 'roboto.otf')).toBe(true);
    expect(isSafeArchivePath(baseDir, 'subfolder/deep/font.woff2')).toBe(true);

    // Malicious traversal paths
    expect(isSafeArchivePath(baseDir, '../escape.ttf')).toBe(false);
    expect(isSafeArchivePath(baseDir, '../../Windows/System32/evil.dll')).toBe(false);
    expect(isSafeArchivePath(baseDir, 'fonts/../../Windows/System32')).toBe(false);
    expect(isSafeArchivePath(baseDir, 'fonts/null\0byte.ttf')).toBe(false);
  });

  it('identifies Windows protected system fonts directory', () => {
    expect(isSystemFontPath('C:\\Windows\\Fonts\\arial.ttf')).toBe(true);
    expect(isSystemFontPath('c:\\windows\\fonts\\segoeui.ttf')).toBe(true);
    expect(isSystemFontPath('D:\\MyFonts\\custom.ttf')).toBe(false);
    expect(isSystemFontPath('C:\\Users\\User\\AppData\\Local\\Microsoft\\Windows\\Fonts\\user.ttf')).toBe(false);
  });

  it('normalizes windows paths properly', () => {
    const normalized = normalizeWindowsPath('C:\\Windows\\System32');
    expect(normalized.startsWith('c:\\')).toBe(true);
  });
});

