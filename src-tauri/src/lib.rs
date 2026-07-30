/// Open the web inspector (devtools). Gated by the `devtools` Cargo feature so
/// it works in both debug and release builds when the user enables dev mode.
#[tauri::command]
fn open_devtools(window: tauri::WebviewWindow) {
  window.open_devtools();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  #[cfg_attr(not(desktop), allow(unused_mut))]
  let mut builder = tauri::Builder::default()
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_store::Builder::new().build())
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_deep_link::init())
    .invoke_handler(tauri::generate_handler![open_devtools]);

  // The updater plugin is desktop-only.
  #[cfg(desktop)]
  {
    builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
  }

  // StoreKit / Play Billing — mobile only.
  #[cfg(mobile)]
  {
    builder = builder.plugin(tauri_plugin_purchases::init());
  }

  builder
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // After a post-update relaunch on macOS the new process starts without
      // activating, leaving the window hidden behind other apps. Explicitly
      // show and focus here so every launch — including relaunches — brings
      // the window to the front.
      #[cfg(desktop)]
      {
        use tauri::Manager;
        if let Some(window) = app.get_webview_window("main") {
          let _ = window.show();
          let _ = window.set_focus();
        }
      }

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
