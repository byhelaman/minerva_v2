
use std::fs;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn save_file(app: tauri::AppHandle, window: tauri::Window, title: String, default_name: String, content: Vec<u8>, open_file: bool) -> Result<bool, String> {
    // 1. Mostrar diálogo nativo "Guardar Como"
    // Esto es el Core de la seguridad: El usuario DEBE interactuar para guardar fuera del sandbox
    // Usamos blocking_save_file para simplificar el flujo async en este comando
    let file_path = app.dialog()
        .file()
        .set_parent(&window)
        .set_title(title)
        .set_file_name(default_name)
        .blocking_save_file();

    // 2. Si el usuario eligió un path (no canceló)
    if let Some(path) = file_path {
        // Escribir el contenido
        // Al estar en Rust, esto ignora el sandbox de Tauri (que solo afecta a JS)
        // PERO es seguro porque el path vino del diálogo del usuario
        // Convertimos path a PathBuf para fs::write
        let path_buf = path.into_path().map_err(|e| e.to_string())?;
        fs::write(&path_buf, content).map_err(|e| e.to_string())?;

        // 3. Abrir el archivo si se solicitó (Feedback visual inmediato)
        if open_file {
             // Convertir path a string para el plugin opener
             let path_str = path_buf.to_string_lossy().to_string();
             app.opener().open_path(path_str, None::<&str>).map_err(|e| e.to_string())?;
        }
        
        Ok(true) // Guardado exitoso
    } else {
        Ok(false) // Usuario canceló
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, save_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
