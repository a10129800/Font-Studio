import React, { useState } from 'react';
import { FontRecord } from '../../../../shared/types';
import { Binary, Layers, Search } from 'lucide-react';

interface GlyphViewProps {
  fonts: FontRecord[];
}

export const GlyphView: React.FC<GlyphViewProps> = ({ fonts }) => {
  const [selectedFontId, setSelectedFontId] = useState<string>(fonts[0]?.id || '');
  const [glyphSearch, setGlyphSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'sample' | 'coverage'>('sample');

  const selectedFont = fonts.find((f) => f.id === selectedFontId) || fonts[0];
  const fontFamilyName = selectedFont ? `FS_Font_${selectedFont.id}` : 'sans-serif';

  // Sample Unicode glyphs representing major scripts
  const sampleGlyphs = [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '-', '_', '=', '+', '[', ']',
    '永', '和', '九', '年', '歲', '在', '癸', '丑', '暮', '春', '之', '初', '會', '於', '會', '稽', '山', '陰', '之', '蘭', '亭', '脩', '禊', '事', '也',
    '群', '賢', '畢', '至', '少', '長', '咸', '集', '此', '地', '有', '崇', '山', '峻', '嶺', '茂', '林', '修', '竹', '又', '有', '清', '流', '激', '湍',
    'あ', 'い', 'う', 'え', 'お', 'か', 'き', 'く', 'け', 'こ', 'さ', 'し', 'す', 'せ', 'そ', 'た', 'ち', 'つ', 'て', 'と',
    'ア', 'イ', 'ウ', 'エ', 'オ', 'カ', 'キ', 'ク', 'ケ', 'コ', 'サ', 'シ', 'ス', 'セ', 'ソ', 'タ', 'チ', 'ツ', 'テ', 'ト',
    '가', '나', '다', '라', '마', '바', '사', '아', '자', '차', '카', '타', '파', '하',
  ];

  const filteredGlyphs = glyphSearch
    ? sampleGlyphs.filter((char) => char.includes(glyphSearch))
    : sampleGlyphs;

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6 select-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Binary className="w-5 h-5 text-brand-400" />
            <span>字元檢視器與語言覆蓋分析</span>
          </h2>
          <p className="text-xs text-studio-400 mt-1">
            檢視真實字體輪廓，並依據字體元數據實際分析 Unicode 編碼與多語系覆蓋率。
          </p>
        </div>

        {/* Font Selector */}
        <select
          value={selectedFontId}
          onChange={(e) => setSelectedFontId(e.target.value)}
          aria-label="選擇檢視字體"
          className="bg-studio-900 border border-studio-800 rounded-lg px-3 py-1.5 text-xs text-studio-300 focus:outline-none focus:border-brand-500 max-w-xs"
        >
          {fonts.map((f) => (
            <option key={f.id} value={f.id}>
              {f.family_name} - {f.style_name} ({f.format.toUpperCase()})
            </option>
          ))}
        </select>
      </div>

      {selectedFont && (
        <div className="space-y-6">
          {/* Font Summary Banner */}
          <div className="p-4 rounded-xl bg-studio-900 border border-studio-800 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm text-white">{selectedFont.family_name}</h3>
              <p className="text-xs text-studio-400 mt-0.5 font-mono">
                {selectedFont.style_name} · 輪廓數: {selectedFont.glyph_count?.toLocaleString() || '未知'} · 碼位數: {selectedFont.character_count?.toLocaleString() || '未知'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('sample')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                  activeTab === 'sample' ? 'bg-brand-600 text-white' : 'text-studio-400 hover:text-white'
                }`}
              >
                常用字元表
              </button>
              <button
                onClick={() => setActiveTab('coverage')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                  activeTab === 'coverage' ? 'bg-brand-600 text-white' : 'text-studio-400 hover:text-white'
                }`}
              >
                語言涵蓋分析
              </button>
            </div>
          </div>

          {activeTab === 'sample' ? (
            <div className="space-y-4">
              <div className="relative max-w-xs">
                <Search className="w-3.5 h-3.5 text-studio-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="搜尋特定字元..."
                  value={glyphSearch}
                  onChange={(e) => setGlyphSearch(e.target.value)}
                  className="w-full bg-studio-950 border border-studio-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-studio-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              {/* Glyph Grid */}
              <div className="grid grid-cols-8 md:grid-cols-12 lg:grid-cols-16 gap-2">
                {filteredGlyphs.map((char, index) => {
                  const codePoint = char.codePointAt(0);
                  const hexCode = codePoint ? `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}` : '';

                  return (
                    <div
                      key={index}
                      className="aspect-square rounded-lg bg-studio-900 border border-studio-800 hover:border-brand-500 flex flex-col items-center justify-between p-2 group transition-all"
                    >
                      <span className="text-[9px] font-mono text-studio-500 group-hover:text-brand-400">
                        {hexCode}
                      </span>
                      <span
                        style={{ fontFamily: `"${fontFamilyName}", sans-serif` }}
                        className="text-2xl text-white my-auto"
                      >
                        {char}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Language Coverage Details */
            <div className="p-6 rounded-xl bg-studio-900 border border-studio-800 space-y-4">
              <h3 className="text-xs font-bold text-studio-300 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-brand-400" />
                <span>Unicode 區塊支援清單</span>
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {(selectedFont.unicode_ranges || ['Latin']).map((range) => (
                  <div
                    key={range}
                    className="p-3 rounded-lg bg-studio-950 border border-studio-800 flex items-center justify-between text-xs"
                  >
                    <span className="text-white font-medium">{range}</span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      支援
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

