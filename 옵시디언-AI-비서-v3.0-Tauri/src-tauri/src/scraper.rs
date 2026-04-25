use crate::error::AppResult;
use ::scraper::{ElementRef, Html, Node, Selector};
use serde::Serialize;

const SKIP_TAGS: &[&str] = &["script", "style", "nav", "footer", "noscript", "iframe"];

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

    // Title
    let title_sel = Selector::parse("title").unwrap();
    let title = document
        .select(&title_sel)
        .next()
        .map(|el| collapse_whitespace(&el.text().collect::<String>()))
        .unwrap_or_else(|| url.to_string());

    // Body text (skip script/style/nav/footer/noscript/iframe)
    let mut buf = String::new();
    let body_sel = Selector::parse("body").unwrap();
    if let Some(body) = document.select(&body_sel).next() {
        walk(body, &mut buf);
    } else {
        walk(document.root_element(), &mut buf);
    }

    Ok(ScrapeResult {
        title,
        text: collapse_whitespace(&buf),
    })
}

fn walk(el: ElementRef<'_>, out: &mut String) {
    if SKIP_TAGS.contains(&el.value().name()) {
        return;
    }
    for child in el.children() {
        match child.value() {
            Node::Text(text) => {
                out.push_str(text);
                out.push(' ');
            }
            Node::Element(_) => {
                if let Some(child_el) = ElementRef::wrap(child) {
                    walk(child_el, out);
                }
            }
            _ => {}
        }
    }
}

fn collapse_whitespace(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let mut last_was_space = true;
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
    if result.ends_with(' ') {
        result.pop();
    }
    result
}
