/**
 * app.js — 옵시디언 AI 비서 v3.0
 * Entry point: Tauri command wrappers, state, settings modal, sidebar.
 */

import { initTabs } from './components/tabs.js';
import { initRag }  from './components/rag.js';
import { initUpdater } from './components/updater.js';

// ── Tauri API imports ─────────────────────────────────────────────────────────
// Tauri v2 exposes globals via window.__TAURI__
const { invoke } = window.__TAURI__.core;
const { open }   = window.__TAURI__.dialog;

// ── Module-level state ────────────────────────────────────────────────────────
export const state = {
  config:          null,   // Config loaded from backend
  currentSubfolder: '',    // Currently selected save subfolder
  ragTop:          '',
  ragSub:          '',
  ragNotes:        [],     // Array of { name, content } selected for context
  lastGenerated:   { md: '', title: '' },
};

// ── Toast ─────────────────────────────────────────────────────────────────────
/**
 * Show a toast message.
 * @param {string} msg
 * @param {'success'|'error'|'info'} type
 * @param {number} duration ms
 */
export function showToast(msg, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-msg">${msg}</span>`;
  container.appendChild(el);
  const dismiss = () => {
    el.classList.add('toast-dismiss');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  };
  const tid = setTimeout(dismiss, duration);
  el.addEventListener('click', () => { clearTimeout(tid); dismiss(); });
}

// ── Tauri command wrappers ────────────────────────────────────────────────────

export async function cmdGetConfig() {
  try {
    return await invoke('get_config');
  } catch (e) {
    showToast(`설정 불러오기 실패: ${e}`, 'error');
    throw e;
  }
}

export async function cmdSaveConfig(cfg) {
  try {
    return await invoke('save_config', { cfg });
  } catch (e) {
    showToast(`설정 저장 실패: ${e}`, 'error');
    throw e;
  }
}

export async function cmdListTopFolders(base) {
  try {
    return await invoke('list_top_folders', { base });
  } catch (e) {
    showToast(`폴더 목록 불러오기 실패: ${e}`, 'error');
    return [];
  }
}

export async function cmdListSubFolders(base, top) {
  try {
    return await invoke('list_sub_folders', { base, top });
  } catch (e) {
    showToast(`하위 폴더 목록 불러오기 실패: ${e}`, 'error');
    return [];
  }
}

export async function cmdListNotes(base, top, sub) {
  try {
    return await invoke('list_notes', { base, top, sub: sub || null });
  } catch (e) {
    showToast(`노트 목록 불러오기 실패: ${e}`, 'error');
    return [];
  }
}

export async function cmdReadNote(base, top, sub, name) {
  try {
    return await invoke('read_note', { base, top, sub: sub || null, name });
  } catch (e) {
    showToast(`노트 읽기 실패: ${e}`, 'error');
    return '';
  }
}

export async function cmdSaveNote(base, sub, name, content) {
  try {
    return await invoke('save_note', { base, sub, name, content });
  } catch (e) {
    showToast(`노트 저장 실패: ${e}`, 'error');
    throw e;
  }
}

export async function cmdMakeSubfolder(base, name) {
  try {
    await invoke('make_subfolder', { base, name });
  } catch (e) {
    showToast(`폴더 생성 실패: ${e}`, 'error');
    throw e;
  }
}

export async function cmdCallAi(req) {
  try {
    return await invoke('call_ai', { req });
  } catch (e) {
    showToast(`AI 호출 실패: ${e}`, 'error');
    throw e;
  }
}

export async function cmdScrapeUrl(url) {
  try {
    return await invoke('scrape_url', { url });
  } catch (e) {
    showToast(`웹 페이지 추출 실패: ${e}`, 'error');
    throw e;
  }
}

export async function cmdAppVersion() {
  try {
    return await invoke('app_version');
  } catch (e) {
    return '3.0.0';
  }
}

// ── Sidebar: subfolder dropdown ───────────────────────────────────────────────

async function refreshSubfolderDropdown() {
  const base = state.config?.obsidian_base_path;
  const sel  = document.getElementById('sel-subfolder');
  sel.innerHTML = '<option value="">— 폴더 선택 —</option>';
  if (!base) return;
  const folders = await cmdListTopFolders(base);
  folders.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f;
    opt.textContent = f;
    sel.appendChild(opt);
  });
  // Restore saved subfolder
  if (state.currentSubfolder) sel.value = state.currentSubfolder;
}

// ── Settings modal ────────────────────────────────────────────────────────────

