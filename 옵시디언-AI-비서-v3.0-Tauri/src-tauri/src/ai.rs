use crate::error::{AppError, AppResult};
use serde::Deserialize;
use serde_json::{json, Value};

// ── Request type ─────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct AiRequest {
    pub provider: String,
    pub model: String,
    pub api_key: String,
    pub prompt: String,
    pub image_base64: Option<String>,
    pub text_data: Option<String>,
    pub audio_path: Option<String>,
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

pub async fn generate(req: AiRequest) -> AppResult<String> {
    match req.provider.as_str() {
        "gemini" => gemini_generate(req).await,
        "openai" => openai_generate(req).await,
        "anthropic" => anthropic_generate(req).await,
        other => Err(AppError::Provider(format!(
            "알 수 없는 프로바이더: {}",
            other
        ))),
    }
}

// ── Shared HTTP client ────────────────────────────────────────────────────────

fn http_client() -> AppResult<reqwest::Client> {
    reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Obsidian-AI-Assistant/3.0)")
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(AppError::Http)
}

// ── Text builder: prompt + optional text_data ─────────────────────────────────

fn build_prompt_text(prompt: &str, text_data: Option<&str>) -> String {
    match text_data {
        Some(td) if !td.is_empty() => format!("{}\n\n[데이터]\n{}", prompt, td),
        _ => prompt.to_string(),
    }
}

// ── Gemini ────────────────────────────────────────────────────────────────────

async fn gemini_generate(req: AiRequest) -> AppResult<String> {
    let client = http_client()?;
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        req.model, req.api_key
    );

    let text = build_prompt_text(&req.prompt, req.text_data.as_deref());
    let mut parts: Vec<Value> = vec![json!({"text": text})];

    // Image (inline)
    if let Some(b64) = &req.image_base64 {
        if !b64.is_empty() {
            parts.push(json!({
                "inline_data": {
                    "mime_type": "image/png",
                    "data": b64
                }
            }));
        }
    }

    // Audio (inline — Gemini supports inline audio up to 20 MB)
    if let Some(audio_path) = &req.audio_path {
        if !audio_path.is_empty() {
            let path = std::path::Path::new(audio_path);
            let audio_bytes = std::fs::read(path)?;
            let audio_b64 = base64_encode(&audio_bytes);
            let mime = mime_from_path(path);
            parts.push(json!({
                "inline_data": {
                    "mime_type": mime,
                    "data": audio_b64
                }
            }));
        }
    }

    let body = json!({
        "contents": [{
            "role": "user",
            "parts": parts
        }]
    });

    let resp = client.post(&url).json(&body).send().await?;
    let val: Value = resp.json().await?;

    extract_gemini_text(&val)
}

fn extract_gemini_text(val: &Value) -> AppResult<String> {
    val.get("candidates")
        .and_then(|c| c.get(0))
        .and_then(|c| c.get("content"))
        .and_then(|c| c.get("parts"))
        .and_then(|p| p.get(0))
        .and_then(|p| p.get("text"))
        .and_then(|t| t.as_str())
        .map(String::from)
        .ok_or_else(|| {
            let error_msg = val
                .get("error")
                .and_then(|e| e.get("message"))
                .and_then(|m| m.as_str())
                .unwrap_or("Gemini API 응답을 파싱할 수 없습니다.");
            AppError::Provider(error_msg.to_string())
        })
}

// ── OpenAI ────────────────────────────────────────────────────────────────────

