/**
 * Web Design Ruler - Popup Script
 * Version: 2.2.0
 *
 * Handles popup UI interactions and communication with background script
 */

let _debug = false;
chrome.storage.local.get('settings', (data) => { _debug = (data.settings && data.settings.debugLogging) || false; });
function log(...args) { if (_debug) console.log(...args); }

// Global state
let currentPaletteName = null;
let palettes = {};
let removeColorTarget = null;
let deletePaletteTimer = null; // module scope so displayPalette can clear a stale confirm
let contrastFg = null;
let contrastBg = '#FFFFFF';
let armedSlot = null;

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  log('[WDR] Popup loaded');
  document.querySelector('.version').textContent = 'v' + chrome.runtime.getManifest().version;

  initializeTabs();
  initializeToolButtons();
  initializeCopyButtons();
  initializePalettes();
  initializeContrast();
  document.getElementById('toggle-saved-fonts').setAttribute('aria-expanded', 'true');
  document.getElementById('toggle-saved-fonts').addEventListener('click', () => {
    const list = document.getElementById('saved-fonts-list');
    const btn = document.getElementById('toggle-saved-fonts');
    list.classList.toggle('collapsed');
    const collapsed = list.classList.contains('collapsed');
    btn.textContent = collapsed ? '\u25B6' : '\u25BC';
    btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    // The dynamically inserted 'Show all' button sits outside the ul;
    // hide it together with the collapsed list.
    const showAll = document.getElementById('show-all-fonts');
    if (showAll) showAll.style.display = collapsed ? 'none' : '';
  });

  document.getElementById('copy-css-export').addEventListener('click', () => {
    chrome.storage.local.get(['lastPickedColor', 'lastDetectedFont', 'lastMeasurement'], (data) => {
      let snippet = '/* Web Design Ruler export */\n';
      let hasData = false;
      if (data.lastPickedColor) {
        snippet += `color: ${data.lastPickedColor};\n`;
        hasData = true;
      }
      if (data.lastDetectedFont) {
        const fw = String(data.lastDetectedFont.fontWeight).split(' ')[0];
        snippet += `font-family: ${data.lastDetectedFont.fontFamilyStack || data.lastDetectedFont.fontFamily};\n`;
        snippet += `font-size: ${data.lastDetectedFont.fontSize};  font-weight: ${fw};  line-height: ${data.lastDetectedFont.lineHeight};\n`;
        hasData = true;
      }
      if (data.lastMeasurement) {
        snippet += `width: ${data.lastMeasurement.width}px;  height: ${data.lastMeasurement.height}px;\n`;
        hasData = true;
      }
      if (hasData) {
        copyToClipboard(snippet);
        showNotification('CSS snippet copied!', 'success');
      }
    });
  });

  const clearRecentBtn = document.getElementById('clear-recent-colors');
  let clearRecentTimer = null;
  clearRecentBtn.addEventListener('click', () => {
    if (clearRecentBtn.classList.contains('confirming')) {
      clearTimeout(clearRecentTimer);
      clearRecentBtn.classList.remove('confirming');
      clearRecentBtn.textContent = 'Clear';
      chrome.storage.local.set({ recentColors: [] }, () => {
        document.getElementById('recent-colors').classList.add('hidden');
        showNotification('Recent colors cleared', 'success');
      });
    } else {
      clearRecentBtn.classList.add('confirming');
      clearRecentBtn.textContent = 'Confirm?';
      clearRecentTimer = setTimeout(() => {
        clearRecentBtn.classList.remove('confirming');
        clearRecentBtn.textContent = 'Clear';
      }, 3000);
    }
  });

  loadStoredData();
  listenForMessages();
});

// ============================================================================
// TAB MANAGEMENT
// ============================================================================

function initializeTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabButtons.forEach(button => {
    button.setAttribute('aria-controls', button.getAttribute('data-tab') + '-tab');
    button.setAttribute('tabindex', button.classList.contains('active') ? '0' : '-1');
    button.addEventListener('click', () => {
      tabButtons.forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
        btn.setAttribute('tabindex', '-1');
      });
      tabPanes.forEach(pane => pane.classList.remove('active'));
      button.classList.add('active');
      button.setAttribute('aria-selected', 'true');
      button.setAttribute('tabindex', '0');
      const tabId = button.getAttribute('data-tab') + '-tab';
      document.getElementById(tabId).classList.add('active');
    });
  });

  document.querySelector('.tabs').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const buttons = Array.from(tabButtons);
    const currentIndex = buttons.findIndex(b => b.classList.contains('active'));
    let newIndex;
    if (e.key === 'ArrowLeft') {
      newIndex = currentIndex <= 0 ? buttons.length - 1 : currentIndex - 1;
    } else {
      newIndex = currentIndex >= buttons.length - 1 ? 0 : currentIndex + 1;
    }
    buttons[newIndex].focus();
    buttons[newIndex].click();
  });
}

// ============================================================================
// TOOL ACTIVATION
// ============================================================================

function initializeToolButtons() {
  document.getElementById('color-picker-btn').addEventListener('click', () => {
    activateTool('activateColorPicker', 'color picker');
  });

  document.getElementById('font-detector-btn').addEventListener('click', () => {
    activateTool('activateFontDetector', 'font detector');
  });

  document.getElementById('measure-tool-btn').addEventListener('click', () => {
    activateTool('activateMeasureTool', 'measurement tool');
  });
}

function activateTool(action, toolName) {
  chrome.runtime.sendMessage({ action }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('[WDR] Error:', chrome.runtime.lastError);
      showNotification(`Cannot activate ${toolName}: ${chrome.runtime.lastError.message}`, 'error');
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

function loadStoredData() {
  chrome.storage.local.get(['lastPickedColor', 'recentColors', 'lastDetectedFont', 'lastMeasurement'], (data) => {
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
    const hasExportData = !!(data.lastPickedColor || data.lastDetectedFont || data.lastMeasurement);
    document.getElementById('copy-css-export').disabled = !hasExportData;
  });

  renderSavedFonts();
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

  // Convert to other formats
  const rgb = hexToRgb(color);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  colorHex.value = color;
  colorRgb.value = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
  colorHsl.value = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;

  // Setup save to palette button
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

  document.getElementById('contrast-card').classList.remove('hidden');
  contrastFg = color;
  updateContrast();
}

function displayRecentColors(colors) {
  const section = document.getElementById('recent-colors');
  const grid = document.getElementById('recent-colors-grid');

  section.classList.remove('hidden');
  grid.innerHTML = '';

  colors.forEach(color => {
    const swatch = createColorSwatch(color);
    swatch.addEventListener('click', () => displayPickedColor(color));
    swatch.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      copyToClipboard(color);
      showNotification(color + ' copied', 'success');
    });
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

  // Set preview
  fontPreview.style.fontFamily = fontDetails.fontFamilyStack || fontDetails.fontFamily;
  fontPreview.style.fontSize = fontDetails.fontSize;
  fontPreview.style.fontWeight = String(fontDetails.fontWeight).split(' ')[0];
  fontPreview.style.fontStyle = fontDetails.fontStyle;
  fontPreview.style.color = fontDetails.color;
  fontPreview.textContent = 'The quick brown fox jumps over the lazy dog';

  // Display properties
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
    const nameSpan = document.createElement('span');
    nameSpan.className = 'property-name';
    nameSpan.textContent = prop.name + ':';
    const valueSpan = document.createElement('span');
    valueSpan.textContent = prop.value;
    li.appendChild(nameSpan);
    li.appendChild(valueSpan);
    fontProperties.appendChild(li);
  });

  // Setup buttons
  document.getElementById('copy-font-css').onclick = () => {
    if (!fontDetails.css) {
      // Legacy v1.x records have no css field; copying would paste 'undefined'
      showNotification('No CSS stored for this font', 'warning');
      return;
    }
    copyToClipboard(fontDetails.css);
    showNotification('CSS copied to clipboard!', 'success');
  };

  document.getElementById('save-font').onclick = () => {
    // isWebFont is detected in the content script against the inspected
    // page's FontFaceSet; the popup's own FontFaceSet is meaningless here.
    const isWebFont = fontDetails.isWebFont === true;
    chrome.storage.local.get('savedFonts', ({ savedFonts = [] }) => {
      savedFonts.unshift({ ...fontDetails, isWebFont, savedAt: new Date().toISOString() });
      savedFonts = savedFonts.slice(0, 50);
      chrome.storage.local.set({ savedFonts }, () => {
        showNotification('Font saved!', 'success');
        renderSavedFonts();
      });
    });
  };
}

