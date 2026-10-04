use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

mod commands;
mod icon_extractor;
mod settings;

pub fn activate_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();

        let settings = settings::load_settings();
        let _ = commands::resize_window_to_grid(
            window.clone(),
            settings.rows,
            settings.columns,
            settings.cell_width,
            settings.cell_height,
        );

        let _ = window.set_focus();

        if settings.center_mouse_on_startup {
            let _ = window.center();
            commands::center_mouse_cursor_internal();
        }
    }
}

pub fn register_hotkey(app: &tauri::AppHandle, modifier_str: &str, key_str: &str) {
    let hotkey_str = commands::parse_shortcut_str(modifier_str, key_str);
    println!("[Global Shortcut] Registering hotkey: '{}'", hotkey_str);

    let _ = app.global_shortcut().unregister_all();

    if let Ok(shortcut) = hotkey_str.parse::<Shortcut>() {
        let res = app.global_shortcut().on_shortcut(shortcut, move |app, _shortcut, event| {
            if event.state() == ShortcutState::Pressed {
                println!("[Global Shortcut] Pressed: checking window status");
                if let Some(window) = app.get_webview_window("main") {
                    let is_visible = window.is_visible().unwrap_or(false);
                    let is_focused = window.is_focused().unwrap_or(false);

                    if commands::should_activate_window(is_visible, is_focused) {
                        println!("[Global Shortcut] Window not visible or focused -> activating window");
                        activate_window(app);
                    } else {
                        println!("[Global Shortcut] Window already active & focused -> doing nothing");
                    }
                }
            }
        });
        if let Err(e) = res {
            eprintln!("[Global Shortcut] Error registering '{}': {}", hotkey_str, e);
        }
    } else {
        eprintln!("[Global Shortcut] Failed to parse shortcut string: '{}'", hotkey_str);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(
                    tauri_plugin_window_state::StateFlags::all()
                        & !tauri_plugin_window_state::StateFlags::SIZE
                        & !tauri_plugin_window_state::StateFlags::MAXIMIZED,
                )
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                if commands::determine_window_close_action(true) == commands::WindowCloseAction::HideToSystemTray {
                    println!("[Window Event] CloseRequested intercepted -> hiding window to system tray");
                    commands::log_to_file("[Window Event] CloseRequested intercepted -> hiding window to system tray");
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
            tauri::WindowEvent::ScaleFactorChanged { scale_factor, .. } => {
                let msg = format!("[Window Event] ScaleFactorChanged -> {}", scale_factor);
                println!("{}", msg);
                commands::log_to_file(&msg);

                if let Some(main_win) = window.app_handle().get_webview_window("main") {
                    let settings = settings::load_settings();
                    let _ = commands::resize_window_to_grid(
                        main_win,
                        settings.rows,
                        settings.columns,
                        settings.cell_width,
                        settings.cell_height,
                    );
                }
            }
            tauri::WindowEvent::Resized(size) => {
                if let Some(main_win) = window.app_handle().get_webview_window("main") {
                    let settings = settings::load_settings();
                    let dims = commands::calculate_grid_window_dimensions(
                        settings.rows,
                        settings.columns,
                        settings.cell_width,
                        settings.cell_height,
                        0.0,
                        0.0,
                    );
                    let scale_factor = window.scale_factor().unwrap_or(1.0);
                    let expected_phys_w = (dims.required_width * scale_factor).round() as u32;
                    let expected_phys_h = (dims.required_height * scale_factor).round() as u32;

                    let is_maximized = window.is_maximized().unwrap_or(false);
                    let size_mismatch = (size.width as i32 - expected_phys_w as i32).abs() > 2
                        || (size.height as i32 - expected_phys_h as i32).abs() > 2;

                    if is_maximized || size_mismatch {
                        let msg = format!(
                            "[Window Event] Resized/DPI Mismatch detected (Actual: {}x{}, Expected: {}x{}, Maximized: {}) -> Re-clamping to grid",
                            size.width, size.height, expected_phys_w, expected_phys_h, is_maximized
                        );
                        println!("{}", msg);
                        commands::log_to_file(&msg);

                        let _ = commands::resize_window_to_grid(
                            main_win,
                            settings.rows,
                            settings.columns,
                            settings.cell_width,
                            settings.cell_height,
                        );
                    }
                }
            }
            _ => {}
        })
        .setup(|app| {
            let show_i = MenuItem::with_id(app, "show", "Show TomLauncher", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            let mut builder = TrayIconBuilder::new().menu(&menu);
            if let Some(icon) = app.default_window_icon() {
                builder = builder.icon(icon.clone());
            }

            let _tray = builder
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        activate_window(app);
                    }
                    "quit" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.destroy();
                        }
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        activate_window(tray.app_handle());
                    }
                })
                .build(app)?;

            // Register global hotkey on startup
            let settings = settings::load_settings();
            register_hotkey(app.handle(), &settings.modifier, &settings.key);

            // Activate and center window on initial launch
            activate_window(app.handle());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_settings,
            commands::save_settings,
            commands::resize_window_to_grid,
            commands::launch_program,
            commands::extract_icon,
            commands::pick_file,
            commands::pick_image,
            commands::center_cursor,
            commands::exit_app,
            commands::resolve_shortcut,
            commands::hide_window,
            commands::get_settings_path,
            commands::open_settings_folder
        ])
        .run(tauri::generate_context!())
        .expect("error while running TomLauncher V2");
}
