import React, { useState } from 'react';
import { FontRecord } from '../../../../shared/types';
import { Copy, AlertTriangle, FolderOpen, Check } from 'lucide-react';

interface DuplicatesViewProps {
  fonts: FontRecord[];
  onOpenFilePath: (path: string) => void;
}

export const DuplicatesView: React.FC<DuplicatesViewProps> = ({ fonts, onOpenFilePath }) => {
  const [activeTab, setActiveTab] = useState<'exact' | 'family'>('exact');

  // Group by SHA-256 for exact duplicates
  const shaMap = new Map<string, FontRecord[]>();
  for (const f of fonts) {
    const list = shaMap.get(f.sha256) || [];
    list.push(f);
    shaMap.set(f.sha256, list);
  }
  const exactDupes = Array.from(shaMap.entries()).filter(([, list]) => list.length > 1);

  // Group by Family Name for potential family duplicates across different paths
  const familyMap = new Map<string, FontRecord[]>();
  for (const f of fonts) {
    const list = familyMap.get(f.family_name) || [];
    list.push(f);
    familyMap.set(f.family_name, list);
  }
  const familyDupes = Array.from(familyMap.entries()).filter(([, list]) => {
    const distinctPaths = new Set(list.map((item) => item.file_path));
    return distinctPaths.size > 1;
  });

  const totalWastedBytes = exactDupes.reduce((sum, [, list]) => {
    return sum + (list.length - 1) * list[0].file_size;
  }, 0);

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6 select-none">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Copy className="w-5 h-5 text-brand-400" />
            <span>重複字體偵測</span>
          </h2>
          <p className="text-xs text-studio-400 mt-1">
            以 SHA-256 校驗值識別完全相同的重複檔案，並比對不同路徑下的同名家族字體。
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex items-center bg-studio-900 border border-studio-800 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('exact')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'exact' ? 'bg-brand-600 text-white' : 'text-studio-400 hover:text-white'
            }`}
          >
            完全重複 ({exactDupes.length})
          </button>
          <button
            onClick={() => setActiveTab('family')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'family' ? 'bg-brand-600 text-white' : 'text-studio-400 hover:text-white'
            }`}
          >
            同名家族重複 ({familyDupes.length})
          </button>
        </div>
      </div>

      {activeTab === 'exact' ? (
        <div className="space-y-4">
          {/* Summary Box */}
          <div className="p-4 rounded-xl bg-studio-900 border border-studio-800 flex items-center justify-between text-xs">
            <span className="text-studio-300">
              發現 <strong className="text-white font-mono">{exactDupes.length}</strong> 組完全重複的字體檔案
            </span>
            <span className="text-amber-400 font-medium">
              浪費容量估計: {(totalWastedBytes / 1024 / 1024).toFixed(2)} MB
            </span>
          </div>

          {exactDupes.length === 0 ? (
            <div className="p-12 text-center rounded-xl bg-studio-900/50 border border-studio-800 text-xs text-studio-500">
              <Check className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              目前未發現任何完全重複的字體檔案。
            </div>
          ) : (
            <div className="space-y-3">
              {exactDupes.map(([sha, list]) => (
                <div key={sha} className="p-4 rounded-xl bg-studio-900 border border-studio-800 space-y-3">
                  <div className="flex items-center justify-between border-b border-studio-800 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-white">{list[0].family_name}</span>
                      <span className="text-[11px] text-studio-400">({list[0].style_name})</span>
                    </div>
                    <span className="text-[10px] font-mono text-studio-500 truncate max-w-xs">
                      SHA256: {sha.slice(0, 16)}...
                    </span>
                  </div>

                  {/* List of duplicate locations */}
                  <div className="space-y-1.5">
                    {list.map((f, idx) => (
                      <div
                        key={f.id}
                        className="flex items-center justify-between p-2 rounded bg-studio-950 border border-studio-800/80 text-[11px]"
                      >
                        <div className="flex items-center gap-2 overflow-hidden mr-2">
                          <span className="text-[10px] text-studio-500 font-mono">#{idx + 1}</span>
                          <span className="text-studio-300 font-mono truncate">{f.file_path}</span>
                        </div>
                        <button
                          onClick={() => onOpenFilePath(f.file_path)}
                          title="在檔案總管中顯示"
                          className="text-studio-400 hover:text-white p-1"
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Family duplicates */
        <div className="space-y-3">
          {familyDupes.map(([familyName, list]) => (
            <div key={familyName} className="p-4 rounded-xl bg-studio-900 border border-studio-800 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-xs text-white">{familyName}</h4>
                <span className="text-[10px] text-studio-400 font-mono">{list.length} 個檔案</span>
              </div>
              <div className="space-y-1">
                {list.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between p-2 rounded bg-studio-950 border border-studio-800/80 text-[11px]"
                  >
                    <span className="text-studio-300 font-mono truncate mr-2">{f.file_path}</span>
                    <button
                      onClick={() => onOpenFilePath(f.file_path)}
                      title="在檔案總管中顯示"
                      className="text-studio-400 hover:text-white p-1"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