let savedFontsExpanded = false;

function renderSavedFonts() {
  chrome.storage.local.get('savedFonts', ({ savedFonts = [] }) => {
    const container = document.getElementById('saved-fonts');
    const list = document.getElementById('saved-fonts-list');
    if (!savedFonts || savedFonts.length === 0) {
      container.classList.add('hidden');
      list.replaceChildren();
      const oldShowAll = document.getElementById('show-all-fonts');
      if (oldShowAll) oldShowAll.remove();
      return;
    }
    container.classList.remove('hidden');
    list.replaceChildren();

    const showCount = savedFontsExpanded ? savedFonts.length : 10;
    const visible = savedFonts.slice(0, showCount);

    visible.forEach((entry) => {
      const item = document.createElement('li');
      item.className = 'saved-font-item';

      const preview = document.createElement('span');
      preview.className = 'saved-font-preview';
      preview.style.fontFamily = entry.fontFamilyStack || entry.fontFamily;
      preview.style.fontSize = '15px';
      preview.textContent = 'Aa';
      preview.title = 'Click to view details';
      preview.addEventListener('click', () => displayFontDetails(entry));

      const info = document.createElement('span');
      info.className = 'font-info';
      info.textContent = entry.fontFamily + ' \u2014 ' + entry.fontSize + ' / ' + entry.fontWeight;
      info.title = 'Saved ' + new Date(entry.savedAt).toLocaleString();
      info.addEventListener('click', () => displayFontDetails(entry));

      if (entry.isWebFont) {
        const badge = document.createElement('span');
        badge.className = 'web-font-badge';
        badge.textContent = 'Web Font';
        item.appendChild(preview);
        item.appendChild(info);
        item.appendChild(badge);
      } else {
        item.appendChild(preview);
        item.appendChild(info);
      }

      const copyCssBtn = document.createElement('button');
      copyCssBtn.className = 'copy-btn saved-font-copy';
      copyCssBtn.textContent = 'CSS';
      copyCssBtn.title = 'Copy CSS';
      copyCssBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        copyToClipboard(entry.css || '');
        const original = copyCssBtn.textContent;
        copyCssBtn.textContent = 'Copied!';
        setTimeout(() => { copyCssBtn.textContent = original; }, 1000);
      });
      item.appendChild(copyCssBtn);

      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-btn';
      removeBtn.textContent = '\u00D7';
      removeBtn.setAttribute('aria-label', 'Remove saved font');
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        chrome.storage.local.get('savedFonts', ({ savedFonts = [] }) => {
          // Remove by identity, not render-time index: two rapid removals
          // would otherwise splice the wrong entry from the re-read array.
          const i = savedFonts.findIndex(f => f && f.savedAt === entry.savedAt && f.fontFamily === entry.fontFamily);
          if (i === -1) return;
          savedFonts.splice(i, 1);
          chrome.storage.local.set({ savedFonts }, () => {
            renderSavedFonts();
            showNotification('Font removed', 'success');
          });
        });
      });
      item.appendChild(removeBtn);

      list.appendChild(item);
    });

    const oldShowAll = document.getElementById('show-all-fonts');
    if (oldShowAll) oldShowAll.remove();
    if (savedFonts.length > 10) {
      const showAllBtn = document.createElement('button');
      showAllBtn.id = 'show-all-fonts';
      showAllBtn.className = 'secondary-btn full-width';
      showAllBtn.style.marginTop = '8px';
      showAllBtn.textContent = savedFontsExpanded ? 'Show less' : 'Show all (' + savedFonts.length + ')';
      showAllBtn.addEventListener('click', () => {
        savedFontsExpanded = !savedFontsExpanded;
        renderSavedFonts();
      });
      if (list.classList.contains('collapsed')) showAllBtn.style.display = 'none';
      list.insertAdjacentElement('afterend', showAllBtn);
    }
  });
}

