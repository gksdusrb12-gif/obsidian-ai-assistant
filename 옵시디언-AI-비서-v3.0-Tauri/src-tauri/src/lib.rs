mod ai;
mod config;
mod error;
mod scraper;
mod vault;

use ai::AiRequest;
use config::Config;
use error::AppError;
use scraper::ScrapeResult;

// ── Tauri commands ────────────────────────────────────────────────────────────

#[tauri::command]
async fn get_config() -> Result<Config, AppError> {
    config::load_config()
}

#[tauri::command]
async fn save_config(cfg: Config) -> Result<Config, AppError> {
    config::save_config(cfg)
}

#[tauri::command]
async fn list_top_folders(base: String) -> Result<Vec<String>, AppError> {
    vault::list_top_folders(&base)
}

#[tauri::command]
async fn list_sub_folders(base: String, top: String) -> Result<Vec<String>, AppError> {
    vault::list_sub_folders(&base, &top)
}

#[tauri::command]
async fn list_notes(
    base: String,
    top: String,
    sub: Option<String>,
) -> Result<Vec<String>, AppError> {
    vault::list_notes(&base, &top, sub.as_deref())
}

#[tauri::command]
async fn read_note(
    base: String,
    top: String,
    sub: Option<String>,
    name: String,
) -> Result<String, AppError> {
    vault::read_note(&base, &top, sub.as_deref(), &name)
}

#[tauri::command]
async fn save_note(
    base: String,
    sub: String,
    name: String,
    content: String,
) -> Result<String, AppError> {
    vault::save_note(&base, &sub, &name, &content)
}

#[tauri::command]
async fn make_subfolder(base: String, name: String) -> Result<(), AppError> {
    vault::make_subfolder(&base, &name)
}

#[tauri::command]
async fn call_ai(req: AiRequest) -> Result<String, AppError> {
    ai::generate(req).await
}

#[tauri::command]
async fn scrape_url(url: String) -> Result<ScrapeResult, AppError> {
    scraper::scrape(&url).await
}

#[tauri::command]
fn app_version() -> &'static str {
    "3.0.0"
}

// ── App entry point ───────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            get_config,
            save_config,
            list_top_folders,
            list_sub_folders,
            list_notes,
            read_note,
            save_note,
            make_subfolder,
            call_ai,
            scrape_url,
            app_version
        ])
        .run(tauri::generate_context!())
        .expect("Tauri 앱을 실행하는 데 실패했습니다.");
}
