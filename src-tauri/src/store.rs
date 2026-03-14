use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

fn data_dir(app: &AppHandle) -> PathBuf {
    app.path().app_data_dir().expect("failed to get app data dir")
}

fn ensure_dir(app: &AppHandle) {
    let dir = data_dir(app);
    if !dir.exists() {
        fs::create_dir_all(&dir).ok();
    }
}

fn read_json(path: &PathBuf) -> Value {
    match fs::read_to_string(path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or(Value::Null),
        Err(_) => Value::Null,
    }
}

fn write_json(path: &PathBuf, value: &Value) {
    if let Ok(content) = serde_json::to_string_pretty(value) {
        fs::write(path, content).ok();
    }
}

#[tauri::command]
pub fn get_projects(app: AppHandle) -> Value {
    ensure_dir(&app);
    let path = data_dir(&app).join("projects.json");
    let val = read_json(&path);
    if val.is_null() {
        Value::Array(vec![])
    } else {
        val
    }
}

#[tauri::command]
pub fn save_projects(app: AppHandle, projects: Value) {
    ensure_dir(&app);
    let path = data_dir(&app).join("projects.json");
    write_json(&path, &projects);
}

#[tauri::command]
pub fn get_sessions(app: AppHandle) -> Value {
    ensure_dir(&app);
    let path = data_dir(&app).join("sessions.json");
    let val = read_json(&path);
    if val.is_null() {
        Value::Array(vec![])
    } else {
        val
    }
}

#[tauri::command]
pub fn save_sessions(app: AppHandle, sessions: Value) {
    ensure_dir(&app);
    let path = data_dir(&app).join("sessions.json");
    write_json(&path, &sessions);
}

#[tauri::command]
pub fn get_settings(app: AppHandle) -> Value {
    ensure_dir(&app);
    let path = data_dir(&app).join("settings.json");
    let val = read_json(&path);
    if val.is_null() {
        Value::Object(serde_json::Map::new())
    } else {
        val
    }
}

#[tauri::command]
pub fn save_settings(app: AppHandle, settings: Value) {
    ensure_dir(&app);
    let path = data_dir(&app).join("settings.json");
    // Merge with existing settings.
    let mut existing = match read_json(&path) {
        Value::Object(map) => map,
        _ => serde_json::Map::new(),
    };
    if let Value::Object(incoming) = settings {
        for (k, v) in incoming {
            existing.insert(k, v);
        }
    }
    write_json(&path, &Value::Object(existing));
}
