/**
 * Web Design Ruler Background Script (Edge Build)
 * Version: 2.0.0
 *
 * EDGE-SPECIFIC BUILD with workarounds for:
 * - Aggressive service worker termination
 * - Context menu recreation on service worker restart
 * - Stricter message passing requirements
 * - chrome.runtime.lastError handling differences
 */

console.log('[WDR-Edge] Background service worker started');

// ============================================================================
// CONSTANTS
// ============================================================================
const PING_TIMEOUT_MS = 1500;  // Longer timeout for Edge
const INJECTION_RETRY_DELAY_MS = 200;  // Longer delay for Edge
const MAX_INJECTION_RETRIES = 4;  // More retries for Edge
const KEEP_ALIVE_ALARM_NAME = 'wdr-keep-alive';
const KEEP_ALIVE_INTERVAL_MINUTES = 0.4;  // ~24 seconds to stay under 30s limit

const RESTRICTED_URL_PATTERNS = [
  /^chrome:\/\//,
  /^chrome-extension:\/\//,
  /^edge:\/\//,
  /^about:/,
  /^moz-extension:\/\//,
  /^file:\/\//
];

const MENU_ITEMS = [
  { id: 'wdr-eyedropper', title: 'Pick Color', action: 'activateColorPicker' },
  { id: 'wdr-font-detector', title: 'Identify Font', action: 'activateFontDetector' },
  { id: 'wdr-measure-tool', title: 'Measure', action: 'activateMeasureTool' }
];

// Track if context menus have been created
let menusCreated = false;

// ============================================================================
// EDGE-SPECIFIC: KEEP-ALIVE MECHANISM
// ============================================================================

/**
 * Set up keep-alive alarm to prevent service worker termination
 * Edge terminates service workers more aggressively than Chrome
 */
function setupKeepAlive() {
  // Create an alarm that fires periodically
  chrome.alarms.create(KEEP_ALIVE_ALARM_NAME, {
    periodInMinutes: KEEP_ALIVE_INTERVAL_MINUTES
  });
  console.log('[WDR-Edge] Keep-alive alarm set');
}

// Handle alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === KEEP_ALIVE_ALARM_NAME) {
    // Just accessing storage is enough to keep the service worker alive
    chrome.storage.local.get('_keepAlive', () => {
      console.log('[WDR-Edge] Keep-alive ping');
    });
  }
});

// ============================================================================
// CONTEXT MENU MANAGEMENT
// ============================================================================

/**
 * Creates context menu items with proper error handling for Edge
 * Edge may need context menus recreated on service worker restart
 */
function createContextMenus() {
  if (menusCreated) {
    console.log('[WDR-Edge] Menus already created, skipping');
    return;
  }

  // Remove all existing menus first (Edge may have stale entries)
  try {
    chrome.contextMenus.removeAll(() => {
      // Check for errors silently
      const removeError = chrome.runtime.lastError;
      if (removeError) {
        console.log('[WDR-Edge] removeAll note:', removeError.message);
      }

      // Create new menus
      MENU_ITEMS.forEach((item, index) => {
        try {
          chrome.contextMenus.create({
            id: item.id,
            title: `${item.title} with Web Design Ruler`,
            contexts: ['page', 'selection', 'image']
          }, () => {
            const createError = chrome.runtime.lastError;
            if (createError) {
              // In Edge, duplicate ID error is common on service worker restart
              if (!createError.message.includes('duplicate')) {
                console.warn('[WDR-Edge] Menu creation issue:', createError.message);
              }
            } else if (index === MENU_ITEMS.length - 1) {
              menusCreated = true;
              console.log('[WDR-Edge] Context menus created successfully');
            }
          });
        } catch (e) {
          console.error('[WDR-Edge] Menu creation error:', e);
        }
      });
    });
  } catch (e) {
    console.error('[WDR-Edge] Context menu setup error:', e);
  }
}

/**
 * Initialize default storage values
 */
