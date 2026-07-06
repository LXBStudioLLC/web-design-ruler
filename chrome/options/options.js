const eyeDropperToggle = document.getElementById('use-eyedropper');
const debugToggle = document.getElementById('debug-logging');

chrome.storage.local.get('settings', (data) => {
  const settings = data.settings || {};
  if (eyeDropperToggle) eyeDropperToggle.checked = settings.useNativeEyeDropper || false;
  if (debugToggle) debugToggle.checked = settings.debugLogging || false;
});

if (eyeDropperToggle) {
  eyeDropperToggle.addEventListener('change', () => {
    chrome.storage.local.get('settings', (data) => {
      const settings = data.settings || {};
      settings.useNativeEyeDropper = eyeDropperToggle.checked;
      chrome.storage.local.set({ settings });
    });
  });
}

if (debugToggle) {
  debugToggle.addEventListener('change', () => {
    chrome.storage.local.get('settings', (data) => {
      const settings = data.settings || {};
      settings.debugLogging = debugToggle.checked;
      chrome.storage.local.set({ settings });
    });
  });
}
