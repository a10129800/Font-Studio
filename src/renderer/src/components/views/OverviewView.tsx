import React from 'react';
import {
  Type,
  CheckCircle2,
  HardDrive,
  Heart,
  RefreshCw,
  FolderOpen,
  FileUp,
  Copy,
  Archive,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { FontRecord } from '../../../../shared/types';
import { NavTabId } from '../Sidebar';

interface OverviewViewProps {
  fonts: FontRecord[];
  onNavigate: (tab: NavTabId) => void;
  onStartScan: () => void;
  onImportFolder: () => void;
  onImportFiles?: () => void;
  isScanning: boolean;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  fonts,
  onNavigate,
  onStartScan,
  onImportFolder,
  onImportFiles,
  isScanning,
}) => {
  const total = fonts.length;
  const installed = fonts.filter((f) => f.install_scope === 'system' || f.install_scope === 'user').length;
  const local = fonts.filter((f) => f.source_type === 'imported').length;
  const favorites = fonts.filter((f) => f.is_favorite).length;

  const ttfCount = fonts.filter((f) => f.format === 'ttf').length;
  const otfCount = fonts.filter((f) => f.format === 'otf').length;
  const ttcCount = fonts.filter((f) => f.format === 'ttc').length;
  const webCount = fonts.filter((f) => f.format === 'woff' || f.format === 'woff2').length;

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 select-none">
      {/* Welcome Banner */}
      <div className="rounded-2xl p-6 bg-gradient-to-r from-studio-900 via-studio-850 to-studio-900 border border-studio-800 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">歡迎使用 Font Studio</h2>
          <p className="text-xs text-studio-400 mt-1 max-w-xl leading-relaxed">
            Windows 專業字體管理軟體。安全掃描、快速檢視、分類標籤、字元分析與無損備份。
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onStartScan}
            disabled={isScanning}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-xs font-semibold text-white shadow-md shadow-brand-500/20 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? '正在掃描...' : '掃描 Windows 字體'}</span>
          </button>
          <button
            onClick={onImportFiles || onImportFolder}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-studio-800 hover:bg-studio-700 text-xs font-semibold text-studio-200 border border-studio-700 transition-all"
            title="選擇一或多個字體檔案匯入"
          >
            <FileUp className="w-3.5 h-3.5 text-brand-400" />
            <span>匯入檔案</span>
          </button>
          <button
            onClick={onImportFolder}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-studio-800 hover:bg-studio-700 text-xs font-semibold text-studio-200 border border-studio-700 transition-all"
            title="選擇自訂字體資料夾進行掃描匯入"
          >
            <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
            <span>匯入資料夾</span>
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-4 gap-4">
        <div
          onClick={() => onNavigate('all-fonts')}
          className="p-5 rounded-xl bg-studio-900 border border-studio-800 hover:border-brand-500/50 cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-studio-400">全部已索引字體</span>
            <Type className="w-4 h-4 text-brand-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold text-white mt-2 font-mono">{total}</div>
          <div className="text-[11px] text-studio-500 mt-1">包含所有樣式與變體</div>
        </div>

        <div
          onClick={() => onNavigate('installed')}
          className="p-5 rounded-xl bg-studio-900 border border-studio-800 hover:border-emerald-500/50 cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-studio-400">Windows 已安裝</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-2 font-mono">{installed}</div>
          <div className="text-[11px] text-studio-500 mt-1">系統與目前使用者字體</div>
        </div>

        <div
          onClick={() => onNavigate('local')}
          className="p-5 rounded-xl bg-studio-900 border border-studio-800 hover:border-blue-500/50 cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-studio-400">本機匯入檔案</span>
            <HardDrive className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold text-blue-400 mt-2 font-mono">{local}</div>
          <div className="text-[11px] text-studio-500 mt-1">自訂資料夾字體檔案</div>
        </div>

        <div
          onClick={() => onNavigate('favorites')}
          className="p-5 rounded-xl bg-studio-900 border border-studio-800 hover:border-rose-500/50 cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-studio-400">我的收藏</span>
            <Heart className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold text-rose-400 mt-2 font-mono">{favorites}</div>
          <div className="text-[11px] text-studio-500 mt-1">標記為喜愛的字體</div>
        </div>
      </div>

      {/* Format Breakdown & Quick Features */}
      <div className="grid grid-cols-3 gap-6">
        {/* Format Distribution */}
        <div className="p-5 rounded-xl bg-studio-900 border border-studio-800 space-y-4">
          <h3 className="text-xs font-bold text-studio-300 uppercase tracking-wider">字體格式分佈</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-studio-300">TrueType (.ttf)</span>
                <span className="font-mono text-studio-400">{ttfCount}</span>
              </div>
              <div className="w-full h-1.5 bg-studio-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500" style={{ width: total ? `${(ttfCount / total) * 100}%` : '0%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-studio-300">OpenType (.otf)</span>
                <span className="font-mono text-studio-400">{otfCount}</span>
              </div>
              <div className="w-full h-1.5 bg-studio-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: total ? `${(otfCount / total) * 100}%` : '0%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-studio-300">TrueType Collection (.ttc)</span>
                <span className="font-mono text-studio-400">{ttcCount}</span>
              </div>
              <div className="w-full h-1.5 bg-studio-800 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500" style={{ width: total ? `${(ttcCount / total) * 100}%` : '0%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-studio-300">Web Fonts (woff / woff2)</span>
                <span className="font-mono text-studio-400">{webCount}</span>
              </div>
              <div className="w-full h-1.5 bg-studio-800 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500" style={{ width: total ? `${(webCount / total) * 100}%` : '0%' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Pro Tools Shortcuts */}
        <div className="col-span-2 p-5 rounded-xl bg-studio-900 border border-studio-800 space-y-3">
          <h3 className="text-xs font-bold text-studio-300 uppercase tracking-wider">專業工作區功能</h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => onNavigate('compare')}
              className="p-3.5 rounded-lg bg-studio-950 border border-studio-800 hover:border-brand-500 text-left transition-colors flex items-center justify-between"
            >
              <div>
                <h4 className="text-xs font-semibold text-white">字體多欄並列比較</h4>
                <p className="text-[11px] text-studio-400 mt-0.5">自訂文案同步檢視字體韻律</p>
              </div>
              <ArrowRight className="w-4 h-4 text-studio-500" />
            </button>

            <button
              onClick={() => onNavigate('glyph-viewer')}
              className="p-3.5 rounded-lg bg-studio-950 border border-studio-800 hover:border-brand-500 text-left transition-colors flex items-center justify-between"
            >
              <div>
                <h4 className="text-xs font-semibold text-white">字元檢視器與語言覆蓋</h4>
                <p className="text-[11px] text-studio-400 mt-0.5">繁中、日文及 Unicode 碼位支援檢查</p>
              </div>
              <ArrowRight className="w-4 h-4 text-studio-500" />
            </button>

            <button
              onClick={() => onNavigate('duplicates')}
              className="p-3.5 rounded-lg bg-studio-950 border border-studio-800 hover:border-brand-500 text-left transition-colors flex items-center justify-between"
            >
              <div>
                <h4 className="text-xs font-semibold text-white">重複字體偵測</h4>
                <p className="text-[11px] text-studio-400 mt-0.5">SHA-256 實體重複與同家族檢查</p>
              </div>
              <ArrowRight className="w-4 h-4 text-studio-500" />
            </button>

            <button
              onClick={() => onNavigate('storage')}
              className="p-3.5 rounded-lg bg-studio-950 border border-studio-800 hover:border-brand-500 text-left transition-colors flex items-center justify-between"
            >
              <div>
                <h4 className="text-xs font-semibold text-white">磁碟容量與診斷</h4>
                <p className="text-[11px] text-studio-400 mt-0.5">字體佔用空間與異常檔案診斷</p>
              </div>
              <ArrowRight className="w-4 h-4 text-studio-500" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