function openSettingsModal() {
  const modal = document.getElementById('settings-modal');
  const cfg   = state.config || {};
  // Populate fields
  document.getElementById('cfg-user-id').value      = cfg.user_id || '';
  document.getElementById('cfg-gemini-key').value    = cfg.providers?.gemini?.api_key    || '';
  document.getElementById('cfg-openai-key').value    = cfg.providers?.openai?.api_key    || '';
  document.getElementById('cfg-anthropic-key').value = cfg.providers?.anthropic?.api_key || '';
  document.getElementById('cfg-model').value         = cfg.selected_model || 'gemini-2.0-flash';
  document.getElementById('cfg-base-path').value     = cfg.obsidian_base_path || '';

  // Theme radio
  const theme = cfg.theme || 'obsidian';
  const radio = document.querySelector(`input[name="cfg-theme"][value="${theme}"]`);
  if (radio) radio.checked = true;

  // Remote
  document.getElementById('cfg-remote-enabled').checked  = cfg.remote?.enabled || false;
  document.getElementById('cfg-remote-endpoint').value   = cfg.remote?.endpoint || '';
  document.getElementById('cfg-remote-interval').value   = cfg.remote?.sync_interval_minutes ?? 60;

  modal.removeAttribute('hidden');
}

function closeSettingsModal() {
  document.getElementById('settings-modal').setAttribute('hidden', '');
}

async function saveSettingsModal() {
  const cfg = state.config ? { ...state.config } : {};
  cfg.user_id              = document.getElementById('cfg-user-id').value.trim();
  cfg.obsidian_base_path   = document.getElementById('cfg-base-path').value.trim();
  cfg.selected_model       = document.getElementById('cfg-model').value;
  const checkedTheme       = document.querySelector('input[name="cfg-theme"]:checked');
  cfg.theme                = checkedTheme ? checkedTheme.value : 'obsidian';

  cfg.providers = {
    gemini:    { api_key: document.getElementById('cfg-gemini-key').value.trim() },
    openai:    { api_key: document.getElementById('cfg-openai-key').value.trim() },
    anthropic: { api_key: document.getElementById('cfg-anthropic-key').value.trim() },
  };

  cfg.remote = {
    enabled:               document.getElementById('cfg-remote-enabled').checked,
    endpoint:              document.getElementById('cfg-remote-endpoint').value.trim(),
    sync_interval_minutes: parseInt(document.getElementById('cfg-remote-interval').value, 10) || 60,
  };

  try {
    const saved   = await cmdSaveConfig(cfg);
    state.config  = saved;
    closeSettingsModal();
    showToast('설정이 저장되었습니다.', 'success');
    await refreshSubfolderDropdown();
  } catch (_) { /* error already toasted */ }
}

// ── Folder picker (settings) ──────────────────────────────────────────────────

async function pickObsidianFolder() {
  try {
    const selected = await open({ directory: true, multiple: false });
    if (selected) {
      document.getElementById('cfg-base-path').value = selected;
    }
  } catch (e) {
    showToast(`폴더 선택 실패: ${e}`, 'error');
  }
}

// ── Preview & save helpers ────────────────────────────────────────────────────

let markedReady = false;
async function ensureMarked() {
  if (markedReady) return;
  await import('https://cdn.jsdelivr.net/npm/marked/marked.min.js');
  markedReady = true;
}

