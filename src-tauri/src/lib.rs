mod pty;
mod store;
mod system_monitor;

use system_monitor::SystemMonitor;

#[tauri::command]
fn path_exists(path: String) -> bool {
    std::path::Path::new(&path).exists()
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .manage(SystemMonitor::new())
        .manage(pty::PtyState::default())
        .invoke_handler(tauri::generate_handler![
            store::get_projects,
            store::save_projects,
            store::get_sessions,
            store::save_sessions,
            store::get_settings,
            store::save_settings,
            system_monitor::get_system_stats,
            path_exists,
            pty::pty_spawn,
            pty::pty_write,
            pty::pty_read,
            pty::pty_resize,
            pty::pty_kill,
            pty::pty_exitstatus,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
