use crate::error::{AppError, AppResult};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

// ── Helpers ───────────────────────────────────────────────────────────────────

fn sanitize_name(name: &str) -> String {
    name.replace('/', "").replace('\\', "").trim().to_string()
}

/// Collect all .md files recursively under `root`.
fn collect_md_files(root: &Path, results: &mut Vec<PathBuf>) -> AppResult<()> {
    if !root.exists() {
        return Ok(());
    }
    for entry in fs::read_dir(root)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            collect_md_files(&path, results)?;
        } else if path.extension().and_then(|e| e.to_str()) == Some("md") {
            results.push(path);
        }
    }
    Ok(())
}

// ── Public API ────────────────────────────────────────────────────────────────

/// Direct subdirectories of `base`, skipping dotfiles, sorted.
pub fn list_top_folders(base: &str) -> AppResult<Vec<String>> {
    let base_path = Path::new(base);
    if !base_path.exists() {
        return Err(AppError::Other(format!(
            "경로를 찾을 수 없습니다: {}",
            base
        )));
    }

    let mut folders: Vec<String> = Vec::new();
    for entry in fs::read_dir(base_path)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                if !name.starts_with('.') {
                    folders.push(name.to_string());
                }
            }
        }
    }
    folders.sort();
    Ok(folders)
}

/// Direct subdirectories of `base/top`.
pub fn list_sub_folders(base: &str, top: &str) -> AppResult<Vec<String>> {
    let root = Path::new(base).join(top);
    if !root.exists() {
        return Ok(Vec::new());
    }

    let mut folders: Vec<String> = Vec::new();
    for entry in fs::read_dir(&root)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                if !name.starts_with('.') {
                    folders.push(name.to_string());
                }
            }
        }
    }
    folders.sort();
    Ok(folders)
}

/// All .md filenames (basenames) recursively.
/// If sub is None or "(전체 보기)", scope is base/top.
/// Otherwise scope is base/top/sub.
pub fn list_notes(base: &str, top: &str, sub: Option<&str>) -> AppResult<Vec<String>> {
    let scope = match sub {
        Some(s) if s != "(전체 보기)" && !s.is_empty() => {
            Path::new(base).join(top).join(s)
        }
        _ => Path::new(base).join(top),
    };

    let mut files: Vec<PathBuf> = Vec::new();
    collect_md_files(&scope, &mut files)?;

    let mut seen = HashSet::new();
    let mut names: Vec<String> = files
        .iter()
        .filter_map(|p| p.file_name().and_then(|n| n.to_str()).map(String::from))
        .filter(|name| seen.insert(name.clone()))
        .collect();
    names.sort();
    Ok(names)
}

/// Read first matching note in scope (matches basename).
pub fn read_note(base: &str, top: &str, sub: Option<&str>, name: &str) -> AppResult<String> {
    let scope = match sub {
        Some(s) if s != "(전체 보기)" && !s.is_empty() => {
            Path::new(base).join(top).join(s)
        }
        _ => Path::new(base).join(top),
    };

    let mut files: Vec<PathBuf> = Vec::new();
    collect_md_files(&scope, &mut files)?;

    let target_name = if name.ends_with(".md") {
        name.to_string()
    } else {
        format!("{}.md", name)
    };

    for path in &files {
        if path.file_name().and_then(|n| n.to_str()) == Some(target_name.as_str()) {
            return Ok(fs::read_to_string(path)?);
        }
    }

    Err(AppError::Other(format!(
        "노트를 찾을 수 없습니다: {}",
        name
    )))
}

/// Write note to base/sub/name.md; on collision append _1, _2, ...
/// Returns final absolute path.
pub fn save_note(base: &str, sub: &str, name: &str, content: &str) -> AppResult<String> {
    let clean_name = sanitize_name(name);
    if clean_name.is_empty() {
        return Err(AppError::Other("노트 이름이 비어 있습니다.".to_string()));
    }

    let dir = Path::new(base).join(sub);
    fs::create_dir_all(&dir)?;

    let stem = if clean_name.ends_with(".md") {
        clean_name[..clean_name.len() - 3].to_string()
    } else {
        clean_name.clone()
    };

    let mut candidate = dir.join(format!("{}.md", stem));
    let mut counter = 1u32;
    while candidate.exists() {
        candidate = dir.join(format!("{}_{}.md", stem, counter));
        counter += 1;
    }

    fs::write(&candidate, content)?;

    candidate
        .to_str()
        .map(String::from)
        .ok_or_else(|| AppError::Other("경로를 문자열로 변환할 수 없습니다.".to_string()))
}

/// Create directory base/name (with -p semantics).
pub fn make_subfolder(base: &str, name: &str) -> AppResult<()> {
    let clean = sanitize_name(name);
    if clean.is_empty() {
        return Err(AppError::Other("폴더 이름이 비어 있습니다.".to_string()));
    }
    let path = Path::new(base).join(&clean);
    fs::create_dir_all(path)?;
    Ok(())
}
