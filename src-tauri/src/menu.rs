use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder},
    App, Emitter, Manager,
};

pub fn setup(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    let check_for_updates =
        MenuItemBuilder::with_id("check_for_updates", "Check for Updates...").build(app)?;

    let zoom_in = MenuItemBuilder::with_id("zoom_in", "Zoom In")
        .accelerator("CmdOrCtrl+=")
        .build(app)?;
    let zoom_out = MenuItemBuilder::with_id("zoom_out", "Zoom Out")
        .accelerator("CmdOrCtrl+-")
        .build(app)?;
    let zoom_reset = MenuItemBuilder::with_id("zoom_reset", "Actual Size")
        .accelerator("CmdOrCtrl+0")
        .build(app)?;

    let quit = MenuItemBuilder::with_id("quit", "Quit shelldeck")
        .accelerator("CmdOrCtrl+Q")
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
        .item(&quit)
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
        .item(&zoom_in)
        .item(&zoom_out)
        .item(&zoom_reset)
        .separator()
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
            check_for_updates_handler(app_handle.clone());
        } else if event.id() == zoom_in.id() {
            let _ = app_handle.emit("zoom", "in");
        } else if event.id() == zoom_out.id() {
            let _ = app_handle.emit("zoom", "out");
        } else if event.id() == zoom_reset.id() {
            let _ = app_handle.emit("zoom", "reset");
        } else if event.id() == quit.id() {
            if let Some(window) = app_handle.get_webview_window("main") {
                let _ = window.close();
            }
        }
    });

    Ok(())
}

fn check_for_updates_handler(app_handle: tauri::AppHandle) {
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
                    .buttons(tauri_plugin_dialog::MessageDialogButtons::OkCancelCustom(
                        "Install and Restart".into(),
                        "Later".into(),
                    ))
                    .blocking_show();

                if confirmed {
                    if let Err(e) = update.download_and_install(|_, _| {}, || {}).await {
                        app_handle
                            .dialog()
                            .message(format!("Failed to install update:\n{e}"))
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
