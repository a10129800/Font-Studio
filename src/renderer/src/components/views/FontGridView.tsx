import React from 'react';
import { FontRecord, FontFormat } from '../../../../shared/types';
import { FontCard } from '../FontCard';
import { FontListRow } from '../FontListRow';
import { FolderSearch, ChevronLeft, ChevronRight, X, CheckSquare, Square } from 'lucide-react';

interface FontGridViewProps {
  fonts: FontRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
  onPageSizeChange: (newPageSize: number) => void;
  previewText: string;
  fontSize: number;
  viewMode: 'grid' | 'list';
  selectedFontIds: Set<string>;
  onToggleSelectFont: (fontId: string, selected: boolean) => void;
  onSelectAllPage: (select: boolean) => void;
  onToggleFavorite: (fontId: string) => void;
  onSelectFontForDetail: (font: FontRecord) => void;
  onScanFonts: () => void;
  // Filters for chips
  searchQuery: string;
  onClearSearch: () => void;
  formatFilter: FontFormat | 'all';
  onClearFormat: () => void;
}

export const FontGridView: React.FC<FontGridViewProps> = ({
  fonts,
  total,
  page,
  pageSize,
  totalPages,
  onPageChange,
  onPageSizeChange,
  previewText,
  fontSize,
  viewMode,
  selectedFontIds,
  onToggleSelectFont,
  onSelectAllPage,
  onToggleFavorite,
  onSelectFontForDetail,
  onScanFonts,
  searchQuery,
  onClearSearch,
  formatFilter,
  onClearFormat,
}) => {
  const allPageSelected = fonts.length > 0 && fonts.every((f) => selectedFontIds.has(f.id));
  const hasActiveFilters = Boolean(searchQuery.trim() || formatFilter !== 'all');

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden select-none">
      {/* Sub-header Bar: Result summary, Active filter chips & Select all */}
      <div className="h-10 px-6 bg-studio-900/60 border-b border-studio-800/80 flex items-center justify-between text-xs flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onSelectAllPage(!allPageSelected)}
            className="flex items-center gap-1.5 text-studio-400 hover:text-white transition-colors"
          >
            {allPageSelected ? (
              <CheckSquare className="w-3.5 h-3.5 text-brand-400" />
            ) : (
              <Square className="w-3.5 h-3.5" />
            )}
            <span className="text-[11px]">全選本頁</span>
          </button>

          <span className="text-studio-500">|</span>

          <span className="text-studio-300 font-medium">
            共 <strong className="text-white font-mono">{total}</strong> 個字體項目
          </span>

          {/* Active Filter Chips */}
          {searchQuery && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-brand-500/10 border border-brand-500/20 text-brand-300 text-[11px]">
              <span>搜尋: {searchQuery}</span>
              <button onClick={onClearSearch} className="hover:text-white">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {formatFilter !== 'all' && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-brand-500/10 border border-brand-500/20 text-brand-300 text-[11px]">
              <span>格式: {formatFilter.toUpperCase()}</span>
              <button onClick={onClearFormat} className="hover:text-white">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Selected count info */}
        {selectedFontIds.size > 0 && (
          <div className="text-xs text-brand-400 font-medium">
            已勾選 {selectedFontIds.size} 個項目
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {fonts.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-studio-900 border border-studio-800 flex items-center justify-center text-studio-400 mb-4">
            <FolderSearch className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-white">尚無符合條件的字體</h3>
          <p className="text-xs text-studio-400 mt-1.5 max-w-sm">
            {hasActiveFilters
              ? '目前的搜尋或篩選條件查無相符項目，請嘗試清除篩選。'
              : '本機尚未掃描任何字體，請點擊下方按鈕開始掃描 Windows 系統字體。'}
          </p>
          <div className="flex items-center gap-3 mt-5">
            {hasActiveFilters ? (
              <button
                onClick={() => {
                  onClearSearch();
                  onClearFormat();
                }}
                className="px-4 py-2 rounded-xl bg-studio-800 hover:bg-studio-700 text-xs font-semibold text-white transition-colors"
              >
                清除所有篩選
              </button>
            ) : (
              <button
                onClick={onScanFonts}
                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-xs font-semibold text-white transition-colors"
              >
                立即掃描 Windows 字體
              </button>
            )}
          </div>
        </div>
      ) : (
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
      )}

      {/* Pagination Footer Toolbar */}
      {total > 0 && (
        <div className="h-12 px-6 bg-studio-900 border-t border-studio-800 flex items-center justify-between text-xs flex-shrink-0">
          <div className="flex items-center gap-2 text-studio-400">
            <span>每頁顯示:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="每頁顯示數量"
              className="bg-studio-950 border border-studio-800 rounded px-2 py-1 text-xs text-studio-200 focus:outline-none focus:border-brand-500"
            >
              <option value="24">24</option>
              <option value="36">36</option>
              <option value="48">48</option>
              <option value="96">96</option>
            </select>
          </div>

          {/* Page Switcher */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-studio-800 text-studio-300 hover:text-white hover:bg-studio-800 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-xs font-mono text-studio-300">
              第 <strong className="text-white">{page}</strong> / {totalPages} 頁
            </span>

            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg border border-studio-800 text-studio-300 hover:text-white hover:bg-studio-800 disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
