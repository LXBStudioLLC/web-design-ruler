/**
 * Web Design Ruler Background Script (Firefox Build)
 * Version: 2.0.0
 *
 * FIREFOX-SPECIFIC BUILD:
 * - Uses browser.* namespace with Promises
 * - Firefox uses non-persistent background scripts, not service workers
 * - Different permission model for clipboard
 */

console.log('[WDR-Firefox] Background script started');

// ============================================================================
// FIREFOX COMPATIBILITY: browser.* namespace with Promise support
// ============================================================================
let browserAPI;
if (typeof browser !== 'undefined' && browser.runtime) {
  browserAPI = browser;
  console.log('[WDR-Firefox] Using browser.* API');
} else if (typeof chrome !== 'undefined' && chrome.runtime) {
  browserAPI = chrome;
  console.log('[WDR-Firefox] Using chrome.* API');
} else {
  console.error('[WDR-Firefox] No browser API found!');
}

let _debug = false;
try { browserAPI.storage.local.get('settings').then((data) => { _debug = (data.settings && data.settings.debugLogging) || false; }).catch(() => {}); } catch {}
function log(...args) { if (_debug) console.log(...args); }

// ============================================================================
// CONSTANTS
// ============================================================================
const PING_TIMEOUT_MS = 1000;
const INJECTION_RETRY_DELAY_MS = 150;
const MAX_INJECTION_RETRIES = 3;

const RESTRICTED_URL_PATTERNS = [
  /^about:/,
  /^moz-extension:\/\//,
  /^chrome:\/\//,
  /^file:\/\//
];

const MENU_ITEMS = [
  { id: 'wdr-eyedropper', title: 'Pick Color', action: 'activateColorPicker' },
  { id: 'wdr-font-detector', title: 'Identify Font', action: 'activateFontDetector' },
  { id: 'wdr-measure-tool', title: 'Measure', action: 'activateMeasureTool' },
  { id: 'wdr-copy-all-colors', title: 'Copy All Colors', action: 'copyAllColors' }
];

const BADGE_COLOR = '#10B981';
let badgeClearTimer = null;

function setBadge(text) {
  browserAPI.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
  browserAPI.action.setBadgeText({ text: text });
}

function flashDoneBadge() {
  if (badgeClearTimer) clearTimeout(badgeClearTimer);
  setBadge('\u2713');
  badgeClearTimer = setTimeout(() => {
    setBadge('');
    badgeClearTimer = null;
  }, 2000);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Create context menu items using Firefox's Promise-based API
 */
async function createContextMenus() {
  try {
    // Remove existing menus
    await browserAPI.contextMenus.removeAll();

    // Create menus
    for (const item of MENU_ITEMS) {
      await browserAPI.contextMenus.create({
        id: item.id,
        title: `${item.title} with Web Design Ruler`,
        contexts: ['page', 'selection', 'image']
      });
    }
    log('[WDR-Firefox] Context menus created');
  } catch (error) {
    console.error('[WDR-Firefox] Menu creation error:', error);
  }
}

/**
 * Initialize storage
 */
async function initializeStorage() {
  try {
    const result = await browserAPI.storage.local.get(['palettes', 'recentColors']);

    const updates = {};
    if (!result.palettes) {
      updates.palettes = {
        'Web Design Ruler': ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#6366F1'],
        'Neutrals': ['#000000', '#374151', '#6B7280', '#D1D5DB', '#FFFFFF'],
        'Firefox': ['#FF9500', '#002147', '#00FEFF', '#B1B1B3', '#FFFFFF']
      };
    }
    if (!result.recentColors) {
      updates.recentColors = [];
    }

    if (Object.keys(updates).length > 0) {
      await browserAPI.storage.local.set(updates);
      log('[WDR-Firefox] Storage initialized');
    }
  } catch (error) {
    console.error('[WDR-Firefox] Storage init error:', error);
  }
}

// Install handler
browserAPI.runtime.onInstalled.addListener(async (details) => {
  log('[WDR-Firefox] Extension installed:', details.reason);
  await initializeStorage();
  await createContextMenus();
  if (details.reason === 'install') {
    browserAPI.tabs.create({ url: browserAPI.runtime.getURL('welcome/welcome.html') });
  }
});

// Initialize on script load (Firefox doesn't need startup listener as much)
(async () => {
  await createContextMenus();
})();

// ============================================================================
// URL VALIDATION
// ============================================================================

function isValidUrl(url) {
  if (!url) return false;
  return !RESTRICTED_URL_PATTERNS.some(pattern => pattern.test(url));
}

// ============================================================================
// CONTENT SCRIPT MANAGEMENT
// ============================================================================

/**
 * Check if content script is loaded using Firefox Promises
 */
async function isContentScriptLoaded(tabId) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve(false);
    }, PING_TIMEOUT_MS);

    browserAPI.tabs.sendMessage(tabId, { action: 'ping' })
      .then(response => {
        clearTimeout(timeout);
        resolve(response && response.pong === true);
      })
      .catch(() => {
        clearTimeout(timeout);
        resolve(false);
      });
  });
}

/**
 * Inject content script using Firefox's Promise-based API
 */
async function injectContentScript(tabId) {
  try {
    await browserAPI.scripting.executeScript({
      target: { tabId: tabId },
      files: ['scripts/content-script.js']
    });
    log('[WDR-Firefox] Content script injected');
    return true;
  } catch (error) {
    console.error('[WDR-Firefox] Injection failed:', error);
    return false;
  }
}

/**
 * Ensure content script is available
 */
