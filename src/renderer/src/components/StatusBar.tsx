import React from 'react';
import {
  CheckCircle,
  AlertTriangle,
  SkipForward,
  Loader2,
  XCircle,
} from 'lucide-react';
import { ScanProgressUpdate } from '../../../shared/types';

interface StatusBarProps {
  scanProgress: ScanProgressUpdate | null;
  onCancelScan?: () => void;
  statusMessage?: string;
  totalFonts: number;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  scanProgress,
  onCancelScan,
  statusMessage,
  totalFonts,
}) => {
  const isScanning = scanProgress && scanProgress.phase !== 'complete' && scanProgress.phase !== 'cancelled';

  const percent =
    scanProgress && scanProgress.total > 0
      ? Math.min(100, Math.round((scanProgress.current / scanProgress.total) * 100))
      : 0;

  return (
    <footer className="h-9 bg-studio-950 border-t border-studio-800 px-4 flex items-center justify-between text-xs text-studio-400 select-none flex-shrink-0 z-20">
      {/* Left: Active operation or status */}
      <div className="flex items-center gap-3 overflow-hidden">
        {isScanning ? (
          <div className="flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 text-brand-400 animate-spin flex-shrink-0" />
            <span className="text-white font-medium text-[11px] truncate max-w-xs">
              {scanProgress?.currentFile}
            </span>
            <div className="w-28 h-1.5 bg-studio-800 rounded-full overflow-hidden flex-shrink-0">
              <div
                className="h-full bg-brand-500 transition-all duration-150"
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="text-[11px] font-mono text-studio-400 flex-shrink-0">
              {scanProgress?.current} / {scanProgress?.total} ({percent}%)
            </span>
            {onCancelScan && (
              <button
                onClick={onCancelScan}
                className="text-rose-400 hover:text-rose-300 text-[11px] font-medium ml-1"
              >
                取消
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="text-studio-300 text-[11px]">
              {statusMessage || `已索引 ${totalFonts} 個字體樣式`}
            </span>
          </div>
        )}
      </div>

      {/* Right: Metrics counters */}
      <div className="flex items-center gap-4 text-[11px]">
        {scanProgress && (
          <>
            <div className="flex items-center gap-1 text-emerald-400" title="成功處理數量">
              <CheckCircle className="w-3 h-3" />
              <span>成功: {scanProgress.successCount}</span>
            </div>
            {scanProgress.failedCount > 0 && (
              <div className="flex items-center gap-1 text-rose-400" title="解析失敗或損壞數量">
                <XCircle className="w-3 h-3" />
                <span>失敗: {scanProgress.failedCount}</span>
              </div>
            )}
            {scanProgress.skippedCount > 0 && (
              <div className="flex items-center gap-1 text-amber-400" title="跳過數量">
                <SkipForward className="w-3 h-3" />
                <span>跳過: {scanProgress.skippedCount}</span>
              </div>
            )}
          </>
        )}
        <div className="text-studio-500 border-l border-studio-800 pl-3">
          Windows Font Indexing Engine
        </div>
      </div>
    </footer>
  );
};

