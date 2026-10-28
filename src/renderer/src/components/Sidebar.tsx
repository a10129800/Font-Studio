import React from 'react';
import {
  LayoutDashboard,
  Type,
  CheckCircle2,
  HardDrive,
  Heart,
  FolderTree,
  GitCompare,
  Binary,
  Copy,
  Archive,
  PieChart,
  Settings,
  Sparkles,
} from 'lucide-react';

export type NavTabId =
  | 'overview'
  | 'all-fonts'
  | 'installed'
  | 'local'
  | 'favorites'
  | 'collections'
  | 'compare'
  | 'glyph-viewer'
  | 'duplicates'
  | 'backup'
  | 'storage'
  | 'settings';

interface SidebarProps {
  activeTab: NavTabId;
  onTabChange: (tab: NavTabId) => void;
  fontCounts: {
    total: number;
    installed: number;
    local: number;
    favorites: number;
  };
}

interface NavItemDef {
  id: NavTabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  fontCounts,
}) => {
  const navItems: NavItemDef[] = [
    { id: 'overview', label: '總覽', icon: LayoutDashboard },
    { id: 'all-fonts', label: '全部字體', icon: Type, count: fontCounts.total },
    { id: 'installed', label: '已安裝', icon: CheckCircle2, count: fontCounts.installed },
    { id: 'local', label: '本機字體檔案', icon: HardDrive, count: fontCounts.local },
    { id: 'favorites', label: '我的收藏', icon: Heart, count: fontCounts.favorites },
    { id: 'collections', label: '分類與標籤', icon: FolderTree },
    { id: 'compare', label: '字體比較', icon: GitCompare },
    { id: 'glyph-viewer', label: '字元檢視器', icon: Binary },
    { id: 'duplicates', label: '重複字體', icon: Copy },
    { id: 'backup', label: '備份與還原', icon: Archive },
    { id: 'storage', label: '容量分析', icon: PieChart },
    { id: 'settings', label: '設定', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-studio-900 border-r border-studio-800 flex flex-col flex-shrink-0 select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-5 border-b border-studio-800 gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-400 flex items-center justify-center text-white font-bold shadow-md shadow-brand-500/20">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div>
          <h1 className="font-semibold text-sm tracking-wide text-white">Font Studio</h1>
          <p className="text-[10px] text-studio-400 font-medium tracking-wider uppercase">Professional Edition</p>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id as NavTabId)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-all ${
                isActive
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-studio-300 hover:bg-studio-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-studio-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.count !== undefined && item.count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    isActive ? 'bg-brand-700 text-white' : 'bg-studio-800 text-studio-400'
                  }`}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* System Status Pill */}
      <div className="p-3 border-t border-studio-800">
        <div className="p-2.5 rounded-lg bg-studio-950/60 border border-studio-800/80 text-[11px] text-studio-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-studio-300 font-medium">Windows Ready</span>
          </div>
          <span className="text-[10px] text-studio-500 font-mono">v0.1.0</span>
        </div>
      </div>
    </aside>
  );
};