async function ensureContentScript(tabId) {
  let isLoaded = await isContentScriptLoaded(tabId);
  if (isLoaded) {
    return { success: true };
  }

  for (let attempt = 1; attempt <= MAX_INJECTION_RETRIES; attempt++) {
    log(`[WDR-Firefox] Injection attempt ${attempt}/${MAX_INJECTION_RETRIES}`);

    const injected = await injectContentScript(tabId);
    if (!injected) {
      await new Promise(resolve => setTimeout(resolve, INJECTION_RETRY_DELAY_MS));
      continue;
    }

    await new Promise(resolve => setTimeout(resolve, INJECTION_RETRY_DELAY_MS));

    isLoaded = await isContentScriptLoaded(tabId);
    if (isLoaded) {
      return { success: true };
    }
  }

  return {
    success: false,
    error: 'Failed to inject content script. Try refreshing the page.'
  };
}

// ============================================================================
// TOOL ACTIVATION
// ============================================================================

async function activateTool(actionType, tab = null) {
  try {
    if (!tab) {
      const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });

      if (!tabs || tabs.length === 0) {
        return { success: false, error: 'No active tab found' };
      }

      tab = tabs[0];
    }

    if (!isValidUrl(tab.url)) {
      return {
        success: false,
        error: 'Cannot use tools on browser pages. Navigate to a website first.'
      };
    }

    const scriptResult = await ensureContentScript(tab.id);
    if (!scriptResult.success) {
      return scriptResult;
    }

    try {
      await browserAPI.tabs.sendMessage(tab.id, { action: actionType });
      log('[WDR-Firefox] Tool activated:', actionType);
      if (badgeClearTimer) { clearTimeout(badgeClearTimer); badgeClearTimer = null; }
      setBadge('\u25CF');
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to activate tool. Try refreshing.' };
    }

  } catch (error) {
    console.error('[WDR-Firefox] Tool activation error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

// Context menu clicks
browserAPI.contextMenus.onClicked.addListener((info, tab) => {
  log('[WDR-Firefox] Context menu clicked:', info.menuItemId);
  const menuItem = MENU_ITEMS.find(item => item.id === info.menuItemId);
  if (menuItem) {
    activateTool(menuItem.action, tab);
  }
});

// Message handling - Firefox style with Promises
browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  log('[WDR-Firefox] Message received:', message.action);

  // Handle tool activation - use async handler pattern for Firefox
  if (['activateColorPicker', 'activateFontDetector', 'activateMeasureTool'].includes(message.action)) {
    // Firefox MV3: Use async/await pattern with sendResponse
    (async () => {
      try {
        const result = await activateTool(message.action);
        sendResponse(result);
      } catch (error) {
        console.error('[WDR-Firefox] Tool activation error:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Indicates async response
  }

  // Tool cancelled (Esc) in the content script: clear the activity badge
  if (message.action === 'toolCancelled') {
    if (badgeClearTimer) { clearTimeout(badgeClearTimer); badgeClearTimer = null; }
    setBadge('');
    sendResponse({ success: true });
    return false;
  }

  // Handle data from content script.
  // Forward to the popup only AFTER storage is written, so the popup's
  // re-read never races the write.
  if (message.action === 'colorPicked' && message.color) {
    browserAPI.storage.local.set({ lastPickedColor: message.color });

    browserAPI.storage.local.get('recentColors').then(({ recentColors = [] }) => {
      recentColors = recentColors.filter(c => c !== message.color);
      recentColors.unshift(message.color);
      recentColors = recentColors.slice(0, 20);
      return browserAPI.storage.local.set({ recentColors });
    }).then(() => {
      return browserAPI.runtime.sendMessage(message);
    }).catch(() => {});

    flashDoneBadge();
    sendResponse({ success: true });
    return false;
  }

  if (message.action === 'fontDetected' && message.fontDetails) {
    browserAPI.storage.local.set({ lastDetectedFont: message.fontDetails }).then(() => {
      return browserAPI.runtime.sendMessage(message);
    }).catch(() => {});
    flashDoneBadge();
    sendResponse({ success: true });
    return false;
  }

  if (message.action === 'measurementTaken' && message.measurements) {
    browserAPI.storage.local.set({ lastMeasurement: message.measurements }).then(() => {
      return browserAPI.runtime.sendMessage(message);
    }).catch(() => {});
    flashDoneBadge();
    sendResponse({ success: true });
    return false;
  }

  if (message.action === 'pageColorsCollected' && message.colors) {
    const hostname = message.hostname || 'Page';
    const date = new Date().toISOString().slice(0, 10);
    const baseName = 'Page Colors \u2014 ' + hostname + ' ' + date;
    browserAPI.storage.local.get('palettes').then(({ palettes = {} }) => {
      let finalName = baseName;
      if (palettes[finalName]) {
        let i = 2;
        while (palettes[finalName + ' (' + i + ')']) i++;
        finalName = finalName + ' (' + i + ')';
      }
      const validated = (message.colors || []).filter(c => typeof c === 'string' && /^#[0-9A-F]{6}$/i.test(c));
      palettes[finalName] = validated;
      browserAPI.storage.local.set({ palettes }).then(() => {
        log('[WDR-Firefox] Palette created from page colors:', finalName, '(' + validated.length + ' colors)');
      });
    });
    flashDoneBadge();
    sendResponse({ success: true });
    return false;
  }

  return false;
});

// Keyboard shortcuts
browserAPI.commands.onCommand.addListener((command) => {
  log('[WDR-Firefox] Command received:', command);
  if (command === 'activate_eyedropper') {
    activateTool('activateColorPicker');
  } else if (command === 'activate_font_detector') {
    activateTool('activateFontDetector');
  } else if (command === 'activate_measure_tool') {
    activateTool('activateMeasureTool');
  }
});

log('[WDR-Firefox] Background script initialization complete');
