/**
 * Web Design Ruler Background Script (Chrome Build)
 * Version: 2.0.0
 *
 * Handles service worker lifecycle, message passing, and tool activation
 * with robust error handling and cross-browser compatibility.
 */

let _debug = false;
chrome.storage.local.get('settings', (data) => { _debug = (data.settings && data.settings.debugLogging) || false; });
function log(...args) { if (_debug) console.log(...args); }

log('[WDR] Background service worker started');

// ============================================================================
// CONSTANTS
// ============================================================================
const PING_TIMEOUT_MS = 1000;
const INJECTION_RETRY_DELAY_MS = 150;
const MAX_INJECTION_RETRIES = 3;

const RESTRICTED_URL_PATTERNS = [
  /^chrome:\/\//,
  /^chrome-extension:\/\//,
  /^edge:\/\//,
  /^about:/,
  /^moz-extension:\/\//,
  /^file:\/\//  // file:// URLs require special permissions
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
  chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
  chrome.action.setBadgeText({ text: text });
}

function flashDoneBadge() {
  if (badgeClearTimer) clearTimeout(badgeClearTimer);
  setBadge('\u2713');
  forgetToolTab(); // the tool session ended with a result
  badgeClearTimer = setTimeout(() => {
    setBadge('');
    badgeClearTimer = null;
  }, 2000);
}

// The \u25CF badge belongs to the tab whose tool set it. The owner is kept in
// storage.session (survives service-worker restarts, dies with the browser)
// so a closed/navigated tab, or a stale toolCancelled from another tab, can
// be told apart from the live owner.
function rememberToolTab(tabId) {
  chrome.storage.session.set({ activeToolTabId: tabId });
}

function forgetToolTab() {
  chrome.storage.session.remove('activeToolTabId');
}

function clearBadgeIfOwner(tabId) {
  chrome.storage.session.get('activeToolTabId', ({ activeToolTabId }) => {
    if (activeToolTabId === tabId) {
      if (badgeClearTimer) { clearTimeout(badgeClearTimer); badgeClearTimer = null; }
      setBadge('');
      forgetToolTab();
    }
  });
}

// A tool dies silently with its page: no toolCancelled is ever sent when the
// owning tab closes or navigates away, so clear the stale \u25CF here.
chrome.tabs.onRemoved.addListener((tabId) => clearBadgeIfOwner(tabId));
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') clearBadgeIfOwner(tabId);
});

// Surface activation failures from badge-only entry points: the popup shows
// activateTool errors itself, but context-menu and keyboard-shortcut users
// otherwise get a silent no-op (restricted pages, injection failures).
const DEFAULT_ACTION_TITLE = 'Web Design Ruler';

function flashErrorBadge(errorText) {
  if (badgeClearTimer) clearTimeout(badgeClearTimer);
  chrome.action.setBadgeBackgroundColor({ color: '#EF4444' });
  chrome.action.setBadgeText({ text: '!' });
  chrome.action.setTitle({ title: DEFAULT_ACTION_TITLE + ' \u2014 ' + (errorText || 'Tool activation failed') });
  badgeClearTimer = setTimeout(() => {
    setBadge(''); // also restores the normal badge color
    chrome.action.setTitle({ title: DEFAULT_ACTION_TITLE });
    badgeClearTimer = null;
  }, 3000);
}

function surfaceActivationResult(result) {
  if (result && !result.success) flashErrorBadge(result.error);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Creates context menu items. Called on install and service worker startup.
 */
function createContextMenus() {
  // First remove any existing menus to prevent duplicates
  chrome.contextMenus.removeAll(() => {
    MENU_ITEMS.forEach(item => {
      chrome.contextMenus.create({
        id: item.id,
        title: `${item.title} with Web Design Ruler`,
        contexts: ['page', 'selection', 'image']
      }, () => {
        if (chrome.runtime.lastError) {
          console.warn(`[WDR] Menu creation warning: ${chrome.runtime.lastError.message}`);
        }
      });
    });
    log('[WDR] Context menus created');
  });
}

/**
 * Initialize default storage values
 */
function initializeStorage() {
  const defaultPalettes = {
    'Web Design Ruler': [
      '#2563EB', // Primary Blue
      '#10B981', // Success Green
      '#F59E0B', // Warning Amber
      '#EF4444', // Danger Red
      '#6366F1'  // Indigo
    ],
    'Neutrals': [
      '#000000', '#374151', '#6B7280', '#D1D5DB', '#FFFFFF'
    ]
  };

  chrome.storage.local.get(['palettes', 'recentColors'], (result) => {
    const updates = {};
    if (!result.palettes) {
      updates.palettes = defaultPalettes;
    }
    if (!result.recentColors) {
      updates.recentColors = [];
    }
    if (Object.keys(updates).length > 0) {
      chrome.storage.local.set(updates, () => {
        log('[WDR] Storage initialized');
      });
    }
  });
}

// Install handler
chrome.runtime.onInstalled.addListener((details) => {
  log('[WDR] Extension installed/updated:', details.reason);
  initializeStorage();
  createContextMenus();
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('welcome/welcome.html') });
  }
});

