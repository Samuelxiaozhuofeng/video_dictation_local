mod cache;
mod import;
mod tts;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_http::init())
    .plugin(tauri_plugin_opener::init())
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
    .invoke_handler(tauri::generate_handler![
      import::start_import,
      import::open_youtube_login,
      import::probe_import_sizes,
      cache::write_cache,
      tts::tts,
      trash_file
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

// Move a file to the macOS Trash (recoverable), via the system `trash` tool.
#[tauri::command]
fn trash_file(path: String) -> Result<(), String> {
  if !std::path::Path::new(&path).is_file() {
    return Err("not a file".into());
  }
  let out = std::process::Command::new("/usr/bin/trash")
    .arg(&path)
    .output()
    .map_err(|e| e.to_string())?;
  if out.status.success() {
    Ok(())
  } else {
    Err(String::from_utf8_lossy(&out.stderr).into_owned())
  }
}