export async function renderPreview(md, defaultTitle = '') {
  await ensureMarked();
  state.lastGenerated.md    = md;
  state.lastGenerated.title = defaultTitle;

  const previewSection = document.getElementById('preview-section');
  const previewContent = document.getElementById('preview-content');
  const saveSection    = document.getElementById('save-section');

  previewContent.innerHTML = window.marked.parse(md);
  previewSection.removeAttribute('hidden');
  saveSection.removeAttribute('hidden');

  // Populate filename default
  const fnInput = document.getElementById('inp-save-filename');
  if (!fnInput.value) fnInput.value = defaultTitle || '새 노트';

  // Scroll into view
  previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function handleSaveNote() {
  const confirmId = document.getElementById('inp-confirm-id').value.trim();
  const userId    = state.config?.user_id || '';

  if (!confirmId) {
    showToast('본인 확인용 ID를 입력해주세요.', 'error');
    return;
  }
  if (userId && confirmId !== userId) {
    showToast('ID가 일치하지 않습니다. 다시 확인해주세요.', 'error');
    return;
  }

  const base = state.config?.obsidian_base_path;
  if (!base) {
    showToast('옵시디언 볼트 경로가 설정되지 않았습니다.', 'error');
    return;
  }

  const sub     = state.currentSubfolder || '';
  const rawName = document.getElementById('inp-save-filename').value.trim() || '새 노트';
  const name    = rawName.endsWith('.md') ? rawName : `${rawName}.md`;
  const content = state.lastGenerated.md;

  if (!content) {
    showToast('저장할 내용이 없습니다.', 'error');
    return;
  }

  try {
    const savedPath = await cmdSaveNote(base, sub, name, content);
    showToast(`저장 완료: ${savedPath}`, 'success', 6000);
    document.getElementById('inp-confirm-id').value    = '';
    document.getElementById('inp-save-filename').value = '';
  } catch (_) { /* error already toasted */ }
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  // Load config
  try {
    state.config = await cmdGetConfig();
  } catch (_) {
    state.config = null;
    initUpdater(showToast);
  }

 // ★ 이벤트 핸들러를 가장 먼저 바인딩 (자동 모달 열기보다 먼저)
  document.getElementById('btn-settings').addEventListener('click', openSettingsModal);
  document.getElementById('btn-close-settings').addEventListener('click', closeSettingsModal);
  document.getElementById('btn-cancel-settings').addEventListener('click', closeSettingsModal);
  document.getElementById('btn-save-settings').addEventListener('click', saveSettingsModal);
  document.getElementById('btn-pick-folder').addEventListener('click', pickObsidianFolder);
  document.getElementById('settings-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeSettingsModal();
  });
  // Esc 또는 Ctrl+, 로 설정 열기
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === ',') {
      e.preventDefault();
      openSettingsModal();
    } else if (e.key === 'Escape') {
      closeSettingsModal();
    }
  });

  // Auto-open settings if incomplete config (이제 핸들러 바인딩 후)
  const cfg = state.config;
  const missingSetup = !cfg?.user_id ||
    !cfg?.obsidian_base_path ||
    (!cfg?.providers?.gemini?.api_key &&
     !cfg?.providers?.openai?.api_key &&
     !cfg?.providers?.anthropic?.api_key);

  if (missingSetup) {
    showToast('초기 설정을 완료해 주세요.', 'info', 5000);
    setTimeout(openSettingsModal, 500);  // DOM 완전히 준비된 후
  }

  // Populate sidebar subfolder dropdown
  await refreshSubfolderDropdown();

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-panel').forEach(p => {
        p.hidden = (p.dataset.tab !== tab);
      });
    });
  });

  // Close modal on backdrop click
  document.getElementById('settings-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeSettingsModal();
  });

  // Subfolder dropdown change
  document.getElementById('sel-subfolder').addEventListener('change', e => {
    state.currentSubfolder = e.target.value;
  });

  // Remove subfolder from saved list
  document.getElementById('btn-remove-subfolder').addEventListener('click', async () => {
    const sub = state.currentSubfolder;
    if (!sub) { showToast('제거할 폴더를 먼저 선택해주세요.', 'info'); return; }
    const cfg = { ...state.config };
    cfg.obsidian_subfolders = (cfg.obsidian_subfolders || []).filter(s => s !== sub);
    try {
      state.config = await cmdSaveConfig(cfg);
      state.currentSubfolder = '';
      await refreshSubfolderDropdown();
      showToast(`폴더 "${sub}" 가 목록에서 제거되었습니다.`, 'success');
    } catch (_) {}
  });

  // Create subfolder
  document.getElementById('btn-create-folder').addEventListener('click', async () => {
    const name = document.getElementById('inp-new-folder').value.trim();
    if (!name) { showToast('폴더 이름을 입력해주세요.', 'info'); return; }
    const base = state.config?.obsidian_base_path;
    if (!base) { showToast('먼저 옵시디언 볼트 경로를 설정해주세요.', 'error'); return; }
    try {
      await cmdMakeSubfolder(base, name);
      // Add to config subfolders list
      const cfg = { ...state.config };
      cfg.obsidian_subfolders = [...new Set([...(cfg.obsidian_subfolders || []), name])];
      state.config = await cmdSaveConfig(cfg);
      document.getElementById('inp-new-folder').value = '';
      document.getElementById('new-folder-details').removeAttribute('open');
      await refreshSubfolderDropdown();
      showToast(`폴더 "${name}" 가 생성되었습니다.`, 'success');
    } catch (_) {}
  });

  // Save note
  document.getElementById('btn-save-note').addEventListener('click', handleSaveNote);

  // Copy markdown
  document.getElementById('btn-copy-md').addEventListener('click', () => {
    if (!state.lastGenerated.md) return;
    navigator.clipboard.writeText(state.lastGenerated.md)
      .then(() => showToast('마크다운이 클립보드에 복사되었습니다.', 'success'))
      .catch(() => showToast('클립보드 복사에 실패했습니다.', 'error'));
  });

  // Init components
  initRag({ invoke, state, showToast, cmdListTopFolders, cmdListSubFolders, cmdListNotes, cmdReadNote });
  initTabs({ invoke, state, showToast, renderPreview, open, cmdCallAi, cmdScrapeUrl });
}

document.addEventListener('DOMContentLoaded', init);
