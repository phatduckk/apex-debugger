document.addEventListener('DOMContentLoaded', () => {
  const input    = document.getElementById('hostname');
  const beefMode = document.getElementById('beefMode');
  const status   = document.getElementById('status');

  chrome.storage.sync.get({ hostname: 'apex.local', beefMode: false }, ({ hostname, beefMode: beef }) => {
    input.value = hostname;
    beefMode.checked = beef;
  });

  document.getElementById('save').addEventListener('click', () => {
    const hostname = input.value.trim();
    if (!hostname) return;
    chrome.storage.sync.set({ hostname, beefMode: beefMode.checked }, () => {
      status.textContent = 'Saved!';
      setTimeout(() => (status.textContent = ''), 2000);
    });
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('save').click();
  });
});
