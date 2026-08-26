use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

fn default_theme() -> String {
    "dark".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShortcutEntry {
    pub row: usize,
    pub col: usize,
    pub name: String,
    #[serde(rename = "shortcutLocation")]
    pub shortcut_location: String,
    #[serde(default, rename = "arguments")]
    pub arguments: Option<String>,
    #[serde(rename = "imageLocation")]
    pub image_location: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub rows: usize,
    pub columns: usize,
    #[serde(rename = "cellWidth")]
    pub cell_width: u32,
    #[serde(rename = "cellHeight")]
    pub cell_height: u32,
    pub modifier: String,
    pub key: String,
    #[serde(rename = "centerMouseOnStartup")]
    pub center_mouse_on_startup: bool,
    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(rename = "shortcutList")]
    pub shortcut_list: Vec<ShortcutEntry>,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            rows: 5,
            columns: 5,
            cell_width: 150,
            cell_height: 40,
            modifier: "Alt+Shift".to_string(),
            key: "Z".to_string(),
            center_mouse_on_startup: false,
            theme: "dark".to_string(),
            shortcut_list: Vec::new(),
        }
    }
}

pub fn get_settings_dir() -> PathBuf {
    let mut dir = dirs_next_dir();
    dir.push("TomLauncherV2");
    dir
}

pub fn get_settings_file_path() -> PathBuf {
    let mut path = get_settings_dir();
    path.push("settings.json");
    path
}

fn dirs_next_dir() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        if let Ok(appdata) = std::env::var("APPDATA") {
            return PathBuf::from(appdata);
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        if let Ok(home) = std::env::var("HOME") {
            let mut path = PathBuf::from(home);
            path.push(".config");
            return path;
        }
    }
    std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}

pub fn load_settings() -> Settings {
    let path = get_settings_file_path();
    if path.exists() {
        match fs::read_to_string(&path) {
            Ok(content) => match serde_json::from_str::<Settings>(&content) {
                Ok(settings) => return settings,
                Err(e) => eprintln!("[Settings] Failed to parse settings.json: {}. Using defaults.", e),
            },
            Err(e) => eprintln!("[Settings] Failed to read settings.json: {}. Using defaults.", e),
        }
    }

    let default_settings = Settings::default();
    let _ = save_settings(&default_settings);
    default_settings
}

pub fn save_settings(settings: &Settings) -> Result<(), String> {
    let dir = get_settings_dir();
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    let path = get_settings_file_path();
    let json = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_settings() {
        let s = Settings::default();
        assert_eq!(s.rows, 5);
        assert_eq!(s.columns, 5);
        assert_eq!(s.cell_width, 150);
        assert_eq!(s.cell_height, 40);
        assert_eq!(s.modifier, "Alt+Shift");
        assert_eq!(s.key, "Z");
        assert_eq!(s.center_mouse_on_startup, false);
        assert_eq!(s.theme, "dark");
        assert!(s.shortcut_list.is_empty());
    }

    #[test]
    fn test_json_serialization() {
        let mut s = Settings::default();
        s.theme = "light".to_string();
        s.shortcut_list.push(ShortcutEntry {
            row: 1,
            col: 2,
            name: "Schtasks".to_string(),
            shortcut_location: "C:\\Windows\\System32\\schtasks.exe".to_string(),
            arguments: Some("/run /tn \"Arknights\"".to_string()),
            image_location: None,
        });

        let json = serde_json::to_string(&s).expect("Serialization failed");
        assert!(json.contains("\"cellWidth\":150"));
        assert!(json.contains("\"cellHeight\":40"));
        assert!(json.contains("\"theme\":\"light\""));
        assert!(json.contains("\"shortcutLocation\":\"C:\\\\Windows\\\\System32\\\\schtasks.exe\""));
        assert!(json.contains("\"arguments\":\"/run /tn \\\"Arknights\\\"\""));

        let deserialized: Settings = serde_json::from_str(&json).expect("Deserialization failed");
        assert_eq!(deserialized.theme, "light");
        assert_eq!(deserialized.shortcut_list.len(), 1);
        assert_eq!(deserialized.shortcut_list[0].row, 1);
        assert_eq!(deserialized.shortcut_list[0].col, 2);
        assert_eq!(deserialized.shortcut_list[0].name, "Schtasks");
        assert_eq!(deserialized.shortcut_list[0].shortcut_location, "C:\\Windows\\System32\\schtasks.exe");
        assert_eq!(deserialized.shortcut_list[0].arguments, Some("/run /tn \"Arknights\"".to_string()));
    }
}
