import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Sidebar, NavTabId } from './components/Sidebar';
import { Header } from './components/Header';
import { StatusBar } from './components/StatusBar';
import { FontDetailPanel } from './components/FontDetailPanel';
import { BatchActionBar } from './components/BatchActionBar';
import { BatchOperationModal } from './components/BatchOperationModal';
import { OverviewView } from './components/views/OverviewView';
import { FontGridView } from './components/views/FontGridView';
import { CollectionsView } from './components/views/CollectionsView';
import { CompareView } from './components/views/CompareView';
import { GlyphView } from './components/views/GlyphView';
import { DuplicatesView } from './components/views/DuplicatesView';
import { BackupView } from './components/views/BackupView';
import { StorageAnalysisView } from './components/views/StorageAnalysisView';
import { SettingsView } from './components/views/SettingsView';
import {
  FontRecord,
  CollectionRecord,
  TagRecord,
  FontFormat,
  ScanProgressUpdate,
  BatchTaskProgressUpdate,
} from '../../shared/types';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTabId>('overview');
  const [fonts, setFonts] = useState<FontRecord[]>([]);
  const [collections, setCollections] = useState<CollectionRecord[]>([]);
  const [tags, setTags] = useState<TagRecord[]>([]);

  // Pagination & Counts
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(36);
  const [totalFonts, setTotalFonts] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [fontCounts, setFontCounts] = useState({
    total: 0,
    installed: 0,
    local: 0,
    favorites: 0,
  });

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

  // Active collection or tag filter from navigation
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [activeTagId, setActiveTagId] = useState<string | null>(null);

  // Scanning & Operations
  const [scanProgress, setScanProgress] = useState<ScanProgressUpdate | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Batch Job Queue State
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchModalType, setBatchModalType] = useState<'install' | 'uninstall'>('install');
  const [batchProgress, setBatchProgress] = useState<BatchTaskProgressUpdate | null>(null);
  const [isBatchRunning, setIsBatchRunning] = useState(false);

  const api = typeof window !== 'undefined' ? window.fontStudioAPI : undefined;

  // Load global counts for sidebar badges
  const loadCounts = useCallback(async () => {
    if (!api) return;
    try {
      const allRes = await api.fonts.getAll({ pageSize: 1 });
      const installedRes = await api.fonts.getAll({ installScope: 'installed', pageSize: 1 });
      const localRes = await api.fonts.getAll({ sourceType: 'imported', pageSize: 1 });
      const favRes = await api.fonts.getAll({ isFavorite: true, pageSize: 1 });

      setFontCounts({
        total: allRes.total,
        installed: installedRes.total,
        local: localRes.total,
        favorites: favRes.total,
      });
    } catch (err) {
      console.error('Failed to load counts:', err);
    }
  }, [api]);

  // Load fonts from SQLite with pagination
  const loadFonts = useCallback(async () => {
    if (!api) return;
    try {
      const filterOpts: any = {
        searchQuery,
        format: formatFilter,
        sortBy,
        page,
        pageSize,
      };

      if (activeTab === 'installed') {
        filterOpts.installScope = 'installed';
      } else if (activeTab === 'local') {
        filterOpts.sourceType = 'imported';
      } else if (activeTab === 'favorites') {
        filterOpts.isFavorite = true;
      }

      if (activeCollectionId) {
        filterOpts.collectionId = activeCollectionId;
      }
      if (activeTagId) {
        filterOpts.tagId = activeTagId;
      }

      const res = await api.fonts.getAll(filterOpts);
      setFonts(res.fonts);
      setTotalFonts(res.total);
      setTotalPages(res.totalPages);
    } catch (err) {
      console.error('Failed to load fonts:', err);
    }
  }, [api, searchQuery, formatFilter, sortBy, page, pageSize, activeTab, activeCollectionId, activeTagId]);

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
  }, [loadFonts]);

  useEffect(() => {
    loadCollections();
    loadCounts();
  }, [loadCollections, loadCounts]);

  // Subscribe to real scan progress events
  useEffect(() => {
    if (!api) return;
    const unsubscribe = api.fonts.onScanProgress((progress: ScanProgressUpdate) => {
      setScanProgress(progress);
      if (progress.phase === 'complete') {
        loadFonts();
        loadCollections();
        loadCounts();
        setStatusMessage(`掃描完成！新增或更新共 ${progress.successCount} 個字體`);
      } else if (progress.phase === 'cancelled') {
        loadFonts();
        loadCounts();
        setStatusMessage('掃描已被使用者取消');
      }
    });

    return () => {
      unsubscribe();
    };
  }, [api, loadFonts, loadCollections, loadCounts]);

  // Subscribe to real batch install/uninstall task progress events
  useEffect(() => {
    if (!api) return;
    const unsubscribe = api.install.onTaskProgress((progress: BatchTaskProgressUpdate) => {
      setBatchProgress(progress);
      if (progress.phase === 'completed' || progress.phase === 'error' || progress.phase === 'cancelled') {
        setIsBatchRunning(false);
        loadFonts();
        loadCounts();
        if (progress.phase === 'completed') {
          setStatusMessage(`批次作業完成：成功 ${progress.successCount}，略過 ${progress.skippedCount}，失敗 ${progress.failedCount}`);
        } else if (progress.phase === 'cancelled') {
          setStatusMessage('批次作業已被中止');
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [api, loadFonts, loadCounts]);

  // Reset pagination on filter or tab change
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setPage(1);
  };

  const handleFormatChange = (format: FontFormat | 'all') => {
    setFormatFilter(format);
    setPage(1);
  };

  const handleSortChange = (newSort: string) => {
    setSortBy(newSort);
    setPage(1);
  };

  const handleTabChange = (newTab: NavTabId) => {
    setActiveTab(newTab);
    setSelectedFontForDetail(null);
    setPage(1);
  };

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
    loadCounts();
  };

  const handleToggleSelectFont = (fontId: string, selected: boolean) => {
    setSelectedFontIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(fontId);
      else next.delete(fontId);
      return next;
    });
  };

  const handleSelectAllPage = (select: boolean) => {
    setSelectedFontIds((prev) => {
      const next = new Set(prev);
      for (const f of fonts) {
        if (select) next.add(f.id);
        else next.delete(f.id);
      }
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

  const handleBatchAddToCollection = async (collectionId: string) => {
    if (!api || selectedFontIds.size === 0) return;
    const res = await api.collections.addFontsBatch(Array.from(selectedFontIds), collectionId);
    setStatusMessage(`已將 ${res.count} 個字體加入分類`);
    await loadCollections();
  };

  const handleBatchAddTag = async (tagName: string) => {
    if (!api || selectedFontIds.size === 0) return;
    const tag = await api.tags.create(tagName);
    const res = await api.tags.addBatch(Array.from(selectedFontIds), tag.id);
    setStatusMessage(`已為 ${res.count} 個字體加上標籤 #${tagName}`);
    await loadCollections();
  };

  const handleBatchFavorite = async (favorite: boolean) => {
    if (!api || selectedFontIds.size === 0) return;
    const res = await api.fonts.setFavoritesBatch(Array.from(selectedFontIds), favorite);
    setStatusMessage(`已更新 ${res.count} 個字體的收藏狀態`);
    await loadFonts();
    await loadCounts();
  };

  const handleRenameTag = async (id: string, newName: string) => {
    if (!api) return;
    await api.tags.rename(id, newName);
    await loadCollections();
  };

  const handleDeleteTag = async (id: string) => {
    if (!api) return;
    await api.tags.delete(id);
    await loadCollections();
  };

  const handleConfirmBatchOperation = async () => {
    if (!api || selectedFontIds.size === 0) return;
    setIsBatchRunning(true);
    try {
      const ids = Array.from(selectedFontIds);
      if (batchModalType === 'install') {
        await api.install.installFonts(ids);
      } else {
        await api.install.uninstallFonts(ids);
      }
    } catch (err: any) {
      console.error('Batch execution error:', err);
      setIsBatchRunning(false);
      setStatusMessage(`批次作業失敗: ${err.message}`);
    }
  };

  const handleCancelBatchTask = async () => {
    if (!api || !batchProgress?.taskId) return;
    await api.install.cancelTask(batchProgress.taskId);
  };

  const isScanning = Boolean(
    scanProgress && scanProgress.phase !== 'complete' && scanProgress.phase !== 'cancelled'
  );

  return (
    <div className={`flex flex-col h-screen w-screen overflow-hidden ${isDarkMode ? 'dark' : ''}`}>
      <div className="flex flex-1 overflow-hidden">
        {/* Left Navigation */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          fontCounts={fontCounts}
        />

        {/* Center Main Work Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-studio-950 overflow-hidden">
          {/* Header Controls */}
          <Header
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            previewText={previewText}
            onPreviewTextChange={setPreviewText}
            fontSize={fontSize}
            onFontSizeChange={setFontSize}
            formatFilter={formatFilter}
            onFormatFilterChange={handleFormatChange}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            sortBy={sortBy}
            onSortByChange={handleSortChange}
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
                onNavigate={handleTabChange}
                onStartScan={handleStartScan}
                onImportFolder={handleImportFolder}
                isScanning={isScanning}
              />
            )}

            {(activeTab === 'all-fonts' || activeTab === 'installed' || activeTab === 'local' || activeTab === 'favorites') && (
              <FontGridView
                fonts={fonts}
                total={totalFonts}
                page={page}
                pageSize={pageSize}
                totalPages={totalPages}
                onPageChange={setPage}
                onPageSizeChange={(newSize) => {
                  setPageSize(newSize);
                  setPage(1);
                }}
                previewText={previewText}
                fontSize={fontSize}
                viewMode={viewMode}
                selectedFontIds={selectedFontIds}
                onToggleSelectFont={handleToggleSelectFont}
                onSelectAllPage={handleSelectAllPage}
                onToggleFavorite={handleToggleFavorite}
                onSelectFontForDetail={setSelectedFontForDetail}
                onScanFonts={handleStartScan}
                searchQuery={searchQuery}
                onClearSearch={() => handleSearchChange('')}
                formatFilter={formatFilter}
                onClearFormat={() => handleFormatChange('all')}
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
                onRenameTag={handleRenameTag}
                onDeleteTag={handleDeleteTag}
                onSelectCollection={(colId) => {
                  setActiveCollectionId(colId);
                  setActiveTagId(null);
                  setActiveTab('all-fonts');
                }}
                onSelectTag={(tagId) => {
                  setActiveTagId(tagId);
                  setActiveCollectionId(null);
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

      {/* Floating Batch Action Bar */}
      <BatchActionBar
        selectedCount={selectedFontIds.size}
        collections={collections}
        tags={tags}
        onAddToCollection={handleBatchAddToCollection}
        onAddTag={handleBatchAddTag}
        onBatchFavorite={handleBatchFavorite}
        onOpenInstallModal={() => {
          setBatchModalType('install');
          setBatchProgress(null);
          setIsBatchModalOpen(true);
        }}
        onOpenUninstallModal={() => {
          setBatchModalType('uninstall');
          setBatchProgress(null);
          setIsBatchModalOpen(true);
        }}
        onClearSelection={() => setSelectedFontIds(new Set())}
      />

      {/* Batch Install / Uninstall Confirmation & Progress Modal */}
      <BatchOperationModal
        isOpen={isBatchModalOpen}
        type={batchModalType}
        selectedCount={selectedFontIds.size}
        progress={batchProgress}
        isRunning={isBatchRunning}
        onConfirm={handleConfirmBatchOperation}
        onCancelTask={handleCancelBatchTask}
        onClose={() => {
          setIsBatchModalOpen(false);
          setBatchProgress(null);
          setIsBatchRunning(false);
          setSelectedFontIds(new Set());
        }}
      />

      {/* Bottom Status Bar */}
      <StatusBar
        scanProgress={scanProgress}
        onCancelScan={handleCancelScan}
        statusMessage={statusMessage}
        totalFonts={totalFonts}
      />
    </div>
  );
};

export default App;
