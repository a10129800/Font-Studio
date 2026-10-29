# Changelog

All notable changes to **Font Studio** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-10-29

### Added
- **Milestone M3: Backup, Verification, Restore, and Windows Packaging**:
  - `BackupService`: Complete ZIP packaging of font files, manifest, and database metadata.
  - SHA-256 cryptographic integrity validation for archive and internal font entries.
  - Anti-Zip Slip directory traversal defense ensuring zero path escapes during extraction.
  - Two-stage restore workflow: pre-restore archive verification & inspection followed by user-directed extraction.
  - Conflict resolution policies: `skip`, `rename` (with unique hash postfix), and `overwrite`.
  - Non-destructive SQLite metadata import: merges collections, tags, and favorites without touching or resetting the live database.
  - Dedicated `BackupView` with real-time progress bars, live counter statistics, cancellation support, and error item reporting.
  - Windows release packaging: NSIS installer and portable executable targets with user data preservation (`deleteAppDataOnUninstall: false`).
  - GitHub Actions CI workflow supporting automated tests, linting, and Windows installer releases.
  - 10 new Vitest tests in `tests/m3_backup_restore.test.ts`, bringing total test count to 46 across 8 test suites.

## [0.2.0] - 2026-10-28

### Added
- **Milestone M1 & M2: Scanning, Collections, Tags, and Safe Installation**:
  - OpenType localization for Traditional Chinese (zh-TW, zh-HK) and English font names.
  - TrueType Collection (TTC) multi-face parsing with deterministic stable IDs (`md5(filePath + '::' + faceIndex)`).
  - SQLite pagination, case-insensitive multi-field search, and sorting.
  - Real SQLite collections and tags CRUD with foreign-key cascade deletions.
  - Windows User Scope font installation (`%LOCALAPPDATA%\Microsoft\Windows\Fonts` + `HKCU`) with zero elevation required.
  - Core Windows system font uninstallation protection (Segoe UI, Arial, 微軟正黑體, 新細明體, etc.).
  - Transactional rollback on registry failure and `WM_FONTCHANGE` system broadcast.
  - Cooperative batch job queue with non-fatal item error isolation and cancellation tokens.

## [0.1.0] - 2026-10-28

### Added
- **Milestone M0 Architecture**:
  - Electron 34 with secure defaults: `contextIsolation: true`, `nodeIntegration: false`, Renderer sandbox enabled.
  - Privileged `font-preview://` protocol for zero-install, secure font previews.
  - Preload script exposing strictly validated, minimal IPC APIs to the renderer.
  - SQLite database service with versioned migrations, WAL mode, foreign keys, and stable ID preservation across rescans.
  - High-performance streaming SHA-256 calculation and Zip Slip path traversal security validation.
  - Font parser service supporting TTF, OTF, TTC, WOFF, WOFF2 with graceful fault tolerance for corrupted files.
  - Font scanner service for Windows system fonts (`C:\Windows\Fonts`) and user fonts (`%LOCALAPPDATA%\Microsoft\Windows\Fonts`).
  - Professional design software UI with 12 navigation sections, dark/light theme, specimen cards, and live progress status bar.
  - Comprehensive unit test suite with 17 Vitest tests covering SQLite, hashing, path validation, parsing, and scanner cancellation.

