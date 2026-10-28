import React from 'react';
import { Settings, Shield, Database, Monitor, Info, RefreshCw } from 'lucide-react';

interface SettingsViewProps {
  isDarkMode: boolean;
  onToggleTheme: () => void;
  defaultPreviewText: string;
  onDefaultPreviewTextChange: (text: string) => void;
  onRescanAll: () => void;
  isScanning: boolean;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  isDarkMode,
  onToggleTheme,
  defaultPreviewText,
  onDefaultPreviewTextChange,
  onRescanAll,
  isScanning,
}) => {
  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 select-none max-w-4xl">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <Settings className="w-5 h-5 text-brand-400" />
          <span>應用程式設定與安全架構</span>
        </h2>
        <p className="text-xs text-studio-400 mt-1">
          管理字體預覽偏好、外觀主題、本機 SQLite 資料庫及 Windows 整合設定。
        </p>
      </div>

      {/* Security Baseline Status */}
      <div className="p-5 rounded-xl bg-studio-900 border border-studio-800 space-y-3">
        <h3 className="text-xs font-bold text-studio-300 uppercase tracking-wider flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-400" />
          <span>Electron 安全沙盒與防護基準</span>
        </h3>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-studio-950 border border-studio-800 flex items-center justify-between">
            <span className="text-studio-300">Context Isolation</span>
            <span className="text-emerald-400 font-mono font-medium text-[11px] bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              啟用 (true)
            </span>
          </div>

          <div className="p-3 rounded-lg bg-studio-950 border border-studio-800 flex items-center justify-between">
            <span className="text-studio-300">Node Integration in Renderer</span>
            <span className="text-emerald-400 font-mono font-medium text-[11px] bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              已停用 (false)
            </span>
          </div>

          <div className="p-3 rounded-lg bg-studio-950 border border-studio-800 flex items-center justify-between">
            <span className="text-studio-300">Renderer Process Sandbox</span>
            <span className="text-emerald-400 font-mono font-medium text-[11px] bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              啟用 (true)
            </span>
          </div>

          <div className="p-3 rounded-lg bg-studio-950 border border-studio-800 flex items-center justify-between">
            <span className="text-studio-300">Zero-Install Font Preview</span>
            <span className="text-emerald-400 font-mono font-medium text-[11px] bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              安全隔離協定
            </span>
          </div>
        </div>
      </div>

      {/* Preferences */}
      <div className="p-5 rounded-xl bg-studio-900 border border-studio-800 space-y-4">
        <h3 className="text-xs font-bold text-studio-300 uppercase tracking-wider flex items-center gap-2">
          <Monitor className="w-4 h-4 text-brand-400" />
          <span>介面與預覽偏好</span>
        </h3>

        <div className="space-y-2">
          <label className="text-xs font-medium text-studio-300">預設預覽字樣</label>
          <input
            type="text"
            value={defaultPreviewText}
            onChange={(e) => onDefaultPreviewTextChange(e.target.value)}
            className="w-full bg-studio-950 border border-studio-800 rounded-lg px-3 py-2 text-xs text-white placeholder-studio-500 focus:outline-none focus:border-brand-500"
          />
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-studio-800/80">
          <div>
            <h4 className="text-xs font-medium text-white">主題外觀</h4>
            <p className="text-[11px] text-studio-400">切換深色與淺色介面風格</p>
          </div>
          <button
            onClick={onToggleTheme}
            className="px-4 py-1.5 rounded-lg border border-studio-700 bg-studio-800 text-xs text-studio-200 hover:bg-studio-700 transition-colors"
          >
            {isDarkMode ? '深色模式 (Dark)' : '淺色模式 (Light)'}
          </button>
        </div>
      </div>

      {/* Database Maintenance */}
      <div className="p-5 rounded-xl bg-studio-900 border border-studio-800 space-y-3">
        <h3 className="text-xs font-bold text-studio-300 uppercase tracking-wider flex items-center gap-2">
          <Database className="w-4 h-4 text-brand-400" />
          <span>SQLite 資料庫與索引維護</span>
        </h3>
        <p className="text-xs text-studio-400 leading-relaxed">
          重新掃描字體時將採用穩定 ID 比對，<strong>不會清除既有的收藏、自訂分類與標籤</strong>。
        </p>
        <button
          onClick={onRescanAll}
          disabled={isScanning}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-xs font-semibold text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
          <span>{isScanning ? '正在維護索引中...' : '重新掃描並更新索引'}</span>
        </button>
      </div>

      {/* About */}
      <div className="p-5 rounded-xl bg-studio-900 border border-studio-800 flex items-center justify-between text-xs text-studio-400">
        <div>
          <h4 className="font-semibold text-white">Font Studio Desktop</h4>
          <p className="text-[11px] text-studio-500 mt-0.5">Version 0.1.0 · Open Source MIT License</p>
        </div>
        <div className="text-right text-[11px] text-studio-500 font-mono">
          Electron 34 · React 18 · SQLite3
        </div>
      </div>
    </div>
  );
};

