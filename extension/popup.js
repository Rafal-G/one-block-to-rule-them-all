document.querySelector('#settings').addEventListener('click', () => chrome.runtime.openOptionsPage());
chrome.storage.local.get('settings').then(({ settings }) => {
  if (settings) document.querySelector('#summary').textContent = `${settings.blocked.length} blocked · ${settings.cooldown.length} with a pause`;
});