// Service worker startup - recreate menus (they don't persist across restarts)
chrome.runtime.onStartup.addListener(() => {
  log('[WDR] Browser startup detected');
  createContextMenus();
});

// Also create menus immediately when service worker loads
// This handles the case where service worker restarts mid-session
createContextMenus();

// ============================================================================
// URL VALIDATION
// ============================================================================

/**
 * Check if a URL is valid for content script injection
 * @param {string} url - URL to check
 * @returns {boolean} - True if URL is valid
 */
function isValidUrl(url) {
  if (!url) return false;
  return !RESTRICTED_URL_PATTERNS.some(pattern => pattern.test(url));
}

// ============================================================================
// CONTENT SCRIPT MANAGEMENT
// ============================================================================

/**
 * Check if content script is already loaded in a tab
 * @param {number} tabId - Tab ID to check
 * @returns {Promise<boolean>} - True if content script responds
 */
async function isContentScriptLoaded(tabId) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve(false);
    }, PING_TIMEOUT_MS);

    try {
      chrome.tabs.sendMessage(tabId, { action: 'ping' }, (response) => {
        clearTimeout(timeout);

        // Check for runtime errors first
        if (chrome.runtime.lastError) {
          log('[WDR] Ping failed:', chrome.runtime.lastError.message);
          resolve(false);
          return;
        }

        resolve(response && response.pong === true);
      });
    } catch (error) {
      clearTimeout(timeout);
      log('[WDR] Ping exception:', error.message);
      resolve(false);
    }
  });
}

/**
 * Inject content script into a tab
 * @param {number} tabId - Tab ID to inject into
 * @returns {Promise<boolean>} - True if injection succeeded
 */
async function injectContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['scripts/content-script.js'],
      world: 'ISOLATED'  // Explicit world for cross-browser compatibility
    });
    log('[WDR] Content script injected successfully');
    return true;
  } catch (error) {
    console.error('[WDR] Injection failed:', error.message);
    return false;
  }
}

