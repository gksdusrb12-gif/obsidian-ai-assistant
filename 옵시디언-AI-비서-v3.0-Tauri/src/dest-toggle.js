// Save destination card toggle (Obsidian / Notion)
// Extracted from inline <script> in index.html for CSP compatibility (script-src 'self').

document.addEventListener('DOMContentLoaded', () => {
  const cards = document.querySelectorAll('.dest-card');
  const hidden = document.getElementById('save-destination');
  cards.forEach(card => {
    card.addEventListener('click', () => {
      if (card.classList.contains('disabled')) return;
      cards.forEach(c => {
        c.classList.remove('active');
        c.setAttribute('aria-checked', 'false');
      });
      card.classList.add('active');
      card.setAttribute('aria-checked', 'true');
      if (hidden) hidden.value = card.dataset.dest;
    });
    card.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && !card.classList.contains('disabled')) {
        e.preventDefault();
        card.click();
      }
    });
  });
});
