use crate::icon_extractor::extract_icon_as_base64;
use crate::settings::{self, Settings};
use serde::{Deserialize, Serialize};
use std::fs::OpenOptions;
use std::io::Write;
use std::path::Path;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolvedShortcut {
    #[serde(rename = "target_path")]
    pub target_path: String,
    #[serde(rename = "arguments")]
    pub arguments: Option<String>,
    #[serde(rename = "name")]
    pub name: Option<String>,
    #[serde(rename = "icon_path")]
    pub icon_path: Option<String>,
}

pub fn should_log(enable_debug_logging: bool) -> bool {
    enable_debug_logging
}

pub fn log_to_file(msg: &str) {
    let settings = settings::load_settings();
    if !should_log(settings.enable_debug_logging) {
        return;
    }
    let mut log_path = settings::get_settings_dir();
    log_path.push("debug.log");
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(log_path) {
        let timestamp = chrono_like_timestamp();
        let _ = writeln!(file, "[{}] {}", timestamp, msg);
    }
}

fn chrono_like_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let start = SystemTime::now();
    let since_the_epoch = start.duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("{}", since_the_epoch.as_secs())
}

pub fn normalize_launch_path(path: &str) -> String {
    let mut clean_path = path.trim().trim_matches('"').to_string();
    if clean_path.contains('/') && !clean_path.starts_with("http://") && !clean_path.starts_with("https://") {
        clean_path = clean_path.replace('/', "\\");
    }
    clean_path
}

pub fn parse_shortcut_str(modifier: &str, key: &str) -> String {
    let mut parts = Vec::new();
    let mod_trimmed = modifier.trim();
    if !mod_trimmed.is_empty() {
        for m in mod_trimmed.split('+') {
            let m_clean = m.trim();
            if !m_clean.is_empty() {
                parts.push(m_clean.to_string());
            }
        }
    }

    let key_trimmed = key.trim().to_uppercase();
    if !key_trimmed.is_empty() {
        if key_trimmed.len() == 1 && key_trimmed.chars().next().unwrap().is_ascii_alphabetic() {
            parts.push(format!("Key{}", key_trimmed));
        } else {
            parts.push(key_trimmed);
        }
    }

    parts.join("+")
}

pub fn should_activate_window(is_visible: bool, is_focused: bool) -> bool {
    !is_visible || !is_focused
}

#[derive(Debug, PartialEq)]
pub enum WindowCloseAction {
    HideToSystemTray,
    DefaultClose,
}

pub fn determine_window_close_action(is_close_requested_event: bool) -> WindowCloseAction {
    if is_close_requested_event {
        WindowCloseAction::HideToSystemTray
    } else {
        WindowCloseAction::DefaultClose
    }
}

#[tauri::command]
pub fn exit_app(app: tauri::AppHandle) {
    println!("[IPC] exit_app requested: quitting TomLauncher V2");
    log_to_file("[IPC] exit_app requested: quitting TomLauncher V2");
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.destroy();
    }
    app.exit(0);
}


#[tauri::command]
pub fn get_settings() -> Settings {
    println!("[IPC] get_settings requested");
    log_to_file("[IPC] get_settings requested");
    settings::load_settings()
}

#[tauri::command]
pub fn save_settings(app: tauri::AppHandle, settings: Settings) -> Result<(), String> {
    let msg = format!("[IPC] save_settings: {} shortcuts", settings.shortcut_list.len());
    println!("{}", msg);
    log_to_file(&msg);
    let res = settings::save_settings(&settings);
    if res.is_ok() {
        crate::register_hotkey(&app, &settings.modifier, &settings.key);
    }
    res
}

#[derive(Debug, PartialEq, Serialize, Deserialize)]
pub struct WindowGridDimensions {
    pub required_width: f64,
    pub required_height: f64,
    pub max_width: f64,
    pub max_height: f64,
    pub min_width: f64,
    pub min_height: f64,
}

