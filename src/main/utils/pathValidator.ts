import * as path from 'path';
import * as fs from 'fs';

/**
 * Validates that a file path exists and is a valid file within reasonable constraints.
 */
export function isValidFilePath(filePath: string): boolean {
  if (!filePath || typeof filePath !== 'string') return false;
  // Disallow null bytes or invalid control chars
  if (filePath.includes('\0')) return false;

  try {
    const resolved = path.resolve(filePath);
    return fs.existsSync(resolved) && fs.statSync(resolved).isFile();
  } catch {
    return false;
  }
}

/**
 * Validates that a directory path exists.
 */
export function isValidDirectoryPath(dirPath: string): boolean {
  if (!dirPath || typeof dirPath !== 'string') return false;
  if (dirPath.includes('\0')) return false;

  try {
    const resolved = path.resolve(dirPath);
    return fs.existsSync(resolved) && fs.statSync(resolved).isDirectory();
  } catch {
    return false;
  }
}

const WINDOWS_RESERVED_NAMES = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..+)?$/i;

/**
 * Prevents Zip Slip vulnerability by ensuring target path stays strictly inside destination directory.
 * Disallows absolute paths, drive letters, UNC roots, leading slashes, reserved device names, and traversal segments ('..').
 */
export function isSafeArchivePath(destinationDir: string, relativePath: string): boolean {
  if (!destinationDir || !relativePath || typeof relativePath !== 'string') return false;
  if (relativePath.includes('\0')) return false;

  const normalized = relativePath.replace(/\\/g, '/');

  // Reject absolute paths, Windows drive specifiers, or UNC paths
  if (path.isAbsolute(relativePath) || path.win32.isAbsolute(relativePath)) return false;
  if (/^[a-zA-Z]:/.test(relativePath)) return false;
  if (normalized.startsWith('/') || normalized.startsWith('//') || relativePath.startsWith('\\\\')) return false;

  // Check for traversal segments and reserved Windows device names
  const segments = normalized.split('/');
  if (segments.some((seg) => seg === '..')) return false;
  if (segments.some((seg) => WINDOWS_RESERVED_NAMES.test(seg))) return false;

  const destResolved = path.resolve(destinationDir);
  const targetResolved = path.resolve(destinationDir, relativePath);

  return targetResolved.startsWith(destResolved + path.sep) || targetResolved === destResolved;
}

/**
 * Sanitizes a filename for Windows filesystem safety:
 * - Replaces illegal characters (/\:*?"<>|)
 * - Guards against Windows reserved names (CON, PRN, AUX, NUL, COM1-9, LPT1-9)
 * - Trims trailing dots and spaces
 * - Fallbacks to safe default if empty
 */
export function sanitizeWindowsFilename(rawName: string, fallbackPrefix = 'font'): string {
  if (!rawName || typeof rawName !== 'string') {
    return `${fallbackPrefix}_${Date.now()}.ttf`;
  }

  // Remove null bytes and control chars
  let clean = rawName.replace(/[\0\x01-\x1F]/g, '');
  // Replace illegal Windows filename chars
  clean = clean.replace(/[\/\\:\*\?"<>\|]/g, '_');
  // Trim trailing periods and spaces (prohibited by Windows)
  clean = clean.replace(/[\.\s]+$/, '');
  // Trim leading spaces
  clean = clean.trim();

  // Guard against Windows reserved device names
  if (WINDOWS_RESERVED_NAMES.test(clean)) {
    clean = `safe_${clean}`;
  }

  if (!clean || clean === '.' || clean === '..') {
    clean = `${fallbackPrefix}_${Date.now()}.ttf`;
  }

  return clean;
}

/**
 * Normalizes a Windows path to lowercase drive letter and uniform backslashes.
 */
export function normalizeWindowsPath(p: string): string {
  if (!p) return '';
  const resolved = path.resolve(p);
  // Match drive letter e.g. "c:\" or "C:\"
  if (/^[a-zA-Z]:/.test(resolved)) {
    return resolved.charAt(0).toLowerCase() + resolved.slice(1);
  }
  return resolved;
}

/**
 * Checks if a path is within the Windows protected system fonts directory (e.g. C:\Windows\Fonts).
 */
export function isSystemFontPath(filePath: string): boolean {
  const norm = normalizeWindowsPath(filePath).toLowerCase();
  const winDir = (process.env.WINDIR || 'C:\\Windows').toLowerCase();
  const sysFonts = path.join(winDir, 'fonts').toLowerCase();
  return norm.startsWith(sysFonts);
}

