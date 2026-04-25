use crate::error::{AppError, AppResult};
use ::scraper::{Html, Selector};
use serde::Serialize;

#[derive(Serialize)]
pub struct ScrapeResult {
    pub title: String,
    pub text: String,
}

pub async fn scrape(url: &str) -> AppResult<ScrapeResult> {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Obsidian-AI-Assistant/3.0) AppleWebKit/537.36")
        .timeout(std::time::Duration::from_secs(15))
        .build()?;

    let resp = client.get(url).send().await?;
    let html_body = resp.text().await?;

    let document = Html::parse_document(&html_body);

    // --- Extract title ---
    let title_sel = Selector::parse("title").unwrap();
    let title = document
        .select(&title_sel)
        .next()
        .map(|el| el.text().collect::<String>())
        .unwrap_or_else(|| url.to_string());
    let title = collapse_whitespace(&title);

    // --- Remove noisy elements ---
    // We work on the raw HTML string to strip tags before text extraction,
    // by collecting text from remaining elements.
    // Selectors for tags to drop
    let drop_tags = ["script", "style", "nav", "footer", "noscript", "iframe"];
    let drop_sels: Vec<Selector> = drop_tags
        .iter()
        .filter_map(|s| Selector::parse(s).ok())
        .collect();

    // Collect all element IDs to skip
    use std::collections::HashSet;
    let mut skip_ids: HashSet<::ego_tree::NodeId> = HashSet::new();
                          ^^^^^^^^^^^^^^^^^^
    for sel in &drop_sels {
        for el in document.select(sel) {
            // Mark the element's node and all its descendants
            collect_subtree(el, &mut skip_ids);
        }
    }

    // Walk the document collecting text nodes that are not under dropped elements
    let body_sel = Selector::parse("body").unwrap();
    let text_root = document.select(&body_sel).next();

    let raw_text: String = if let Some(body) = text_root {
        collect_text(body, &skip_ids)
    } else {
        // Fallback: strip HTML tags crudely
        document.root_element().text().collect::<Vec<_>>().join(" ")
    };

    let text = collapse_whitespace(&raw_text);

    Ok(ScrapeResult { title, text })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn collect_subtree(
    el: ::scraper::ElementRef<'_>,
    ids: &mut std::collections::HashSet<::ego_tree::NodeId>,
                                    ^^^^^^^^^^^^^^^^^^,
) {
    ids.insert(el.id());
    for child in el.children() {
        if let Some(child_el) = ::scraper::ElementRef::wrap(child) {
            collect_subtree(child_el, ids);
        }
    }
}

fn collect_text(
    el: ::scraper::ElementRef<'_>,
    skip_ids: &std::collections::HashSet<::ego_tree::NodeId>,
                                     ^^^^^^^^^^^^^^^^^^,
) -> String {
    let mut buf = String::new();
    for node in el.children() {
        if let Some(text) = node.value().as_text() {
            buf.push_str(text);
        } else if let Some(child_el) = ::scraper::ElementRef::wrap(node) {
            if !skip_ids.contains(&child_el.id()) {
                buf.push_str(&collect_text(child_el, skip_ids));
            }
        }
    }
    buf
}

fn collapse_whitespace(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let mut last_was_space = true; // start true to trim leading whitespace
    for ch in s.chars() {
        if ch.is_whitespace() {
            if !last_was_space {
                result.push(' ');
                last_was_space = true;
            }
        } else {
            result.push(ch);
            last_was_space = false;
        }
    }
    // Trim trailing space
    if result.ends_with(' ') {
        result.pop();
    }
    result
}