pub fn calculate_grid_window_dimensions(
    rows: usize,
    columns: usize,
    cell_width: u32,
    cell_height: u32,
    extra_w: f64,
    extra_h: f64,
) -> WindowGridDimensions {
    let grid_width = (columns * cell_width as usize) + (columns.saturating_sub(1) * 1);
    let grid_height = (rows * cell_height as usize) + (rows.saturating_sub(1) * 1);

    // Header: 48px, Footer: 28px, Main side padding: 2px (0px top/bottom, 1px left/right)
    let required_width = (grid_width + 2).max(320) as f64;
    let required_height = (grid_height + 48 + 28) as f64;

    let target_width = required_width + extra_w;
    let target_height = required_height + extra_h;

    let min_w = 200.0f64.min(target_width);
    let min_h = 140.0f64.min(target_height);

    WindowGridDimensions {
        required_width: target_width,
        required_height: target_height,
        max_width: target_width,
        max_height: target_height,
        min_width: min_w,
        min_height: min_h,
    }
}

pub fn center_mouse_cursor_internal() {
    #[cfg(target_os = "windows")]
    {
        use windows_sys::Win32::UI::WindowsAndMessaging::{GetSystemMetrics, SetCursorPos, SM_CXSCREEN, SM_CYSCREEN};
        unsafe {
            let width = GetSystemMetrics(SM_CXSCREEN);
            let height = GetSystemMetrics(SM_CYSCREEN);
            SetCursorPos(width / 2, height / 2);
        }
    }
}

#[tauri::command]
pub fn resize_window_to_grid(
    window: tauri::WebviewWindow,
    rows: usize,
    columns: usize,
    cell_width: u32,
    cell_height: u32,
) -> Result<(), String> {
    let dims = calculate_grid_window_dimensions(rows, columns, cell_width, cell_height, 0.0, 0.0);

    let max_size = tauri::Size::Logical(tauri::LogicalSize {
        width: dims.max_width,
        height: dims.max_height,
    });

    let min_size = tauri::Size::Logical(tauri::LogicalSize {
        width: dims.min_width,
        height: dims.min_height,
    });

    let target_size = tauri::Size::Logical(tauri::LogicalSize {
        width: dims.required_width,
        height: dims.required_height,
    });

    let _ = window.unmaximize();
    let _ = window.set_min_size(Some(min_size));
    let _ = window.set_max_size(Some(max_size));
    let _ = window.set_size(target_size);

    let settings = settings::load_settings();
    if settings.center_mouse_on_startup {
        let _ = window.center();
        center_mouse_cursor_internal();
    }

    Ok(())
}

#[cfg(target_os = "windows")]
pub fn expand_windows_env_vars(path: &str) -> String {
    use std::ffi::OsStr;
    use std::os::windows::ffi::{OsStrExt, OsStringExt};
    use windows_sys::Win32::System::Environment::ExpandEnvironmentStringsW;

    if !path.contains('%') {
        return path.to_string();
    }

    let src_wide: Vec<u16> = OsStr::new(path).encode_wide().chain(std::iter::once(0)).collect();
    let mut dst_wide = vec![0u16; 2048];
    unsafe {
        let len = ExpandEnvironmentStringsW(src_wide.as_ptr(), dst_wide.as_mut_ptr(), dst_wide.len() as u32);
        if len > 0 && (len as usize) < dst_wide.len() {
            dst_wide.truncate((len - 1) as usize);
            let expanded = std::ffi::OsString::from_wide(&dst_wide).to_string_lossy().to_string();
            let log_msg = format!("[launch_program] Expanded env vars: '{}' -> '{}'", path, expanded);
            println!("{}", log_msg);
            log_to_file(&log_msg);
            return expanded;
        }
    }
    path.to_string()
}

pub fn split_path_and_args(raw_path: &str, raw_args: Option<&str>) -> (String, Option<String>) {
    let trimmed_path = raw_path.trim();
    let trimmed_args = raw_args.map(|a| a.trim()).filter(|a| !a.is_empty());

    if let Some(args) = trimmed_args {
        let clean_target = normalize_launch_path(trimmed_path);
        return (clean_target, Some(args.to_string()));
    }

    if trimmed_path.is_empty() {
        return (String::new(), None);
    }

    if trimmed_path.starts_with("http://") || trimmed_path.starts_with("https://") {
        return (trimmed_path.to_string(), None);
    }

    let clean_path = normalize_launch_path(trimmed_path);
    if Path::new(&clean_path).exists() {
        return (clean_path, None);
    }

    if trimmed_path.starts_with('"') {
        if let Some(end_quote_idx) = trimmed_path[1..].find('"') {
            let target = &trimmed_path[1..end_quote_idx + 1];
            let rest = trimmed_path[end_quote_idx + 2..].trim();
            let args = if rest.is_empty() { None } else { Some(rest.to_string()) };
            return (normalize_launch_path(target), args);
        }
    }

    let lower = trimmed_path.to_lowercase();
    let exts = [".exe", ".bat", ".cmd", ".com", ".lnk", ".ps1", ".vbs"];
    for ext in exts {
        if let Some(idx) = lower.find(ext) {
            let split_pos = idx + ext.len();
            let target = &trimmed_path[..split_pos];
            let rest = trimmed_path[split_pos..].trim();
            let args = if rest.is_empty() { None } else { Some(rest.to_string()) };
            return (normalize_launch_path(target), args);
        }
    }

    (clean_path, None)
}

