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

/**
 * Prevents Zip Slip vulnerability by ensuring target path stays strictly inside destination directory.
 */
export function isSafeArchivePath(destinationDir: string, relativePath: string): boolean {
  if (!destinationDir || !relativePath) return false;
  if (relativePath.includes('\0')) return false;

  const destResolved = path.resolve(destinationDir);
  const targetResolved = path.resolve(destinationDir, relativePath);

  // targetResolved must start with destResolved + separator
  return targetResolved.startsWith(destResolved + path.sep) || targetResolved === destResolved;
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

