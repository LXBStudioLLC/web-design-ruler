let browserAPI;
if (typeof browser !== 'undefined' && browser.runtime) {
  browserAPI = browser;
} else if (typeof chrome !== 'undefined' && chrome.runtime) {
  browserAPI = chrome;
} else {
  browserAPI = { storage: { local: { get: () => Promise.resolve({}), set: () => Promise.resolve() } } };
}

const stickyToggle = document.getElementById('sticky-tools');
const debugToggle = document.getElementById('debug-logging');

browserAPI.storage.local.get('settings').then((data) => {
  const settings = (data && data.settings) || {};
  if (stickyToggle) stickyToggle.checked = settings.stickyTools !== false; // default on
  if (debugToggle) debugToggle.checked = settings.debugLogging || false;
}).catch(() => {});

function bindToggle(toggle, key) {
  if (!toggle) return;
  toggle.addEventListener('change', () => {
    browserAPI.storage.local.get('settings').then((data) => {
      const settings = (data && data.settings) || {};
      settings[key] = toggle.checked;
      return browserAPI.storage.local.set({ settings });
    }).catch(() => {});
  });
}

bindToggle(stickyToggle, 'stickyTools');
bindToggle(debugToggle, 'debugLogging');
