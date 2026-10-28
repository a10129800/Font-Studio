# Changelog

All notable changes to **Font Studio** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
