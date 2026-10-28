import React, { useState } from 'react';
import { FontRecord } from '../../../../shared/types';
import { GitCompare, Plus, Trash2 } from 'lucide-react';

interface CompareViewProps {
  fonts: FontRecord[];
}

export const CompareView: React.FC<CompareViewProps> = ({ fonts }) => {
  const [selectedFontIds, setSelectedFontIds] = useState<string[]>(() => {
    return fonts.slice(0, 3).map((f) => f.id);
  });
  const [compareText, setCompareText] = useState('永和九年，歲在癸丑，暮春之初，會於會稽山陰之蘭亭。The quick brown fox jumps over the lazy dog.');
  const [compareSize, setCompareSize] = useState(28);

  const comparedFonts = selectedFontIds
    .map((id) => fonts.find((f) => f.id === id))
    .filter((f): f is FontRecord => !!f);

  const addFontToCompare = (fontId: string) => {
    if (!selectedFontIds.includes(fontId)) {
      setSelectedFontIds([...selectedFontIds, fontId]);
    }
  };

  const removeFontFromCompare = (fontId: string) => {
    setSelectedFontIds(selectedFontIds.filter((id) => id !== fontId));
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6 select-none">
      {/* Title & Toolbar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-brand-400" />
            <span>字體並列比較</span>
          </h2>
          <p className="text-xs text-studio-400 mt-1">同步排版測試，觀察字體在相同字級下的字間距、字面率與視覺張力。</p>
        </div>

        {/* Add font select */}
        <div className="flex items-center gap-3">
          <select
            onChange={(e) => {
              if (e.target.value) {
                addFontToCompare(e.target.value);
                e.target.value = '';
              }
            }}
            aria-label="選擇字體加入比較"
            className="bg-studio-900 border border-studio-800 rounded-lg px-3 py-1.5 text-xs text-studio-300 focus:outline-none focus:border-brand-500"
          >
            <option value="">+ 新增比較字體...</option>
            {fonts
              .filter((f) => !selectedFontIds.includes(f.id))
              .map((f) => (
                <option key={f.id} value={f.id}>
                  {f.family_name} - {f.style_name}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Comparison Text Input & Size Slider */}
      <div className="p-4 rounded-xl bg-studio-900 border border-studio-800 flex items-center gap-4">
        <input
          type="text"
          value={compareText}
          onChange={(e) => setCompareText(e.target.value)}
          placeholder="輸入自訂比較文案..."
          className="flex-1 bg-studio-950 border border-studio-800 rounded-lg px-3 py-2 text-xs text-white placeholder-studio-500 focus:outline-none focus:border-brand-500"
        />
        <div className="flex items-center gap-2 w-48">
          <span className="text-xs text-studio-400">字級:</span>
          <input
            type="range"
            min="16"
            max="72"
            value={compareSize}
            onChange={(e) => setCompareSize(Number(e.target.value))}
            className="w-full h-1 bg-studio-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
          />
          <span className="text-xs font-mono text-studio-400 w-10 text-right">{compareSize}px</span>
        </div>
      </div>

      {/* Compare Cards Columns */}
      <div className="space-y-4">
        {comparedFonts.map((font) => {
          const fontFamilyName = `FS_Font_${font.id}`;
          return (
            <div
              key={font.id}
              className="p-5 rounded-xl bg-studio-900 border border-studio-800 hover:border-studio-700 space-y-3"
            >
              <div className="flex items-center justify-between pb-3 border-b border-studio-800/80">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-sm text-white">{font.family_name}</h3>
                  <span className="text-xs text-brand-400 font-medium">{font.style_name}</span>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded border bg-studio-800 text-studio-400 border-studio-700">
                    {font.format}
                  </span>
                </div>
                <button
                  onClick={() => removeFontFromCompare(font.id)}
                  title="移除此項比較"
                  className="p-1 rounded text-studio-500 hover:text-rose-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Rendered Text */}
              <div className="py-2">
                <p
                  style={{
                    fontFamily: `"${fontFamilyName}", sans-serif`,
                    fontSize: `${compareSize}px`,
                    lineHeight: 1.4,
                  }}
                  className="text-slate-100 break-words"
                >
                  {compareText}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

