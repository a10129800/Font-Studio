import React from 'react';
import {
  X,
  Heart,
  FolderOpen,
  Info,
  Calendar,
  Layers,
  Hash,
  ShieldAlert,
  Tag,
  Plus,
} from 'lucide-react';
import { FontRecord, CollectionRecord } from '../../../shared/types';

interface FontDetailPanelProps {
  font: FontRecord | null;
  onClose: () => void;
  onToggleFavorite: () => void;
  collections: CollectionRecord[];
  onAddToCollection: (collectionId: string) => void;
  onRemoveFromCollection: (collectionId: string) => void;
  onOpenFilePath: (path: string) => void;
}

export const FontDetailPanel: React.FC<FontDetailPanelProps> = ({
  font,
  onClose,
  onToggleFavorite,
  collections,
  onAddToCollection,
  onRemoveFromCollection,
  onOpenFilePath,
}) => {
  if (!font) return null;

  return (
    <aside className="w-96 bg-studio-900 border-l border-studio-800 flex flex-col flex-shrink-0 select-none z-10 overflow-hidden">
      {/* Panel Header */}
      <div className="h-16 flex items-center justify-between px-5 border-b border-studio-800">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-brand-400" />
          <h2 className="font-semibold text-sm text-white">字體詳細資訊</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleFavorite}
            title={font.is_favorite ? '取消收藏' : '加入收藏'}
            className="p-1.5 rounded-lg text-studio-400 hover:text-rose-400 hover:bg-studio-800 transition-colors"
          >
            <Heart className={`w-4 h-4 ${font.is_favorite ? 'fill-rose-500 text-rose-500' : ''}`} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-studio-400 hover:text-white hover:bg-studio-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Panel Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* Title & Style */}
        <div>
          <h3 className="text-lg font-bold text-white tracking-tight">
            {font.localized_name ? `${font.localized_name} (${font.family_name})` : font.family_name}
          </h3>
          <p className="text-xs text-brand-400 font-medium mt-0.5">{font.style_name}</p>
          {font.full_name && font.full_name !== font.family_name && (
            <p className="text-xs text-studio-300 mt-1">全名: {font.full_name}</p>
          )}
          {font.postscript_name && (
            <p className="text-[11px] text-studio-400 font-mono mt-0.5">PS: {font.postscript_name}</p>
          )}
        </div>

        {/* Primary Badges */}
        <div className="flex flex-wrap gap-2 text-xs">
          <div className="px-2.5 py-1 rounded bg-studio-800 border border-studio-700 text-studio-300 font-mono text-[11px] uppercase">
            {font.format}
          </div>
          {font.face_count > 1 && (
            <div className="px-2.5 py-1 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 text-[11px] font-mono">
              TrueType Collection (第 {font.face_index + 1} 面 / 共 {font.face_count} 面)
            </div>
          )}
          <div className={`px-2.5 py-1 rounded text-[11px] font-medium border ${
            font.install_scope === 'system'
              ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
              : font.install_scope === 'user'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-studio-800 text-studio-400 border-studio-700'
          }`}>
            {font.install_scope === 'system' ? 'Windows 系統安裝' : font.install_scope === 'user' ? '目前使用者安裝' : '未安裝至系統'}
          </div>
          {font.is_missing && (
            <div className="px-2.5 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[11px] font-medium flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" />
              <span>實體檔案離線 / 已移除</span>
            </div>
          )}
          {font.scan_status !== 'valid' && !font.is_missing && (
            <div className="px-2.5 py-1 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[11px] font-medium flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" />
              <span>解析狀態: {font.scan_status}</span>
            </div>
          )}
        </div>

        {/* Technical Specs List */}
        <div className="space-y-3 bg-studio-950/60 p-3.5 rounded-lg border border-studio-800 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-studio-400">檔案大小</span>
            <span className="font-mono text-studio-200">{(font.file_size / 1024).toFixed(1)} KB</span>
          </div>
          {font.glyph_count !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-studio-400">字元輪廓 (Glyphs)</span>
              <span className="font-mono text-studio-200">{font.glyph_count.toLocaleString()}</span>
            </div>
          )}
          {font.character_count !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-studio-400">Unicode 碼位數</span>
              <span className="font-mono text-studio-200">{font.character_count.toLocaleString()}</span>
            </div>
          )}
          {font.version && (
            <div className="flex items-center justify-between">
              <span className="text-studio-400">字體版本</span>
              <span className="font-mono text-studio-200 truncate max-w-[180px]">{font.version}</span>
            </div>
          )}
          <div className="flex items-start justify-between gap-2 pt-1 border-t border-studio-850">
            <span className="text-studio-400 flex-shrink-0">SHA-256</span>
            <span className="font-mono text-[10px] text-studio-400 break-all text-right">{font.sha256}</span>
          </div>
        </div>

        {/* File Path & Reveal in Explorer */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-studio-300">本機路徑</label>
          <div className="p-2.5 rounded-lg bg-studio-950 border border-studio-800 text-[11px] text-studio-400 font-mono break-all flex items-start justify-between gap-2">
            <span>{font.file_path}</span>
            <button
              onClick={() => onOpenFilePath(font.file_path)}
              title="在檔案總管中顯示"
              className="text-brand-400 hover:text-brand-300 p-1 rounded hover:bg-studio-800 flex-shrink-0"
            >
              <FolderOpen className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Unicode Range Coverage */}
        {font.unicode_ranges && font.unicode_ranges.length > 0 && (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-studio-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-studio-400" />
              <span>語言與編碼涵蓋</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {font.unicode_ranges.map((range) => (
                <span
                  key={range}
                  className="px-2 py-0.5 rounded bg-studio-800/80 text-[11px] text-studio-300 border border-studio-700/60"
                >
                  {range}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Collections Assignment */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-studio-300 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-studio-400" />
            <span>自訂分類</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {collections.map((col) => {
              const inCollection = font.collection_ids?.includes(col.id);
              return (
                <button
                  key={col.id}
                  onClick={() => {
                    if (inCollection) onRemoveFromCollection(col.id);
                    else onAddToCollection(col.id);
                  }}
                  className={`text-[11px] px-2.5 py-1 rounded-md border transition-all ${
                    inCollection
                      ? 'bg-brand-600/20 border-brand-500 text-brand-300'
                      : 'bg-studio-950 border-studio-800 text-studio-400 hover:border-studio-700 hover:text-white'
                  }`}
                >
                  {inCollection ? '✓ ' : '+ '}
                  {col.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
};

