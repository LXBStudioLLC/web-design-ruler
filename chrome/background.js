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
  { id: 'wdr-measure-tool', title: 'Measure', action: 'activateMeasureTool' }
];

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
    activateTool(menuItem.action, tab);
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

  // Handle data from content script
  if (message.action === 'colorPicked' && message.color) {
    // Save to storage
    chrome.storage.local.set({ lastPickedColor: message.color });

    // Update recent colors
    chrome.storage.local.get('recentColors', ({ recentColors = [] }) => {
      recentColors = recentColors.filter(c => c !== message.color);
      recentColors.unshift(message.color);
      recentColors = recentColors.slice(0, 20);
      chrome.storage.local.set({ recentColors });
    });

    // Forward to popup if open
    chrome.runtime.sendMessage(message).catch(() => {});
    sendResponse({ success: true });
    return true;
  }

  if (message.action === 'fontDetected' && message.fontDetails) {
    chrome.storage.local.set({ lastDetectedFont: message.fontDetails });
    chrome.runtime.sendMessage(message).catch(() => {});
    sendResponse({ success: true });
    return true;
  }

  if (message.action === 'measurementTaken' && message.measurements) {
    chrome.storage.local.set({ lastMeasurement: message.measurements });
    chrome.runtime.sendMessage(message).catch(() => {});
    sendResponse({ success: true });
    return true;
  }

  return false;
});

// Keyboard shortcuts
chrome.commands.onCommand.addListener((command) => {
  log('[WDR] Command received:', command);
  if (command === 'activate_eyedropper') {
    activateTool('activateColorPicker');
  } else if (command === 'activate_font_detector') {
    activateTool('activateFontDetector');
  } else if (command === 'activate_measure_tool') {
    activateTool('activateMeasureTool');
  }
});

log('[WDR] Background script initialization complete');