// ============================================================================
// MEASUREMENT DISPLAY
// ============================================================================

function displayMeasurement(measurement) {
  const measureResult = document.getElementById('measure-result');
  const measureWidth = document.getElementById('measure-width');
  const measureHeight = document.getElementById('measure-height');
  const measureDiagonal = document.getElementById('measure-diagonal');
  const measureArea = document.getElementById('measure-area');
  const visual = document.getElementById('measurement-visual');

  measureResult.classList.remove('hidden');

  measureWidth.value = measurement.width;
  measureHeight.value = measurement.height;
  measureDiagonal.value = measurement.diagonal;
  if (typeof measurement.area === 'number') {
    measureArea.value = measurement.area;
  } else {
    measureArea.value = '';
  }

  // Create visual representation
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
    const createRow = document.getElementById('create-palette-row');
    const createInput = document.getElementById('create-palette-name');
    createRow.classList.remove('hidden');
    createInput.value = '';
    createInput.focus();
  });

  document.getElementById('create-palette-confirm').addEventListener('click', () => {
    const createInput = document.getElementById('create-palette-name');
    const name = createInput.value.trim();
    if (!name) return;
    createPalette(name, [], (success, reason) => {
      if (success) {
        currentPaletteName = name;
        loadPalettes(updatePaletteDisplay);
        showNotification('Palette created!', 'success');
        document.getElementById('create-palette-row').classList.add('hidden');
      } else if (reason === 'exists') {
        showNotification(`A palette named "${name}" already exists`, 'error');
      }
    });
  });

  document.getElementById('create-palette-cancel').addEventListener('click', () => {
    document.getElementById('create-palette-row').classList.add('hidden');
  });

  document.getElementById('create-palette-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('create-palette-confirm').click();
    } else if (e.key === 'Escape') {
      document.getElementById('create-palette-row').classList.add('hidden');
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
          // Trim and cap like the create-palette input (maxlength=40); a
          // whitespace-only name would collide with the selector placeholder
          // and create an unviewable, undeletable palette.
          const importName = (typeof data.name === 'string' ? data.name : '').trim().slice(0, 40);
          if (!importName) {
            showNotification('Invalid palette file', 'error');
            return;
          }
          const validatedColors = validatePaletteColors(data.colors);
          if (!validatedColors) {
            showNotification('Invalid palette file', 'error');
            return;
          }
          loadPalettes((palettes) => {
            let finalName = importName;
            if (palettes[finalName]) {
              let i = 2;
              while (palettes[`${finalName} (${i})`]) i++;
              finalName = `${finalName} (${i})`;
            }
            createPalette(finalName, validatedColors, (success, reason) => {
              if (!success) {
                // A concurrent writer can take the name between our read and
                // this write, and storage itself can fail — don't claim success.
                showNotification(reason === 'exists' ? 'A palette with that name already exists' : 'Error importing palette', 'error');
                return;
              }
              loadPalettes(updatePaletteDisplay);
              showNotification(
                finalName === importName ? 'Palette imported!' : `Imported as "${finalName}"`,
                'success'
              );
            });
          });
        } catch (error) {
          showNotification('Error importing palette', 'error');
        }
      };
      reader.readAsText(file);
      // Reset so selecting the same file again re-fires the change event
      e.target.value = '';
    }
  });

  const colorChip = document.getElementById('remove-color-chip');
  document.getElementById('remove-color-confirm').addEventListener('click', () => {
    if (removeColorTarget) {
      removeFromPalette(removeColorTarget.paletteName, removeColorTarget.color, () => {
        loadPalettes(updatePaletteDisplay);
        showNotification('Color removed', 'success');
      });
      removeColorTarget = null;
    }
    colorChip.classList.add('hidden');
  });

  document.getElementById('remove-color-cancel').addEventListener('click', () => {
    removeColorTarget = null;
    colorChip.classList.add('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!colorChip.classList.contains('hidden') && !colorChip.contains(e.target)) {
      removeColorTarget = null;
      colorChip.classList.add('hidden');
    }
  }, true);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !colorChip.classList.contains('hidden')) {
      removeColorTarget = null;
      colorChip.classList.add('hidden');
    }
  }, true);
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
      removeColorTarget = { paletteName, color };
      document.getElementById('remove-color-text').textContent = `Remove ${color}?`;
      document.getElementById('remove-color-chip').classList.remove('hidden');
    });
    colorsEl.appendChild(swatch);
  });

  // Setup palette actions
  const nameInput = document.getElementById('rename-palette-input');

  document.getElementById('edit-palette-name').onclick = () => {
    nameInput.value = paletteName;
    nameEl.classList.add('hidden');
    nameInput.classList.remove('hidden');
    nameInput.focus();
    nameInput.select();
  };

  nameInput.onkeydown = (e) => {
    if (e.key === 'Enter') {
      const newName = nameInput.value.trim();
      nameEl.classList.remove('hidden');
      nameInput.classList.add('hidden');
      if (newName && newName !== paletteName) {
        renamePalette(paletteName, newName, (success) => {
          if (success) {
            currentPaletteName = newName;
            loadPalettes(updatePaletteDisplay);
            showNotification('Palette renamed!', 'success');
          } else {
            showNotification('Could not rename palette', 'error');
          }
        });
      }
    } else if (e.key === 'Escape') {
      nameEl.classList.remove('hidden');
      nameInput.classList.add('hidden');
    }
  };

  nameInput.onblur = () => {
    nameEl.classList.remove('hidden');
    nameInput.classList.add('hidden');
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

  const deleteBtn = document.getElementById('delete-palette');
  // Reset any confirm state left by a previously displayed palette: without
  // this, switching palettes while armed lets a single click delete the
  // newly displayed palette (and the old closure's timer stays live).
  if (deletePaletteTimer) { clearTimeout(deletePaletteTimer); deletePaletteTimer = null; }
  deleteBtn.classList.remove('confirming');
  deleteBtn.textContent = 'Delete';

  deleteBtn.onclick = () => {
    if (deleteBtn.classList.contains('confirming')) {
      clearTimeout(deletePaletteTimer);
      deletePaletteTimer = null;
      deleteBtn.classList.remove('confirming');
      deleteBtn.textContent = 'Delete';
      deletePalette(paletteName, () => {
        currentPaletteName = null;
        loadPalettes(updatePaletteDisplay);
        document.getElementById('current-palette').classList.add('hidden');
        showNotification('Palette deleted', 'success');
      });
    } else {
      deleteBtn.classList.add('confirming');
      deleteBtn.textContent = 'Confirm delete?';
      deletePaletteTimer = setTimeout(() => {
        deleteBtn.classList.remove('confirming');
        deleteBtn.textContent = 'Delete';
      }, 3000);
    }
  };
}

