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

  builder
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
