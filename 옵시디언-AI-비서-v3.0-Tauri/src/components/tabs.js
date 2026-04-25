/**
 * tabs.js — Three tab handlers: file/audio/code, web, memo.
 *
 * Receives deps object from app.js:
 *   { invoke, state, showToast, renderPreview, open, cmdCallAi, cmdScrapeUrl }
 */

import { getRagContext } from './rag.js';

// ── Deps ──────────────────────────────────────────────────────────────────────
let _state, _showToast, _renderPreview, _openDialog, _cmdCallAi, _cmdScrapeUrl;

// ── Provider derivation ───────────────────────────────────────────────────────

function providerOf(model) {
  const m = (model || '').toLowerCase();
  if (m.startsWith('gemini'))                                    return 'gemini';
  if (m.startsWith('gpt') || m.startsWith('o1') ||
      m.startsWith('o3') || m.startsWith('o4'))                  return 'openai';
  if (m.startsWith('claude'))                                    return 'anthropic';
  throw new Error(`알 수 없는 모델: ${model}`);
}

// ── API key resolution ────────────────────────────────────────────────────────

function apiKeyFor(provider) {
  const p = _state.config?.providers;
  if (!p) return '';
  if (provider === 'gemini')    return p.gemini?.api_key    || '';
  if (provider === 'openai')    return p.openai?.api_key    || '';
  if (provider === 'anthropic') return p.anthropic?.api_key || '';
  return '';
}

// ── Spinner ───────────────────────────────────────────────────────────────────

function showSpinner()  { document.getElementById('spinner').removeAttribute('hidden'); }
function hideSpinner()  { document.getElementById('spinner').setAttribute('hidden', ''); }

// ── Validate config before AI call ───────────────────────────────────────────

function validateConfig() {
  if (!_state.config?.selected_model) {
    _showToast('사용할 AI 모델이 설정되지 않았습니다. 설정을 확인해주세요.', 'error');
    return false;
  }
  const model    = _state.config.selected_model;
  let provider;
  try { provider = providerOf(model); } catch (e) {
    _showToast(e.message, 'error');
    return false;
  }
  const key = apiKeyFor(provider);
  if (!key) {
    _showToast(`${provider.toUpperCase()} API 키가 설정되지 않았습니다.`, 'error');
    return false;
  }
  return { model, provider, key };
}

// ── Base AI prompt for file/web/memo ─────────────────────────────────────────

const BASE_FILE_PROMPT = `업로드된 데이터를 분석해 옵시디언 마크다운 노트를 작성해주세요.
1. 파일명을 기반으로 제목을 만들어 주세요 (예: # <filename> 분석).
2. tags: [study] 같은 태그 줄을 포함해 주세요.
3. 마크다운 포맷(글머리·코드블럭 등) 활용.
4. 불필요한 말 없이 마크다운 텍스트만 출력.`;

// ── File tab ──────────────────────────────────────────────────────────────────

// Holds the current audio path picked via Tauri dialog
let currentAudioPath = '';

async function handleFileAnalysis() {
  const validated = validateConfig();
  if (!validated) return;
  const { model, provider, key } = validated;

  const fileInput   = document.getElementById('inp-file');
  const instructions = document.getElementById('inp-file-instructions').value.trim();
  const ragCtx      = await getRagContext();

  const file = fileInput.files?.[0];
  const hasAudio = !!currentAudioPath;

  if (!file && !hasAudio) {
    _showToast('파일 또는 음성 파일을 선택해주세요.', 'error');
    return;
  }

  const promptParts = [BASE_FILE_PROMPT];
  if (ragCtx) promptParts.push('\n\n[기존 옵시디언 노트 컨텍스트]\n' + ragCtx);
  if (instructions) promptParts.push('\n\n[추가 지시사항]\n' + instructions);
  const prompt = promptParts.join('');

  const req = {
    provider,
    model,
    api_key: key,
    prompt,
    image_base64: null,
    text_data:    null,
    audio_path:   null,
  };

  // Handle audio (Tauri dialog path — Gemini only)
  if (hasAudio) {
    if (provider !== 'gemini') {
      _showToast('음성 파일은 Gemini 모델에서만 지원됩니다.', 'error');
      return;
    }
    req.audio_path = currentAudioPath;
  }

  // Handle image / text file
  if (file) {
    const ext = file.name.split('.').pop().toLowerCase();
    const imageExts = ['png', 'jpg', 'jpeg', 'webp'];
    const audioExts = ['mp3', 'wav', 'm4a', 'ogg', 'flac'];
    const textExts  = ['py', 'js', 'ts', 'md', 'txt', 'json', 'csv', 'html', 'css'];

    if (imageExts.includes(ext)) {
      req.image_base64 = await fileToBase64(file);
    } else if (audioExts.includes(ext)) {
      // HTML input can't give native path; we inform user to use the dedicated button
      _showToast('음성 파일은 "음성 파일 선택…" 버튼을 사용해주세요.', 'info');
      return;
    } else if (textExts.includes(ext)) {
      req.text_data = await fileToText(file);
    } else {
      // Try reading as text for unknown extensions
      try {
        req.text_data = await fileToText(file);
      } catch (_) {
        _showToast('지원하지 않는 파일 형식입니다.', 'error');
        return;
      }
    }
  }

  const fileName = file ? file.name : currentAudioPath.split('/').pop().split('\\').pop();

  showSpinner();
  try {
    const result = await _cmdCallAi(req);
    await _renderPreview(result, fileName.replace(/\.[^.]+$/, '') + ' 분석');
    _showToast('분석이 완료되었습니다!', 'success');
  } catch (_) {
    // error already toasted
  } finally {
    hideSpinner();
  }
}

