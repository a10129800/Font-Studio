import React, { useState, useEffect } from 'react';
import {
  Archive,
  ShieldCheck,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileArchive,
  FolderOpen,
  Copy,
  Check,
  Loader2,
  RefreshCw,
  Folder,
  Tag,
  Heart,
  ChevronRight,
} from 'lucide-react';
import {
  FontRecord,
  CollectionRecord,
  BackupVerificationResult,
  BackupProgressUpdate,
  BackupResult,
  RestoreResult,
  RestoreConflictPolicy,
} from '../../../../shared/types';

interface BackupViewProps {
  fonts: FontRecord[];
  collections: CollectionRecord[];
  selectedFontIds: Set<string>;
  onSelectSavePath: (defaultName: string) => Promise<string | null>;
  onSelectZipFile: () => Promise<string | null>;
  onSelectFolder: () => Promise<string | null>;
  onRefreshData?: () => Promise<void>;
}

export const BackupView: React.FC<BackupViewProps> = ({
  fonts,
  collections,
  selectedFontIds,
  onSelectSavePath,
  onSelectZipFile,
  onSelectFolder,
  onRefreshData,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'create' | 'restore'>('create');
  const api = typeof window !== 'undefined' ? window.fontStudioAPI : undefined;

  // ==================== Create Backup State ====================
  const [backupScope, setBackupScope] = useState<'all' | 'selected' | 'collection'>('all');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('');
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupProgress, setBackupProgress] = useState<BackupProgressUpdate | null>(null);
  const [backupResult, setBackupResult] = useState<BackupResult | null>(null);
  const [copiedSha, setCopiedSha] = useState(false);

  // ==================== Verify & Restore State ====================
  const [selectedZipPath, setSelectedZipPath] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<BackupVerificationResult | null>(null);
  const [restoreTargetDir, setRestoreTargetDir] = useState<string>('');
  const [conflictPolicy, setConflictPolicy] = useState<RestoreConflictPolicy>('rename');
  const [importCollections, setImportCollections] = useState(true);
  const [importTags, setImportTags] = useState(true);
  const [importFavorites, setImportFavorites] = useState(true);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState<BackupProgressUpdate | null>(null);
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null);

  // Subscribe to real backup progress events
  useEffect(() => {
    if (!api) return;
    const unsubscribe = api.backup.onProgress((update: BackupProgressUpdate) => {
      if (update.type === 'backup') {
        setBackupProgress(update);
        if (update.phase === 'completed' || update.phase === 'error' || update.phase === 'cancelled') {
          setIsBackingUp(false);
        }
      } else if (update.type === 'restore') {
        setRestoreProgress(update);
        if (update.phase === 'completed' || update.phase === 'error' || update.phase === 'cancelled') {
          setIsRestoring(false);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [api]);

  // Compute font count for chosen scope
  const targetFontCount = (() => {
    if (backupScope === 'selected') return selectedFontIds.size;
    if (backupScope === 'collection') {
      const col = collections.find((c) => c.id === selectedCollectionId);
      return col?.font_count || 0;
    }
    return fonts.length;
  })();

  // Trigger Create Backup
  const handleStartBackup = async () => {
    if (!api) return;

    // Generate smart default filename: FontStudio_Backup_YYYYMMDD_HHmmss.zip
    const now = new Date();
    const dateStr = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const defaultName = `FontStudio_Backup_${dateStr}.zip`;

    const savePath = await onSelectSavePath(defaultName);
    if (!savePath) return;

    setIsBackingUp(true);
    setBackupResult(null);

    const options: { fontIds?: string[]; collectionId?: string; includeAll?: boolean } = {};
    if (backupScope === 'selected') {
      options.fontIds = Array.from(selectedFontIds);
    } else if (backupScope === 'collection') {
      options.collectionId = selectedCollectionId;
    } else {
      options.includeAll = true;
    }

    try {
      const result = await api.backup.create(savePath, options);
      setBackupResult(result);
    } catch (err: any) {
      setBackupResult({
        success: false,
        fontCount: 0,
        failedCount: 0,
        failedItems: [],
        error: err.message || String(err),
      });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleCancelBackup = async () => {
    if (!api || !backupProgress?.taskId) return;
    await api.backup.cancelTask(backupProgress.taskId);
  };

  // Trigger Select ZIP & Verify
  const handleSelectAndVerifyZip = async () => {
    if (!api) return;
    const zipPath = await onSelectZipFile();
    if (!zipPath) return;

    setSelectedZipPath(zipPath);
    setIsVerifying(true);
    setVerificationResult(null);
    setRestoreResult(null);

    try {
      const verifyRes = await api.backup.verify(zipPath);
      setVerificationResult(verifyRes);
    } catch (err: any) {
      setVerificationResult({
        valid: false,
        fontCount: 0,
        totalSizeBytes: 0,
        issues: [`驗證失敗: ${err.message}`],
        disclaimer: '校驗失敗',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // Choose Restore Directory
  const handleChooseRestoreDir = async () => {
    const dir = await onSelectFolder();
    if (dir) {
      setRestoreTargetDir(dir);
    }
  };

  // Trigger Restore
  const handleStartRestore = async () => {
    if (!api || !selectedZipPath || !restoreTargetDir) return;

    setIsRestoring(true);
    setRestoreResult(null);

    try {
      const result = await api.backup.restore({
        zipPath: selectedZipPath,
        targetDirectory: restoreTargetDir,
        conflictPolicy,
        importMetadata: {
          collections: importCollections,
          tags: importTags,
          favorites: importFavorites,
        },
      });

      setRestoreResult(result);
      if (onRefreshData) {
        await onRefreshData();
      }
    } catch (err: any) {
      setRestoreResult({
        success: false,
        restoredCount: 0,
        skippedCount: 0,
        failedCount: 0,
        restoredFiles: [],
        errors: [{ item: 'restore', error: err.message || String(err) }],
        error: err.message,
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleCancelRestore = async () => {
    if (!api || !restoreProgress?.taskId) return;
    await api.backup.cancelTask(restoreProgress.taskId);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSha(true);
    setTimeout(() => setCopiedSha(false), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6 select-none">
      {/* Title Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Archive className="w-5 h-5 text-brand-400" />
            <span>字體備份、驗證與無損還原</span>
          </h2>
          <p className="text-xs text-studio-400 mt-1">
            完整備份原始字體檔、中繼資訊、分類收藏庫與自訂標籤，並透過 SHA-256 清單與 Zip Slip 防護保證資料安全。
          </p>
        </div>

        {/* Sub-tab Switcher */}
        <div className="flex bg-studio-900 border border-studio-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveSubTab('create')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeSubTab === 'create'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-studio-400 hover:text-white'
            }`}
          >
            建立備份 (Backup)
          </button>
          <button
            onClick={() => setActiveSubTab('restore')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeSubTab === 'restore'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-studio-400 hover:text-white'
            }`}
          >
            驗證與還原 (Restore)
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: 建立備份                                          */}
      {/* ======================================================== */}
      {activeSubTab === 'create' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-studio-900 border border-studio-800 space-y-5">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Download className="w-4 h-4 text-brand-400" />
              <span>設定備份範圍與參數</span>
            </h3>

            {/* Scope Selection */}
            <div className="grid grid-cols-3 gap-4">
              <div
                onClick={() => setBackupScope('all')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  backupScope === 'all'
                    ? 'bg-brand-500/10 border-brand-500 text-white'
                    : 'bg-studio-950 border-studio-800 text-studio-300 hover:border-studio-700'
                }`}
              >
                <div className="font-semibold text-xs flex items-center justify-between">
                  <span>全部已索引字體</span>
                  <span className="font-mono text-[11px] text-brand-400">{fonts.length}</span>
                </div>
                <p className="text-[11px] text-studio-400 mt-1">打包目前資料庫中所有可讀取之字體檔案與完整關聯。</p>
              </div>

              <div
                onClick={() => {
                  if (selectedFontIds.size > 0) setBackupScope('selected');
                }}
                className={`p-4 rounded-xl border transition-all ${
                  selectedFontIds.size === 0
                    ? 'opacity-40 cursor-not-allowed bg-studio-950 border-studio-800 text-studio-500'
                    : backupScope === 'selected'
                    ? 'bg-brand-500/10 border-brand-500 text-white cursor-pointer'
                    : 'bg-studio-950 border-studio-800 text-studio-300 hover:border-studio-700 cursor-pointer'
                }`}
              >
                <div className="font-semibold text-xs flex items-center justify-between">
                  <span>目前選取的字體</span>
                  <span className="font-mono text-[11px] text-brand-400">{selectedFontIds.size}</span>
                </div>
                <p className="text-[11px] text-studio-400 mt-1">
                  {selectedFontIds.size === 0 ? '尚未選取任何字體卡片' : `僅打包目前勾選的 ${selectedFontIds.size} 個字體`}
                </p>
              </div>

              <div
                onClick={() => setBackupScope('collection')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  backupScope === 'collection'
                    ? 'bg-brand-500/10 border-brand-500 text-white'
                    : 'bg-studio-950 border-studio-800 text-studio-300 hover:border-studio-700'
                }`}
              >
                <div className="font-semibold text-xs flex items-center justify-between">
                  <span>指定分類庫字體</span>
                  <Folder className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <p className="text-[11px] text-studio-400 mt-1">選取特定分類專案資料庫進行單獨打包備份。</p>
              </div>
            </div>

            {/* Collection Dropdown if Collection Scope */}
            {backupScope === 'collection' && (
              <div className="p-4 rounded-xl bg-studio-950 border border-studio-800 flex items-center gap-3">
                <span className="text-xs text-studio-300 whitespace-nowrap">選擇備份分類:</span>
                <select
                  value={selectedCollectionId}
                  onChange={(e) => setSelectedCollectionId(e.target.value)}
                  className="bg-studio-900 border border-studio-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="">-- 請選擇分類 --</option>
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.font_count || 0} 個字體)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-2 border-t border-studio-800">
              <div className="text-xs text-studio-400">
                預計打包字體數量: <span className="font-mono font-bold text-white">{targetFontCount}</span> 個
              </div>

              {!isBackingUp ? (
                <button
                  onClick={handleStartBackup}
                  disabled={targetFontCount === 0}
                  className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-xs font-semibold text-white shadow-sm transition-all disabled:opacity-40"
                >
                  選擇目標位置並開始備份
                </button>
              ) : (
                <button
                  onClick={handleCancelBackup}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white flex items-center gap-1.5 transition-all"
                >
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>中止備份</span>
                </button>
              )}
            </div>

            {/* Live Backup Progress */}
            {isBackingUp && backupProgress && (
              <div className="p-4 rounded-xl bg-studio-950 border border-studio-800 space-y-2 text-xs">
                <div className="flex justify-between text-studio-400 text-[11px]">
                  <span className="truncate max-w-[70%]">正在打包: {backupProgress.currentItem}</span>
                  <span className="font-mono text-white">
                    {backupProgress.total > 0
                      ? Math.round((backupProgress.current / backupProgress.total) * 100)
                      : 0}
                    %
                  </span>
                </div>
                <div className="w-full h-2 bg-studio-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-500 transition-all duration-200"
                    style={{
                      width: `${
                        backupProgress.total > 0
                          ? Math.round((backupProgress.current / backupProgress.total) * 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Backup Result Card */}
            {backupResult && (
              <div
                className={`p-5 rounded-xl border space-y-3 ${
                  backupResult.success
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-sm">
                  {backupResult.success ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      <span>備份成功完成！</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5 text-rose-400" />
                      <span>備份失敗: {backupResult.error}</span>
                    </>
                  )}
                </div>

                {backupResult.success && (
                  <div className="space-y-1.5 text-xs text-studio-300">
                    <p>
                      <span className="text-studio-400">儲存路徑:</span>{' '}
                      <span className="font-mono text-white break-all">{backupResult.archivePath}</span>
                    </p>
                    <p>
                      <span className="text-studio-400">檔案大小:</span>{' '}
                      <span className="font-mono text-white">
                        {((backupResult.archiveSize || 0) / (1024 * 1024)).toFixed(2)} MB
                      </span>
                      <span className="mx-2">|</span>
                      <span className="text-studio-400">封裝字體:</span>{' '}
                      <span className="font-mono text-white">{backupResult.fontCount} 個</span>
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-studio-400">ZIP SHA-256:</span>
                      <span className="font-mono text-[11px] bg-studio-950 px-2 py-0.5 rounded border border-studio-800 text-studio-200 break-all">
                        {backupResult.sha256}
                      </span>
                      <button
                        onClick={() => backupResult.sha256 && copyToClipboard(backupResult.sha256)}
                        className="p-1 hover:text-white"
                        title="複製 SHA-256"
                      >
                        {copiedSha ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    {backupResult.failedItems && backupResult.failedItems.length > 0 && (
                      <div className="mt-3 p-3 rounded-lg bg-rose-950/40 border border-rose-900 text-rose-300 text-[11px] space-y-1">
                        <div className="font-semibold">部分字體無法讀取已略過 ({backupResult.failedItems.length} 個):</div>
                        {backupResult.failedItems.map((fi, idx) => (
                          <div key={idx} className="font-mono text-[10px]">
                            • {fi.family_name || fi.file_path}: {fi.error}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: 驗證與還原                                        */}
      {/* ======================================================== */}
      {activeSubTab === 'restore' && (
        <div className="space-y-6">
          {/* Step 1: Select Archive */}
          <div className="p-6 rounded-2xl bg-studio-900 border border-studio-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileArchive className="w-4 h-4 text-emerald-400" />
                  <span>第一步：選取備份 ZIP 檔案並進行安全驗證</span>
                </h3>
                <p className="text-xs text-studio-400 mt-1">
                  系統將完整校驗 ZIP 架構、manifest.json 清單、SHA-256 完整性及 Zip Slip 防禦。
                </p>
              </div>

              <button
                onClick={handleSelectAndVerifyZip}
                disabled={isVerifying}
                className="px-4 py-2 rounded-xl bg-studio-800 hover:bg-studio-700 border border-studio-700 text-xs font-semibold text-white transition-all flex items-center gap-2"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>正在校驗壓縮包...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    <span>選取備份檔案 (.zip)</span>
                  </>
                )}
              </button>
            </div>

            {selectedZipPath && (
              <div className="p-3 bg-studio-950 rounded-xl border border-studio-800 font-mono text-xs text-studio-300 flex items-center justify-between break-all">
                <span>路徑: {selectedZipPath}</span>
              </div>
            )}

            {/* Verification Result Panel */}
            {verificationResult && (
              <div
                className={`p-5 rounded-xl border space-y-3 text-xs ${
                  verificationResult.valid
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-sm">
                  {verificationResult.valid ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      <span>ZIP 檔案與 SHA-256 校驗全部通過！</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-5 h-5 text-rose-400" />
                      <span>備份校驗未通過，請勿還原此檔案！</span>
                    </>
                  )}
                </div>

                {verificationResult.valid && verificationResult.manifest && (
                  <div className="space-y-2 text-studio-300">
                    <div className="grid grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
                      <div className="p-2 rounded bg-studio-950/80 border border-studio-800">
                        <div className="text-studio-500">清單版本</div>
                        <div className="text-white font-bold">{verificationResult.manifestVersion}</div>
                      </div>
                      <div className="p-2 rounded bg-studio-950/80 border border-studio-800">
                        <div className="text-studio-500">字體數量</div>
                        <div className="text-white font-bold">{verificationResult.fontCount} 個</div>
                      </div>
                      <div className="p-2 rounded bg-studio-950/80 border border-studio-800">
                        <div className="text-studio-500">總字體容量</div>
                        <div className="text-white font-bold">
                          {((verificationResult.totalSizeBytes || 0) / (1024 * 1024)).toFixed(2)} MB
                        </div>
                      </div>
                      <div className="p-2 rounded bg-studio-950/80 border border-studio-800">
                        <div className="text-studio-500">包含分類 / 標籤</div>
                        <div className="text-white font-bold">
                          {verificationResult.manifest.collections?.length || 0} /{' '}
                          {verificationResult.manifest.tags?.length || 0}
                        </div>
                      </div>
                    </div>

                    <div className="text-[11px] text-studio-400 pt-1">
                      ZIP SHA-256: <span className="font-mono text-studio-200">{verificationResult.archiveSha256}</span>
                    </div>

                    {/* Security Disclaimer */}
                    <div className="p-2.5 rounded-lg bg-studio-950/90 border border-studio-800 text-[11px] text-studio-400 leading-relaxed">
                      <span className="text-amber-400 font-semibold">安全性提示: </span>
                      {verificationResult.disclaimer}
                    </div>
                  </div>
                )}

                {verificationResult.issues.length > 0 && (
                  <div className="space-y-1 text-[11px] font-mono text-rose-300">
                    <div className="font-bold">發現問題:</div>
                    {verificationResult.issues.map((iss, i) => (
                      <div key={i}>• {iss}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 2: Destination & Restore Settings (Only if valid) */}
          {verificationResult?.valid && verificationResult.manifest && (
            <div className="p-6 rounded-2xl bg-studio-900 border border-studio-800 space-y-5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-brand-400" />
                <span>第二步：選擇還原目標資料夾與衝突設定</span>
              </h3>

              {/* Destination Directory Picker */}
              <div className="space-y-1.5">
                <label className="text-xs text-studio-300 font-medium">還原字體檔案至指定資料夾 (不直接寫入系統):</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    placeholder="請點擊右側按鈕選擇還原資料夾..."
                    value={restoreTargetDir}
                    className="flex-1 bg-studio-950 border border-studio-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-studio-500 font-mono"
                  />
                  <button
                    onClick={handleChooseRestoreDir}
                    className="px-4 py-2 rounded-xl bg-studio-800 hover:bg-studio-700 text-xs font-semibold text-white border border-studio-700 transition-all flex items-center gap-1.5"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>瀏覽目錄</span>
                  </button>
                </div>
              </div>

              {/* Conflict Policy Options */}
              <div className="space-y-2">
                <label className="text-xs text-studio-300 font-medium">檔案名稱衝突處理原則:</label>
                <div className="grid grid-cols-3 gap-3">
                  <label
                    className={`p-3 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                      conflictPolicy === 'rename'
                        ? 'bg-brand-500/10 border-brand-500 text-white'
                        : 'bg-studio-950 border-studio-800 text-studio-400 hover:border-studio-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="conflict"
                      checked={conflictPolicy === 'rename'}
                      onChange={() => setConflictPolicy('rename')}
                      className="text-brand-500"
                    />
                    <div className="text-xs">
                      <div className="font-semibold text-white">自動重命名 (保留二者)</div>
                      <div className="text-[10px] text-studio-500">新檔案附加 (restored_hash)</div>
                    </div>
                  </label>

                  <label
                    className={`p-3 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                      conflictPolicy === 'skip'
                        ? 'bg-brand-500/10 border-brand-500 text-white'
                        : 'bg-studio-950 border-studio-800 text-studio-400 hover:border-studio-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="conflict"
                      checked={conflictPolicy === 'skip'}
                      onChange={() => setConflictPolicy('skip')}
                      className="text-brand-500"
                    />
                    <div className="text-xs">
                      <div className="font-semibold text-white">略過已存在檔案</div>
                      <div className="text-[10px] text-studio-500">不變更目標目錄中檔案</div>
                    </div>
                  </label>

                  <label
                    className={`p-3 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                      conflictPolicy === 'overwrite'
                        ? 'bg-rose-500/10 border-rose-500 text-white'
                        : 'bg-studio-950 border-studio-800 text-studio-400 hover:border-studio-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="conflict"
                      checked={conflictPolicy === 'overwrite'}
                      onChange={() => setConflictPolicy('overwrite')}
                      className="text-rose-500"
                    />
                    <div className="text-xs">
                      <div className="font-semibold text-white">確認並覆寫現有檔案</div>
                      <div className="text-[10px] text-studio-500">以備份檔案替換同名檔案</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Metadata Restore Options */}
              <div className="space-y-2 pt-2 border-t border-studio-800">
                <label className="text-xs text-studio-300 font-medium">Font Studio 中繼資料匯入選項 (無損合併):</label>
                <div className="flex gap-6 text-xs text-studio-300">
                  <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                    <input
                      type="checkbox"
                      checked={importCollections}
                      onChange={(e) => setImportCollections(e.target.checked)}
                      className="rounded bg-studio-950 border-studio-700 text-brand-500"
                    />
                    <Folder className="w-3.5 h-3.5 text-amber-400" />
                    <span>還原自訂分類 ({verificationResult.manifest.collections?.length || 0})</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                    <input
                      type="checkbox"
                      checked={importTags}
                      onChange={(e) => setImportTags(e.target.checked)}
                      className="rounded bg-studio-950 border-studio-700 text-brand-500"
                    />
                    <Tag className="w-3.5 h-3.5 text-brand-400" />
                    <span>還原標籤標記 ({verificationResult.manifest.tags?.length || 0})</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                    <input
                      type="checkbox"
                      checked={importFavorites}
                      onChange={(e) => setImportFavorites(e.target.checked)}
                      className="rounded bg-studio-950 border-studio-700 text-brand-500"
                    />
                    <Heart className="w-3.5 h-3.5 text-rose-400" />
                    <span>還原收藏清單 ({verificationResult.manifest.favorites?.length || 0})</span>
                  </label>
                </div>
              </div>

              {/* Font Preview List in Archive */}
              <div className="space-y-2 pt-2 border-t border-studio-800">
                <label className="text-xs text-studio-300 font-medium">備份包待還原字體清單預覽 ({verificationResult.fontCount} 個):</label>
                <div className="max-h-48 overflow-y-auto space-y-1 p-2 rounded-xl bg-studio-950 border border-studio-800 text-[11px] font-mono">
                  {verificationResult.manifest.files.map((f, idx) => (
                    <div key={idx} className="flex items-center justify-between p-1.5 hover:bg-studio-900 rounded">
                      <span className="text-white font-medium truncate max-w-[50%]">
                        {f.localized_name || f.family_name} {f.style_name}
                      </span>
                      <span className="text-studio-500 uppercase">{f.format}</span>
                      <span className="text-studio-400">{(f.file_size / 1024).toFixed(1)} KB</span>
                      <span className="text-studio-600 truncate max-w-[25%]">{f.sha256.slice(0, 16)}...</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Restore Execution Bar */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-studio-800">
                {!isRestoring ? (
                  <button
                    onClick={handleStartRestore}
                    disabled={!restoreTargetDir}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white shadow-md transition-all disabled:opacity-40 flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    <span>開始安全還原字體</span>
                  </button>
                ) : (
                  <button
                    onClick={handleCancelRestore}
                    className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white flex items-center gap-1.5 transition-all"
                  >
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>中止還原</span>
                  </button>
                )}
              </div>

              {/* Live Restore Progress */}
              {isRestoring && restoreProgress && (
                <div className="p-4 rounded-xl bg-studio-950 border border-studio-800 space-y-2 text-xs">
                  <div className="flex justify-between text-studio-400 text-[11px]">
                    <span className="truncate max-w-[70%]">正在寫入並校驗: {restoreProgress.currentItem}</span>
                    <span className="font-mono text-white">
                      {restoreProgress.total > 0
                        ? Math.round((restoreProgress.current / restoreProgress.total) * 100)
                        : 0}
                      %
                    </span>
                  </div>
                  <div className="w-full h-2 bg-studio-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-200"
                      style={{
                        width: `${
                          restoreProgress.total > 0
                            ? Math.round((restoreProgress.current / restoreProgress.total) * 100)
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Restore Result Card */}
              {restoreResult && (
                <div
                  className={`p-5 rounded-xl border space-y-3 ${
                    restoreResult.success
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-sm">
                    {restoreResult.success ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        <span>字體已成功還原至目標資料夾！</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-5 h-5 text-rose-400" />
                        <span>還原完成（部分項目發生錯誤或略過）</span>
                      </>
                    )}
                  </div>

                  <div className="space-y-1.5 text-xs text-studio-300">
                    <p>
                      <span className="text-studio-400">已還原檔案數量:</span>{' '}
                      <span className="font-mono font-bold text-white">{restoreResult.restoredCount} 個</span>
                      <span className="mx-2">|</span>
                      <span className="text-studio-400">略過:</span>{' '}
                      <span className="font-mono text-amber-400">{restoreResult.skippedCount} 個</span>
                      <span className="mx-2">|</span>
                      <span className="text-studio-400">失敗:</span>{' '}
                      <span className="font-mono text-rose-400">{restoreResult.failedCount} 個</span>
                    </p>

                    {restoreResult.metadataImported && (
                      <p className="text-emerald-400 text-[11px]">
                        中繼資料合併完成：已匯入 {restoreResult.metadataImported.collections} 個分類、
                        {restoreResult.metadataImported.tags} 個標籤、
                        {restoreResult.metadataImported.favorites} 個收藏。
                      </p>
                    )}

                    {restoreResult.errors && restoreResult.errors.length > 0 && (
                      <div className="mt-2 p-2.5 rounded-lg bg-rose-950/40 border border-rose-900 text-[11px] font-mono text-rose-300 space-y-1">
                        <div className="font-semibold">錯誤明細:</div>
                        {restoreResult.errors.map((e, idx) => (
                          <div key={idx}>• {e.item}: {e.error}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Safety Notice Card at bottom */}
      <div className="p-5 rounded-2xl bg-studio-900/60 border border-studio-800 text-xs space-y-2">
        <h4 className="font-semibold text-studio-300 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Windows 桌面安全架構準則</span>
        </h4>
        <ul className="list-disc list-inside text-studio-400 space-y-1 text-[11px] leading-relaxed">
          <li>備份還原流程不直接存取、修改或覆寫 Windows 系統核心字體目錄（如 C:\Windows\Fonts）。</li>
          <li>還原寫入採用原子性暫存檔與串流校驗，寫入完成且 SHA-256 符合後才正式移入目標目錄。</li>
          <li>嚴格執行 Zip Slip 路徑過濾，全面封殺 ../ 穿越與非法磁碟代號。</li>
          <li>中繼資料採用 SQLite 交易無損合併機制，絕不覆寫或刪除既有字體資料庫檔案。</li>
        </ul>
      </div>
    </div>
  );
};