function createColorSwatch(color) {
  const swatch = document.createElement('div');
  swatch.className = 'color-swatch-small';
  swatch.style.backgroundColor = color;
  swatch.setAttribute('data-color', color);
  swatch.setAttribute('role', 'button');
  swatch.setAttribute('aria-label', color);
  swatch.setAttribute('tabindex', '0');
  swatch.title = color;
  swatch.addEventListener('click', (e) => {
    if (armedSlot) {
      e.stopImmediatePropagation();
      if (armedSlot === 'fg') contrastFg = color;
      else contrastBg = color;
      armedSlot = null;
      document.querySelectorAll('.contrast-slot').forEach(s => s.classList.remove('armed'));
      syncArmedSlotAria();
      updateContrast();
    }
  });
  swatch.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      swatch.click();
    }
  });
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
        case 'width':
          value = document.getElementById('measure-width').value + 'px';
          break;
        case 'height':
          value = document.getElementById('measure-height').value + 'px';
          break;
        case 'diagonal':
          value = document.getElementById('measure-diagonal').value + 'px';
          break;
        case 'area': {
          // Legacy measurements may have no area; don't copy a bare unit
          const area = document.getElementById('measure-area').value;
          value = area ? area + 'px\u00B2' : '';
          break;
        }
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
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Content scripts broadcast reach the popup directly (sender.tab set)
    // AND via the background's re-forward (no sender.tab). Handle only the
    // forwarded copy — it arrives after storage is written.
    if (sender && sender.tab) return;

    log('[WDR] Popup received:', message);

    if (message.action === 'colorPicked' && message.color) {
      displayPickedColor(message.color);
      // Reload recent colors
      chrome.storage.local.get('recentColors', ({ recentColors = [] }) => {
        if (recentColors.length > 0) {
          displayRecentColors(recentColors);
        }
      });
    } else if (message.action === 'fontDetected' && message.fontDetails) {
      displayFontDetails(message.fontDetails);
    } else if (message.action === 'measurementTaken' && message.measurements) {
      displayMeasurement(message.measurements);
    }

    if ((message.action === 'colorPicked' && message.color) ||
        (message.action === 'fontDetected' && message.fontDetails) ||
        (message.action === 'measurementTaken' && message.measurements)) {
      // Exportable data just arrived while the popup is open
      document.getElementById('copy-css-export').disabled = false;
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
    console.warn('[WDR] Clipboard API failed:', error);
  }

  // Fallback
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
    console.error('[WDR] Clipboard fallback failed:', error);
    return false;
  }
}

