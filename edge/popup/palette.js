/**
 * Web Design Ruler - Palette Management
 * Version: 2.0.0
 *
 * Provides functions to manage color palettes in Chrome storage
 */

/**
 * Save a color to an existing palette
 * @param {string} paletteName - Name of the palette
 * @param {string} color - Color in hex format
 * @param {Function} callback - Callback when complete
 */
function saveToPalette(paletteName, color, callback) {
  chrome.storage.local.get('palettes', ({ palettes = {} }) => {
    if (!palettes[paletteName]) {
      palettes[paletteName] = [];
    }

    // Add color if not already present
    if (!palettes[paletteName].includes(color)) {
      palettes[paletteName].push(color);
    }

    chrome.storage.local.set({ palettes }, () => {
      if (callback) callback(true);
    });
  });
}

/**
 * Create a new palette
 * @param {string} paletteName - Name for the new palette
 * @param {Array} colors - Initial colors array
 * @param {Function} callback - Callback when complete
 */
function createPalette(paletteName, colors = [], callback) {
  chrome.storage.local.get('palettes', ({ palettes = {} }) => {
    palettes[paletteName] = colors;

    chrome.storage.local.set({ palettes }, () => {
      if (callback) callback(true);
    });
  });
}

/**
 * Delete a palette
 * @param {string} paletteName - Name of palette to delete
 * @param {Function} callback - Callback when complete
 */
function deletePalette(paletteName, callback) {
  chrome.storage.local.get('palettes', ({ palettes = {} }) => {
    delete palettes[paletteName];

    chrome.storage.local.set({ palettes }, () => {
      if (callback) callback(true);
    });
  });
}

/**
 * Load all palettes
 * @param {Function} callback - Callback with palettes object
 */
function loadPalettes(callback) {
  chrome.storage.local.get('palettes', ({ palettes = {} }) => {
    callback(palettes);
  });
}

/**
 * Rename a palette
 * @param {string} oldName - Current palette name
 * @param {string} newName - New palette name
 * @param {Function} callback - Callback with success boolean
 */
function renamePalette(oldName, newName, callback) {
  chrome.storage.local.get('palettes', ({ palettes = {} }) => {
    if (!palettes[oldName] || palettes[newName]) {
      if (callback) callback(false);
      return;
    }

    palettes[newName] = palettes[oldName];
    delete palettes[oldName];

    chrome.storage.local.set({ palettes }, () => {
      if (callback) callback(true);
    });
  });
}

/**
 * Remove a color from a palette
 * @param {string} paletteName - Name of palette
 * @param {string} color - Color to remove
 * @param {Function} callback - Callback with success boolean
 */
function removeFromPalette(paletteName, color, callback) {
  chrome.storage.local.get('palettes', ({ palettes = {} }) => {
    if (!palettes[paletteName]) {
      if (callback) callback(false);
      return;
    }

    palettes[paletteName] = palettes[paletteName].filter(c => c !== color);

    chrome.storage.local.set({ palettes }, () => {
      if (callback) callback(true);
    });
  });
}

/**
 * Get a specific palette
 * @param {string} paletteName - Name of palette
 * @param {Function} callback - Callback with palette array or null
 */
function getPalette(paletteName, callback) {
  chrome.storage.local.get('palettes', ({ palettes = {} }) => {
    callback(palettes[paletteName] || null);
  });
}
