# Implementation Plan — Core Feature Automated Test Suite

We will implement a comprehensive automated testing suite covering all core features of **TomLauncherV2** across both the **Rust backend** and **JavaScript frontend**, including explicit verification of program/file launch operations.

---

## Technical Design & Test Scope

```mermaid
flowchart TD
    subgraph Rust Backend Tests (cargo test)
        S1[settings::test_default_settings]
        S2[settings::test_json_serialization]
        S3[settings::test_parse_legacy_xml]
        C1[commands::test_path_normalization]
        C2[commands::test_quote_trimming]
        C3[commands::test_expand_windows_env_vars]
        C4[commands::test_empty_path_rejection]
        C5[commands::test_launch_program_execution_success]
    end

    subgraph Frontend JS Tests (node --test)
        J1[accessor.test.js - Property Casing & Number Coercion]
        J2[grid.test.js - findShortcut Row/Col Coercion]
        J3[drag_swap.test.js - Move & Swap Grid Cell Logic]
        J4[queue.test.js - Shift/Ctrl Click Launcher Queueing]
    end

    subgraph Test Execution Command
        T[npm test -> cargo test + node --test]
    end

    Rust Backend Tests --> T
    Frontend JS Tests --> T
```

---

## User Review Required

> [!IMPORTANT]
> **Program/File Execution Test Included**:
> We have added `test_launch_program_execution_success` to test launching actual files and system executables.
> - **File Launch Test**: Creates a temporary document (`tomlauncher_test_target.txt`) and executes `launch_program`, verifying that `ShellExecuteW` / OS launcher returns `Ok(())` and writes a success entry to `debug.log`.
> - **System Command Launch Test**: Tests launching standard system executables (e.g. `cmd.exe /C exit 0`), verifying process launch return codes.

> [!NOTE]
> We will use Node.js's built-in test runner (`node --test`) for the frontend JavaScript tests to avoid introducing heavy external npm test runner dependencies (like Vitest or Jest), keeping the repository lightweight and fast.

---

## Proposed Changes

### Rust Backend Tests

#### [`MODIFY`] [`src-tauri/src/settings.rs`](file:///D:/gitwork/TomLauncherV2/src-tauri/src/settings.rs)
- Make `parse_legacy_xml` and `extract_xml_tag` accessible for `#[cfg(test)]`.
- Add `mod tests` block covering:
  - Default settings values (5x5 grid, 150x40 cell size, `Alt+Shift+Z` hotkey).
  - JSON serialization/deserialization matching camelCase keys (`cellWidth`, `cellHeight`, `shortcutLocation`).
  - Parsing legacy C# WinForms `TomLauncherSettings.xml` XML content (verifying grid dimensions and `<ShortcutEntry>` entries with `<Row>`, `<Column>`, `<Name>`, `<ShortcutLocation>`, `<ImageLocation>`).

#### [`MODIFY`] [`src-tauri/src/commands.rs`](file:///D:/gitwork/TomLauncherV2/src-tauri/src/commands.rs)
- Expose `clean_and_normalize_path` helper for unit testing.
- Add `mod tests` block covering:
  - **`test_launch_program_execution_success`**: Launches a temporary `.txt` file and system command, verifying that `launch_program` executes successfully without error and writes a success log entry.
  - Forward slashes (`/`) to backslashes (`\`) path normalization.
  - Preserving URL schemes (`http://`, `https://`).
  - Stripping surrounding quotes from raw inputs (`"C:\path\app.exe"`).
  - Environment variable expansion (`%APPDATA%`, `%USERPROFILE%`).
  - Empty path validation error handling.

---

### Frontend JavaScript Tests

#### [`NEW`] [`web/test/accessor.test.js`](file:///D:/gitwork/TomLauncherV2/web/test/accessor.test.js)
- Test property accessors (`getShortcutRow`, `getShortcutCol`, `getShortcutLocation`, `getShortcutName`, `getShortcutImage`).
- Verify numeric coercion for string row/column numbers.
- Verify fallback behavior when camelCase vs PascalCase keys are supplied.

#### [`NEW`] [`web/test/grid_drag.test.js`](file:///D:/gitwork/TomLauncherV2/web/test/grid_drag.test.js)
- Test `findShortcut(row, col)` with string vs number coordinates.
- Test move shortcut to empty cell logic.
- Test swap shortcuts between two occupied cells.
- Test clearing/deleting shortcut entry logic.

---

### Orchestration & Scripts

#### [`MODIFY`] [`package.json`](file:///D:/gitwork/TomLauncherV2/package.json)
- Add `"test"` script:
  ```json
  "scripts": {
    "dev": "tauri dev",
    "build": "tauri build",
    "test": "cargo test --manifest-path src-tauri/Cargo.toml && node --test web/test/*.test.js"
  }
  ```

---

## Verification Plan

### Automated Tests
Execute the full test suite with:
```powershell
npm test
```
Or execute individual test runners:
- **Rust Backend**: `cargo test --manifest-path src-tauri/Cargo.toml`
- **Frontend JS**: `node --test web/test/*.test.js`

### Manual Verification
1. Verify `npm test` finishes with exit code `0` and 100% test pass rate.
