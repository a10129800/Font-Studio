import React, { useState } from 'react';
import { CollectionRecord, TagRecord } from '../../../shared/types';
import {
  FolderPlus,
  Tag as TagIcon,
  Heart,
  Download,
  Trash2,
  X,
  Plus,
  Check,
} from 'lucide-react';

interface BatchActionBarProps {
  selectedCount: number;
  collections: CollectionRecord[];
  tags: TagRecord[];
  onAddToCollection: (collectionId: string) => Promise<void>;
  onAddTag: (tagName: string) => Promise<void>;
  onBatchFavorite: (favorite: boolean) => Promise<void>;
  onOpenInstallModal: () => void;
  onOpenUninstallModal: () => void;
  onClearSelection: () => void;
}

export const BatchActionBar: React.FC<BatchActionBarProps> = ({
  selectedCount,
  collections,
  tags,
  onAddToCollection,
  onAddTag,
  onBatchFavorite,
  onOpenInstallModal,
  onOpenUninstallModal,
  onClearSelection,
}) => {
  const [showColMenu, setShowColMenu] = useState(false);
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');

  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-9 left-64 right-0 z-40 flex justify-center pointer-events-none px-6">
      <div className="pointer-events-auto bg-studio-900/95 backdrop-blur-md border border-studio-700/80 shadow-2xl rounded-2xl px-5 py-2.5 flex items-center gap-3 text-xs text-white animate-in fade-in slide-in-from-bottom-4 duration-200">
        {/* Count Label */}
        <div className="flex items-center gap-2 pr-3 border-r border-studio-700">
          <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
          <span className="font-semibold text-studio-200">
            已選取 <span className="text-white font-mono font-bold text-brand-400">{selectedCount}</span> 個字體
          </span>
        </div>

        {/* Action: Add to Collection */}
        <div className="relative">
          <button
            onClick={() => {
              setShowColMenu(!showColMenu);
              setShowTagMenu(false);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-studio-800 hover:bg-studio-700 text-studio-200 hover:text-white transition-colors"
          >
            <FolderPlus className="w-3.5 h-3.5 text-brand-400" />
            <span>加入分類</span>
          </button>

          {showColMenu && (
            <div className="absolute bottom-full mb-2 left-0 w-52 bg-studio-900 border border-studio-700 rounded-xl shadow-xl overflow-hidden py-1.5 z-50">
              <div className="px-3 py-1 text-[10px] font-bold text-studio-500 uppercase tracking-wider">
                選擇字體分類
              </div>
              {collections.length === 0 ? (
                <div className="px-3 py-2 text-[11px] text-studio-500">尚未建立分類</div>
              ) : (
                <div className="max-h-48 overflow-y-auto">
                  {collections.map((col) => (
                    <button
                      key={col.id}
                      onClick={() => {
                        onAddToCollection(col.id);
                        setShowColMenu(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-studio-300 hover:text-white hover:bg-studio-800 flex items-center justify-between"
                    >
                      <span className="truncate">{col.name}</span>
                      <span className="text-[10px] text-studio-500 font-mono">
                        {col.font_count || 0}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action: Add Tag */}
        <div className="relative">
          <button
            onClick={() => {
              setShowTagMenu(!showTagMenu);
              setShowColMenu(false);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-studio-800 hover:bg-studio-700 text-studio-200 hover:text-white transition-colors"
          >
            <TagIcon className="w-3.5 h-3.5 text-amber-400" />
            <span>新增標籤</span>
          </button>

          {showTagMenu && (
            <div className="absolute bottom-full mb-2 left-0 w-60 bg-studio-900 border border-studio-700 rounded-xl shadow-xl overflow-hidden p-2.5 z-50 space-y-2">
              <div className="text-[10px] font-bold text-studio-500 uppercase tracking-wider">
                套用標籤
              </div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="標籤名稱..."
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newTagInput.trim()) {
                      onAddTag(newTagInput.trim());
                      setNewTagInput('');
                      setShowTagMenu(false);
                    }
                  }}
                  className="flex-1 bg-studio-950 border border-studio-700 rounded-md px-2.5 py-1 text-xs text-white placeholder-studio-500 focus:outline-none focus:border-brand-500"
                  autoFocus
                />
                <button
                  disabled={!newTagInput.trim()}
                  onClick={() => {
                    if (newTagInput.trim()) {
                      onAddTag(newTagInput.trim());
                      setNewTagInput('');
                      setShowTagMenu(false);
                    }
                  }}
                  className="px-2.5 py-1 rounded-md bg-brand-600 hover:bg-brand-500 text-white disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {tags.length > 0 && (
                <div className="max-h-36 overflow-y-auto pt-1 flex flex-wrap gap-1">
                  {tags.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        onAddTag(t.name);
                        setShowTagMenu(false);
                      }}
                      className="px-2 py-0.5 rounded bg-studio-950 hover:bg-studio-800 border border-studio-700 text-[11px] text-studio-300 hover:text-white"
                    >
                      #{t.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action: Batch Favorite */}
        <button
          onClick={() => onBatchFavorite(true)}
          title="將選取字體全部加入收藏"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-studio-800 hover:bg-studio-700 text-studio-200 hover:text-rose-400 transition-colors"
        >
          <Heart className="w-3.5 h-3.5 text-rose-400" />
          <span>收藏</span>
        </button>

        {/* Action: Windows Install */}
        <button
          onClick={onOpenInstallModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-medium transition-colors shadow-sm"
        >
          <Download className="w-3.5 h-3.5" />
          <span>安裝字體</span>
        </button>

        {/* Action: Windows Uninstall */}
        <button
          onClick={onOpenUninstallModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white font-medium transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>卸載字體</span>
        </button>

        {/* Clear selection */}
        <button
          onClick={onClearSelection}
          title="清除選取"
          className="p-1.5 rounded-lg text-studio-400 hover:text-white hover:bg-studio-800 transition-colors ml-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