async fn openai_generate(req: AiRequest) -> AppResult<String> {
    let client = http_client()?;

    let text = build_prompt_text(&req.prompt, req.text_data.as_deref());

    // Handle audio: transcribe first, then append to prompt
    let final_text = if let Some(audio_path) = &req.audio_path {
        if !audio_path.is_empty() {
            let transcript = openai_transcribe(&client, &req.api_key, audio_path).await?;
            format!("{}\n\n[음성 전사]\n{}", text, transcript)
        } else {
            text
        }
    } else {
        text
    };

    let mut content: Vec<Value> = vec![json!({"type": "text", "text": final_text})];

    if let Some(b64) = &req.image_base64 {
        if !b64.is_empty() {
            content.push(json!({
                "type": "image_url",
                "image_url": {
                    "url": format!("data:image/png;base64,{}", b64)
                }
            }));
        }
    }

    let body = json!({
        "model": req.model,
        "messages": [{
            "role": "user",
            "content": content
        }]
    });

    let resp = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", req.api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await?;

    let val: Value = resp.json().await?;

    val.get("choices")
        .and_then(|c| c.get(0))
        .and_then(|c| c.get("message"))
        .and_then(|m| m.get("content"))
        .and_then(|t| t.as_str())
        .map(String::from)
        .ok_or_else(|| {
            let error_msg = val
                .get("error")
                .and_then(|e| e.get("message"))
                .and_then(|m| m.as_str())
                .unwrap_or("OpenAI API 응답을 파싱할 수 없습니다.");
            AppError::Provider(error_msg.to_string())
        })
}

async fn openai_transcribe(
    client: &reqwest::Client,
    api_key: &str,
    audio_path: &str,
) -> AppResult<String> {
    let path = std::path::Path::new(audio_path);
    let audio_bytes = std::fs::read(path)?;
    let filename = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("audio.mp3")
        .to_string();

    let part = reqwest::multipart::Part::bytes(audio_bytes)
        .file_name(filename)
        .mime_str("audio/mpeg")
        .map_err(AppError::Http)?;

    let form = reqwest::multipart::Form::new()
        .text("model", "whisper-1")
        .part("file", part);

    let resp = client
        .post("https://api.openai.com/v1/audio/transcriptions")
        .header("Authorization", format!("Bearer {}", api_key))
        .multipart(form)
        .send()
        .await?;

    let val: Value = resp.json().await?;
    val.get("text")
        .and_then(|t| t.as_str())
        .map(String::from)
        .ok_or_else(|| {
            AppError::Provider("음성 전사 결과를 파싱할 수 없습니다.".to_string())
        })
}

// ── Anthropic ─────────────────────────────────────────────────────────────────

async fn anthropic_generate(req: AiRequest) -> AppResult<String> {
    // Audio not supported on Claude
    if req.audio_path.as_deref().map(|s| !s.is_empty()).unwrap_or(false) {
        return Err(AppError::Provider(
            "Claude 모델은 음성 분석을 지원하지 않습니다. Gemini 또는 GPT 모델을 사용해주세요."
                .to_string(),
        ));
    }

    let client = http_client()?;
    let text = build_prompt_text(&req.prompt, req.text_data.as_deref());

    let mut content: Vec<Value> = vec![json!({"type": "text", "text": text})];

    if let Some(b64) = &req.image_base64 {
        if !b64.is_empty() {
            content.push(json!({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/png",
                    "data": b64
                }
            }));
        }
    }

    let body = json!({
        "model": req.model,
        "max_tokens": 4096,
        "messages": [{
            "role": "user",
            "content": content
        }]
    });

    let resp = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &req.api_key)
        .header("anthropic-version", "2023-06-01")
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await?;

    let val: Value = resp.json().await?;

    val.get("content")
        .and_then(|c| c.get(0))
        .and_then(|c| c.get("text"))
        .and_then(|t| t.as_str())
        .map(String::from)
        .ok_or_else(|| {
            let error_msg = val
                .get("error")
                .and_then(|e| e.get("message"))
                .and_then(|m| m.as_str())
                .unwrap_or("Anthropic API 응답을 파싱할 수 없습니다.");
            AppError::Provider(error_msg.to_string())
        })
}

// ── Audio MIME helper ─────────────────────────────────────────────────────────

fn mime_from_path(path: &std::path::Path) -> &'static str {
    match path
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_lowercase())
        .as_deref()
    {
        Some("mp3") => "audio/mp3",
        Some("mp4") => "audio/mp4",
        Some("wav") => "audio/wav",
        Some("ogg") => "audio/ogg",
        Some("flac") => "audio/flac",
        Some("aac") => "audio/aac",
        Some("m4a") => "audio/mp4",
        Some("webm") => "audio/webm",
        _ => "audio/mpeg",
    }
}

// ── Base64 helper ─────────────────────────────────────────────────────────────

fn base64_encode(bytes: &[u8]) -> String {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD.encode(bytes)
}
