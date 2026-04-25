/**
 * rag.js — Obsidian vault RAG picker component
 *
 * Exports:
 *   initRag(deps)   — call once from app.js init
 *   getRagContext() — returns concatenated note content string (or '')
 */

// Module-level refs set by initRag
let _state, _showToast;
let _cmdListTopFolders, _cmdListSubFolders, _cmdListNotes, _cmdReadNote;

// Internal: current list of available note names in the chosen folder
let availableNotes = [];  // string[]
// Selected note names (user picked)
let selectedNotes  = [];  // string[]

// ── DOM refs ──────────────────────────────────────────────────────────────────
let selTop, selSub, noteOptionsEl, selectedNotesEl, noteListEl, btnAdd;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns a formatted RAG context string for all selected notes.
 * Each note is wrapped with a separator header.
 */
export async function getRagContext() {
  if (selectedNotes.length === 0) return '';

  const base = _state.config?.obsidian_base_path;
  const top  = _state.ragTop;
  const sub  = _state.ragSub === '__all__' ? null : (_state.ragSub || null);

  const parts = [];
  for (const name of selectedNotes) {
    const content = await _cmdReadNote(base, top, sub, name);
    if (content) {
      parts.push(`\n--- 기존 노트 [${name}] ---\n${content}\n`);
    }
  }
  return parts.join('\n');
}

// ── Init ──────────────────────────────────────────────────────────────────────

export function initRag(deps) {
  _state              = deps.state;
  _showToast          = deps.showToast;
  _cmdListTopFolders  = deps.cmdListTopFolders;
  _cmdListSubFolders  = deps.cmdListSubFolders;
  _cmdListNotes       = deps.cmdListNotes;
  _cmdReadNote        = deps.cmdReadNote;

  selTop          = document.getElementById('sel-rag-top');
  selSub          = document.getElementById('sel-rag-sub');
  noteOptionsEl   = document.getElementById('rag-note-options');
  selectedNotesEl = document.getElementById('rag-selected-notes');
  noteListEl      = document.getElementById('rag-note-list');
  btnAdd          = document.getElementById('btn-rag-add');

  selTop.addEventListener('change', onTopChange);
  selSub.addEventListener('change', onSubChange);
  btnAdd.addEventListener('click', onAddNotes);

  // Initial load of top folders
  populateTopFolders();
}

// ── Populate top folders ──────────────────────────────────────────────────────

async function populateTopFolders() {
  const base = _state.config?.obsidian_base_path;
  selTop.innerHTML = '<option value="">(선택하지 않음)</option>';
  if (!base) return;

  const folders = await _cmdListTopFolders(base);
  folders.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f;
    opt.textContent = `📁 ${f}`;
    selTop.appendChild(opt);
  });
}

// ── Top folder change ─────────────────────────────────────────────────────────

async function onTopChange() {
  const top = selTop.value;
  _state.ragTop = top;
  _state.ragSub = '';

  // Reset sub + note list
  resetSubDropdown();
  resetNoteList();
  selectedNotes = [];
  renderSelectedNotes();

  if (!top) {
    selSub.disabled = true;
    noteListEl.hidden = true;
    return;
  }

  // Populate sub folders
  const base = _state.config?.obsidian_base_path;
  const subs = await _cmdListSubFolders(base, top);

  selSub.innerHTML = '<option value="__all__">(전체 보기)</option>';
  subs.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = `📂 ${s}`;
    selSub.appendChild(opt);
  });
  selSub.disabled = false;

  // Auto-load notes for "(전체 보기)"
  _state.ragSub = '__all__';
  selSub.value  = '__all__';
  await loadNotes(top, null);
}

// ── Sub folder change ─────────────────────────────────────────────────────────

async function onSubChange() {
  const sub = selSub.value;
  _state.ragSub = sub;
  resetNoteList();
  selectedNotes = [];
  renderSelectedNotes();

  const top  = _state.ragTop;
  const base = _state.config?.obsidian_base_path;
  if (!top || !base) return;

  const subParam = sub === '__all__' ? null : sub;
  await loadNotes(top, subParam);
}

// ── Load & display available notes ───────────────────────────────────────────

async function loadNotes(top, sub) {
  const base = _state.config?.obsidian_base_path;
  if (!base || !top) return;

  availableNotes = await _cmdListNotes(base, top, sub);

  if (availableNotes.length === 0) {
    noteListEl.hidden = true;
    _showToast('이 폴더에 노트가 없습니다.', 'info');
    return;
  }

  noteListEl.hidden = false;

  // Build chips
  noteOptionsEl.innerHTML = '';
  availableNotes.forEach(name => {
    const chip = document.createElement('span');
    chip.className = 'rag-note-chip';
    chip.dataset.name = name;
    chip.textContent  = name.replace(/\.md$/, '');
    chip.addEventListener('click', () => chip.classList.toggle('selected'));
    noteOptionsEl.appendChild(chip);
  });

  // If "(전체 보기)" auto-select all
  if (_state.ragSub === '__all__') {
    document.querySelectorAll('.rag-note-chip').forEach(c => c.classList.add('selected'));
  }
}

// ── Add selected chips to confirmed list ──────────────────────────────────────

function onAddNotes() {
  const chips = document.querySelectorAll('.rag-note-chip.selected');
  chips.forEach(chip => {
    const name = chip.dataset.name;
    if (!selectedNotes.includes(name)) {
      selectedNotes.push(name);
    }
    chip.classList.remove('selected');
  });
  renderSelectedNotes();
}

// ── Render confirmed selected notes as tags ───────────────────────────────────

function renderSelectedNotes() {
  selectedNotesEl.innerHTML = '';
  selectedNotes.forEach((name, idx) => {
    const tag = document.createElement('span');
    tag.className = 'rag-selected-tag';
    const label = document.createElement('span');
    label.textContent = name.replace(/\.md$/, '');
    const removeBtn = document.createElement('button');
    removeBtn.textContent = '✕';
    removeBtn.title = '제거';
    removeBtn.addEventListener('click', () => {
      selectedNotes.splice(idx, 1);
      renderSelectedNotes();
    });
    tag.appendChild(label);
    tag.appendChild(removeBtn);
    selectedNotesEl.appendChild(tag);
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resetSubDropdown() {
  selSub.innerHTML = '<option value="__all__">(전체 보기)</option>';
  selSub.disabled  = true;
}

function resetNoteList() {
  availableNotes = [];
  noteOptionsEl.innerHTML = '';
  noteListEl.hidden = true;
}
