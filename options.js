document.addEventListener('DOMContentLoaded', () => {
  const input    = document.getElementById('hostname');
  const beefMode = document.getElementById('beefMode');
  const status   = document.getElementById('status');

  chrome.storage.sync.get({ hostname: 'apex.local', beefMode: false, theme: 'default' }, ({ hostname, beefMode: beef, theme }) => {
    input.value = hostname;
    beefMode.checked = beef;
    selectTheme(theme);
  });

  document.getElementById('themeGrid').addEventListener('click', (e) => {
    const swatch = e.target.closest('.theme-swatch');
    if (!swatch) return;
    selectTheme(swatch.dataset.theme);
  });

  function selectTheme(themeKey) {
    document.querySelectorAll('.theme-swatch').forEach(el => {
      const active = el.dataset.theme === themeKey;
      el.classList.toggle('selected', active);
      el.querySelector('input[type="radio"]').checked = active;
    });
  }

  document.getElementById('save').addEventListener('click', () => {
    const hostname = input.value.trim();
    if (!hostname) return;
    const theme = document.querySelector('.theme-swatch.selected')?.dataset.theme || 'default';
    chrome.storage.sync.set({ hostname, beefMode: beefMode.checked, theme }, () => {
      status.textContent = 'Saved!';
      setTimeout(() => (status.textContent = ''), 2000);
    });
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('save').click();
  });
});
