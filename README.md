# TomLauncher V2

A lightweight, high-performance desktop application launcher and customizable shortcut grid built with **Tauri 2.0**, **Rust**, and native web technologies.

---

## Key Features

- ⚡ **Customizable Application Grid**: Configure grid dimensions (`Rows` $\times$ `Cols`) and individual cell dimensions (`Width` $\times$ `Height`).
- 🎯 **Dual Modes**:
  - **Launch Mode**: Single-click to instantly launch apps and hide the launcher to system tray.
  - **Edit Mode**: Drag and drop shortcuts to reorder cells, or click cells to edit names, paths, arguments, and custom icons.
- 📁 **File & Shortcut Drag-and-Drop**: Drag `.exe`, `.lnk`, or files directly from Windows File Explorer onto grid cells (with automatic Windows DPI scaling adjustment).
- 🖼️ **Win32 Icon Extraction & `.lnk` Resolution**: Automatically extracts high-resolution icons from executables and shortcuts, resolving shortcut targets and command-line arguments.
- 🚀 **Multi-Launch Queueing**: `Shift+Click` or `Right-Click` items to queue multiple shortcuts to launch together when the window closes/minimizes.
- ⌨️ **Global Hotkey & System Tray**: Toggle the launcher using customizable global hotkeys (e.g. `Ctrl+Alt+Space`) or click the system tray icon.
- 🎯 **Mouse Cursor Centering**: Option to automatically center the mouse cursor over the launcher window upon activation.
- 🎨 **Theming & Color Customization**: Dark & Light theme support with custom cell background and highlight color pickers.
- 🔄 **Legacy Settings Importer**: Automatically detects and migrates settings and shortcut configurations from legacy C# WinForms `settings.xml`.

---

## Tech Stack

| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Desktop Shell** | [Tauri 2.0](https://v2.tauri.app/) | Cross-platform desktop application framework |
| **Backend Language** | Rust (Edition 2021) | Native process execution, Win32 API icon extraction, global hotkeys |
| **Web Runtime** | Windows WebView2 | Lightweight native OS webview engine |
| **Frontend UI** | Vanilla HTML5 / ES6 JavaScript | Single-page interface with zero heavy framework dependencies |
| **Styling** | Vanilla CSS3 | Custom CSS variables for theme tokens (Dark & Light) |
| **Persistence** | JSON (`settings.json`) | Local configuration in `%APPDATA%/TomLauncherV2/` with legacy XML fallback |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later recommended)
- [Rust](https://www.rust-lang.org/tools/install) (Edition 2021)
- Windows Build Tools (for C++ / Win32 API support)

### Installation

Clone the repository and install npm dependencies:

```bash
git clone https://github.com/your-username/TomLauncherV2.git
cd TomLauncherV2
npm install
```

---

## Development & Building

### Run in Development Mode

Launches the Tauri dev environment with hot-reloading:

```bash
npm run dev
```

### Run Unit Tests

Runs both the Rust backend test suite (`cargo test`) and the JavaScript unit tests (`node --test`):

```bash
npm test
```

### Build for Production

Compiles the production Rust binary and bundles the Windows installer / executable:

```bash
npm run build
```

---

## Architecture Overview

```
TomLauncherV2/
├── src-tauri/             # Rust Native Backend
│   ├── src/
│   │   ├── main.rs        # App entry point & subsystem setup
│   │   ├── lib.rs         # Tauri builder, plugins, window & tray lifecycle
│   │   ├── commands.rs    # IPC commands (launch, settings, resolution, centering)
│   │   ├── icon_extractor.rs # Win32 icon extraction (SHGetFileInfoW -> Base64 PNG)
│   │   └── settings.rs    # JSON settings manager & legacy XML importer
│   └── Cargo.toml         # Rust crate configuration & dependencies
│
├── web/                   # Frontend User Interface
│   ├── index.html         # Main app layout and modals
│   ├── styles.css         # Grid layout, animations, and theme CSS
│   ├── app.js             # Grid renderer, drag-and-drop, IPC caller
│   └── test/              # Frontend unit test suite & helpers
│       ├── grid_helpers.js
│       ├── grid_drag.test.js
│       └── accessor.test.js
│
├── package.json           # npm scripts and Tauri CLI dependency
└── techstack.md           # Detailed technology stack documentation
```

---

## License

This project is open-source under the MIT License.
