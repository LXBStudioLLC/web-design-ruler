/**
 * Web Design Ruler - Popup Script (Firefox Build)
 * Version: 2.0.0
 *
 * Uses browser.* namespace with Promises for Firefox
 * Note: browserAPI is defined in palette.js which loads first
 */

let currentPaletteName = null;
let palettes = {};

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('[WDR-Firefox] Popup loaded, initializing...');

  try {
    console.log('[WDR-Firefox] Initializing tabs...');
    initializeTabs();

    console.log('[WDR-Firefox] Initializing tool buttons...');
    initializeToolButtons();

    console.log('[WDR-Firefox] Initializing copy buttons...');
    initializeCopyButtons();

    console.log('[WDR-Firefox] Initializing palettes...');
    initializePalettes();

    console.log('[WDR-Firefox] Loading stored data...');
    loadStoredData();

    console.log('[WDR-Firefox] Setting up message listener...');
    listenForMessages();

    console.log('[WDR-Firefox] Initialization complete!');
  } catch (error) {
    console.error('[WDR-Firefox] Initialization error:', error);
  }
});

// ============================================================================
// TAB MANAGEMENT
// ============================================================================

function initializeTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      tabButtons.forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
      });
      tabPanes.forEach(pane => pane.classList.remove('active'));

      button.classList.add('active');
      button.setAttribute('aria-selected', 'true');

      const tabId = button.getAttribute('data-tab') + '-tab';
      document.getElementById(tabId).classList.add('active');
    });
  });
}

// ============================================================================
// TOOL ACTIVATION
// ============================================================================

function initializeToolButtons() {
  const colorBtn = document.getElementById('color-picker-btn');
  const fontBtn = document.getElementById('font-detector-btn');
  const measureBtn = document.getElementById('measure-tool-btn');

  console.log('[WDR-Firefox] Found buttons:', { colorBtn, fontBtn, measureBtn });

  if (colorBtn) {
    colorBtn.addEventListener('click', (e) => {
      console.log('[WDR-Firefox] Color picker button clicked!', e);
      activateTool('activateColorPicker', 'color picker');
    });
  } else {
    console.error('[WDR-Firefox] Color picker button not found!');
  }

  if (fontBtn) {
    fontBtn.addEventListener('click', (e) => {
      console.log('[WDR-Firefox] Font detector button clicked!', e);
      activateTool('activateFontDetector', 'font detector');
    });
  } else {
    console.error('[WDR-Firefox] Font detector button not found!');
  }

  if (measureBtn) {
    measureBtn.addEventListener('click', (e) => {
      console.log('[WDR-Firefox] Measure tool button clicked!', e);
      activateTool('activateMeasureTool', 'measurement tool');
    });
  } else {
    console.error('[WDR-Firefox] Measure tool button not found!');
  }
}

function activateTool(action, toolName) {
  console.log('[WDR-Firefox] Activating tool:', action);

  browserAPI.runtime.sendMessage({ action }, (response) => {
    console.log('[WDR-Firefox] Tool activation response:', response);

    if (browserAPI.runtime.lastError) {
      console.error('[WDR-Firefox] Runtime error:', browserAPI.runtime.lastError);
      showNotification(`Cannot activate ${toolName}: ${browserAPI.runtime.lastError.message}`, 'error');
      return;
    }

    if (response && response.success) {
      window.close();
    } else if (response && response.error) {
      showNotification(response.error, 'error');
    } else {
      showNotification(`Cannot activate ${toolName}. Try refreshing the page.`, 'error');
    }
  });
}

// ============================================================================
// DATA LOADING
// ============================================================================

async function loadStoredData() {
  try {
    const data = await browserAPI.storage.local.get([
      'lastPickedColor', 'recentColors', 'lastDetectedFont', 'lastMeasurement'
    ]);

    if (data.lastPickedColor) {
      displayPickedColor(data.lastPickedColor);
    }
    if (data.recentColors && data.recentColors.length > 0) {
      displayRecentColors(data.recentColors);
    }
    if (data.lastDetectedFont) {
      displayFontDetails(data.lastDetectedFont);
    }
    if (data.lastMeasurement) {
      displayMeasurement(data.lastMeasurement);
    }
  } catch (error) {
    console.error('[WDR-Firefox] loadStoredData error:', error);
  }
}

// ============================================================================
// COLOR DISPLAY
// ============================================================================

function displayPickedColor(color) {
  const colorResult = document.getElementById('color-result');
  const colorSwatch = document.getElementById('color-swatch');
  const colorHex = document.getElementById('color-hex');
  const colorRgb = document.getElementById('color-rgb');
  const colorHsl = document.getElementById('color-hsl');

  colorResult.classList.remove('hidden');
  colorSwatch.style.backgroundColor = color;

  const rgb = hexToRgb(color);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  colorHex.value = color;
  colorRgb.value = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
  colorHsl.value = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;

  document.getElementById('save-to-palette').onclick = () => {
    if (currentPaletteName) {
      saveToPalette(currentPaletteName, color, () => {
        loadPalettes(updatePaletteDisplay);
        showNotification('Color saved to palette!', 'success');
      });
    } else {
      showNotification('Please select or create a palette first', 'warning');
      document.querySelector('[data-tab="palettes"]').click();
    }
  };
}

