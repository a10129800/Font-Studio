import React from 'react';
import { BatchTaskProgressUpdate } from '../../../shared/types';
import { AlertTriangle, CheckCircle2, XCircle, ShieldCheck, Loader2 } from 'lucide-react';

interface BatchOperationModalProps {
  isOpen: boolean;
  type: 'install' | 'uninstall';
  selectedCount: number;
  progress: BatchTaskProgressUpdate | null;
  isRunning: boolean;
  onConfirm: () => void;
  onCancelTask: () => void;
  onClose: () => void;
}

export const BatchOperationModal: React.FC<BatchOperationModalProps> = ({
  isOpen,
  type,
  selectedCount,
  progress,
  isRunning,
  onConfirm,
  onCancelTask,
  onClose,
}) => {
  if (!isOpen) return null;

  const isCompleted = progress && (progress.phase === 'completed' || progress.phase === 'error' || progress.phase === 'cancelled');
  const percent = progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-studio-900 border border-studio-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-studio-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {type === 'install' ? (
              <div className="p-2 rounded-lg bg-brand-500/10 text-brand-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            ) : (
              <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
            )}
            <div>
              <h3 className="text-sm font-bold text-white">
                {type === 'install' ? '批次安裝字體至 Windows' : '批次卸載 Windows 使用者字體'}
              </h3>
              <p className="text-[11px] text-studio-400">
                {isRunning
                  ? '正在執行批次作業，請勿關閉視窗...'
                  : isCompleted
                  ? '批次作業已結束'
                  : `已選取 ${selectedCount} 個字體`}
              </p>
            </div>
          </div>
          {!isRunning && (
            <button
              onClick={onClose}
              className="text-studio-500 hover:text-white text-xs px-2 py-1 rounded-md hover:bg-studio-800 transition-colors"
            >
              ✕
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {!isRunning && !isCompleted ? (
            // Confirmation Screen
            <div className="space-y-4 text-studio-300">
              {type === 'install' ? (
                <>
                  <div className="p-3.5 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-300 space-y-1">
                    <p className="font-semibold flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4" />
                      <span>目前使用者安全安裝 (User Scope)</span>
                    </p>
                    <p className="text-[11px] text-studio-300">
                      字體將複製至目前使用者的字體目錄並註冊於 HKCU，無需系統管理員權限，安全且完全相容所有 Windows 應用程式。
                    </p>
                  </div>
                  <ul className="list-disc pl-5 space-y-1 text-studio-400 text-[11px]">
                    <li>支援格式：TTF、OTF、TTC。</li>
                    <li>不支援格式：WOFF、WOFF2 網頁壓縮字體將自動略過。</li>
                    <li>若同名同內容字體已安裝，將自動跳過避免重複複製。</li>
                  </ul>
                </>
              ) : (
                <>
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 space-y-1">
                    <p className="font-semibold flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4" />
                      <span>Windows 系統字體核心防護</span>
                    </p>
                    <p className="text-[11px] text-studio-300">
                      系統內建與核心字體（例如微軟正黑體、新細明體、Segoe UI、Arial 等）受保護， Font Studio 將自動拒絕卸載任何核心字體以確保作業系統運作正常。
                    </p>
                  </div>
                  <p className="text-studio-400 text-[11px]">
                    確定要卸載已選取的 {selectedCount} 個字體嗎？卸載後該字體將自目前使用者註冊表中移除。
                  </p>
                </>
              )}
            </div>
          ) : (
            // Progress & Results Screen
            <div className="space-y-4">
              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] text-studio-400">
                  <span className="truncate max-w-[70%]">
                    {progress?.currentItem ? `處理中: ${progress.currentItem}` : '準備中...'}
                  </span>
                  <span className="font-mono font-medium text-white">{percent}%</span>
                </div>
                <div className="w-full h-2 bg-studio-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      type === 'install' ? 'bg-brand-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>

              {/* Counter Stats */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-lg bg-studio-950 border border-studio-800">
                  <div className="text-emerald-400 font-bold font-mono text-sm">
                    {progress?.successCount || 0}
                  </div>
                  <div className="text-[10px] text-studio-500">成功完成</div>
                </div>
                <div className="p-2.5 rounded-lg bg-studio-950 border border-studio-800">
                  <div className="text-amber-400 font-bold font-mono text-sm">
                    {progress?.skippedCount || 0}
                  </div>
                  <div className="text-[10px] text-studio-500">略過 / 已存在</div>
                </div>
                <div className="p-2.5 rounded-lg bg-studio-950 border border-studio-800">
                  <div className="text-rose-400 font-bold font-mono text-sm">
                    {progress?.failedCount || 0}
                  </div>
                  <div className="text-[10px] text-studio-500">失敗 / 錯誤</div>
                </div>
              </div>

              {/* Errors List */}
              {progress?.errors && progress.errors.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="text-[11px] font-semibold text-rose-400">錯誤清單:</h4>
                  <div className="max-h-36 overflow-y-auto space-y-1 p-2 rounded-lg bg-studio-950 border border-rose-950 text-[11px] font-mono">
                    {progress.errors.map((err, idx) => (
                      <div key={idx} className="text-rose-300 flex items-start gap-1">
                        <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                        <span>
                          <span className="font-semibold">{err.item}:</span> {err.error}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 bg-studio-950 border-t border-studio-800 flex justify-end gap-2.5">
          {!isRunning && !isCompleted ? (
            <>
              <button
                onClick={onClose}
                className="px-4 py-1.5 rounded-lg bg-studio-800 hover:bg-studio-700 text-xs text-studio-300 transition-colors"
              >
                取消
              </button>
              <button
                onClick={onConfirm}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors flex items-center gap-1.5 ${
                  type === 'install'
                    ? 'bg-brand-600 hover:bg-brand-500'
                    : 'bg-rose-600 hover:bg-rose-500'
                }`}
              >
                {type === 'install' ? '確認安裝' : '確認卸載'}
              </button>
            </>
          ) : isRunning ? (
            <button
              onClick={onCancelTask}
              className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white transition-colors flex items-center gap-1.5"
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>中止工作</span>
            </button>
          ) : (
            <button
              onClick={onClose}
              className="px-5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-xs font-semibold text-white transition-colors"
            >
              完成
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
