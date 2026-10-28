# Font Studio (Windows)

> Professional Font Manager for Windows Desktop

[![CI / Build & Test](https://github.com/font-studio/font-studio/actions/workflows/build.yml/badge.svg)](https://github.com/font-studio/font-studio/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-34-47848F.svg)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6.svg)](https://www.typescriptlang.org/)

**Font Studio** is an open-source, high-performance font management application crafted specifically for Windows desktop environments. It allows designers, typographers, and developers to safely scan, organize, compare, and back up fonts with enterprise-grade security and zero-install live specimen preview.

---

## Key Features

1. **Zero-Install Font Preview**: Safely preview any uninstalled font without installing it to Windows.
2. **TrueType Collections (TTC) & Variable Support**: Robust parsing of multi-face TTC archives, TTF, OTF, WOFF, and WOFF2.
3. **Resilient Indexing Engine**: Corrupted or unreadable font files are gracefully isolated without interrupting batch scans.
4. **Stable SQLite Storage**: Foreign-key backed collections, tags, and favorites retain identity across rescans.
5. **Exact Duplicate Detection**: Cryptographically identifies duplicate font files via streaming SHA-256 calculation.
6. **Strict Security Architecture**:
   - `contextIsolation: true`
   - `nodeIntegration: false`
   - Renderer Sandbox enabled
   - Parameter-validated IPC handlers
   - Zip Slip path traversal protection

---

## 12 Professional Workspaces

1. **總覽 (Overview)**: Summary metrics, format breakdown, and workspace launchpad.
2. **全部字體 (All Fonts)**: Comprehensive index with grid/list toggles, live specimen rendering, and size controls.
3. **已安裝 (Installed)**: Windows system and current user font directory scopes.
4. **本機字體檔案 (Local Font Files)**: External imported folders.
5. **我的收藏 (Favorites)**: Quick access to pinned typography.
6. **分類與標籤 (Collections & Tags)**: Custom project folders and flexible tags.
7. **字體比較 (Compare)**: Side-by-side synchronized specimen comparison.
8. **字元檢視器 (Glyph Viewer)**: Unicode code point explorer with language coverage analysis.
9. **重複字體 (Duplicates)**: SHA-256 duplicate file detection and wasted disk estimation.
10. **備份與還原 (Backup & Restore)**: ZIP package export with SHA-256 manifest verification.
11. **容量分析 (Storage Analysis)**: Disk usage breakdown and corrupted font health diagnostics.
12. **設定 (Settings)**: Security audit indicators and interface preferences.

---

## Tech Stack

- **Runtime**: Electron 34, Node.js 20/24
- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide Icons
- **Bundler & Test**: Vite 6, Vitest
- **Database**: SQLite3 via `better-sqlite3` (WAL mode, Foreign Keys enabled)
- **Font Parsing**: `fontkit`, `opentype.js`
- **Packaging**: `electron-builder`

---

## Development & Testing

### Prerequisites
- Node.js >= 20.x or 24.x
- npm >= 10.x
- Windows 10/11 x64

### Getting Started

```bash
# Clone the repository
git clone https://github.com/font-studio/font-studio.git
cd font-studio

# Install dependencies
npm install

# Run unit tests
npm test

# Type-check TypeScript
npm run lint

# Compile Electron main process and Vite renderer
npm run build

# Start Electron in development mode
npm run dev
```

---

## License

This project is licensed under the [MIT License](LICENSE).

