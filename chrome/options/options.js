const stickyToggle = document.getElementById('sticky-tools');
const eyeDropperToggle = document.getElementById('use-eyedropper');
const debugToggle = document.getElementById('debug-logging');

chrome.storage.local.get('settings', (data) => {
  const settings = (data && data.settings) || {};
  if (stickyToggle) stickyToggle.checked = settings.stickyTools !== false; // default on
  if (eyeDropperToggle) eyeDropperToggle.checked = settings.useNativeEyeDropper || false;
  if (debugToggle) debugToggle.checked = settings.debugLogging || false;
});

function bindToggle(toggle, key) {
  if (!toggle) return;
  toggle.addEventListener('change', () => {
    chrome.storage.local.get('settings', (data) => {
      const settings = (data && data.settings) || {};
      settings[key] = toggle.checked;
      chrome.storage.local.set({ settings });
    });
  });
}

bindToggle(stickyToggle, 'stickyTools');
bindToggle(eyeDropperToggle, 'useNativeEyeDropper');
bindToggle(debugToggle, 'debugLogging');