function showNotification(message, type = 'info') {
  // One toast at a time: stacked notifications render on top of each other
  // at the same fixed position, hiding the earlier message.
  document.querySelectorAll('.notification').forEach(n => n.remove());
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

function relativeLuminance(r, g, b) {
  const lin = (c) => {
    const cs = c / 255;
    return cs <= 0.04045 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(hex1, hex2) {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  const l1 = relativeLuminance(rgb1.r, rgb1.g, rgb1.b);
  const l2 = relativeLuminance(rgb2.r, rgb2.g, rgb2.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function updateContrast() {
  if (!contrastFg || !contrastBg) return;
  const ratio = contrastRatio(contrastFg, contrastBg);
  document.getElementById('contrast-fg-swatch').style.backgroundColor = contrastFg;
  document.getElementById('contrast-bg-swatch').style.backgroundColor = contrastBg;
  // Two decimals so the readout can't show '4.5' while the raw ratio
  // (e.g. 4.46) fails the AA badge comparison right next to it.
  document.getElementById('contrast-ratio').textContent = ratio.toFixed(2);

  const badges = document.getElementById('contrast-badges');
  badges.replaceChildren();
  const checks = [
    { label: 'AA', threshold: 4.5 },
    { label: 'AA Large', threshold: 3.0 },
    { label: 'AAA', threshold: 7.0 },
    { label: 'AAA Large', threshold: 4.5 }
  ];
  checks.forEach(c => {
    const badge = document.createElement('span');
    badge.className = 'contrast-badge ' + (ratio >= c.threshold ? 'pass' : 'fail');
    badge.textContent = c.label;
    badges.appendChild(badge);
  });
}

function syncArmedSlotAria() {
  document.querySelectorAll('.contrast-slot').forEach(s => {
    s.setAttribute('aria-pressed', s.classList.contains('armed') ? 'true' : 'false');
  });
}

function initializeContrast() {
  syncArmedSlotAria();
  document.getElementById('contrast-fg').addEventListener('click', () => {
    const slot = document.getElementById('contrast-fg');
    if (armedSlot === 'fg') {
      armedSlot = null;
      slot.classList.remove('armed');
    } else {
      armedSlot = 'fg';
      document.querySelectorAll('.contrast-slot').forEach(s => s.classList.remove('armed'));
      slot.classList.add('armed');
    }
    syncArmedSlotAria();
  });
  document.getElementById('contrast-bg').addEventListener('click', () => {
    const slot = document.getElementById('contrast-bg');
    if (armedSlot === 'bg') {
      armedSlot = null;
      slot.classList.remove('armed');
    } else {
      armedSlot = 'bg';
      document.querySelectorAll('.contrast-slot').forEach(s => s.classList.remove('armed'));
      slot.classList.add('armed');
    }
    syncArmedSlotAria();
  });
}