function initializeStorage() {
  const defaultPalettes = {
    'Web Design Ruler': [
      '#2563EB', '#10B981', '#F59E0B', '#EF4444', '#6366F1'
    ],
    'Neutrals': [
      '#000000', '#374151', '#6B7280', '#D1D5DB', '#FFFFFF'
    ]
  };

  chrome.storage.local.get(['palettes', 'recentColors'], (result) => {
    // EDGE-SPECIFIC: Always check lastError
    if (chrome.runtime.lastError) {
      console.error('[WDR-Edge] Storage get error:', chrome.runtime.lastError.message);
      return;
    }

    const updates = {};
    if (!result.palettes) {
      updates.palettes = defaultPalettes;
    }
    if (!result.recentColors) {
      updates.recentColors = [];
    }
    if (Object.keys(updates).length > 0) {
      chrome.storage.local.set(updates, () => {
        if (chrome.runtime.lastError) {
          console.error('[WDR-Edge] Storage set error:', chrome.runtime.lastError.message);
        } else {
          console.log('[WDR-Edge] Storage initialized');
        }
      });
    }
  });
}

// ============================================================================
// LIFECYCLE EVENT HANDLERS
// ============================================================================

// Install handler
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[WDR-Edge] Extension installed/updated:', details.reason);
  menusCreated = false;  // Reset flag
  initializeStorage();
  createContextMenus();
  setupKeepAlive();
});

// Browser startup handler
chrome.runtime.onStartup.addListener(() => {
  console.log('[WDR-Edge] Browser startup detected');
  menusCreated = false;  // Reset flag on browser restart
  createContextMenus();
  setupKeepAlive();
});

// Service worker started - create menus immediately
// EDGE-SPECIFIC: This is crucial because Edge service workers restart frequently
console.log('[WDR-Edge] Service worker script executing, initializing...');
createContextMenus();
setupKeepAlive();

// ============================================================================
// URL VALIDATION
// ============================================================================

function isValidUrl(url) {
  if (!url) return false;
  return !RESTRICTED_URL_PATTERNS.some(pattern => pattern.test(url));
}

// ============================================================================
// CONTENT SCRIPT MANAGEMENT (EDGE-SPECIFIC)
// ============================================================================

/**
 * Check if content script is loaded
 * EDGE-SPECIFIC: Uses longer timeout and proper error handling
 */
async function isContentScriptLoaded(tabId) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.log('[WDR-Edge] Ping timed out');
      resolve(false);
    }, PING_TIMEOUT_MS);

    try {
      chrome.tabs.sendMessage(tabId, { action: 'ping' }, (response) => {
        clearTimeout(timeout);

        // EDGE-SPECIFIC: Must check lastError first
        if (chrome.runtime.lastError) {
          console.log('[WDR-Edge] Ping error:', chrome.runtime.lastError.message);
          resolve(false);
          return;
        }

        const isLoaded = response && response.pong === true;
        console.log('[WDR-Edge] Ping response:', isLoaded);
        resolve(isLoaded);
      });
    } catch (error) {
      clearTimeout(timeout);
      console.error('[WDR-Edge] Ping exception:', error);
      resolve(false);
    }
  });
}

/**
 * Inject content script
 * EDGE-SPECIFIC: Uses explicit world parameter
 */
async function injectContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['scripts/content-script.js'],
      world: 'ISOLATED'  // EDGE-SPECIFIC: Explicit world parameter
    });
    console.log('[WDR-Edge] Content script injected');
    return true;
  } catch (error) {
    console.error('[WDR-Edge] Injection failed:', error.message);
    return false;
  }
}

/**
 * Ensure content script is available
 * EDGE-SPECIFIC: More retries and longer delays
 */
