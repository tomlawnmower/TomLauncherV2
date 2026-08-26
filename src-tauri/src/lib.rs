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
        .on_window_event(|window, event| {
            let is_close_req = matches!(event, tauri::WindowEvent::CloseRequested { .. });
            if commands::determine_window_close_action(is_close_req) == commands::WindowCloseAction::HideToSystemTray {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    println!("[Window Event] CloseRequested intercepted -> hiding window to system tray");
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
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
            commands::resolve_shortcut
        ])
        .run(tauri::generate_context!())
        .expect("error while running TomLauncher V2");
}