#[cfg(target_os = "windows")]
pub fn resolve_lnk_file(lnk_path: &str) -> Option<ResolvedShortcut> {
    let path_clean = normalize_launch_path(lnk_path);
    let path_buf = Path::new(&path_clean);
    if !path_buf.exists() || !path_clean.to_lowercase().ends_with(".lnk") {
        return None;
    }

    let file_name = path_buf.file_stem().and_then(|s| s.to_str()).map(|s| s.to_string());

    let ps_script = format!(
        "$sh = New-Object -ComObject WScript.Shell\n$s = $sh.CreateShortcut('{}')\nWrite-Output $s.TargetPath\nWrite-Output $s.Arguments",
        path_clean.replace("'", "''")
    );

    let utf16_bytes: Vec<u8> = ps_script.encode_utf16().flat_map(|c| c.to_le_bytes()).collect();
    use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
    let encoded_script = BASE64.encode(&utf16_bytes);

    let output = std::process::Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-EncodedCommand", &encoded_script])
        .output();

    if let Ok(out) = output {
        if out.status.success() {
            let text = String::from_utf8_lossy(&out.stdout);
            let lines: Vec<&str> = text.lines().map(|l| l.trim()).collect();
            let target = lines.first().copied().unwrap_or("");
            let args = lines.get(1).copied().unwrap_or("");

            let final_target = if target.is_empty() { path_clean.clone() } else { target.to_string() };
            let final_args = if args.is_empty() { None } else { Some(args.to_string()) };

            let log_msg = format!("[resolve_lnk_file] Resolved '{}' -> Target: '{}', Args: '{:?}'", lnk_path, final_target, final_args);
            println!("{}", log_msg);
            log_to_file(&log_msg);

            return Some(ResolvedShortcut {
                target_path: final_target,
                arguments: final_args,
                name: file_name,
                icon_path: None,
            });
        }
    }

    None
}

pub fn resolve_shortcut_internal(raw_path: &str) -> ResolvedShortcut {
    #[cfg(target_os = "windows")]
    {
        if let Some(resolved) = resolve_lnk_file(raw_path) {
            return resolved;
        }
    }

    let (target, args) = split_path_and_args(raw_path, None);
    let path_buf = Path::new(&target);
    let name = path_buf.file_stem().and_then(|s| s.to_str()).map(|s| s.to_string());

    ResolvedShortcut {
        target_path: target,
        arguments: args,
        name,
        icon_path: None,
    }
}

#[tauri::command]
pub fn resolve_shortcut(path: String) -> ResolvedShortcut {
    resolve_shortcut_internal(&path)
}