/**
 * Ensure content script is available in tab with retry logic
 * @param {number} tabId - Tab ID
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function ensureContentScript(tabId) {
  // First, check if already loaded
  let isLoaded = await isContentScriptLoaded(tabId);
  if (isLoaded) {
    log('[WDR] Content script already loaded');
    return { success: true };
  }

  // Try injection with retries
  for (let attempt = 1; attempt <= MAX_INJECTION_RETRIES; attempt++) {
    log(`[WDR] Injection attempt ${attempt}/${MAX_INJECTION_RETRIES}`);

    const injected = await injectContentScript(tabId);
    if (!injected) {
      continue;
    }

    // Wait for script to initialize
    await new Promise(resolve => setTimeout(resolve, INJECTION_RETRY_DELAY_MS));

    // Verify injection
    isLoaded = await isContentScriptLoaded(tabId);
    if (isLoaded) {
      return { success: true };
    }
  }

  return {
    success: false,
    error: 'Failed to inject content script after multiple attempts. Try refreshing the page.'
  };
}

// ============================================================================
// TOOL ACTIVATION
// ============================================================================

/**
 * Activate a tool in the current active tab
 * @param {string} actionType - Action to send to content script
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function activateTool(actionType, tab = null) {
  try {
    if (!tab) {
      [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    }

    if (!tab) {
      return { success: false, error: 'No active tab found' };
    }

    // Validate URL
    if (!isValidUrl(tab.url)) {
      return {
        success: false,
        error: 'Cannot use tools on browser internal pages. Navigate to a website first.'
      };
    }

    // Ensure content script is available
    const scriptResult = await ensureContentScript(tab.id);
    if (!scriptResult.success) {
      return scriptResult;
    }

    // Send activation message
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id, { action: actionType }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('[WDR] Activation failed:', chrome.runtime.lastError.message);
          resolve({
            success: false,
            error: 'Failed to activate tool. Try refreshing the page.'
          });
          return;
        }

        log('[WDR] Tool activated:', actionType);
        if (badgeClearTimer) { clearTimeout(badgeClearTimer); badgeClearTimer = null; }
        setBadge('\u25CF');
        rememberToolTab(tab.id);
        resolve({ success: true });
      });
    });

  } catch (error) {
    console.error('[WDR] Tool activation error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

// Context menu click handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
  const menuItem = MENU_ITEMS.find(item => item.id === info.menuItemId);
  if (menuItem) {
    log('[WDR] Context menu clicked:', menuItem.id);
    activateTool(menuItem.action, tab).then(surfaceActivationResult);
  }
});

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  log('[WDR] Message received:', message.action);

  // Handle tool activation requests from popup
  if (['activateColorPicker', 'activateFontDetector', 'activateMeasureTool'].includes(message.action)) {
    activateTool(message.action).then(result => {
      sendResponse(result);
    });
    return true; // Keep channel open for async response
  }

  // Tool cancelled (Esc) in the content script: clear the activity badge \u2014
  // but only when the cancel comes from the badge's owning tab (or the owner
  // is unknown); a stale cancel must not clear a newer tool's badge.
  if (message.action === 'toolCancelled') {
    const senderTabId = sender.tab && sender.tab.id;
    chrome.storage.session.get('activeToolTabId', ({ activeToolTabId }) => {
      if (activeToolTabId == null || senderTabId == null || activeToolTabId === senderTabId) {
        if (badgeClearTimer) { clearTimeout(badgeClearTimer); badgeClearTimer = null; }
        setBadge('');
        forgetToolTab();
      }
    });
    sendResponse({ success: true });
    return false;
  }

  // Handle data from content script.
  // Forward to the popup only AFTER storage is written, so the popup's
  // re-read never races the write.
  if (message.action === 'colorPicked' && message.color) {
    chrome.storage.local.set({ lastPickedColor: message.color });

    chrome.storage.local.get('recentColors', ({ recentColors = [] }) => {
      recentColors = recentColors.filter(c => c !== message.color);
      recentColors.unshift(message.color);
      recentColors = recentColors.slice(0, 20);
      chrome.storage.local.set({ recentColors }, () => {
        chrome.runtime.sendMessage(message).catch(() => {});
      });
    });

    flashDoneBadge();
    sendResponse({ success: true });
    return true;
  }

  if (message.action === 'fontDetected' && message.fontDetails) {
    chrome.storage.local.set({ lastDetectedFont: message.fontDetails }, () => {
      chrome.runtime.sendMessage(message).catch(() => {});
    });
    flashDoneBadge();
    sendResponse({ success: true });
    return true;
  }

  if (message.action === 'measurementTaken' && message.measurements) {
    chrome.storage.local.set({ lastMeasurement: message.measurements }, () => {
      chrome.runtime.sendMessage(message).catch(() => {});
    });
    flashDoneBadge();
    sendResponse({ success: true });
    return true;
  }

  if (message.action === 'pageColorsCollected' && message.colors) {
    const hostname = message.hostname || 'Page';
    const date = new Date().toISOString().slice(0, 10);
    const baseName = 'Page Colors \u2014 ' + hostname + ' ' + date;
    chrome.storage.local.get('palettes', ({ palettes = {} }) => {
      let finalName = baseName;
      if (palettes[finalName]) {
        let i = 2;
        while (palettes[finalName + ' (' + i + ')']) i++;
        finalName = finalName + ' (' + i + ')';
      }
      const validated = (message.colors || []).filter(c => typeof c === 'string' && /^#[0-9A-F]{6}$/i.test(c));
      palettes[finalName] = validated;
      chrome.storage.local.set({ palettes }, () => {
        log('[WDR] Palette created from page colors:', finalName, '(' + validated.length + ' colors)');
      });
    });
    flashDoneBadge();
    sendResponse({ success: true });
    return true;
  }

  return false;
});

// Keyboard shortcuts
chrome.commands.onCommand.addListener((command) => {
  log('[WDR] Command received:', command);
  if (command === 'activate_eyedropper') {
    activateTool('activateColorPicker').then(surfaceActivationResult);
  } else if (command === 'activate_font_detector') {
    activateTool('activateFontDetector').then(surfaceActivationResult);
  } else if (command === 'activate_measure_tool') {
    activateTool('activateMeasureTool').then(surfaceActivationResult);
  }
});

log('[WDR] Background script initialization complete');
