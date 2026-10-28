import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { FontRecord, InstallScope } from '../../shared/types';
import { DatabaseService } from './databaseService';

const execFileAsync = promisify(execFile);

export interface InstallResult {
  success: boolean;
  installedPath?: string;
  alreadyInstalled?: boolean;
  requiresReboot?: boolean;
  error?: string;
}

export interface UninstallResult {
  success: boolean;
  requiresReboot?: boolean;
  error?: string;
}

export type ExecFileFunction = (file: string, args: string[]) => Promise<{ stdout: string; stderr: string }>;

// Protected Windows core and critical system fonts
export const PROTECTED_SYSTEM_FONTS = new Set([
  // Core Windows UI and shell fonts
  'segoe ui',
  'segoe ui variable',
  'segoe ui emoji',
  'segoe ui symbol',
  'segoe ui historic',
  'arial',
  'calibri',
  'consolas',
  'courier new',
  'tahoma',
  'times new roman',
  'trebuchet ms',
  'verdana',
  'impact',
  'georgia',
  'comic sans ms',
  'symbol',
  'wingdings',
  'webdings',
  'marlett',
  'ms sans serif',
  'ms serif',
  // Traditional & Simplified Chinese system fonts
  'microsoft jhenghei',
  'microsoft jhenghei ui',
  '微軟正黑體',
  'mingliu',
  'pmingliu',
  '細明體',
  '新細明體',
  'dfkai-sb',
  '標楷體',
  'microsoft yahei',
  'microsoft yahei ui',
  '微軟雅黑',
  'simhei',
  '黑體',
  'simsun',
  'nsimsun',
  '宋體',
  '新宋體',
  'kaiti',
  'fangsong',
  // Japanese & Korean system fonts
  'meiryo',
  'meiryo ui',
  'yu gothic',
  'yu gothic ui',
  'ms gothic',
  'ms pgothic',
  'ms mincho',
  'ms pmincho',
  'malgun gothic',
  'batang',
  'gulim',
  'dotum',
  'gungsuh',
]);

// Protected file base names (lowercase)
export const PROTECTED_FONT_FILES = new Set([
  'segoeui.ttf',
  'segoeuib.ttf',
  'segoeuii.ttf',
  'segoeuiz.ttf',
  'seguiemj.ttf',
  'seguisym.ttf',
  'seguihis.ttf',
  'arial.ttf',
  'arialbd.ttf',
  'ariali.ttf',
  'arialbi.ttf',
  'calibri.ttf',
  'calibrib.ttf',
  'calibrii.ttf',
  'calibriz.ttf',
  'consola.ttf',
  'consolab.ttf',
  'consolai.ttf',
  'consolaz.ttf',
  'cour.ttf',
  'courbd.ttf',
  'couri.ttf',
  'courbi.ttf',
  'tahoma.ttf',
  'tahomabd.ttf',
  'times.ttf',
  'timesbd.ttf',
  'timesi.ttf',
  'timesbi.ttf',
  'verdana.ttf',
  'verdanab.ttf',
  'verdanai.ttf',
  'verdanaz.ttf',
  'marlett.ttf',
  'msjh.ttc',
  'msjhbd.ttc',
  'msjhl.ttc',
  'mingliu.ttc',
  'kaiu.ttf',
  'msyh.ttc',
  'msyhbd.ttc',
  'simsun.ttc',
  'simhei.ttf',
  'meiryo.ttc',
  'malgun.ttf',
]);

export class FontInstallService {
  private db: DatabaseService;
  private userFontsDir: string;
  private execRunner: ExecFileFunction;
  private fontChangeNotifier: () => Promise<void>;

  constructor(
    db: DatabaseService,
    customUserFontsDir?: string,
    customExecRunner?: ExecFileFunction,
    customNotifier?: () => Promise<void>
  ) {
    this.db = db;
    if (customUserFontsDir) {
      this.userFontsDir = customUserFontsDir;
    } else {
      const localAppData =
        process.env.LOCALAPPDATA ||
        path.join(process.env.USERPROFILE || 'C:\\Users\\Default', 'AppData', 'Local');
      this.userFontsDir = path.join(localAppData, 'Microsoft', 'Windows', 'Fonts');
    }

    this.execRunner = customExecRunner || (async (file, args) => execFileAsync(file, args));
    this.fontChangeNotifier = customNotifier || (() => this.defaultBroadcastFontChange());
  }

  /**
   * Returns the user font installation directory (%LOCALAPPDATA%\Microsoft\Windows\Fonts)
   */
  public getUserFontsDir(): string {
    return this.userFontsDir;
  }

