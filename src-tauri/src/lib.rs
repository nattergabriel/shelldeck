mod pty;
mod store;
mod system_monitor;

use system_monitor::SystemMonitor;
use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};

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
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;

            let check_for_updates =
                MenuItemBuilder::with_id("check_for_updates", "Check for Updates...")
                    .build(app)?;

            let app_menu = SubmenuBuilder::new(app, "shelldeck")
                .about(None)
                .separator()
                .item(&check_for_updates)
                .separator()
                .services()
                .separator()
                .hide()
                .hide_others()
                .show_all()
                .separator()
                .quit()
                .build()?;

            let edit_menu = SubmenuBuilder::new(app, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;

            let view_menu = SubmenuBuilder::new(app, "View")
                .item(&PredefinedMenuItem::fullscreen(app, None)?)
                .build()?;

            let window_menu = SubmenuBuilder::new(app, "Window")
                .minimize()
                .item(&PredefinedMenuItem::maximize(app, None)?)
                .close_window()
                .build()?;

            let menu = MenuBuilder::new(app)
                .items(&[&app_menu, &edit_menu, &view_menu, &window_menu])
                .build()?;

            app.set_menu(menu)?;

            app.on_menu_event(move |app_handle, event| {
                if event.id() == check_for_updates.id() {
                    let app_handle = app_handle.clone();
                    tauri::async_runtime::spawn(async move {
                        use tauri_plugin_dialog::DialogExt;
                        use tauri_plugin_updater::UpdaterExt;

                        let updater = match app_handle.updater_builder().build() {
                            Ok(u) => u,
                            Err(e) => {
                                app_handle
                                    .dialog()
                                    .message(format!("Failed to check for updates:\n{e}"))
                                    .title("Update Error")
                                    .blocking_show();
                                return;
                            }
                        };

                        match updater.check().await {
                            Ok(Some(update)) => {
                                let version = update.version.clone();
                                let confirmed = app_handle
                                    .dialog()
                                    .message(format!(
                                        "A new version ({version}) is available. Would you like to install it and restart?"
                                    ))
                                    .title("Update Available")
                                    .buttons(tauri_plugin_dialog::MessageDialogButtons::OkCancelCustom("Install and Restart".into(), "Later".into()))
                                    .blocking_show();

                                if confirmed {
                                    if let Err(e) =
                                        update.download_and_install(|_, _| {}, || {}).await
                                    {
                                        app_handle
                                            .dialog()
                                            .message(format!(
                                                "Failed to install update:\n{e}"
                                            ))
                                            .title("Update Error")
                                            .blocking_show();
                                        return;
                                    }
                                    app_handle.restart();
                                }
                            }
                            Ok(None) => {
                                app_handle
                                    .dialog()
                                    .message("You're already on the latest version.")
                                    .title("No Updates Available")
                                    .blocking_show();
                            }
                            Err(e) => {
                                app_handle
                                    .dialog()
                                    .message(format!("Failed to check for updates:\n{e}"))
                                    .title("Update Error")
                                    .blocking_show();
                            }
                        }
                    });
                }
            });

            Ok(())
        })
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