// ── Web tab ───────────────────────────────────────────────────────────────────

async function handleWebScrape() {
  const validated = validateConfig();
  if (!validated) return;
  const { model, provider, key } = validated;

  const url          = document.getElementById('inp-url').value.trim();
  const instructions = document.getElementById('inp-web-instructions').value.trim();

  if (!url) { _showToast('URL을 입력해주세요.', 'error'); return; }

  showSpinner();
  try {
    const scraped = await _cmdScrapeUrl(url);
    const ragCtx  = await getRagContext();

    const promptParts = [
      `다음 웹 페이지 내용을 분석하여 옵시디언 마크다운 노트를 작성해주세요.
1. 페이지 제목을 기반으로 # 제목을 만들어 주세요.
2. tags: [web, 요약] 태그 줄을 포함해 주세요.
3. 출처 URL을 노트 상단에 포함해 주세요.
4. 마크다운 포맷(글머리·코드블럭 등) 활용.
5. 불필요한 말 없이 마크다운 텍스트만 출력.

[URL] ${url}
[제목] ${scraped.title || '(제목 없음)'}`,
    ];
    if (ragCtx) promptParts.push('\n\n[기존 옵시디언 노트 컨텍스트]\n' + ragCtx);
    if (instructions) promptParts.push('\n\n[추가 지시사항]\n' + instructions);

    const req = {
      provider,
      model,
      api_key:      key,
      prompt:       promptParts.join(''),
      text_data:    scraped.text || '',
      image_base64: null,
      audio_path:   null,
    };

    const result = await _cmdCallAi(req);
    await _renderPreview(result, scraped.title || '웹 요약');
    _showToast('웹 페이지 요약이 완료되었습니다!', 'success');
  } catch (_) {
    // error already toasted
  } finally {
    hideSpinner();
  }
}

// ── Memo tab ──────────────────────────────────────────────────────────────────

async function handleMemoOrganize() {
  const validated = validateConfig();
  if (!validated) return;
  const { model, provider, key } = validated;

  const memoTitle    = document.getElementById('inp-memo-title').value.trim();
  const memoBody     = document.getElementById('inp-memo-body').value.trim();
  const instructions = document.getElementById('inp-memo-instructions').value.trim();

  if (!memoBody) { _showToast('메모 내용을 입력해주세요.', 'error'); return; }

  const ragCtx = await getRagContext();

  const promptParts = [
    `다음 메모를 정리하여 옵시디언 마크다운 노트를 작성해주세요.
1. 메모 제목을 기반으로 # 제목을 만들어 주세요.
2. tags: [메모] 태그 줄을 포함해 주세요.
3. 마크다운 포맷(글머리·코드블럭 등) 활용.
4. 불필요한 말 없이 마크다운 텍스트만 출력.

[메모 제목] ${memoTitle || '(제목 없음)'}`,
  ];
  if (ragCtx) promptParts.push('\n\n[기존 옵시디언 노트 컨텍스트]\n' + ragCtx);
  if (instructions) promptParts.push('\n\n[추가 지시사항]\n' + instructions);

  const req = {
    provider,
    model,
    api_key:      key,
    prompt:       promptParts.join(''),
    text_data:    memoBody,
    image_base64: null,
    audio_path:   null,
  };

  showSpinner();
  try {
    const result = await _cmdCallAi(req);
    await _renderPreview(result, memoTitle || '메모 정리');
    _showToast('메모 정리가 완료되었습니다!', 'success');
  } catch (_) {
    // error already toasted
  } finally {
    hideSpinner();
  }
}

// ── File helpers ──────────────────────────────────────────────────────────────

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => {
      // Strip "data:image/png;base64," prefix — backend wants raw b64
      const result = reader.result;
      const comma  = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function fileToText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file, 'utf-8');
  });
}

// ── Audio picker (Tauri dialog) ───────────────────────────────────────────────
// HTML <input type=file> does NOT expose native file paths in Tauri webview.
// For audio_path (which the backend reads from disk), we MUST use the Tauri
// dialog plugin to get a real OS path.

async function pickAudioFile() {
  try {
    const selected = await _openDialog({
      multiple: false,
      filters: [{ name: '음성 파일', extensions: ['mp3', 'wav', 'm4a', 'ogg', 'flac', 'webm'] }],
    });
    if (selected) {
      currentAudioPath = selected;
      const display = document.getElementById('audio-path-display');
      display.textContent = selected.split('/').pop().split('\\').pop();
      display.title = selected;
    }
  } catch (e) {
    _showToast(`음성 파일 선택 실패: ${e}`, 'error');
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

export function initTabs(deps) {
  _state         = deps.state;
  _showToast     = deps.showToast;
  _renderPreview = deps.renderPreview;
  _openDialog    = deps.open;
  _cmdCallAi     = deps.cmdCallAi;
  _cmdScrapeUrl  = deps.cmdScrapeUrl;

  // File tab
  document.getElementById('inp-file').addEventListener('change', e => {
    const file = e.target.files?.[0];
    const display = document.getElementById('file-name-display');
    display.textContent = file ? file.name : '선택된 파일 없음';
  });
  document.getElementById('btn-pick-audio').addEventListener('click', pickAudioFile);
  document.getElementById('btn-analyze-file').addEventListener('click', handleFileAnalysis);

  // Web tab
  document.getElementById('btn-scrape-web').addEventListener('click', handleWebScrape);

  // Memo tab
  document.getElementById('btn-organize-memo').addEventListener('click', handleMemoOrganize);
}