  /**
   * Evaluates if a font is a protected Windows system font.
   */
  public isProtectedFont(font: Pick<FontRecord, 'family_name' | 'localized_name' | 'postscript_name' | 'file_path' | 'install_scope'>): boolean {
    // 1. Direct system install scope check
    if (font.install_scope === 'system') {
      return true;
    }

    // 2. Windows system directory check
    const windir = process.env.WINDIR || 'C:\\Windows';
    const systemFontsDir = path.join(windir, 'Fonts').toLowerCase();
    const normalizedFilePath = font.file_path.toLowerCase();
    if (normalizedFilePath.startsWith(systemFontsDir)) {
      return true;
    }

    // 3. File basename check
    const baseName = path.basename(font.file_path).toLowerCase();
    if (PROTECTED_FONT_FILES.has(baseName)) {
      return true;
    }

    // 4. Family and localized name check
    const family = (font.family_name || '').trim().toLowerCase();
    const localized = (font.localized_name || '').trim().toLowerCase();
    const postscript = (font.postscript_name || '').trim().toLowerCase();

    if (PROTECTED_SYSTEM_FONTS.has(family) || PROTECTED_SYSTEM_FONTS.has(localized)) {
      return true;
    }

    for (const protectedName of PROTECTED_SYSTEM_FONTS) {
      if (family === protectedName || localized === protectedName) {
        return true;
      }
      if (postscript.includes(protectedName.replace(/\s+/g, ''))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Formats the Windows Font Registry Value Name according to Windows conventions.
   * e.g. "MyFont (TrueType)" or "MyFont Bold (OpenType)"
   */
  public getRegistryValueName(font: Pick<FontRecord, 'family_name' | 'style_name' | 'format'>): string {
    const isOtf = font.format === 'otf';
    const suffix = isOtf ? '(OpenType)' : '(TrueType)';
    const style = (font.style_name || '').trim();
    const family = (font.family_name || '').trim();

    if (style && style.toLowerCase() !== 'regular') {
      return `${family} ${style} ${suffix}`;
    }
    return `${family} ${suffix}`;
  }

  /**
   * Checks whether the current process has administrative elevation on Windows.
   */
  public async isElevated(): Promise<boolean> {
    if (process.platform !== 'win32') return false;
    try {
      // 'net session' exits with 0 if elevated, 2 if not elevated
      await this.execRunner('net.exe', ['session']);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Installs a font into Current User scope (%LOCALAPPDATA%\Microsoft\Windows\Fonts + HKCU Fonts).
   * Safe, non-elevated, clean rollback on registry failure.
   */
  public async installFontUserScope(font: FontRecord): Promise<InstallResult> {
    // 1. Format validation
    if (font.format === 'woff' || font.format === 'woff2') {
      return {
        success: false,
        error: `不支援直接安裝 ${font.format.toUpperCase()} 網頁字體格式。Windows 僅支援安裝 TTF、OTF 或 TTC 字體。`,
      };
    }
    if (font.format !== 'ttf' && font.format !== 'otf' && font.format !== 'ttc') {
      return {
        success: false,
        error: `不支援的字體格式: ${font.format}`,
      };
    }

    // 2. Source file existence and read check
    if (!fs.existsSync(font.file_path)) {
      return {
        success: false,
        error: `來源字體檔案不存在: ${font.file_path}`,
      };
    }

    try {
      // 3. Ensure target user fonts directory exists
      if (!fs.existsSync(this.userFontsDir)) {
        fs.mkdirSync(this.userFontsDir, { recursive: true });
      }

      const fileName = path.basename(font.file_path);
      const targetPath = path.join(this.userFontsDir, fileName);

      // Check if target already exists with the same content
      let fileCopied = false;
      if (fs.existsSync(targetPath)) {
        if (targetPath.toLowerCase() === font.file_path.toLowerCase()) {
          // Already in the user fonts directory
        } else {
          // Check file size / content
          const sourceStats = fs.statSync(font.file_path);
          const targetStats = fs.statSync(targetPath);
          if (sourceStats.size === targetStats.size && font.sha256) {
            // Verify registry entry
            const valName = this.getRegistryValueName(font);
            const regExists = await this.checkRegistryEntryExists('HKCU\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Fonts', valName);
            if (regExists) {
              this.db.updateFontInstallScope(font.id, 'user', targetPath);
              return { success: true, installedPath: targetPath, alreadyInstalled: true };
            }
          }
          // If different or not registered, copy over target safely
          fs.copyFileSync(font.file_path, targetPath);
          fileCopied = true;
        }
      } else {
        fs.copyFileSync(font.file_path, targetPath);
        fileCopied = true;
      }

      // 4. Register in Windows Registry under HKCU
      const valueName = this.getRegistryValueName(font);
      const regKey = 'HKCU\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Fonts';

      try {
        await this.execRunner('reg.exe', [
          'add',
          regKey,
          '/v',
          valueName,
          '/t',
          'REG_SZ',
          '/d',
          targetPath,
          '/f',
        ]);
      } catch (regErr: any) {
        // Rollback: delete copied file if we created it
        if (fileCopied && fs.existsSync(targetPath)) {
          try {
            fs.unlinkSync(targetPath);
          } catch {}
        }
        return {
          success: false,
          error: `寫入 Windows 登錄機碼失敗: ${regErr?.message || String(regErr)}`,
        };
      }

      // 5. Verify registry write
      const verified = await this.checkRegistryEntryExists(regKey, valueName);
      if (!verified) {
        if (fileCopied && fs.existsSync(targetPath)) {
          try {
            fs.unlinkSync(targetPath);
          } catch {}
        }
        return {
          success: false,
          error: 'Windows 登錄驗證失敗：登錄機碼未正確寫入。',
        };
      }

      // 6. Broadcast WM_FONTCHANGE to inform Windows applications
      try {
        await this.fontChangeNotifier();
      } catch (notifyErr) {
        console.warn('WM_FONTCHANGE broadcast warning:', notifyErr);
      }

      // 7. Update SQLite record
      this.db.updateFontInstallScope(font.id, 'user', targetPath);

      return {
        success: true,
        installedPath: targetPath,
      };
    } catch (err: any) {
      return {
        success: false,
        error: `安裝字體時發生未預期錯誤: ${err?.message || String(err)}`,
      };
    }
  }

  /**
   * Uninstalls a font installed in User Scope.
   * Strictly forbids uninstalling protected or system fonts.
   */
  public async uninstallFontUserScope(font: FontRecord): Promise<UninstallResult> {
    // 1. Guard against protected system fonts
    if (this.isProtectedFont(font)) {
      return {
        success: false,
        error: `字體「${font.family_name}」為 Windows 核心系統受保護字體，禁止卸載以維持系統穩定。`,
      };
    }

    // 2. Guard against system-wide installed fonts or fonts outside user directory
    if (font.install_scope === 'system') {
      return {
        success: false,
        error: `字體「${font.family_name}」為系統層級安裝之字體，無法以使用者層級權限卸載。`,
      };
    }

    const normalizedPath = font.file_path.toLowerCase();
    const normalizedUserFontsDir = this.userFontsDir.toLowerCase();
    const isLocatedInUserFontsDir = normalizedPath.startsWith(normalizedUserFontsDir);

    // 3. Remove registry entry from HKCU
    const valueName = this.getRegistryValueName(font);
    const regKey = 'HKCU\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Fonts';

    try {
      await this.execRunner('reg.exe', [
        'delete',
        regKey,
        '/v',
        valueName,
        '/f',
      ]);
    } catch (regErr: any) {
      // Check if the registry entry actually existed; if it did not, continue
      const exists = await this.checkRegistryEntryExists(regKey, valueName);
      if (exists) {
        return {
          success: false,
          error: `刪除 Windows 登錄機碼失敗: ${regErr?.message || String(regErr)}`,
        };
      }
    }

    // 4. Physical file deletion if it resides in the user fonts directory
    let requiresReboot = false;
    if (isLocatedInUserFontsDir && fs.existsSync(font.file_path)) {
      // Check if other active fonts share this exact file (e.g. multi-face TTC)
      const allFonts = this.db.getAllFonts();
      const sharedCount = allFonts.filter(
        (f) => f.id !== font.id && f.file_path.toLowerCase() === normalizedPath && f.install_scope === 'user'
      ).length;

      if (sharedCount === 0) {
        try {
          fs.unlinkSync(font.file_path);
        } catch (unlinkErr: any) {
          // If Windows or another app holds a lock on the file
          if (unlinkErr.code === 'EBUSY' || unlinkErr.code === 'EPERM' || unlinkErr.code === 'EACCES') {
            requiresReboot = true;
          } else {
            return {
              success: false,
              error: `刪除字體檔案失敗: ${unlinkErr.message}`,
            };
          }
        }
      }
    }

    // 5. Broadcast WM_FONTCHANGE
    try {
      await this.fontChangeNotifier();
    } catch (notifyErr) {
      console.warn('WM_FONTCHANGE broadcast warning:', notifyErr);
    }

    // 6. Update SQLite record
    this.db.updateFontInstallScope(font.id, 'uninstalled');

    return {
      success: true,
      requiresReboot,
    };
  }

  /**
   * Safe check for registry entry presence via reg query.
   */
  public async checkRegistryEntryExists(key: string, valueName: string): Promise<boolean> {
    try {
      const { stdout } = await this.execRunner('reg.exe', ['query', key, '/v', valueName]);
      return stdout.includes(valueName);
    } catch {
      return false;
    }
  }

  /**
   * Default WM_FONTCHANGE broadcaster using safe fixed PowerShell command (no dynamic arguments).
   */
  private async defaultBroadcastFontChange(): Promise<void> {
    if (process.platform !== 'win32') return;

    // Fixed constant script with zero user variables
    const staticScript = [
      '$HWND_BROADCAST = [IntPtr]0xffff;',
      '$WM_FONTCHANGE = 0x001d;',
      'Add-Type -TypeDefinition @"',
      'using System;',
      'using System.Runtime.InteropServices;',
      'public class FontNotifier {',
      '  [DllImport("user32.dll", SetLastError = true)]',
      '  public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, UIntPtr wParam, IntPtr lParam, uint fuFlags, uint uTimeout, out UIntPtr lpdwResult);',
      '}',
      '"@;',
      '[UIntPtr]$res = [UIntPtr]::Zero;',
      '[FontNotifier]::SendMessageTimeout($HWND_BROADCAST, $WM_FONTCHANGE, [UIntPtr]::Zero, [IntPtr]::Zero, 2, 1000, [ref]$res);',
    ].join(' ');

    await this.execRunner('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', staticScript]);
  }
}
