mod menu;
mod pty;
mod store;

#[tauri::command]
fn path_exists(path: String) -> bool {
    std::path::Path::new(&path).exists()
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(
                    tauri_plugin_window_state::StateFlags::all()
                        & !tauri_plugin_window_state::StateFlags::VISIBLE
                        & !tauri_plugin_window_state::StateFlags::SIZE,
                )
                .build(),
        )
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;

            menu::setup(app)?;
            Ok(())
        })
        .manage(pty::PtyState::default())
        .invoke_handler(tauri::generate_handler![
            store::get_workspaces,
            store::save_workspaces,
            store::get_sessions,
            store::save_sessions,
            store::get_settings,
            store::save_settings,
            path_exists,
            pty::pty_spawn,
            pty::pty_write,
            pty::pty_read,
            pty::pty_resize,
            pty::pty_kill,
            pty::pty_exitstatus,
            pty::pty_cleanup,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
