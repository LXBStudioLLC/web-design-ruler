let browserAPI;
if (typeof browser !== 'undefined' && browser.runtime) {
  browserAPI = browser;
} else if (typeof chrome !== 'undefined' && chrome.runtime) {
  browserAPI = chrome;
} else {
  browserAPI = { storage: { local: { get: () => Promise.resolve({}), set: () => Promise.resolve() } } };
}

const debugToggle = document.getElementById('debug-logging');

browserAPI.storage.local.get('settings').then((data) => {
  const settings = data.settings || {};
  if (debugToggle) debugToggle.checked = settings.debugLogging || false;
}).catch(() => {});

if (debugToggle) {
  debugToggle.addEventListener('change', () => {
    browserAPI.storage.local.get('settings').then((data) => {
      const settings = data.settings || {};
      settings.debugLogging = debugToggle.checked;
      return browserAPI.storage.local.set({ settings });
    }).catch(() => {});
  });
}
