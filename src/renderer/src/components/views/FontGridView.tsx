import React from 'react';
import { FontRecord } from '../../../../shared/types';
import { FontCard } from '../FontCard';
import { FontListRow } from '../FontListRow';
import { Type, FolderSearch } from 'lucide-react';

interface FontGridViewProps {
  fonts: FontRecord[];
  previewText: string;
  fontSize: number;
  viewMode: 'grid' | 'list';
  selectedFontIds: Set<string>;
  onToggleSelectFont: (fontId: string, selected: boolean) => void;
  onToggleFavorite: (fontId: string) => void;
  onSelectFontForDetail: (font: FontRecord) => void;
  onScanFonts: () => void;
}

export const FontGridView: React.FC<FontGridViewProps> = ({
  fonts,
  previewText,
  fontSize,
  viewMode,
  selectedFontIds,
  onToggleSelectFont,
  onToggleFavorite,
  onSelectFontForDetail,
  onScanFonts,
}) => {
  if (fonts.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none">
        <div className="w-16 h-16 rounded-2xl bg-studio-900 border border-studio-800 flex items-center justify-center text-studio-400 mb-4">
          <FolderSearch className="w-8 h-8" />
        </div>
        <h3 className="text-base font-semibold text-white">尚無符合條件的字體</h3>
        <p className="text-xs text-studio-400 mt-1.5 max-w-sm">
          可能是尚未掃描 Windows 系統字體、尚未匯入字體資料夾，或目前的搜尋與篩選條件無相符項目。
        </p>
        <button
          onClick={onScanFonts}
          className="mt-5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-xs font-semibold text-white transition-colors"
        >
          立即掃描字體
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {fonts.map((font) => (
            <FontCard
              key={font.id}
              font={font}
              previewText={previewText}
              fontSize={fontSize}
              isSelected={selectedFontIds.has(font.id)}
              onSelect={(selected) => onToggleSelectFont(font.id, selected)}
              onToggleFavorite={() => onToggleFavorite(font.id)}
              onClick={() => onSelectFontForDetail(font)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {fonts.map((font) => (
            <FontListRow
              key={font.id}
              font={font}
              previewText={previewText}
              fontSize={fontSize}
              isSelected={selectedFontIds.has(font.id)}
              onSelect={(selected) => onToggleSelectFont(font.id, selected)}
              onToggleFavorite={() => onToggleFavorite(font.id)}
              onClick={() => onSelectFontForDetail(font)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

