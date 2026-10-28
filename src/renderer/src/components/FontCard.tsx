import React, { useEffect, useState } from 'react';
import { Heart, AlertCircle, AlertTriangle } from 'lucide-react';
import { FontRecord } from '../../../shared/types';

interface FontCardProps {
  font: FontRecord;
  previewText: string;
  fontSize: number;
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
  onClick: () => void;
}

export const FontCard: React.FC<FontCardProps> = ({
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

    // Load custom font-face via secure protocol
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
        .catch(() => {
          // Fallback to installed font or system fallback
        });
    } catch {
      // Ignored
    }

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

  const formatColors: Record<string, string> = {
    ttf: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    otf: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    ttc: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    woff: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    woff2: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    unknown: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  };

  const isCorrupted = font.scan_status === 'corrupted' || font.scan_status === 'unsupported' || font.scan_status === 'unreadable';

  // CSS Font family fallback list prioritizing loaded custom font, then native family name, localized name
  const appliedFontFamily = fontLoaded
    ? `"${fontFamilyName}", "${font.family_name}", "${font.localized_name || ''}", sans-serif`
    : `"${font.family_name}", "${font.localized_name || ''}", sans-serif`;

  return (
    <div
      onClick={onClick}
      className={`group relative flex flex-col justify-between p-4 rounded-xl border bg-studio-900 transition-all cursor-pointer ${
        isSelected
          ? 'border-brand-500 ring-2 ring-brand-500/20 bg-studio-900/90'
          : 'border-studio-800 hover:border-studio-700 hover:bg-studio-850 shadow-sm'
      }`}
    >
      {/* Top Bar: Family, Localized name, Style, Badges & Favorite */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-start gap-2.5 overflow-hidden">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onSelect(e.target.checked);
            }}
            aria-label={`選取字體 ${font.family_name} ${font.style_name}`}
            className="mt-1 rounded border-studio-700 bg-studio-950 text-brand-600 focus:ring-brand-500 focus:ring-offset-studio-900 cursor-pointer"
          />
          <div className="overflow-hidden">
            <h3 className="font-semibold text-sm text-white truncate group-hover:text-brand-400 transition-colors">
              {font.localized_name ? `${font.localized_name} (${font.family_name})` : font.family_name}
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className="text-[11px] text-studio-400 font-medium">{font.style_name}</span>
              <span className={`text-[9px] uppercase px-1.5 py-0.2 rounded border font-mono ${formatColors[font.format] || formatColors.unknown}`}>
                {font.format}
              </span>
              {font.face_count > 1 && (
                <span className="text-[9px] px-1 py-0.2 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 font-mono">
                  面 {font.face_index + 1}/{font.face_count}
                </span>
              )}
              {font.install_scope === 'system' && (
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">
                  系統
                </span>
              )}
              {font.install_scope === 'user' && (
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                  使用者
                </span>
              )}
              {font.is_missing && (
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium flex items-center gap-0.5">
                  <AlertTriangle className="w-2.5 h-2.5" /> 檔案離線
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Favorite Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(e);
          }}
          title={font.is_favorite ? '取消收藏' : '加入收藏'}
          className="p-1 rounded-md text-studio-400 hover:text-rose-400 transition-colors"
        >
          <Heart
            className={`w-4 h-4 ${font.is_favorite ? 'fill-rose-500 text-rose-500' : 'text-studio-500 hover:text-rose-400'}`}
          />
        </button>
      </div>

      {/* Main Specimen Preview */}
      <div className="py-4 my-auto min-h-[90px] flex items-center overflow-hidden">
        {isCorrupted ? (
          <div className="flex items-center gap-2 text-rose-400 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>無法解析字體檔案或格式損壞</span>
          </div>
        ) : (
          <p
            style={{
              fontFamily: appliedFontFamily,
              fontSize: `${fontSize}px`,
              lineHeight: 1.25,
            }}
            className="text-slate-100 truncate w-full tracking-normal"
          >
            {defaultSample}
          </p>
        )}
      </div>

      {/* Card Footer: Metadata info */}
      <div className="pt-3 border-t border-studio-800/80 flex items-center justify-between text-[10px] text-studio-500 font-mono">
        <span>{(font.file_size / 1024).toFixed(0)} KB</span>
        {font.glyph_count !== undefined && font.glyph_count > 0 && (
          <span>{font.glyph_count.toLocaleString()} 字元</span>
        )}
      </div>
    </div>
  );
};
