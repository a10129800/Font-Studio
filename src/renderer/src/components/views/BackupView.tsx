import React, { useState } from 'react';
import { Archive, ShieldCheck, Download, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { FontRecord } from '../../../../shared/types';

interface BackupViewProps {
  fonts: FontRecord[];
  onSelectSavePath: () => Promise<string | null>;
  onSelectZipFile: () => Promise<string | null>;
}

export const BackupView: React.FC<BackupViewProps> = ({
  fonts,
  onSelectSavePath,
  onSelectZipFile,
}) => {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleStartBackup = async () => {
    const savePath = await onSelectSavePath();
    if (!savePath) return;

    setStatusMessage('備份服務正在準備建立中（本功能將於 Milestone M3 正式連接完整打包服務）...');
  };

  const handleVerifyZip = async () => {
    const zipPath = await onSelectZipFile();
    if (!zipPath) return;

    setStatusMessage('正在讀取備份包清單與校驗 SHA-256（本功能將於 Milestone M3 正式連接完整打包服務）...');
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6 select-none">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <Archive className="w-5 h-5 text-brand-400" />
          <span>字體備份與無損還原</span>
        </h2>
        <p className="text-xs text-studio-400 mt-1">
          完整備份字體原始檔案、分類收藏庫、標籤與自訂設定，並以 SHA-256 清單確保備份資料完整性。
        </p>
      </div>

      {statusMessage && (
        <div className="p-3.5 rounded-xl bg-brand-500/10 border border-brand-500/20 text-xs text-brand-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-brand-400 flex-shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Backup & Restore Action Cards */}
      <div className="grid grid-cols-2 gap-6">
        {/* Create Backup */}
        <div className="p-6 rounded-xl bg-studio-900 border border-studio-800 space-y-4">
          <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-400 flex items-center justify-center">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-white">建立字體備份壓縮包</h3>
            <p className="text-xs text-studio-400 mt-1 leading-relaxed">
              將目前的自訂字體檔案、SQLite 資料庫關聯、分類與標籤結構打包為 ZIP，並產生 SHA-256 校驗清單。
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={handleStartBackup}
              className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-xs font-semibold text-white shadow-sm transition-all"
            >
              選擇儲存路徑並備份
            </button>
          </div>
        </div>

        {/* Restore Backup */}
        <div className="p-6 rounded-xl bg-studio-900 border border-studio-800 space-y-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <Upload className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-white">驗證並還原備份</h3>
            <p className="text-xs text-studio-400 mt-1 leading-relaxed">
              選取既有的 ZIP 備份包，驗證檔案完整性、預覽待還原字體清單，防止 Zip Slip 路徑穿越與衝突覆寫。
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={handleVerifyZip}
              className="px-4 py-2 rounded-xl bg-studio-800 hover:bg-studio-700 text-xs font-semibold text-studio-200 border border-studio-700 transition-all"
            >
              選取備份 ZIP 檔案
            </button>
          </div>
        </div>
      </div>

      {/* Safety Notice */}
      <div className="p-5 rounded-xl bg-studio-900/60 border border-studio-800 text-xs space-y-2">
        <h4 className="font-semibold text-studio-300 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>安全防護準則</span>
        </h4>
        <ul className="list-disc list-inside text-studio-400 space-y-1 text-[11px] leading-relaxed">
          <li>本軟體區分「字體檔案實體備份」與「Windows 系統註冊表安裝復原」。</li>
          <li>還原前會強制比對清單內的 SHA-256 校驗值，發現檔案損毀時會主動警示。</li>
          <li>具備路徑消毒檢查，嚴格防止惡意備份檔企圖寫入系統重要目錄。</li>
        </ul>
      </div>
    </div>
  );
};

