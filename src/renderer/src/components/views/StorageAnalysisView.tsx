import React from 'react';
import { FontRecord, StorageAnalysisReport } from '../../../../shared/types';
import { PieChart, HardDrive, AlertTriangle, ShieldCheck, FileText } from 'lucide-react';

interface StorageAnalysisViewProps {
  fonts: FontRecord[];
}

export const StorageAnalysisView: React.FC<StorageAnalysisViewProps> = ({ fonts }) => {
  let totalSizeBytes = 0;
  let systemSizeBytes = 0;
  let userSizeBytes = 0;
  let importedSizeBytes = 0;

  for (const f of fonts) {
    totalSizeBytes += f.file_size;
    if (f.source_type === 'system') systemSizeBytes += f.file_size;
    else if (f.source_type === 'user') userSizeBytes += f.file_size;
    else importedSizeBytes += f.file_size;
  }

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const corruptedCount = fonts.filter(
    (f) => f.scan_status === 'corrupted' || f.scan_status === 'unsupported'
  ).length;

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6 select-none">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <PieChart className="w-5 h-5 text-brand-400" />
          <span>磁碟容量與健康度分析</span>
        </h2>
        <p className="text-xs text-studio-400 mt-1">
          深入分析 Windows 系統字體與本機字庫的空間佔用比例，提供磁碟瘦身整理建議。
        </p>
      </div>

      {/* Main Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-studio-900 border border-studio-800">
          <span className="text-xs text-studio-400">字體總佔用空間</span>
          <div className="text-2xl font-bold text-white mt-1 font-mono">{formatSize(totalSizeBytes)}</div>
          <span className="text-[11px] text-studio-500">{fonts.length} 個已索引檔案</span>
        </div>

        <div className="p-5 rounded-xl bg-studio-900 border border-studio-800">
          <span className="text-xs text-studio-400">Windows 系統目錄</span>
          <div className="text-2xl font-bold text-indigo-400 mt-1 font-mono">{formatSize(systemSizeBytes)}</div>
          <span className="text-[11px] text-studio-500">C:\Windows\Fonts</span>
        </div>

        <div className="p-5 rounded-xl bg-studio-900 border border-studio-800">
          <span className="text-xs text-studio-400">目前使用者字庫</span>
          <div className="text-2xl font-bold text-emerald-400 mt-1 font-mono">{formatSize(userSizeBytes)}</div>
          <span className="text-[11px] text-studio-500">%LOCALAPPDATA%</span>
        </div>

        <div className="p-5 rounded-xl bg-studio-900 border border-studio-800">
          <span className="text-xs text-studio-400">異常或損壞字體</span>
          <div className={`text-2xl font-bold mt-1 font-mono ${corruptedCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {corruptedCount}
          </div>
          <span className="text-[11px] text-studio-500">損壞檔案診斷</span>
        </div>
      </div>

      {/* Guidelines and Safety Notice */}
      <div className="p-5 rounded-xl bg-studio-900 border border-studio-800 space-y-3">
        <h3 className="text-xs font-bold text-studio-300 uppercase tracking-wider flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>容量清理安全聲明</span>
        </h3>
        <p className="text-xs text-studio-400 leading-relaxed">
          依照專業安全規範，容量分析僅提供磁碟佔用洞察與整理建議，<strong>絕對不會未經確認自動刪除任何 Windows 系統字體</strong>。
          受 Windows 檔案保護機制的系統字體會明確上鎖，確保作業系統與原生應用程式的排版穩定性。
        </p>
      </div>
    </div>
  );
};

