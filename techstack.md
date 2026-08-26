# TomLauncher V2 — Tech Stack & Architecture Overview

## Overview
**TomLauncher V2** is a lightweight cross-platform desktop application launcher and shortcut grid built with **Tauri 2.0** and web technologies (HTML5, CSS3, Vanilla JavaScript). It replaces the legacy C# WinForms `TomLauncher` app with a native Rust backend and single-page web UI.

---

## Tech Stack Summary

| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Desktop Shell** | [Tauri 2.0](https://v2.tauri.app/) | Cross-platform desktop application framework |
| **Backend Language** | Rust (Edition 2021) | Native OS interactions (WinAPI icon extraction, process execution, hotkeys) |
| **Web Runtime** | Windows WebView2 / WebKitGTK | Native OS Webview engine |
| **Frontend Framework** | Vanilla HTML5 / ES6 JS | Single-page UI, zero heavy JS framework dependencies |
| **Styling** | Vanilla CSS3 | Custom CSS variables for theme tokens (Dark & Light themes) |
| **Persistence** | JSON (`settings.json`) | Local data persistence in `%APPDATA%/TomLauncherV2/` with legacy XML auto-importer |

---

## Architecture Breakdown

### 1. Backend (`src-tauri/`)
- **Framework & Dependencies**:
  - `tauri` (v2): Native app builder and lifecycle manager.
  - `tauri-plugin-window-state` (v2): Persists window position and sizes across launches.
  - `tauri-plugin-dialog` (v2): System file and folder open dialogs.
  - `windows-sys` (Windows): Win32 API icon extraction (`SHGetFileInfoW`) & mouse cursor positioning.
- **Entry Points**:
  - [`src-tauri/src/main.rs`](file:///D:/gitwork/TomLauncherV2/src-tauri/src/main.rs): Windows subsystem entry configuration.
  - [`src-tauri/src/lib.rs`](file:///D:/gitwork/TomLauncherV2/src-tauri/src/lib.rs): Rust application builder initializing plugins and context.
  - [`src-tauri/src/commands.rs`](file:///D:/gitwork/TomLauncherV2/src-tauri/src/commands.rs): Exposes IPC commands for settings, launching, icon extraction, and cursor centering.
  - [`src-tauri/src/icon_extractor.rs`](file:///D:/gitwork/TomLauncherV2/src-tauri/src/icon_extractor.rs): Win32 icon extraction to Base64 PNGs and cross-platform SVG fallback.
  - [`src-tauri/src/settings.rs`](file:///D:/gitwork/TomLauncherV2/src-tauri/src/settings.rs): JSON settings persistence and legacy C# XML settings importer.

### 2. Frontend (`web/`)
- **Single File Web Application**: [`web/index.html`](file:///D:/gitwork/TomLauncherV2/web/index.html), [`web/styles.css`](file:///D:/gitwork/TomLauncherV2/web/styles.css), [`web/app.js`](file:///D:/gitwork/TomLauncherV2/web/app.js)
- **Core Capabilities**:
  - **Dynamic CSS Grid**: Custom `Rows` $\times$ `Cols` grid with customizable `CellWidth` & `CellHeight`.
  - **Launch vs. Edit Modes**: Toggle between single-click launcher mode and grid cell editing mode.
  - **Drag and Drop**: File/folder drag-and-drop onto cells from Windows Explorer, and cell position swapping.
  - **Multi-Launch Queue**: `Shift+Click` or `Ctrl+Click` queues items to launch upon window minimization.
  - **Settings & Modals**: Global settings for grid dimensions, hotkey, cursor centering, and dark/light themes.

---

## Build Setup & Execution

```bash
# Install CLI dependencies
npm install

# Run application in development mode
npm run dev

# Build production executable
npm run build
```