function displayRecentColors(colors) {
  const section = document.getElementById('recent-colors');
  const grid = document.getElementById('recent-colors-grid');

  section.classList.remove('hidden');
  grid.innerHTML = '';

  colors.forEach(color => {
    const swatch = createColorSwatch(color);
    swatch.addEventListener('click', () => displayPickedColor(color));
    grid.appendChild(swatch);
  });
}

// ============================================================================
// FONT DISPLAY
// ============================================================================

function displayFontDetails(fontDetails) {
  const fontResult = document.getElementById('font-result');
  const fontPreview = document.getElementById('font-preview');
  const fontProperties = document.getElementById('font-properties');

  fontResult.classList.remove('hidden');

  fontPreview.style.fontFamily = fontDetails.fontFamily;
  fontPreview.style.fontSize = fontDetails.fontSize;
  fontPreview.style.fontWeight = fontDetails.fontWeight.split(' ')[0];
  fontPreview.style.fontStyle = fontDetails.fontStyle;
  fontPreview.style.color = fontDetails.color;
  fontPreview.textContent = 'The quick brown fox jumps over the lazy dog';

  fontProperties.innerHTML = '';
  const properties = [
    { name: 'Font Family', value: fontDetails.fontFamily.replace(/['"]/g, '').split(',')[0].trim() },
    { name: 'Size', value: fontDetails.fontSize },
    { name: 'Weight', value: fontDetails.fontWeight },
    { name: 'Style', value: fontDetails.fontStyle },
    { name: 'Line Height', value: fontDetails.lineHeight },
    { name: 'Color', value: fontDetails.color }
  ];

  properties.forEach(prop => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="property-name">${prop.name}:</span><span>${prop.value}</span>`;
    fontProperties.appendChild(li);
  });

  document.getElementById('copy-font-css').onclick = () => {
    copyToClipboard(fontDetails.css);
    showNotification('CSS copied to clipboard!', 'success');
  };

  document.getElementById('save-font').onclick = async () => {
    try {
      const { savedFonts = [] } = await browserAPI.storage.local.get('savedFonts');
      savedFonts.unshift({ ...fontDetails, savedAt: new Date().toISOString() });
      await browserAPI.storage.local.set({ savedFonts: savedFonts.slice(0, 50) });
      showNotification('Font saved!', 'success');
    } catch (error) {
      showNotification('Error saving font', 'error');
    }
  };
}

// ============================================================================
// MEASUREMENT DISPLAY
// ============================================================================

function displayMeasurement(measurement) {
  const measureResult = document.getElementById('measure-result');
  const measureWidth = document.getElementById('measure-width');
  const measureHeight = document.getElementById('measure-height');
  const measureDiagonal = document.getElementById('measure-diagonal');
  const visual = document.getElementById('measurement-visual');

  measureResult.classList.remove('hidden');

  measureWidth.value = measurement.width;
  measureHeight.value = measurement.height;
  measureDiagonal.value = measurement.diagonal;

  visual.innerHTML = '';
  const containerWidth = 320;
  const containerHeight = 100;

  const scale = Math.min(
    (containerWidth - 40) / measurement.width,
    (containerHeight - 40) / measurement.height,
    1
  );

  const scaledWidth = Math.max(measurement.width * scale, 20);
  const scaledHeight = Math.max(measurement.height * scale, 20);

  const box = document.createElement('div');
  box.style.cssText = `
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: ${scaledWidth}px;
    height: ${scaledHeight}px;
    border: 2px solid #2563EB;
    background: rgba(37, 99, 235, 0.1);
    border-radius: 4px;
  `;
  visual.appendChild(box);
}

// ============================================================================
// PALETTE MANAGEMENT
// ============================================================================

function initializePalettes() {
  loadPalettes(updatePaletteDisplay);

  document.getElementById('create-palette').addEventListener('click', () => {
    const name = prompt('Enter palette name:');
    if (name && name.trim()) {
      createPalette(name.trim(), [], () => {
        currentPaletteName = name.trim();
        loadPalettes(updatePaletteDisplay);
        showNotification('Palette created!', 'success');
      });
    }
  });

  document.getElementById('palette-selector').addEventListener('change', (e) => {
    currentPaletteName = e.target.value;
    if (currentPaletteName) {
      displayPalette(currentPaletteName);
    } else {
      document.getElementById('current-palette').classList.add('hidden');
    }
  });

  document.getElementById('import-btn').addEventListener('click', () => {
    document.getElementById('import-palette').click();
  });

  document.getElementById('import-palette').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          if (data.name && Array.isArray(data.colors)) {
            createPalette(data.name, data.colors, () => {
              loadPalettes(updatePaletteDisplay);
              showNotification('Palette imported!', 'success');
            });
          } else {
            showNotification('Invalid palette file', 'error');
          }
        } catch (error) {
          showNotification('Error importing palette', 'error');
        }
      };
      reader.readAsText(file);
    }
  });
}

function updatePaletteDisplay(loadedPalettes) {
  palettes = loadedPalettes;
  const selector = document.getElementById('palette-selector');

  selector.innerHTML = '<option value="">Select a palette...</option>';

  Object.keys(palettes).forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    selector.appendChild(option);
  });

  if (currentPaletteName && palettes[currentPaletteName]) {
    selector.value = currentPaletteName;
    displayPalette(currentPaletteName);
  }
}

function displayPalette(paletteName) {
  const palette = palettes[paletteName];
  if (!palette) return;

  const container = document.getElementById('current-palette');
  const nameEl = document.getElementById('palette-name');
  const colorsEl = document.getElementById('palette-colors');

  container.classList.remove('hidden');
  nameEl.textContent = paletteName;
  colorsEl.innerHTML = '';

  palette.forEach(color => {
    const swatch = createColorSwatch(color);
    swatch.addEventListener('click', () => displayPickedColor(color));
    swatch.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (confirm(`Remove ${color} from palette?`)) {
        removeFromPalette(paletteName, color, () => {
          loadPalettes(updatePaletteDisplay);
          showNotification('Color removed', 'success');
        });
      }
    });
    colorsEl.appendChild(swatch);
  });

  document.getElementById('edit-palette-name').onclick = () => {
    const newName = prompt('Enter new palette name:', paletteName);
    if (newName && newName.trim() && newName !== paletteName) {
      renamePalette(paletteName, newName.trim(), (success) => {
        if (success) {
          currentPaletteName = newName.trim();
          loadPalettes(updatePaletteDisplay);
          showNotification('Palette renamed!', 'success');
        } else {
          showNotification('Could not rename palette', 'error');
        }
      });
    }
  };

  document.getElementById('export-palette').onclick = () => {
    const data = { name: paletteName, colors: palette };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${paletteName.replace(/[^a-z0-9]/gi, '_')}_palette.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('Palette exported!', 'success');
  };

  document.getElementById('delete-palette').onclick = () => {
    if (confirm(`Delete palette "${paletteName}"?`)) {
      deletePalette(paletteName, () => {
        currentPaletteName = null;
        loadPalettes(updatePaletteDisplay);
        document.getElementById('current-palette').classList.add('hidden');
        showNotification('Palette deleted', 'success');
      });
    }
  };
}

function createColorSwatch(color) {
  const swatch = document.createElement('div');
  swatch.className = 'color-swatch-small';
  swatch.style.backgroundColor = color;
  swatch.setAttribute('data-color', color);
  swatch.title = color;
  return swatch;
}

// ============================================================================
// COPY FUNCTIONALITY
// ============================================================================

function initializeCopyButtons() {
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const valueType = this.getAttribute('data-value');
      let value = '';

      switch(valueType) {
        case 'hex':
          value = document.getElementById('color-hex').value;
          break;
        case 'rgb':
          value = document.getElementById('color-rgb').value;
          break;
        case 'hsl':
          value = document.getElementById('color-hsl').value;
          break;
      }

      if (value) {
        copyToClipboard(value);
        const originalText = this.textContent;
        this.textContent = 'Copied!';
        setTimeout(() => {
          this.textContent = originalText;
        }, 1000);
      }
    });
  });
}

// ============================================================================
// MESSAGE LISTENER
// ============================================================================

function listenForMessages() {
  browserAPI.runtime.onMessage.addListener((message) => {
    console.log('[WDR-Firefox] Popup received:', message);

    if (message.action === 'colorPicked' && message.color) {
      displayPickedColor(message.color);
      browserAPI.storage.local.get('recentColors').then(({ recentColors = [] }) => {
        if (recentColors.length > 0) {
          displayRecentColors(recentColors);
        }
      });
    } else if (message.action === 'fontDetected' && message.fontDetails) {
      displayFontDetails(message.fontDetails);
    } else if (message.action === 'measurementTaken' && message.measurements) {
      displayMeasurement(message.measurements);
    }
  });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (error) {
    console.warn('[WDR-Firefox] Clipboard API failed:', error);
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.cssText = 'position:fixed;left:-9999px;';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch (error) {
    console.error('[WDR-Firefox] Clipboard fallback failed:', error);
    return false;
  }
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideDown 0.3s ease';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }

    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}
