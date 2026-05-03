// Layout toggle (Frosted / Edge)
(function() {
  const saved = localStorage.getItem('layout-mode') || 'frosted';
  document.body.dataset.layout = saved;
  document.addEventListener('DOMContentLoaded', () => {
    const btns = document.querySelectorAll('.layout-toggle button');
    btns.forEach(b => {
      b.classList.toggle('active', b.dataset.mode === saved);
      b.addEventListener('click', () => {
        document.body.dataset.layout = b.dataset.mode;
        localStorage.setItem('layout-mode', b.dataset.mode);
        btns.forEach(x => x.classList.toggle('active', x === b));
      });
    });
  });
})();