async function ensureContentScript(tabId) {
  // First check if already loaded
  let isLoaded = await isContentScriptLoaded(tabId);
  if (isLoaded) {
    console.log('[WDR-Edge] Content script already loaded');
    return { success: true };
  }

  // Try injection with retries
  for (let attempt = 1; attempt <= MAX_INJECTION_RETRIES; attempt++) {
    console.log(`[WDR-Edge] Injection attempt ${attempt}/${MAX_INJECTION_RETRIES}`);

    const injected = await injectContentScript(tabId);
    if (!injected) {
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, INJECTION_RETRY_DELAY_MS));
      continue;
    }

    // Wait for script to initialize (longer for Edge)
    await new Promise(resolve => setTimeout(resolve, INJECTION_RETRY_DELAY_MS * 1.5));

    // Verify injection
    isLoaded = await isContentScriptLoaded(tabId);
    if (isLoaded) {
      return { success: true };
    }
  }

  return {
    success: false,
    error: 'Failed to inject content script. Please refresh the page and try again.'
  };
}

// ============================================================================
// TOOL ACTIVATION
// ============================================================================

async function activateTool(actionType) {
  try {
    // Get active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });

    // EDGE-SPECIFIC: Check lastError after query
    if (chrome.runtime.lastError) {
      console.error('[WDR-Edge] Tab query error:', chrome.runtime.lastError.message);
      return { success: false, error: 'Failed to get active tab' };
    }

    if (!tabs || tabs.length === 0) {
      return { success: false, error: 'No active tab found' };
    }

    const tab = tabs[0];

    // Validate URL
    if (!isValidUrl(tab.url)) {
      return {
        success: false,
        error: 'Cannot use tools on browser pages. Navigate to a website first.'
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
        // EDGE-SPECIFIC: Check lastError
        if (chrome.runtime.lastError) {
          console.error('[WDR-Edge] Send message error:', chrome.runtime.lastError.message);
          resolve({
            success: false,
            error: 'Failed to communicate with page. Try refreshing.'
          });
          return;
        }

        console.log('[WDR-Edge] Tool activated:', actionType);
        resolve({ success: true });
      });
    });

  } catch (error) {
    console.error('[WDR-Edge] Tool activation error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

// Context menu click handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
  console.log('[WDR-Edge] Context menu clicked:', info.menuItemId);
  const menuItem = MENU_ITEMS.find(item => item.id === info.menuItemId);
  if (menuItem) {
    activateTool(menuItem.action);
  }
});

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[WDR-Edge] Message received:', message.action);

  // Tool activation requests
  if (['activateColorPicker', 'activateFontDetector', 'activateMeasureTool'].includes(message.action)) {
    // EDGE-SPECIFIC: Must return true and use async properly
    activateTool(message.action).then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;  // Keep channel open
  }

  // Data from content script
  if (message.action === 'colorPicked' && message.color) {
    chrome.storage.local.set({ lastPickedColor: message.color }, () => {
      if (chrome.runtime.lastError) {
        console.error('[WDR-Edge] Storage error:', chrome.runtime.lastError.message);
      }
    });

    // Update recent colors
    chrome.storage.local.get('recentColors', ({ recentColors = [] }) => {
      if (chrome.runtime.lastError) {
        console.error('[WDR-Edge] Storage error:', chrome.runtime.lastError.message);
        return;
      }
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
    chrome.storage.local.set({ lastDetectedFont: message.fontDetails }, () => {
      if (chrome.runtime.lastError) {
        console.error('[WDR-Edge] Storage error:', chrome.runtime.lastError.message);
      }
    });
    chrome.runtime.sendMessage(message).catch(() => {});
    sendResponse({ success: true });
    return true;
  }

  if (message.action === 'measurementTaken' && message.measurements) {
    chrome.storage.local.set({ lastMeasurement: message.measurements }, () => {
      if (chrome.runtime.lastError) {
        console.error('[WDR-Edge] Storage error:', chrome.runtime.lastError.message);
      }
    });
    chrome.runtime.sendMessage(message).catch(() => {});
    sendResponse({ success: true });
    return true;
  }

  return false;
});

// Keyboard shortcuts
chrome.commands.onCommand.addListener((command) => {
  console.log('[WDR-Edge] Command received:', command);
  if (command === 'activate_eyedropper') {
    activateTool('activateColorPicker');
  }
});

console.log('[WDR-Edge] Background script initialization complete');
