import React, { useState } from 'react';
import { CollectionRecord, TagRecord, FontRecord } from '../../../../shared/types';
import { FolderTree, Plus, Trash2, Edit2, Tag, Check, X } from 'lucide-react';

interface CollectionsViewProps {
  collections: CollectionRecord[];
  tags: TagRecord[];
  fonts: FontRecord[];
  onCreateCollection: (name: string, description: string) => Promise<void>;
  onRenameCollection: (id: string, newName: string) => Promise<void>;
  onDeleteCollection: (id: string) => Promise<void>;
  onCreateTag: (name: string) => Promise<void>;
  onRenameTag?: (id: string, newName: string) => Promise<void>;
  onDeleteTag?: (id: string) => Promise<void>;
  onSelectCollection: (collectionId: string) => void;
  onSelectTag?: (tagId: string) => void;
}

export const CollectionsView: React.FC<CollectionsViewProps> = ({
  collections,
  tags,
  onCreateCollection,
  onRenameCollection,
  onDeleteCollection,
  onCreateTag,
  onRenameTag,
  onDeleteTag,
  onSelectCollection,
  onSelectTag,
}) => {
  const [newColName, setNewColName] = useState('');
  const [newColDesc, setNewColDesc] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const [newTagName, setNewTagName] = useState('');
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingTagName, setEditingTagName] = useState('');

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColName.trim()) return;
    await onCreateCollection(newColName.trim(), newColDesc.trim());
    setNewColName('');
    setNewColDesc('');
  };

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;
    await onCreateTag(newTagName.trim());
    setNewTagName('');
  };

  const saveRename = async (id: string) => {
    if (!editingName.trim()) return;
    await onRenameCollection(id, editingName.trim());
    setEditingId(null);
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 select-none">
      {/* Top Banner */}
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <FolderTree className="w-5 h-5 text-brand-400" />
          <span>字體分類與標籤管理</span>
        </h2>
        <p className="text-xs text-studio-400 mt-1">
          建立個人化專案字體庫、風格分類（如無襯線、標題黑體、手寫風），自訂標籤以方便多條件篩選。
        </p>
      </div>

      <div className="grid grid-cols-3 gap-8">
        {/* Collections List & Creator (2 cols) */}
        <div className="col-span-2 space-y-6">
          {/* Create Collection Card */}
          <form onSubmit={handleCreateCollection} className="p-5 rounded-xl bg-studio-900 border border-studio-800 space-y-3">
            <h3 className="text-xs font-bold text-studio-300 uppercase tracking-wider flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-brand-400" />
              <span>建立新分類</span>
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="分類名稱 (例: 2026 品牌識別、書籍內文)"
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                className="bg-studio-950 border border-studio-800 rounded-lg px-3 py-2 text-xs text-white placeholder-studio-500 focus:outline-none focus:border-brand-500"
              />
              <input
                type="text"
                placeholder="備註說明 (選填)"
                value={newColDesc}
                onChange={(e) => setNewColDesc(e.target.value)}
                className="bg-studio-950 border border-studio-800 rounded-lg px-3 py-2 text-xs text-white placeholder-studio-500 focus:outline-none focus:border-brand-500"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!newColName.trim()}
                className="px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-xs font-medium text-white transition-colors disabled:opacity-50"
              >
                新增分類
              </button>
            </div>
          </form>

          {/* Collections Grid */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-studio-400 uppercase tracking-wider">現有分類 ({collections.length})</h3>
            {collections.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-studio-900/50 border border-studio-800 text-xs text-studio-500">
                尚未建立任何字體分類。
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {collections.map((col) => (
                  <div
                    key={col.id}
                    className="p-4 rounded-xl bg-studio-900 border border-studio-800 hover:border-studio-700 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        {editingId === col.id ? (
                          <div className="flex items-center gap-1.5 flex-1 mr-2">
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              className="w-full bg-studio-950 border border-brand-500 rounded px-2 py-1 text-xs text-white"
                              autoFocus
                            />
                            <button
                              onClick={() => saveRename(col.id)}
                              className="p-1 rounded text-emerald-400 hover:bg-studio-800"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1 rounded text-studio-400 hover:bg-studio-800"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <h4
                            onClick={() => onSelectCollection(col.id)}
                            className="font-semibold text-xs text-white hover:text-brand-400 cursor-pointer transition-colors"
                          >
                            {col.name}
                          </h4>
                        )}
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-studio-800 text-studio-300 font-mono">
                          {col.font_count || 0} 個字體
                        </span>
                      </div>
                      {col.description && (
                        <p className="text-[11px] text-studio-400 mt-1 line-clamp-2">{col.description}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-1 mt-3 pt-2 border-t border-studio-800/80">
                      <button
                        onClick={() => {
                          setEditingId(col.id);
                          setEditingName(col.name);
                        }}
                        title="重新命名"
                        className="p-1 text-studio-500 hover:text-studio-300"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteCollection(col.id)}
                        title="刪除分類"
                        className="p-1 text-studio-500 hover:text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tags Management (1 col) */}
        <div className="space-y-6">
          <form onSubmit={handleCreateTag} className="p-5 rounded-xl bg-studio-900 border border-studio-800 space-y-3">
            <h3 className="text-xs font-bold text-studio-300 uppercase tracking-wider flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-brand-400" />
              <span>新增標籤</span>
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="標籤名稱 (例: 幾何、特黑、文青)"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                className="flex-1 bg-studio-950 border border-studio-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-studio-500 focus:outline-none focus:border-brand-500"
              />
              <button
                type="submit"
                disabled={!newTagName.trim()}
                className="px-3 py-1.5 rounded-lg bg-studio-800 hover:bg-studio-700 text-xs font-medium text-white transition-colors disabled:opacity-50"
              >
                新增
              </button>
            </div>
          </form>

          {/* Tag Cloud */}
          <div className="p-5 rounded-xl bg-studio-900 border border-studio-800 space-y-3">
            <h3 className="text-xs font-bold text-studio-400 uppercase tracking-wider">全部標籤 ({tags.length})</h3>
            {tags.length === 0 ? (
              <div className="text-xs text-studio-500">尚未建立任何標籤。</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <div
                    key={t.id}
                    className="px-2.5 py-1 rounded-md bg-studio-950 border border-studio-800 text-xs text-studio-300 flex items-center gap-1.5 group hover:border-studio-700"
                  >
                    {editingTagId === t.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={editingTagName}
                          onChange={(e) => setEditingTagName(e.target.value)}
                          className="bg-studio-900 border border-brand-500 rounded px-1.5 py-0.5 text-xs text-white w-24"
                          autoFocus
                        />
                        <button
                          onClick={async () => {
                            if (editingTagName.trim() && onRenameTag) {
                              await onRenameTag(t.id, editingTagName.trim());
                            }
                            setEditingTagId(null);
                          }}
                          className="text-emerald-400 hover:text-emerald-300"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setEditingTagId(null)}
                          className="text-studio-500 hover:text-white"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span
                          onClick={() => onSelectTag?.(t.id)}
                          className="cursor-pointer hover:text-brand-400 transition-colors"
                        >
                          #{t.name}
                        </span>
                        <span className="text-[10px] text-studio-500 font-mono">({t.font_count || 0})</span>
                        {onRenameTag && (
                          <button
                            onClick={() => {
                              setEditingTagId(t.id);
                              setEditingTagName(t.name);
                            }}
                            className="opacity-0 group-hover:opacity-100 text-studio-500 hover:text-studio-300 transition-opacity"
                            title="重新命名標籤"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        )}
                        {onDeleteTag && (
                          <button
                            onClick={() => onDeleteTag(t.id)}
                            className="opacity-0 group-hover:opacity-100 text-studio-500 hover:text-rose-400 transition-opacity"
                            title="刪除標籤"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

