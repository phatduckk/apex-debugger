document.addEventListener('DOMContentLoaded', () => {
  const input  = document.getElementById('hostname');
  const status = document.getElementById('status');

  chrome.storage.sync.get({ hostname: 'apex.local' }, ({ hostname }) => {
    input.value = hostname;
  });

  document.getElementById('save').addEventListener('click', () => {
    const hostname = input.value.trim();
    if (!hostname) return;
    chrome.storage.sync.set({ hostname }, () => {
      status.textContent = 'Saved!';
      setTimeout(() => (status.textContent = ''), 2000);
    });
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('save').click();
  });
});
