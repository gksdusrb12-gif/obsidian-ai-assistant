use crate::error::{AppError, AppResult};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::PathBuf;

// ── Structs ──────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(default)]
pub struct Config {
    pub schema_version: u32,
    pub user_id: String,
    pub obsidian_base_path: String,
    pub obsidian_subfolders: Vec<String>,
    pub providers: Providers,
    pub selected_model: String,
    pub theme: String,
    pub remote: RemoteConfig,
    pub updated_at: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(default)]
pub struct Providers {
    pub gemini: ProviderKey,
    pub openai: ProviderKey,
    pub anthropic: ProviderKey,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(default)]
pub struct ProviderKey {
    pub api_key: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(default)]
pub struct RemoteConfig {
    pub enabled: bool,
    pub endpoint: String,
    pub sync_interval_minutes: u32,
}

// ── Defaults ─────────────────────────────────────────────────────────────────

impl Default for Config {
    fn default() -> Self {
        default_config()
    }
}

impl Default for RemoteConfig {
    fn default() -> Self {
        RemoteConfig {
            enabled: false,
            endpoint: String::new(),
            sync_interval_minutes: 60,
        }
    }
}

pub fn default_config() -> Config {
    Config {
        schema_version: 3,
        user_id: String::new(),
        obsidian_base_path: String::new(),
        obsidian_subfolders: Vec::new(),
        providers: Providers::default(),
        selected_model: "gemini-2.0-flash".to_string(),
        theme: "obsidian".to_string(),
        remote: RemoteConfig::default(),
        updated_at: String::new(),
    }
}

// ── Storage path ──────────────────────────────────────────────────────────────

fn config_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".myai_obsidian_config.json")
}

// ── Migration ─────────────────────────────────────────────────────────────────

/// Migrate a raw JSON Value from v1/v2 to the v3 Config struct.
fn migrate(mut raw: Value) -> Config {
    let version = raw
        .get("schema_version")
        .and_then(|v| v.as_u64())
        .unwrap_or(1) as u32;

    // v1 → v3: flat api_key fields → nested providers
    if version < 3 {
        // obsidian_path → obsidian_base_path
        if let Some(op) = raw.get("obsidian_path").and_then(|v| v.as_str()).map(String::from) {
            if raw.get("obsidian_base_path").and_then(|v| v.as_str()).unwrap_or("").is_empty() {
                raw["obsidian_base_path"] = Value::String(op);
            }
        }

        // Flatten provider keys: api_key, openai_api_key, anthropic_api_key
        let gemini_key = raw
            .get("api_key")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let openai_key = raw
            .get("openai_api_key")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let anthropic_key = raw
            .get("anthropic_api_key")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        // Only set nested keys if providers block not already present
        if raw.get("providers").is_none() || !raw["providers"].is_object() {
            raw["providers"] = serde_json::json!({
                "gemini":   { "api_key": gemini_key },
                "openai":   { "api_key": openai_key },
                "anthropic":{ "api_key": anthropic_key }
            });
        }

        raw["schema_version"] = Value::from(3u32);
    }

    // Deserialize into Config (uses serde defaults for missing fields)
    serde_json::from_value(raw).unwrap_or_else(|_| default_config())
}

// ── Public API ────────────────────────────────────────────────────────────────

pub fn load_config() -> AppResult<Config> {
    let path = config_path();

    if !path.exists() {
        return Ok(default_config());
    }

    let data = fs::read_to_string(&path)?;
    let raw: Value = serde_json::from_str(&data)?;
    Ok(migrate(raw))
}

pub fn save_config(mut cfg: Config) -> AppResult<Config> {
    cfg.schema_version = 3;
    cfg.updated_at = Utc::now().to_rfc3339();

    let json = serde_json::to_string_pretty(&cfg)?;

    let path = config_path();
    let dir = path.parent().unwrap_or_else(|| std::path::Path::new("."));

    // Atomic write: temp file → rename
    let tmp_name = format!(
        ".cfg_{}.tmp",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.subsec_nanos())
            .unwrap_or(0)
    );
    let tmp_path = dir.join(tmp_name);

    fs::write(&tmp_path, &json)?;
    fs::rename(&tmp_path, &path)?;

    Ok(cfg)
}
