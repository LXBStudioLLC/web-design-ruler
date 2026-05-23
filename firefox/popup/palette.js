/**
 * Web Design Ruler - Palette Management (Firefox Build)
 * Version: 2.0.0
 *
 * Uses browser.* namespace with Promises for Firefox
 * This file loads BEFORE popup.js, so we define browserAPI here
 */

// Define browserAPI globally for all popup scripts
var browserAPI;
if (typeof browser !== 'undefined' && browser.runtime) {
  browserAPI = browser;
} else if (typeof chrome !== 'undefined' && chrome.runtime) {
  browserAPI = chrome;
} else {
  console.error('[WDR-Firefox Palette] No browser API found!');
  browserAPI = {
    runtime: { sendMessage: function(){}, onMessage: { addListener: function(){} }, lastError: null },
    storage: { local: { get: function() { return Promise.resolve({}); }, set: function() { return Promise.resolve(); } } }
  };
}

async function saveToPalette(paletteName, color, callback) {
  try {
    const { palettes = {} } = await browserAPI.storage.local.get('palettes');

    if (!palettes[paletteName]) {
      palettes[paletteName] = [];
    }

    if (!palettes[paletteName].includes(color)) {
      palettes[paletteName].push(color);
    }

    await browserAPI.storage.local.set({ palettes });
    if (callback) callback(true);
  } catch (error) {
    console.error('[WDR-Firefox] saveToPalette error:', error);
    if (callback) callback(false);
  }
}

async function createPalette(paletteName, colors = [], callback) {
  try {
    const { palettes = {} } = await browserAPI.storage.local.get('palettes');
    palettes[paletteName] = colors;
    await browserAPI.storage.local.set({ palettes });
    if (callback) callback(true);
  } catch (error) {
    console.error('[WDR-Firefox] createPalette error:', error);
    if (callback) callback(false);
  }
}

async function deletePalette(paletteName, callback) {
  try {
    const { palettes = {} } = await browserAPI.storage.local.get('palettes');
    delete palettes[paletteName];
    await browserAPI.storage.local.set({ palettes });
    if (callback) callback(true);
  } catch (error) {
    console.error('[WDR-Firefox] deletePalette error:', error);
    if (callback) callback(false);
  }
}

async function loadPalettes(callback) {
  try {
    const { palettes = {} } = await browserAPI.storage.local.get('palettes');
    callback(palettes);
  } catch (error) {
    console.error('[WDR-Firefox] loadPalettes error:', error);
    callback({});
  }
}

async function renamePalette(oldName, newName, callback) {
  try {
    const { palettes = {} } = await browserAPI.storage.local.get('palettes');

    if (!palettes[oldName] || palettes[newName]) {
      if (callback) callback(false);
      return;
    }

    palettes[newName] = palettes[oldName];
    delete palettes[oldName];

    await browserAPI.storage.local.set({ palettes });
    if (callback) callback(true);
  } catch (error) {
    console.error('[WDR-Firefox] renamePalette error:', error);
    if (callback) callback(false);
  }
}

async function removeFromPalette(paletteName, color, callback) {
  try {
    const { palettes = {} } = await browserAPI.storage.local.get('palettes');

    if (!palettes[paletteName]) {
      if (callback) callback(false);
      return;
    }

    palettes[paletteName] = palettes[paletteName].filter(c => c !== color);
    await browserAPI.storage.local.set({ palettes });
    if (callback) callback(true);
  } catch (error) {
    console.error('[WDR-Firefox] removeFromPalette error:', error);
    if (callback) callback(false);
  }
}

async function getPalette(paletteName, callback) {
  try {
    const { palettes = {} } = await browserAPI.storage.local.get('palettes');
    callback(palettes[paletteName] || null);
  } catch (error) {
    console.error('[WDR-Firefox] getPalette error:', error);
    callback(null);
  }
}
