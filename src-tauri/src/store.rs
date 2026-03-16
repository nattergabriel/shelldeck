use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

fn store_path(app: &AppHandle, filename: &str) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data directory: {e}"))?;
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create app data directory: {e}"))?;
    Ok(dir.join(filename))
}

fn read_json(path: &Path) -> Result<Value, String> {
    match fs::read_to_string(path) {
        Ok(content) => serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse {}: {e}", path.display())),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Value::Null),
        Err(e) => Err(format!("Failed to read {}: {e}", path.display())),
    }
}

fn write_json(path: &Path, value: &Value) -> Result<(), String> {
    let content = serde_json::to_string_pretty(value)
        .map_err(|e| format!("Failed to serialize JSON: {e}"))?;
    fs::write(path, content).map_err(|e| format!("Failed to write {}: {e}", path.display()))
}

fn get_json(app: &AppHandle, filename: &str, default: Value) -> Result<Value, String> {
    let path = store_path(app, filename)?;
    let val = read_json(&path)?;
    Ok(if val.is_null() { default } else { val })
}

fn save_json(app: &AppHandle, filename: &str, value: &Value) -> Result<(), String> {
    let path = store_path(app, filename)?;
    write_json(&path, value)
}

#[tauri::command]
pub fn get_workspaces(app: AppHandle) -> Result<Value, String> {
    get_json(&app, "workspaces.json", Value::Array(vec![]))
}

#[tauri::command]
pub fn save_workspaces(app: AppHandle, workspaces: Value) -> Result<(), String> {
    save_json(&app, "workspaces.json", &workspaces)
}

#[tauri::command]
pub fn get_sessions(app: AppHandle) -> Result<Value, String> {
    get_json(&app, "sessions.json", Value::Array(vec![]))
}

#[tauri::command]
pub fn save_sessions(app: AppHandle, sessions: Value) -> Result<(), String> {
    save_json(&app, "sessions.json", &sessions)
}

#[tauri::command]
pub fn get_settings(app: AppHandle) -> Result<Value, String> {
    get_json(
        &app,
        "settings.json",
        Value::Object(serde_json::Map::new()),
    )
}

#[tauri::command]
pub fn save_settings(app: AppHandle, settings: Value) -> Result<(), String> {
    let path = store_path(&app, "settings.json")?;
    let mut existing = match read_json(&path)? {
        Value::Object(map) => map,
        _ => serde_json::Map::new(),
    };
    match settings {
        Value::Object(incoming) => {
            for (k, v) in incoming {
                existing.insert(k, v);
            }
        }
        _ => return Err("Settings must be a JSON object".to_string()),
    }
    write_json(&path, &Value::Object(existing))
}