pub fn launch_program_internal(path: &str, arguments: Option<&str>) -> Result<(), String> {
    let log_raw = format!("[IPC launch_program] Received raw path: '{}', args: '{:?}'", path, arguments);
    println!("{}", log_raw);
    log_to_file(&log_raw);

    let (clean_path, clean_args) = split_path_and_args(path, arguments);
    if clean_path.is_empty() {
        let err_msg = "[IPC launch_program] Error: Path is empty".to_string();
        eprintln!("{}", err_msg);
        log_to_file(&err_msg);
        return Err("Path is empty".to_string());
    }

    let log_clean = format!("[IPC launch_program] Cleaned path: '{}', args: '{:?}'", clean_path, clean_args);
    println!("{}", log_clean);
    log_to_file(&log_clean);

    // Spawn execution on a dedicated OS background thread to avoid COM/GUI message loop deadlocks
    std::thread::spawn(move || {
        #[cfg(target_os = "windows")]
        {
            let expanded_path = expand_windows_env_vars(&clean_path);
            let target_path = Path::new(&expanded_path);
            let working_dir_os = target_path.parent().and_then(|p| p.to_str()).unwrap_or("");

            let log_target = format!("[Thread Launcher] Target: '{}' | Args: '{:?}' | WorkingDir: '{}' | PathExists: {}", expanded_path, clean_args, working_dir_os, target_path.exists());
            println!("{}", log_target);
            log_to_file(&log_target);

            use std::ffi::OsStr;
            use std::os::windows::ffi::OsStrExt;
            use windows_sys::Win32::UI::Shell::ShellExecuteW;
            use windows_sys::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

            let op_wide: Vec<u16> = OsStr::new("open").encode_wide().chain(std::iter::once(0)).collect();
            let file_wide: Vec<u16> = OsStr::new(&expanded_path).encode_wide().chain(std::iter::once(0)).collect();

            let expanded_args = clean_args.as_ref().map(|a| expand_windows_env_vars(a));
            let params_wide: Option<Vec<u16>> = expanded_args.as_ref().map(|args| {
                OsStr::new(args).encode_wide().chain(std::iter::once(0)).collect()
            });

            let dir_wide: Vec<u16> = if working_dir_os.is_empty() {
                vec![0]
            } else {
                OsStr::new(working_dir_os).encode_wide().chain(std::iter::once(0)).collect()
            };

            unsafe {
                println!("[Thread Launcher] Calling ShellExecuteW...");
                log_to_file("[Thread Launcher] Calling ShellExecuteW...");

                let res = ShellExecuteW(
                    std::ptr::null_mut(),
                    op_wide.as_ptr(),
                    file_wide.as_ptr(),
                    params_wide.as_ref().map_or(std::ptr::null(), |v| v.as_ptr()),
                    if working_dir_os.is_empty() { std::ptr::null() } else { dir_wide.as_ptr() },
                    SW_SHOWNORMAL,
                );

                let res_code = res as usize;
                let log_res = format!("[Thread Launcher] ShellExecuteW return code: {} (Success > 32)", res_code);
                println!("{}", log_res);
                log_to_file(&log_res);

                if res_code > 32 {
                    println!("[Thread Launcher] ShellExecuteW succeeded!");
                    log_to_file("[Thread Launcher] ShellExecuteW succeeded!");
                    return;
                }
            }

            // Fallback 1: cmd.exe /C start "" "expanded_path" [args]
            let log_fb1 = format!("[Thread Launcher] Fallback 1: Executing via cmd.exe /C start \"\" \"{}\"", expanded_path);
            println!("{}", log_fb1);
            log_to_file(&log_fb1);

            let mut cmd_start = std::process::Command::new("cmd");
            let mut cmd_args = vec!["/C".to_string(), "start".to_string(), "".to_string(), expanded_path.clone()];
            if let Some(ref args_str) = expanded_args {
                cmd_args.push(args_str.clone());
            }
            cmd_start.args(&cmd_args);

            if !working_dir_os.is_empty() {
                cmd_start.current_dir(working_dir_os);
            }

            match cmd_start.spawn() {
                Ok(mut child) => {
                    let exit = child.wait();
                    let log_cmd_ok = format!("[Thread Launcher] cmd.exe /C start spawned successfully, exit status: {:?}", exit);
                    println!("{}", log_cmd_ok);
                    log_to_file(&log_cmd_ok);
                    return;
                }
                Err(e) => {
                    let log_cmd_err = format!("[Thread Launcher] cmd.exe /C start error: {}", e);
                    eprintln!("{}", log_cmd_err);
                    log_to_file(&log_cmd_err);
                }
            }

            // Fallback 2: open::that
            let full_target = if let Some(ref args_str) = expanded_args {
                format!("\"{}\" {}", expanded_path, args_str)
            } else {
                expanded_path.clone()
            };
            let log_fb2 = format!("[Thread Launcher] Fallback 2: Executing via open::that('{}')", full_target);
            println!("{}", log_fb2);
            log_to_file(&log_fb2);

            match open::that(&full_target) {
                Ok(_) => {
                    println!("[Thread Launcher] open::that succeeded.");
                    log_to_file("[Thread Launcher] open::that succeeded.");
                }
                Err(_) => {
                    let _ = open::that(&expanded_path);
                }
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            let full_target = if let Some(ref args_str) = clean_args {
                format!("{} {}", clean_path, args_str)
            } else {
                clean_path.clone()
            };
            let _ = open::that(&full_target);
        }
    });

    Ok(())
}

#[tauri::command]
pub fn launch_program(window: tauri::Window, path: String, arguments: Option<String>) -> Result<(), String> {
    let res = launch_program_internal(&path, arguments.as_deref());
    if res.is_ok() {
        let _ = window.hide();
    }
    res
}

#[tauri::command]
pub fn extract_icon(path: String) -> Result<String, String> {
    let (target, _) = split_path_and_args(&path, None);
    extract_icon_as_base64(&target)
}

#[tauri::command]
pub fn pick_file() -> Option<String> {
    let msg = "[IPC] Opening RFD file dialog...";
    println!("{}", msg);
    log_to_file(msg);

    let res = rfd::FileDialog::new()
        .set_title("Select Application, File, or Directory")
        .pick_file()
        .map(|p| p.to_string_lossy().to_string());

    let res_msg = format!("[IPC] RFD file dialog selected: {:?}", res);
    println!("{}", res_msg);
    log_to_file(&res_msg);
    res
}

#[tauri::command]
pub fn pick_image() -> Option<String> {
    let msg = "[IPC] Opening RFD icon dialog...";
    println!("{}", msg);
    log_to_file(msg);

    let res = rfd::FileDialog::new()
        .set_title("Select Custom Icon Image")
        .add_filter("Image Files", &["png", "jpg", "jpeg", "ico", "bmp", "svg"])
        .pick_file()
        .map(|p| p.to_string_lossy().to_string());

    let res_msg = format!("[IPC] RFD icon dialog selected: {:?}", res);
    println!("{}", res_msg);
    log_to_file(&res_msg);
    res
}

#[tauri::command]
pub fn center_cursor(window: tauri::Window) -> Result<(), String> {
    let _ = window.center();
    center_mouse_cursor_internal();
    Ok(())
}

#[tauri::command]
pub fn hide_window(window: tauri::WebviewWindow) -> Result<(), String> {
    println!("[IPC] hide_window requested: hiding window to system tray");
    log_to_file("[IPC] hide_window requested: hiding window to system tray");
    let _ = window.hide();
    Ok(())
}

#[tauri::command]
pub fn get_settings_path() -> String {
    let path = settings::get_settings_file_path();
    path.to_string_lossy().to_string()
}

#[tauri::command]
pub fn open_settings_folder() -> Result<(), String> {
    let dir = settings::get_settings_dir();
    if !dir.exists() {
        let _ = std::fs::create_dir_all(&dir);
    }
    let msg = format!("[IPC] open_settings_folder: opening '{:?}'", dir);
    println!("{}", msg);
    log_to_file(&msg);
    open::that(&dir).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_window_close_requested_interception() {
        assert_eq!(
            determine_window_close_action(true),
            WindowCloseAction::HideToSystemTray,
            "CloseRequested event must trigger HideToSystemTray"
        );
        assert_eq!(
            determine_window_close_action(false),
            WindowCloseAction::DefaultClose
        );
    }

    #[test]
    fn test_parse_shortcut_str() {
        assert_eq!(parse_shortcut_str("Alt+Shift", "Z"), "Alt+Shift+KeyZ");
        assert_eq!(parse_shortcut_str("Ctrl+Shift", "x"), "Ctrl+Shift+KeyX");
        assert_eq!(parse_shortcut_str("Alt", "F1"), "Alt+F1");
    }

    #[test]
    fn test_should_activate_window_active_behavior() {
        // Window in system tray -> activate
        assert_eq!(should_activate_window(false, false), true);

        // Window visible but un-focused -> activate & focus
        assert_eq!(should_activate_window(true, false), true);

        // Window already active & focused -> DO NOTHING (return false)
        assert_eq!(should_activate_window(true, true), false);
    }

    #[test]
    fn test_normalize_launch_path_slashes() {
        let input = "C:/Program Files/App/run.exe";
        let normalized = normalize_launch_path(input);
        assert_eq!(normalized, "C:\\Program Files\\App\\run.exe");
    }

    #[test]
    fn test_normalize_launch_path_url() {
        let url = "https://google.com/search?q=test";
        let normalized = normalize_launch_path(url);
        assert_eq!(normalized, "https://google.com/search?q=test");
    }

    #[test]
    fn test_normalize_launch_path_quotes() {
        let quoted = "\"C:/Tools/calc.exe\"";
        let normalized = normalize_launch_path(quoted);
        assert_eq!(normalized, "C:\\Tools\\calc.exe");
    }

    #[test]
    fn test_empty_path_rejection() {
        let res = launch_program_internal("   ", None);
        assert!(res.is_err());
        assert_eq!(res.unwrap_err(), "Path is empty");
    }

    #[test]
    fn test_resolve_shortcut_internal() {
        let res = resolve_shortcut_internal("C:\\Windows\\System32\\schtasks.exe /run /tn \"Arknights\"");
        assert_eq!(res.target_path, "C:\\Windows\\System32\\schtasks.exe");
        assert_eq!(res.arguments, Some("/run /tn \"Arknights\"".to_string()));
        assert_eq!(res.name, Some("schtasks".to_string()));
    }

    #[test]
    fn test_resolve_shortcut_internal_lnk_file() {
        let temp_dir = std::env::temp_dir();
        let lnk_path = temp_dir.join("test_schtasks_shortcut.lnk");
        let ps_create = format!(
            "$sh = New-Object -ComObject WScript.Shell; $s = $sh.CreateShortcut('{}'); $s.TargetPath = 'C:\\Windows\\System32\\schtasks.exe'; $s.Arguments = '/run /tn \"Arknights\"'; $s.Save()",
            lnk_path.to_string_lossy().replace("'", "''")
        );
        let _ = std::process::Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", &ps_create])
            .output();

        if lnk_path.exists() {
            let res = resolve_shortcut_internal(&lnk_path.to_string_lossy());
            println!("[Test LNK Result] Target: {}, Args: {:?}", res.target_path, res.arguments);
            assert_eq!(res.target_path, "C:\\Windows\\System32\\schtasks.exe");
            assert_eq!(res.arguments, Some("/run /tn \"Arknights\"".to_string()));
            let _ = std::fs::remove_file(lnk_path);
        }
    }

    #[test]
    fn test_split_path_and_args() {
        // Case 1: Target path and arguments supplied separately
        let (target1, args1) = split_path_and_args("C:\\Windows\\System32\\schtasks.exe", Some("/run /tn \"Arknights\""));
        assert_eq!(target1, "C:\\Windows\\System32\\schtasks.exe");
        assert_eq!(args1, Some("/run /tn \"Arknights\"".to_string()));

        // Case 2: Full command line line in target path (unquoted executable with args)
        let (target2, args2) = split_path_and_args("C:\\Windows\\System32\\schtasks.exe /run /tn \"Arknights\"", None);
        assert_eq!(target2, "C:\\Windows\\System32\\schtasks.exe");
        assert_eq!(args2, Some("/run /tn \"Arknights\"".to_string()));

        // Case 3: Full command line line in target path (quoted executable with args)
        let (target3, args3) = split_path_and_args("\"C:\\Program Files\\App\\app.exe\" --flag 123", None);
        assert_eq!(target3, "C:\\Program Files\\App\\app.exe");
        assert_eq!(args3, Some("--flag 123".to_string()));
    }

    #[test]
    fn test_launch_program_execution_success() {
        let res = launch_program_internal("cmd.exe", Some("/C exit 0"));
        assert!(res.is_ok(), "launch_program_internal should return Ok(()) for valid command target");
    }

    #[test]
    fn test_grid_window_dimension_calculation() {
        let rows: usize = 5;
        let columns: usize = 5;
        let cell_width: u32 = 150;
        let cell_height: u32 = 40;

        let dims = calculate_grid_window_dimensions(rows, columns, cell_width, cell_height, 0.0, 0.0);

        assert_eq!(dims.required_width, 756.0);
        assert_eq!(dims.required_height, 280.0);
        assert_eq!(dims.max_width, 756.0, "Maximum width must equal visible grid width");
        assert_eq!(dims.max_height, 280.0, "Maximum height must equal visible grid height");
        assert!(dims.min_width <= dims.max_width);
        assert!(dims.min_height <= dims.max_height);
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn test_expand_windows_env_vars() {
        let path = "%SystemRoot%\\System32\\cmd.exe";
        let expanded = expand_windows_env_vars(path);
        assert!(!expanded.contains("%SystemRoot%"));
        assert!(expanded.to_lowercase().contains("system32"));
    }

    #[test]
    fn test_get_settings_path() {
        let p = get_settings_path();
        assert!(p.ends_with("settings.json"), "get_settings_path must end with settings.json");
    }

    #[test]
    fn test_should_log_flag() {
        assert!(should_log(true), "should_log(true) must be true");
        assert!(!should_log(false), "should_log(false) must be false");
    }
}
