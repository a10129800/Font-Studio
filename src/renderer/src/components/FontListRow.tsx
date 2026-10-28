import React, { useEffect, useState } from 'react';
import { Heart, AlertCircle, AlertTriangle } from 'lucide-react';
import { FontRecord } from '../../../shared/types';

interface FontListRowProps {
  font: FontRecord;
  previewText: string;
  fontSize: number;
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
  onClick: () => void;
}

export const FontListRow: React.FC<FontListRowProps> = ({
  font,
  previewText,
  fontSize,
  isSelected,
  onSelect,
  onToggleFavorite,
  onClick,
}) => {
  const [fontLoaded, setFontLoaded] = useState(false);
  const fontFamilyName = `FS_Font_${font.id}`;

  useEffect(() => {
    if (font.scan_status !== 'valid' || font.is_missing) return;
    let fontFaceInstance: FontFace | null = null;
    let isMounted = true;

    try {
      const fontUrl = `font-preview://font-file?path=${encodeURIComponent(font.file_path)}`;
      fontFaceInstance = new FontFace(fontFamilyName, `url("${fontUrl}")`);
      fontFaceInstance
        .load()
        .then((loaded) => {
          if (isMounted) {
            (document.fonts as any).add(loaded);
            setFontLoaded(true);
          }
        })
        .catch(() => {});
    } catch {}

    return () => {
      isMounted = false;
      if (fontFaceInstance && (document.fonts as any).has(fontFaceInstance)) {
        try {
          (document.fonts as any).delete(fontFaceInstance);
        } catch {}
      }
    };
  }, [font.id, font.file_path, font.scan_status, font.is_missing, fontFamilyName]);

  const defaultSample = previewText.trim() || 'ABCDEF abcdef 123456 永和九年歲在癸丑';

  const appliedFontFamily = fontLoaded
    ? `"${fontFamilyName}", "${font.family_name}", "${font.localized_name || ''}", sans-serif`
    : `"${font.family_name}", "${font.localized_name || ''}", sans-serif`;

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-4 px-4 py-3 rounded-lg border bg-studio-900 transition-colors cursor-pointer ${
        isSelected
          ? 'border-brand-500 bg-studio-900/90 ring-1 ring-brand-500/20'
          : 'border-studio-800 hover:border-studio-700 hover:bg-studio-850'
      }`}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={(e) => {
          e.stopPropagation();
          onSelect(e.target.checked);
        }}
        aria-label={`選取字體 ${font.family_name} ${font.style_name}`}
        className="rounded border-studio-700 bg-studio-950 text-brand-600 focus:ring-brand-500 focus:ring-offset-studio-900 cursor-pointer flex-shrink-0"
      />

      {/* Font Family & Style Column */}
      <div className="w-64 flex-shrink-0 overflow-hidden">
        <h4 className="font-semibold text-xs text-white truncate">
          {font.localized_name ? `${font.localized_name} (${font.family_name})` : font.family_name}
        </h4>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className="text-[11px] text-studio-400 font-medium">{font.style_name}</span>
          <span className="text-[9px] uppercase px-1 py-0.2 rounded border font-mono bg-studio-800 text-studio-400 border-studio-700">
            {font.format}
          </span>
          {font.face_count > 1 && (
            <span className="text-[9px] px-1 py-0.2 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 font-mono">
              面 {font.face_index + 1}/{font.face_count}
            </span>
          )}
          {font.is_missing && (
            <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium flex items-center gap-0.5">
              <AlertTriangle className="w-2.5 h-2.5" /> 離線
            </span>
          )}
        </div>
      </div>

      {/* Specimen Preview Column */}
      <div className="flex-1 overflow-hidden">
        {font.scan_status === 'corrupted' || font.scan_status === 'unsupported' || font.scan_status === 'unreadable' ? (
          <span className="text-rose-400 text-xs flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" /> 無法解析或檔案損壞
          </span>
        ) : (
          <p
            style={{
              fontFamily: appliedFontFamily,
              fontSize: `${Math.min(fontSize, 36)}px`,
            }}
            className="text-slate-100 truncate"
          >
            {defaultSample}
          </p>
        )}
      </div>

      {/* File Size & Install Status */}
      <div className="w-36 flex-shrink-0 flex items-center justify-end gap-3 text-right">
        <span className="text-[11px] text-studio-400 font-mono">
          {(font.file_size / 1024).toFixed(0)} KB
        </span>
        <span
          className={`text-[10px] px-2 py-0.5 rounded font-medium ${
            font.install_scope === 'system'
              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
              : font.install_scope === 'user'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-studio-800 text-studio-400'
          }`}
        >
          {font.install_scope === 'system' ? '系統' : font.install_scope === 'user' ? '使用者' : '未安裝'}
        </span>
      </div>

      {/* Favorite Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite(e);
        }}
        title={font.is_favorite ? '取消收藏' : '加入收藏'}
        className="p-1 rounded text-studio-400 hover:text-rose-400 flex-shrink-0"
      >
        <Heart className={`w-4 h-4 ${font.is_favorite ? 'fill-rose-500 text-rose-500' : 'text-studio-500'}`} />
      </button>
    </div>
  );
};
