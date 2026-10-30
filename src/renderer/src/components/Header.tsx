import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  SlidersHorizontal,
  LayoutGrid,
  List,
  FolderOpen,
  FileUp,
  ChevronDown,
  RefreshCw,
  Sun,
  Moon,
  X,
} from 'lucide-react';
import { FontFormat } from '../../../shared/types';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  previewText: string;
  onPreviewTextChange: (text: string) => void;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  formatFilter: FontFormat | 'all';
  onFormatFilterChange: (format: FontFormat | 'all') => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  sortBy: string;
  onSortByChange: (sortBy: string) => void;
  isScanning: boolean;
  onStartScan: () => void;
  onImportFolder: () => void;
  onImportFiles?: () => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  previewText,
  onPreviewTextChange,
  fontSize,
  onFontSizeChange,
  formatFilter,
  onFormatFilterChange,
  viewMode,
  onViewModeChange,
  sortBy,
  onSortByChange,
  isScanning,
  onStartScan,
  onImportFolder,
  onImportFiles,
  isDarkMode,
  onToggleTheme,
}) => {
  const [isImportMenuOpen, setIsImportMenuOpen] = useState(false);
  const importMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (importMenuRef.current && !importMenuRef.current.contains(e.target as Node)) {
        setIsImportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  return (
    <header className="h-16 bg-studio-900 border-b border-studio-800 px-6 flex items-center justify-between gap-4 flex-shrink-0 select-none">
      {/* Search Input */}
      <div className="relative w-72">
        <Search className="w-4 h-4 text-studio-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="搜尋字體家族或樣式..."
          className="w-full bg-studio-950 border border-studio-800 rounded-lg pl-9 pr-8 py-1.5 text-xs text-white placeholder-studio-500 focus:outline-none focus:border-brand-500 transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-studio-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Preview Text & Size Controls */}
      <div className="flex-1 max-w-md flex items-center gap-3">
        <input
          type="text"
          value={previewText}
          onChange={(e) => onPreviewTextChange(e.target.value)}
          placeholder="輸入預覽字樣..."
          className="flex-1 bg-studio-950 border border-studio-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-studio-500 focus:outline-none focus:border-brand-500 transition-colors"
        />
        <div className="flex items-center gap-2 w-32">
          <input
            type="range"
            min="14"
            max="72"
            value={fontSize}
            onChange={(e) => onFontSizeChange(Number(e.target.value))}
            className="w-full h-1 bg-studio-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
          />
          <span className="text-[11px] font-mono text-studio-400 w-8 text-right">{fontSize}px</span>
        </div>
      </div>

      {/* Filter & View Switchers */}
      <div className="flex items-center gap-2">
        {/* Format Filter */}
        <select
          value={formatFilter}
          onChange={(e) => onFormatFilterChange(e.target.value as any)}
          aria-label="字體格式篩選"
          className="bg-studio-950 border border-studio-800 rounded-lg px-2.5 py-1.5 text-xs text-studio-300 focus:outline-none focus:border-brand-500"
        >
          <option value="all">所有格式</option>
          <option value="ttf">TTF</option>
          <option value="otf">OTF</option>
          <option value="ttc">TTC</option>
          <option value="woff">WOFF</option>
          <option value="woff2">WOFF2</option>
        </select>

        {/* Sort Options */}
        <select
          value={sortBy}
          onChange={(e) => onSortByChange(e.target.value)}
          aria-label="字體排序方式"
          className="bg-studio-950 border border-studio-800 rounded-lg px-2.5 py-1.5 text-xs text-studio-300 focus:outline-none focus:border-brand-500"
        >
          <option value="family_name">依名稱 (A-Z)</option>
          <option value="file_size">依大小</option>
          <option value="last_scanned_at">依最新掃描</option>
        </select>

        {/* View Mode Toggle */}
        <div className="flex items-center bg-studio-950 border border-studio-800 rounded-lg p-0.5">
          <button
            onClick={() => onViewModeChange('grid')}
            title="網格檢視"
            className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-studio-800 text-brand-400' : 'text-studio-400 hover:text-white'}`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onViewModeChange('list')}
            title="清單檢視"
            className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-studio-800 text-brand-400' : 'text-studio-400 hover:text-white'}`}
          >
            <List className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Import Action Dropdown */}
        <div className="relative" ref={importMenuRef}>
          <button
            onClick={() => setIsImportMenuOpen((prev) => !prev)}
            disabled={isScanning}
            title="匯入自訂字體檔案或資料夾"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-studio-700 bg-studio-800 hover:bg-studio-700 text-xs text-studio-200 transition-colors disabled:opacity-50"
          >
            <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
            <span>匯入</span>
            <ChevronDown className="w-3 h-3 text-studio-400" />
          </button>

          {isImportMenuOpen && (
            <div className="absolute right-0 mt-1.5 w-48 bg-studio-900 border border-studio-700 rounded-xl shadow-2xl py-1 z-50">
              <button
                onClick={() => {
                  setIsImportMenuOpen(false);
                  if (onImportFiles) onImportFiles();
                  else onImportFolder();
                }}
                className="w-full text-left px-3 py-2 text-xs text-studio-200 hover:bg-studio-800 flex items-center gap-2 transition-colors"
              >
                <FileUp className="w-3.5 h-3.5 text-brand-400" />
                <span>匯入字體檔案...</span>
              </button>
              <button
                onClick={() => {
                  setIsImportMenuOpen(false);
                  onImportFolder();
                }}
                className="w-full text-left px-3 py-2 text-xs text-studio-200 hover:bg-studio-800 flex items-center gap-2 transition-colors"
              >
                <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
                <span>匯入字體資料夾...</span>
              </button>
            </div>
          )}
        </div>

        {/* Scan System Fonts Button */}
        <button
          onClick={onStartScan}
          disabled={isScanning}
          title="重新掃描 Windows 系統字體"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-xs text-white font-medium shadow-sm transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
          <span>{isScanning ? '掃描中...' : '掃描字體'}</span>
        </button>

        {/* Theme Toggle */}
        <button
          onClick={onToggleTheme}
          title="切換深淺色主題"
          className="p-2 rounded-lg border border-studio-800 text-studio-400 hover:text-white hover:bg-studio-800 transition-colors"
        >
          {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};

