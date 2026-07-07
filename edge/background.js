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

let _debug = false;
chrome.storage.local.get('settings', (data) => { _debug = (data.settings && data.settings.debugLogging) || false; });
function log(...args) { if (_debug) console.log(...args); }

log('[WDR-Edge] Background service worker started');

// ============================================================================
// CONSTANTS
// ============================================================================
const PING_TIMEOUT_MS = 1500;  // Longer timeout for Edge
const INJECTION_RETRY_DELAY_MS = 200;  // Longer delay for Edge
const MAX_INJECTION_RETRIES = 4;  // More retries for Edge
const KEEP_ALIVE_ALARM_NAME = 'wdr-keep-alive';
// NOTE: alarm periods below 1 minute are honored only from Chromium 120;
// on Edge 102-119 (our minimum is 102) the browser clamps this to 1 minute
// and logs a console warning. Acceptable: the alarm is a wake-up aid for the
// service worker, not a hard keep-alive, so a 1-minute cadence still works.
const WAKE_UP_INTERVAL_MINUTES = 0.5;

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

// Track if context menus have been created
let menusCreated = false;

// ============================================================================
// EDGE-SPECIFIC: WAKE-UP MECHANISM
// ============================================================================

function setupKeepAlive() {
  chrome.alarms.create(KEEP_ALIVE_ALARM_NAME, {
    periodInMinutes: WAKE_UP_INTERVAL_MINUTES
  });
  log('[WDR-Edge] Wake-up alarm set');
}

// Handle alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === KEEP_ALIVE_ALARM_NAME) {
    chrome.storage.local.get('_keepAlive', () => {
      log('[WDR-Edge] Wake-up ping');
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
    log('[WDR-Edge] Menus already created, skipping');
    return;
  }

  // Remove all existing menus first (Edge may have stale entries)
  try {
    chrome.contextMenus.removeAll(() => {
      // Check for errors silently
      const removeError = chrome.runtime.lastError;
      if (removeError) {
        log('[WDR-Edge] removeAll note:', removeError.message);
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
              log('[WDR-Edge] Context menus created successfully');
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
          log('[WDR-Edge] Storage initialized');
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
  log('[WDR-Edge] Extension installed/updated:', details.reason);
  menusCreated = false;  // Reset flag
  initializeStorage();
  createContextMenus();
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('welcome/welcome.html') });
  }
  setupKeepAlive();
});

// Browser startup handler
chrome.runtime.onStartup.addListener(() => {
  log('[WDR-Edge] Browser startup detected');
  menusCreated = false;  // Reset flag on browser restart
  createContextMenus();
  setupKeepAlive();
});

// Service worker started - create menus immediately
// EDGE-SPECIFIC: This is crucial because Edge service workers restart frequently
log('[WDR-Edge] Service worker script executing, initializing...');
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
      log('[WDR-Edge] Ping timed out');
      resolve(false);
    }, PING_TIMEOUT_MS);

    try {
      chrome.tabs.sendMessage(tabId, { action: 'ping' }, (response) => {
        clearTimeout(timeout);

        // EDGE-SPECIFIC: Must check lastError first
        if (chrome.runtime.lastError) {
          log('[WDR-Edge] Ping error:', chrome.runtime.lastError.message);
          resolve(false);
          return;
        }

        const isLoaded = response && response.pong === true;
        log('[WDR-Edge] Ping response:', isLoaded);
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
    log('[WDR-Edge] Content script injected');
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
    log('[WDR-Edge] Content script already loaded');
    return { success: true };
  }

  // Try injection with retries
  for (let attempt = 1; attempt <= MAX_INJECTION_RETRIES; attempt++) {
    log(`[WDR-Edge] Injection attempt ${attempt}/${MAX_INJECTION_RETRIES}`);

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

async function activateTool(actionType, tab = null) {
  try {
    if (!tab) {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tabs || tabs.length === 0) {
        return { success: false, error: 'No active tab found' };
      }

      tab = tabs[0];
    }

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

        log('[WDR-Edge] Tool activated:', actionType);
        if (badgeClearTimer) { clearTimeout(badgeClearTimer); badgeClearTimer = null; }
        setBadge('\u25CF');
        rememberToolTab(tab.id);
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
  log('[WDR-Edge] Context menu clicked:', info.menuItemId);
  const menuItem = MENU_ITEMS.find(item => item.id === info.menuItemId);
  if (menuItem) {
    activateTool(menuItem.action, tab).then(surfaceActivationResult);
  }
});

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  log('[WDR-Edge] Message received:', message.action);

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

  // Data from content script.
  // Forward to the popup only AFTER storage is written, so the popup's
  // re-read never races the write.
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
      chrome.storage.local.set({ recentColors }, () => {
        if (chrome.runtime.lastError) {
          console.error('[WDR-Edge] Storage error:', chrome.runtime.lastError.message);
        }
        chrome.runtime.sendMessage(message).catch(() => {});
      });
    });

    flashDoneBadge();
    sendResponse({ success: true });
    return true;
  }

  if (message.action === 'fontDetected' && message.fontDetails) {
    chrome.storage.local.set({ lastDetectedFont: message.fontDetails }, () => {
      if (chrome.runtime.lastError) {
        console.error('[WDR-Edge] Storage error:', chrome.runtime.lastError.message);
      }
      chrome.runtime.sendMessage(message).catch(() => {});
    });
    flashDoneBadge();
    sendResponse({ success: true });
    return true;
  }

  if (message.action === 'measurementTaken' && message.measurements) {
    chrome.storage.local.set({ lastMeasurement: message.measurements }, () => {
      if (chrome.runtime.lastError) {
        console.error('[WDR-Edge] Storage error:', chrome.runtime.lastError.message);
      }
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
        log('[WDR-Edge] Palette created from page colors:', finalName, '(' + validated.length + ' colors)');
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
  log('[WDR-Edge] Command received:', command);
  if (command === 'activate_eyedropper') {
    activateTool('activateColorPicker').then(surfaceActivationResult);
  } else if (command === 'activate_font_detector') {
    activateTool('activateFontDetector').then(surfaceActivationResult);
  } else if (command === 'activate_measure_tool') {
    activateTool('activateMeasureTool').then(surfaceActivationResult);
  }
});

log('[WDR-Edge] Background script initialization complete');
