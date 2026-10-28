import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Sidebar, NavTabId } from './components/Sidebar';
import { Header } from './components/Header';
import { StatusBar } from './components/StatusBar';
import { FontDetailPanel } from './components/FontDetailPanel';
import { OverviewView } from './components/views/OverviewView';
import { FontGridView } from './components/views/FontGridView';
import { CollectionsView } from './components/views/CollectionsView';
import { CompareView } from './components/views/CompareView';
import { GlyphView } from './components/views/GlyphView';
import { DuplicatesView } from './components/views/DuplicatesView';
import { BackupView } from './components/views/BackupView';
import { StorageAnalysisView } from './components/views/StorageAnalysisView';
import { SettingsView } from './components/views/SettingsView';
import { FontRecord, CollectionRecord, TagRecord, FontFormat, ScanProgressUpdate } from '../../shared/types';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTabId>('overview');
  const [fonts, setFonts] = useState<FontRecord[]>([]);
  const [collections, setCollections] = useState<CollectionRecord[]>([]);
  const [tags, setTags] = useState<TagRecord[]>([]);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [formatFilter, setFormatFilter] = useState<FontFormat | 'all'>('all');
  const [sortBy, setSortBy] = useState('family_name');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Preview & Typography Controls
  const [previewText, setPreviewText] = useState('永和九年歲在癸丑 The Quick Brown Fox');
  const [fontSize, setFontSize] = useState(26);
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Selection & Details
  const [selectedFontIds, setSelectedFontIds] = useState<Set<string>>(new Set());
  const [selectedFontForDetail, setSelectedFontForDetail] = useState<FontRecord | null>(null);

  // Scanning & Operations
  const [scanProgress, setScanProgress] = useState<ScanProgressUpdate | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');

  const api = typeof window !== 'undefined' ? window.fontStudioAPI : undefined;

  // Load fonts from SQLite
  const loadFonts = useCallback(async () => {
    if (!api) return;
    try {
      const data = await api.fonts.getAll({
        searchQuery,
        format: formatFilter,
        sortBy: sortBy as any,
      });
      setFonts(data);
    } catch (err) {
      console.error('Failed to load fonts:', err);
    }
  }, [api, searchQuery, formatFilter, sortBy]);

  // Load collections & tags
  const loadCollections = useCallback(async () => {
    if (!api) return;
    try {
      const cols = await api.collections.getAll();
      setCollections(cols);
      const allTags = await api.tags.getAll();
      setTags(allTags);
    } catch (err) {
      console.error('Failed to load collections:', err);
    }
  }, [api]);

  useEffect(() => {
    loadFonts();
    loadCollections();
  }, [loadFonts, loadCollections]);

  // Subscribe to real scan progress events
  useEffect(() => {
    if (!api) return;
    const unsubscribe = api.fonts.onScanProgress((progress: ScanProgressUpdate) => {
      setScanProgress(progress);
      if (progress.phase === 'complete') {
        loadFonts();
        loadCollections();
        setStatusMessage(`掃描完成！新增或更新共 ${progress.successCount} 個字體`);
      } else if (progress.phase === 'cancelled') {
        loadFonts();
        setStatusMessage('掃描已被使用者取消');
      }
    });

    return () => {
      unsubscribe();
    };
  }, [api, loadFonts, loadCollections]);

  // Actions
  const handleStartScan = async () => {
    if (!api) return;
    try {
      setStatusMessage('正在探索 Windows 系統字體目錄...');
      await api.fonts.startScan();
    } catch (err: any) {
      console.error('Scan error:', err);
      setStatusMessage(`掃描失敗: ${err.message}`);
    }
  };

  const handleCancelScan = async () => {
    if (!api) return;
    await api.fonts.cancelScan();
  };

  const handleImportFolder = async () => {
    if (!api) return;
    const folder = await api.dialog.selectFolder();
    if (folder) {
      setStatusMessage(`正在掃描自訂資料夾: ${folder}`);
      await api.fonts.startScan([folder]);
    }
  };

  const handleToggleFavorite = async (fontId: string) => {
    if (!api) return;
    const newStatus = await api.fonts.toggleFavorite(fontId);
    setFonts((prev) =>
      prev.map((f) => (f.id === fontId ? { ...f, is_favorite: newStatus } : f))
    );
    if (selectedFontForDetail?.id === fontId) {
      setSelectedFontForDetail((prev) => (prev ? { ...prev, is_favorite: newStatus } : null));
    }
  };

  const handleToggleSelectFont = (fontId: string, selected: boolean) => {
    setSelectedFontIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(fontId);
      else next.delete(fontId);
      return next;
    });
  };

  const handleCreateCollection = async (name: string, description: string) => {
    if (!api) return;
    await api.collections.create(name, description);
    await loadCollections();
  };

  const handleRenameCollection = async (id: string, newName: string) => {
    if (!api) return;
    await api.collections.rename(id, newName);
    await loadCollections();
  };

  const handleDeleteCollection = async (id: string) => {
    if (!api) return;
    await api.collections.delete(id);
    await loadCollections();
  };

  const handleCreateTag = async (name: string) => {
    if (!api) return;
    await api.tags.create(name);
    await loadCollections();
  };

  const handleAddToCollection = async (colId: string) => {
    if (!api || !selectedFontForDetail) return;
    await api.collections.addFont(selectedFontForDetail.id, colId);
    const updated = await api.fonts.getById(selectedFontForDetail.id);
    if (updated) setSelectedFontForDetail(updated);
    await loadCollections();
  };

  const handleRemoveFromCollection = async (colId: string) => {
    if (!api || !selectedFontForDetail) return;
    await api.collections.removeFont(selectedFontForDetail.id, colId);
    const updated = await api.fonts.getById(selectedFontForDetail.id);
    if (updated) setSelectedFontForDetail(updated);
    await loadCollections();
  };

  const handleOpenFilePath = async (filePath: string) => {
    if (!api) return;
    await api.system.openPath(filePath);
  };

  const fontCounts = useMemo(() => {
    return {
      total: fonts.length,
      installed: fonts.filter((f) => f.install_scope === 'system' || f.install_scope === 'user').length,
      local: fonts.filter((f) => f.source_type === 'imported').length,
      favorites: fonts.filter((f) => f.is_favorite).length,
    };
  }, [fonts]);

  // Filter fonts for current tab
  const displayedFonts = useMemo(() => {
    switch (activeTab) {
      case 'installed':
        return fonts.filter((f) => f.install_scope === 'system' || f.install_scope === 'user');
      case 'local':
        return fonts.filter((f) => f.source_type === 'imported');
      case 'favorites':
        return fonts.filter((f) => f.is_favorite);
      default:
        return fonts;
    }
  }, [activeTab, fonts]);

  const isScanning = Boolean(
    scanProgress && scanProgress.phase !== 'complete' && scanProgress.phase !== 'cancelled'
  );

  return (
    <div className={`flex flex-col h-screen w-screen overflow-hidden ${isDarkMode ? 'dark' : ''}`}>
      <div className="flex flex-1 overflow-hidden">
        {/* Left Navigation */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            setSelectedFontForDetail(null);
          }}
          fontCounts={fontCounts}
        />

        {/* Center Main Work Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-studio-950 overflow-hidden">
          {/* Header Controls */}
          <Header
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            previewText={previewText}
            onPreviewTextChange={setPreviewText}
            fontSize={fontSize}
            onFontSizeChange={setFontSize}
            formatFilter={formatFilter}
            onFormatFilterChange={setFormatFilter}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            sortBy={sortBy}
            onSortByChange={setSortBy}
            isScanning={isScanning}
            onStartScan={handleStartScan}
            onImportFolder={handleImportFolder}
            isDarkMode={isDarkMode}
            onToggleTheme={() => setIsDarkMode(!isDarkMode)}
          />

          {/* Dynamic Active View */}
          <main className="flex-1 flex overflow-hidden">
            {activeTab === 'overview' && (
              <OverviewView
                fonts={fonts}
                onNavigate={setActiveTab}
                onStartScan={handleStartScan}
                onImportFolder={handleImportFolder}
                isScanning={isScanning}
              />
            )}

            {(activeTab === 'all-fonts' || activeTab === 'installed' || activeTab === 'local' || activeTab === 'favorites') && (
              <FontGridView
                fonts={displayedFonts}
                previewText={previewText}
                fontSize={fontSize}
                viewMode={viewMode}
                selectedFontIds={selectedFontIds}
                onToggleSelectFont={handleToggleSelectFont}
                onToggleFavorite={handleToggleFavorite}
                onSelectFontForDetail={setSelectedFontForDetail}
                onScanFonts={handleStartScan}
              />
            )}

            {activeTab === 'collections' && (
              <CollectionsView
                collections={collections}
                tags={tags}
                fonts={fonts}
                onCreateCollection={handleCreateCollection}
                onRenameCollection={handleRenameCollection}
                onDeleteCollection={handleDeleteCollection}
                onCreateTag={handleCreateTag}
                onSelectCollection={(colId) => {
                  setActiveTab('all-fonts');
                }}
              />
            )}

            {activeTab === 'compare' && <CompareView fonts={fonts} />}
            {activeTab === 'glyph-viewer' && <GlyphView fonts={fonts} />}
            {activeTab === 'duplicates' && (
              <DuplicatesView fonts={fonts} onOpenFilePath={handleOpenFilePath} />
            )}
            {activeTab === 'backup' && (
              <BackupView
                fonts={fonts}
                onSelectSavePath={async () => {
                  if (!api) return null;
                  return api.dialog.saveFile('font_studio_backup.zip', [
                    { name: 'ZIP Archive', extensions: ['zip'] },
                  ]);
                }}
                onSelectZipFile={async () => {
                  if (!api) return null;
                  return api.dialog.selectFile([
                    { name: 'ZIP Archive', extensions: ['zip'] },
                  ]);
                }}
              />
            )}
            {activeTab === 'storage' && <StorageAnalysisView fonts={fonts} />}
            {activeTab === 'settings' && (
              <SettingsView
                isDarkMode={isDarkMode}
                onToggleTheme={() => setIsDarkMode(!isDarkMode)}
                defaultPreviewText={previewText}
                onDefaultPreviewTextChange={setPreviewText}
                onRescanAll={handleStartScan}
                isScanning={isScanning}
              />
            )}

            {/* Slide-out Font Detail Panel */}
            {selectedFontForDetail && (
              <FontDetailPanel
                font={selectedFontForDetail}
                onClose={() => setSelectedFontForDetail(null)}
                onToggleFavorite={() => handleToggleFavorite(selectedFontForDetail.id)}
                collections={collections}
                onAddToCollection={handleAddToCollection}
                onRemoveFromCollection={handleRemoveFromCollection}
                onOpenFilePath={handleOpenFilePath}
              />
            )}
          </main>
        </div>
      </div>

      {/* Bottom Status Bar */}
      <StatusBar
        scanProgress={scanProgress}
        onCancelScan={handleCancelScan}
        statusMessage={statusMessage}
        totalFonts={fonts.length}
      />
    </div>
  );
};

export default App;

