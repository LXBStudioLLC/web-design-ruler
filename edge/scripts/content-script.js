/**
 * Web Design Ruler Content Script (Edge Build)
 * Version: 2.0.0
 *
 * Provides color picking, font detection, and measurement tools
 * with proper cleanup, error handling, and duplicate injection protection.
 * Includes enhanced color picker with EyeDropper API and image support.
 */

// Prevent duplicate injection
if (window.__WDR_CONTENT_SCRIPT_LOADED__) {
  console.log('[WDR] Content script already loaded, skipping initialization');
} else {
  window.__WDR_CONTENT_SCRIPT_LOADED__ = true;

  let _debug = false;
  try { chrome.storage.local.get('settings', (data) => { _debug = (data.settings && data.settings.debugLogging) || false; }); } catch {}
  function log(...args) { if (_debug) console.log(...args); }

  log('[WDR] Content script loaded:', window.location.href);

  // ============================================================================
  // CONSTANTS
  // ============================================================================
  const Z_INDEX_MAX = 2147483647;
  const COLORS = {
    primary: '#2563EB',
    success: '#10B981',
    overlay: 'rgba(0, 0, 0, 0.9)',
    overlayLight: 'rgba(37, 99, 235, 0.1)'
  };

  let activeToolCleanup = null;

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  /**
   * Convert RGB/RGBA color string to HEX
   * @param {string} rgb - RGB or RGBA color string
   * @returns {string} - HEX color string
   */
  let _colorCanvas = null;
  function rgbToHex(rgb) {
    if (!rgb) return '#000000';
    if (rgb.startsWith('#')) return rgb.toUpperCase();

    try {
      const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
      if (match) {
        const r = parseInt(match[1], 10);
        const g = parseInt(match[2], 10);
        const b = parseInt(match[3], 10);

        return '#' + [r, g, b].map(x => {
          const hex = x.toString(16);
          return hex.length === 1 ? '0' + hex : hex;
        }).join('').toUpperCase();
      }

      if (!_colorCanvas) _colorCanvas = document.createElement('canvas');
      _colorCanvas.width = 1; _colorCanvas.height = 1;
      const ctx = _colorCanvas.getContext('2d');
      ctx.fillStyle = rgb;
      ctx.fillRect(0, 0, 1, 1);
      const pixel = ctx.getImageData(0, 0, 1, 1).data;
      return '#' + [pixel[0], pixel[1], pixel[2]].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
    } catch (error) {
      console.error('[WDR] RGB to HEX conversion error:', error);
      return '#000000';
    }
  }

  /**
   * Create a styled element
   * @param {string} tag - HTML tag name
   * @param {Object} styles - CSS styles object
   * @returns {HTMLElement}
   */
  function createElement(tag, styles) {
    const el = document.createElement(tag);
    Object.assign(el.style, styles);
    return el;
  }

  /**
   * Copy text to clipboard using modern API with fallback
   * @param {string} text - Text to copy
   * @returns {Promise<boolean>}
   */
  async function copyToClipboard(text) {
    try {
      // Try modern Clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (error) {
      console.warn('[WDR] Clipboard API failed, trying fallback:', error);
    }

    // Fallback to execCommand
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
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

  /**
   * Get background color of an element, traversing up the DOM if transparent
   * @param {HTMLElement} element - Starting element
   * @returns {string} - Background color
   */
  function getBackgroundColor(element) {
    let current = element;
    let maxIterations = 20;

    while (current && maxIterations > 0) {
      const style = window.getComputedStyle(current);
      const bgColor = style.backgroundColor;

      if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
        return bgColor;
      }

      current = current.parentElement;
      maxIterations--;
    }

    return 'rgb(255, 255, 255)'; // Default to white
  }

  /**
   * Get text/font color from an element
   * @param {Element} element - DOM element
   * @returns {string} - RGB color string
   */
  function getTextColor(element) {
    const style = window.getComputedStyle(element);
    return style.color || 'rgb(0, 0, 0)';
  }

  /**
   * Check if EyeDropper API is available
   * @returns {boolean}
   */
  function hasEyeDropperAPI() {
    return typeof window.EyeDropper !== 'undefined';
  }

  function extAlive() { try { return !!(chrome.runtime && chrome.runtime.id); } catch { return false; } }
  function safeSend(msg) { if (!extAlive()) return; try { chrome.runtime.sendMessage(msg, () => void chrome.runtime.lastError); } catch (e) { console.warn('[WDR] sendMessage failed:', e.message); } }

  /**
   * Get color from image at specific coordinates using canvas
   * @param {HTMLImageElement} img - Image element
   * @param {number} x - X coordinate relative to image
   * @param {number} y - Y coordinate relative to image
   * @returns {string|null} - HEX color or null if failed
   */
  function getColorFromImage(img, x, y) {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;

      ctx.drawImage(img, 0, 0);

      const rect = img.getBoundingClientRect();
      const cs = window.getComputedStyle(img);
      const borderLeft = parseFloat(cs.borderLeftWidth) || 0;
      const borderTop = parseFloat(cs.borderTopWidth) || 0;
      const paddingLeft = parseFloat(cs.paddingLeft) || 0;
      const paddingTop = parseFloat(cs.paddingTop) || 0;
      const contentX = x - borderLeft - paddingLeft;
      const contentY = y - borderTop - paddingTop;
      if (img.clientWidth === 0 || img.clientHeight === 0) return null;
      const scaleX = canvas.width / img.clientWidth;
      const scaleY = canvas.height / img.clientHeight;
      const scaledX = Math.floor(contentX * scaleX);
      const scaledY = Math.floor(contentY * scaleY);

      const pixel = ctx.getImageData(scaledX, scaledY, 1, 1).data;

      return '#' + [pixel[0], pixel[1], pixel[2]].map(v => {
        const hex = v.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      }).join('').toUpperCase();
    } catch (error) {
      // Cross-origin images will throw SecurityError
      console.warn('[WDR] Cannot read image pixels (likely cross-origin):', error.message);
      return null;
    }
  }

  /**
   * Get color from canvas element at specific coordinates
   * @param {HTMLCanvasElement} canvas - Canvas element
   * @param {number} x - X coordinate relative to canvas
   * @param {number} y - Y coordinate relative to canvas
   * @returns {string|null} - HEX color or null if failed
   */
  function getColorFromCanvas(canvas, x, y) {
    try {
      const ctx = canvas.getContext('2d');
      const rect = canvas.getBoundingClientRect();
      const cs = window.getComputedStyle(canvas);
      const borderLeft = parseFloat(cs.borderLeftWidth) || 0;
      const borderTop = parseFloat(cs.borderTopWidth) || 0;
      const paddingLeft = parseFloat(cs.paddingLeft) || 0;
      const paddingTop = parseFloat(cs.paddingTop) || 0;
      const contentX = x - borderLeft - paddingLeft;
      const contentY = y - borderTop - paddingTop;
      if (canvas.clientWidth === 0 || canvas.clientHeight === 0) return null;
      const scaleX = canvas.width / canvas.clientWidth;
      const scaleY = canvas.height / canvas.clientHeight;
      const scaledX = Math.floor(contentX * scaleX);
      const scaledY = Math.floor(contentY * scaleY);

      const pixel = ctx.getImageData(scaledX, scaledY, 1, 1).data;

      return '#' + [pixel[0], pixel[1], pixel[2]].map(v => {
        const hex = v.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      }).join('').toUpperCase();
    } catch (error) {
      console.warn('[WDR] Cannot read canvas pixels:', error.message);
      return null;
    }
  }

  /**
   * Get color from video element at specific coordinates
   * @param {HTMLVideoElement} video - Video element
   * @param {number} x - X coordinate relative to video
   * @param {number} y - Y coordinate relative to video
   * @returns {string|null} - HEX color or null if failed
   */
  function getColorFromVideo(video, x, y) {
    try {
      if (video.videoWidth === 0) return null;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      canvas.width = video.videoWidth || video.clientWidth;
      canvas.height = video.videoHeight || video.clientHeight;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const rect = video.getBoundingClientRect();
      const cs = window.getComputedStyle(video);
      const borderLeft = parseFloat(cs.borderLeftWidth) || 0;
      const borderTop = parseFloat(cs.borderTopWidth) || 0;
      const paddingLeft = parseFloat(cs.paddingLeft) || 0;
      const paddingTop = parseFloat(cs.paddingTop) || 0;
      const contentX = x - borderLeft - paddingLeft;
      const contentY = y - borderTop - paddingTop;
      if (video.clientWidth === 0 || video.clientHeight === 0) return null;
      const scaleX = canvas.width / video.clientWidth;
      const scaleY = canvas.height / video.clientHeight;
      const scaledX = Math.floor(contentX * scaleX);
      const scaledY = Math.floor(contentY * scaleY);

      const pixel = ctx.getImageData(scaledX, scaledY, 1, 1).data;

      return '#' + [pixel[0], pixel[1], pixel[2]].map(v => {
        const hex = v.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      }).join('').toUpperCase();
    } catch (error) {
      console.warn('[WDR] Cannot read video pixels:', error.message);
      return null;
    }
  }

  // ============================================================================
  // COLOR PICKER TOOL
  // ============================================================================

  /**
   * Activate color picker using EyeDropper API (Chrome/Edge)
   * This provides true screen-wide color picking including images
   */
  async function activateColorPickerEyeDropper() {
    log('[WDR] Activating color picker with EyeDropper API');

    try {
      const eyeDropper = new EyeDropper();
      const result = await eyeDropper.open();

      const color = result.sRGBHex.toUpperCase();
      log('[WDR] Color picked via EyeDropper:', color);

      // Notify background script (single-writer: background handles storage)
      safeSend({
        action: 'colorPicked',
        color: color
      });

      // Copy to clipboard
      await copyToClipboard(color);

      // Show brief confirmation toast
      showColorPickedToast(color);

    } catch (error) {
      if (error.name === 'AbortError') {
        log('[WDR] EyeDropper cancelled by user');
      } else {
        console.error('[WDR] EyeDropper error:', error);
      }
    }
  }

  /**
   * Show a brief toast notification for picked color
   * @param {string} color - HEX color
   */
  function showColorPickedToast(color) {
    const toast = createElement('div', {
      position: 'fixed',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: COLORS.overlay,
      color: 'white',
      padding: '12px 20px',
      borderRadius: '8px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '14px',
      zIndex: Z_INDEX_MAX,
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    });
    const checkSpan = createElement('span', { color: COLORS.success, fontSize: '20px' });
    checkSpan.textContent = '\u2713';
    const swatchSpan = createElement('span', { display: 'inline-block', width: '24px', height: '24px', backgroundColor: color, border: '2px solid white', borderRadius: '4px' });
    const labelSpan = createElement('span', {});
    labelSpan.textContent = 'Copied: ' + color;
    toast.replaceChildren(checkSpan, swatchSpan, labelSpan);
    document.body.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 2000);
  }

  /**
   * Fallback color picker for browsers without EyeDropper API
   * Enhanced with image/canvas/video support and dual color detection (background + text)
   */
  function activateColorPickerFallback() {
    log('[WDR] Activating color picker (fallback mode with image support)');

    if (activeToolCleanup) activeToolCleanup();

    // Store original body styles
    const originalCursor = document.body.style.cursor;
    const originalUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'crosshair';
    document.body.style.userSelect = 'none';

    let isActive = true;
    let currentBgColor = null;
    let currentTextColor = null;
    let currentPixelColor = null; // For image/canvas/video
    let currentSource = 'element'; // 'element', 'image', 'canvas', 'video'
    let rafId = null;
    let lastMoveEvent = null;
    let pickerCanvas = null;
    let pickerCanvasKey = null;

    // Create display panel
    const panel = createElement('div', {
      position: 'fixed',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: COLORS.overlay,
      color: 'white',
      padding: '12px 20px',
      borderRadius: '8px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '14px',
      zIndex: Z_INDEX_MAX,
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      pointerEvents: 'none'
    });

    const initSpan = createElement('span', {});
    initSpan.textContent = 'Hover any element. Click = background color, right-click = text color. ESC to cancel.';

    const pixelContainer = createElement('div', { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' });
    pixelContainer.dataset.colorType = 'pixel';
    pixelContainer.title = 'Click to select pixel color';
    pixelContainer.style.display = 'none';
    const pixelSwatch = createElement('span', { display: 'inline-block', width: '28px', height: '28px', border: '2px solid white', borderRadius: '4px', boxShadow: '0 0 0 1px rgba(0,0,0,0.2)' });
    const pixelInfo = createElement('div', {});
    const pixelHex = createElement('div', { fontFamily: 'monospace', fontSize: '14px', fontWeight: '600' });
    const pixelLabel = createElement('div', { fontSize: '10px', color: '#9CA3AF' });
    pixelInfo.replaceChildren(pixelHex, pixelLabel);
    pixelContainer.replaceChildren(pixelSwatch, pixelInfo);

    const bgContainer = createElement('div', { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', transition: 'background 0.2s' });
    bgContainer.dataset.colorType = 'bg';
    bgContainer.title = 'Click to select background color';
    bgContainer.style.display = 'none';
    const bgSwatch = createElement('span', { display: 'inline-block', width: '28px', height: '28px', border: '2px solid white', borderRadius: '4px', boxShadow: '0 0 0 1px rgba(0,0,0,0.2)' });
    const bgInfo = createElement('div', {});
    const bgHex = createElement('div', { fontFamily: 'monospace', fontSize: '14px', fontWeight: '600' });
    const bgLabel = createElement('div', { fontSize: '10px', color: '#9CA3AF' });
    bgLabel.textContent = 'background';
    bgInfo.replaceChildren(bgHex, bgLabel);
    bgContainer.replaceChildren(bgSwatch, bgInfo);

    const divider = createElement('div', { width: '1px', height: '36px', background: 'rgba(255,255,255,0.3)' });
    divider.style.display = 'none';

    const textContainer = createElement('div', { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', transition: 'background 0.2s' });
    textContainer.dataset.colorType = 'text';
    textContainer.title = 'Click to select text color';
    textContainer.style.display = 'none';
    const textSwatch = createElement('span', { display: 'inline-block', width: '28px', height: '28px', border: '2px solid white', borderRadius: '4px', boxShadow: '0 0 0 1px rgba(0,0,0,0.2)' });
    const textInfo = createElement('div', {});
    const textHex = createElement('div', { fontFamily: 'monospace', fontSize: '14px', fontWeight: '600' });
    const textLabel = createElement('div', { fontSize: '10px', color: '#9CA3AF' });
    textLabel.textContent = 'text';
    textInfo.replaceChildren(textHex, textLabel);
    textContainer.replaceChildren(textSwatch, textInfo);

    panel.replaceChildren(initSpan, pixelContainer, bgContainer, divider, textContainer);
    document.body.appendChild(panel);

    function sampleMediaPixel(element, relX, relY) {
      try {
        const key = element.tagName + '_' + element.clientWidth + 'x' + element.clientHeight;
        if (pickerCanvasKey !== key) {
          pickerCanvas = document.createElement('canvas');
          const drawCtx = pickerCanvas.getContext('2d');
          if (element.tagName === 'IMG') {
            pickerCanvas.width = element.naturalWidth || element.width;
            pickerCanvas.height = element.naturalHeight || element.height;
            drawCtx.drawImage(element, 0, 0);
          } else if (element.tagName === 'CANVAS') {
            pickerCanvas.width = element.width;
            pickerCanvas.height = element.height;
            drawCtx.drawImage(element, 0, 0);
          } else if (element.tagName === 'VIDEO') {
            pickerCanvas.width = element.videoWidth || element.clientWidth;
            pickerCanvas.height = element.videoHeight || element.clientHeight;
            drawCtx.drawImage(element, 0, 0, pickerCanvas.width, pickerCanvas.height);
          }
          pickerCanvasKey = key;
        } else if (element.tagName === 'VIDEO') {
          const drawCtx = pickerCanvas.getContext('2d');
          drawCtx.drawImage(element, 0, 0, pickerCanvas.width, pickerCanvas.height);
        }

        const ctx = pickerCanvas.getContext('2d');
        const cs = window.getComputedStyle(element);
        const borderLeft = parseFloat(cs.borderLeftWidth) || 0;
        const borderTop = parseFloat(cs.borderTopWidth) || 0;
        const paddingLeft = parseFloat(cs.paddingLeft) || 0;
        const paddingTop = parseFloat(cs.paddingTop) || 0;
        const contentX = relX - borderLeft - paddingLeft;
        const contentY = relY - borderTop - paddingTop;
        if (element.clientWidth === 0 || element.clientHeight === 0) return null;
        const scaleX = pickerCanvas.width / element.clientWidth;
        const scaleY = pickerCanvas.height / element.clientHeight;
        const scaledX = Math.floor(contentX * scaleX);
        const scaledY = Math.floor(contentY * scaleY);
        const pixel = ctx.getImageData(scaledX, scaledY, 1, 1).data;
        return '#' + [pixel[0], pixel[1], pixel[2]].map(v => {
          const hex = v.toString(16);
          return hex.length === 1 ? '0' + hex : hex;
        }).join('').toUpperCase();
      } catch (error) {
        console.warn('[WDR] Cannot read media pixels (likely cross-origin):', error.message);
        return null;
      }
    }

    // Event handlers
    function onMouseMove(e) {
      if (!isActive) return;
      lastMoveEvent = e;
      if (!rafId) rafId = requestAnimationFrame(processMove);
    }

    function processMove() {
      rafId = null;
      if (!isActive || !lastMoveEvent) return;

      const e = lastMoveEvent;
      const element = document.elementFromPoint(e.clientX, e.clientY);
      if (!element || element === panel || panel.contains(element)) return;

      const rect = element.getBoundingClientRect();
      const relX = e.clientX - rect.left;
      const relY = e.clientY - rect.top;

      currentPixelColor = null;
      currentSource = 'element';

      if (element.tagName === 'IMG' || element.tagName === 'CANVAS' || element.tagName === 'VIDEO') {
        currentPixelColor = sampleMediaPixel(element, relX, relY);
        if (currentPixelColor) {
          currentSource = element.tagName === 'IMG' ? 'image' : element.tagName === 'CANVAS' ? 'canvas' : 'video';
        }
      }

      const bgColor = getBackgroundColor(element);
      currentBgColor = rgbToHex(bgColor);
      const textColor = getTextColor(element);
      currentTextColor = rgbToHex(textColor);

      panel.style.pointerEvents = 'auto';

      if (currentPixelColor && currentSource !== 'element') {
        initSpan.style.display = 'none';
        pixelContainer.style.display = 'flex';
        bgContainer.style.display = 'none';
        divider.style.display = 'none';
        textContainer.style.display = 'none';

        pixelSwatch.style.backgroundColor = currentPixelColor;
        pixelHex.textContent = currentPixelColor;
        pixelLabel.textContent = currentSource + ' pixel';
      } else {
        initSpan.style.display = 'none';
        pixelContainer.style.display = 'none';
        bgContainer.style.display = 'flex';
        divider.style.display = '';
        textContainer.style.display = 'flex';

        bgSwatch.style.backgroundColor = currentBgColor;
        bgHex.textContent = currentBgColor;
        textSwatch.style.backgroundColor = currentTextColor;
        textHex.textContent = currentTextColor;
      }
    }

    function selectColor(selectedColor, colorLabel) {
      log('[WDR] Color picked:', selectedColor, 'label:', colorLabel, 'from:', currentSource);

      // Notify background script (single-writer: background handles storage)
      safeSend({
        action: 'colorPicked',
        color: selectedColor
      });

      // Show confirmation
      const confirmCheck = createElement('span', { color: COLORS.success, fontSize: '20px' });
      confirmCheck.textContent = '\u2713';
      const confirmText = createElement('span', {});
      confirmText.textContent = 'Copied ' + colorLabel + ': ' + selectedColor;
      panel.replaceChildren(confirmCheck, confirmText);

      // Copy to clipboard
      copyToClipboard(selectedColor);

      setTimeout(cleanup, 1000);
    }

    function onClick(e) {
      if (!isActive) return;

      e.preventDefault();
      e.stopPropagation();

      // Check if click is on a color swatch in the panel (for specific color selection)
      const colorTypeElement = e.target.closest('[data-color-type]');
      if (colorTypeElement) {
        const colorType = colorTypeElement.dataset.colorType;
        let selectedColor = null;
        let colorLabel = '';

        if (colorType === 'bg' && currentBgColor) {
          selectedColor = currentBgColor;
          colorLabel = 'background';
        } else if (colorType === 'text' && currentTextColor) {
          selectedColor = currentTextColor;
          colorLabel = 'text';
        } else if (colorType === 'pixel' && currentPixelColor) {
          selectedColor = currentPixelColor;
          colorLabel = currentSource + ' pixel';
        }

        if (selectedColor) {
          selectColor(selectedColor, colorLabel);
        }
        return;
      }

      // Clicking anywhere else on the page - select primary color
      // For images/canvas/video: select pixel color
      // For regular elements: select background color
      if (currentPixelColor && currentSource !== 'element') {
        selectColor(currentPixelColor, currentSource + ' pixel');
      } else if (currentBgColor) {
        selectColor(currentBgColor, 'background');
      }
    }

    function onContextMenu(e) {
      if (!isActive) return;
      e.preventDefault();
      e.stopPropagation();
      if (currentTextColor) {
        selectColor(currentTextColor, 'text');
      }
    }

    function onKeyDown(e) {
      if (e.key === 'Escape' && isActive) {
        log('[WDR] Color picker cancelled');
        cleanup();
      }
    }

    function cleanup() {
      if (!isActive) return;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
      activeToolCleanup = null;
      isActive = false;

      document.removeEventListener('mousemove', onMouseMove, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('contextmenu', onContextMenu, true);
      document.removeEventListener('keydown', onKeyDown, true);

      document.body.style.cursor = originalCursor;
      document.body.style.userSelect = originalUserSelect;

      if (panel.parentNode) {
        panel.parentNode.removeChild(panel);
      }

      pickerCanvas = null;
      pickerCanvasKey = null;

      log('[WDR] Color picker cleanup complete');
    }

    activeToolCleanup = cleanup;

    // Use capture phase to ensure we get the events first
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('contextmenu', onContextMenu, true);
    document.addEventListener('keydown', onKeyDown, true);
  }

  /**
   * Main color picker activation
   * Uses the fallback mode by default for visual feedback panel
   * EyeDropper API can be used via activateColorPickerEyeDropper() if needed
   */
  function activateColorPicker() {
    if (extAlive()) {
      try {
        chrome.storage.local.get('settings', (data) => {
          const settings = data.settings || {};
          if (settings.useNativeEyeDropper && hasEyeDropperAPI()) {
            activateColorPickerEyeDropper();
          } else {
            activateColorPickerFallback();
          }
        });
      } catch { activateColorPickerFallback(); }
    } else {
      activateColorPickerFallback();
    }
  }

  // ============================================================================
  // FONT DETECTOR TOOL
  // ============================================================================

  function activateFontDetector() {
    log('[WDR] Activating font detector');

    if (activeToolCleanup) activeToolCleanup();

    const originalCursor = document.body.style.cursor;
    const originalUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'text';
    document.body.style.userSelect = 'none';

    let isActive = true;
    let highlightedElement = null;
    let highlightBox = null;
    let rafId = null;
    let lastMoveEvent = null;

    // Create info panel
    const panel = createElement('div', {
      position: 'fixed',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: COLORS.overlay,
      color: 'white',
      padding: '16px 20px',
      borderRadius: '8px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '13px',
      zIndex: Z_INDEX_MAX,
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
      width: '320px',
      maxWidth: '90vw'
    });
    const fontHeader = createElement('div', { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' });
    const fontIcon = createElement('span', { fontSize: '18px' });
    fontIcon.textContent = 'Aa';
    const fontTitle = createElement('span', { fontWeight: '600' });
    fontTitle.textContent = 'Font Detector';
    fontHeader.replaceChildren(fontIcon, fontTitle);

    const fontInstruction = createElement('div', { color: '#9CA3AF' });
    fontInstruction.textContent = 'Hover over text to see font details. Click to select.';

    const previewWrap = createElement('div', { padding: '10px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', marginBottom: '12px' });
    previewWrap.style.display = 'none';
    const previewText = createElement('div', { fontSize: '18px', fontWeight: '600' });
    previewWrap.replaceChildren(previewText);

    const grid = createElement('div', { display: 'grid', gridTemplateColumns: '90px 1fr', gap: '6px', fontSize: '12px' });
    grid.style.display = 'none';

    const sizeLabel = createElement('span', { color: '#9CA3AF' });
    sizeLabel.textContent = 'Size:';
    const sizeValue = createElement('span', {});

    const weightLabel = createElement('span', { color: '#9CA3AF' });
    weightLabel.textContent = 'Weight:';
    const weightValue = createElement('span', {});

    const styleLabel = createElement('span', { color: '#9CA3AF' });
    styleLabel.textContent = 'Style:';
    const styleValue = createElement('span', {});

    const colorLabel = createElement('span', { color: '#9CA3AF' });
    colorLabel.textContent = 'Color:';
    const colorValue = createElement('span', { display: 'flex', alignItems: 'center', gap: '6px' });
    const colorText = createElement('span', {});
    const colorSwatch = createElement('span', { width: '14px', height: '14px', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '2px' });
    colorValue.replaceChildren(colorText, colorSwatch);

    const lineHeightLabel = createElement('span', { color: '#9CA3AF' });
    lineHeightLabel.textContent = 'Line Height:';
    const lineHeightValue = createElement('span', {});

    grid.replaceChildren(sizeLabel, sizeValue, weightLabel, weightValue, styleLabel, styleValue, colorLabel, colorValue, lineHeightLabel, lineHeightValue);

    const fontFooter = createElement('div', { textAlign: 'center', color: '#9CA3AF', fontSize: '11px', marginTop: '12px' });
    fontFooter.textContent = 'Click to select';
    fontFooter.style.display = 'none';

    panel.replaceChildren(fontHeader, fontInstruction, previewWrap, grid, fontFooter);
    document.body.appendChild(panel);

    function createHighlight(element) {
      if (highlightBox) {
        highlightBox.remove();
      }

      const rect = element.getBoundingClientRect();
      highlightBox = createElement('div', {
        position: 'fixed',
        top: rect.top + 'px',
        left: rect.left + 'px',
        width: rect.width + 'px',
        height: rect.height + 'px',
        border: `2px solid ${COLORS.primary}`,
        backgroundColor: COLORS.overlayLight,
        borderRadius: '4px',
        zIndex: Z_INDEX_MAX - 2,
        pointerEvents: 'none'
      });
      document.body.appendChild(highlightBox);
    }

    /**
     * Detect the actual rendered font from a font-family stack
     * Uses canvas measurement to determine which font is actually rendering
     */
    function getRenderedFont(fontFamilyStack, fontWeight, fontStyle) {
      const testString = 'mmmmmmmmmmlli';
      const testSize = '72px';
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // Get baseline width with monospace (known fallback)
      ctx.font = `${fontStyle} ${fontWeight} ${testSize} monospace`;
      const baselineWidth = ctx.measureText(testString).width;

      // Parse the font family stack
      const fonts = fontFamilyStack.split(',').map(f => f.trim().replace(/['"]/g, ''));

      // System font mappings for common system font keywords
      const systemFontMap = {
        '-apple-system': 'San Francisco',
        'BlinkMacSystemFont': 'San Francisco',
        'system-ui': 'System Default',
        'Segoe UI': 'Segoe UI',
      };

      for (const font of fonts) {
        // Skip generic families
        if (['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui'].includes(font.toLowerCase())) {
          continue;
        }

        // Test if this font renders differently from baseline
        ctx.font = `${fontStyle} ${fontWeight} ${testSize} "${font}", monospace`;
        const testWidth = ctx.measureText(testString).width;

        if (Math.abs(testWidth - baselineWidth) > 1) {
          // This font is being used - return user-friendly name if it's a system font
          return systemFontMap[font] || font;
        }
      }

      // Fallback: return the first font in the stack with friendly name
      const firstFont = fonts[0];
      return systemFontMap[firstFont] || firstFont;
    }

    function getFontDetails(element) {
      const style = window.getComputedStyle(element);

      const weightNames = {
        '100': 'Thin', '200': 'Extra Light', '300': 'Light',
        '400': 'Normal', '500': 'Medium', '600': 'Semi Bold',
        '700': 'Bold', '800': 'Extra Bold', '900': 'Black'
      };

      const fontWeight = style.fontWeight;
      const fontWeightName = weightNames[fontWeight] || fontWeight;
      const fontFamilyStack = style.fontFamily;

      // Get the actual rendered font
      const renderedFont = getRenderedFont(fontFamilyStack, fontWeight, style.fontStyle);

      return {
        fontFamily: renderedFont,
        fontFamilyStack: fontFamilyStack,
        fontSize: style.fontSize,
        fontWeight: `${fontWeight} (${fontWeightName})`,
        fontStyle: style.fontStyle,
        lineHeight: style.lineHeight,
        letterSpacing: style.letterSpacing,
        color: rgbToHex(style.color),
        textTransform: style.textTransform,
        css: `font-family: ${fontFamilyStack};
font-size: ${style.fontSize};
font-weight: ${fontWeight};
font-style: ${style.fontStyle};
line-height: ${style.lineHeight};
letter-spacing: ${style.letterSpacing};
color: ${rgbToHex(style.color)};`
      };
    }

    function updatePanel(element) {
      const details = getFontDetails(element);

      fontInstruction.style.display = 'none';
      previewWrap.style.display = '';
      grid.style.display = 'grid';
      fontFooter.style.display = '';

      previewText.style.fontFamily = details.fontFamilyStack;
      previewText.textContent = details.fontFamily;

      sizeValue.textContent = details.fontSize;
      weightValue.textContent = details.fontWeight;
      styleValue.textContent = details.fontStyle;
      colorText.textContent = details.color;
      colorSwatch.style.background = details.color;
      lineHeightValue.textContent = details.lineHeight;
    }

    function onMouseMove(e) {
      if (!isActive) return;
      lastMoveEvent = e;
      if (!rafId) rafId = requestAnimationFrame(processMove);
    }

    function processMove() {
      rafId = null;
      if (!isActive || !lastMoveEvent) return;

      const e = lastMoveEvent;
      const element = document.elementFromPoint(e.clientX, e.clientY);
      if (!element || element === panel || panel.contains(element) || (highlightBox && highlightBox.contains(element))) return;
      if (element === highlightedElement) return;

      highlightedElement = element;
      createHighlight(element);
      updatePanel(element);
    }

    function onClick(e) {
      if (!isActive || !highlightedElement) return;

      e.preventDefault();
      e.stopPropagation();

      const details = getFontDetails(highlightedElement);
      log('[WDR] Font detected:', details);

      safeSend({ action: 'fontDetected', fontDetails: details });

      // Copy CSS to clipboard
      copyToClipboard(details.css);

      const fontConfirmWrap = createElement('div', { textAlign: 'center', padding: '20px' });
      const fontConfirmCheck = createElement('div', { color: COLORS.success, fontSize: '28px' });
      fontConfirmCheck.textContent = '\u2713';
      const fontConfirmTitle = createElement('div', { fontWeight: '600', marginTop: '8px' });
      fontConfirmTitle.textContent = 'Font Selected!';
      const fontConfirmSub = createElement('div', { color: '#9CA3AF', fontSize: '12px', marginTop: '4px' });
      fontConfirmSub.textContent = 'CSS copied to clipboard';
      fontConfirmWrap.replaceChildren(fontConfirmCheck, fontConfirmTitle, fontConfirmSub);
      panel.replaceChildren(fontConfirmWrap);

      setTimeout(cleanup, 1500);
    }

    function onKeyDown(e) {
      if (e.key === 'Escape' && isActive) {
        cleanup();
      }
    }

    function cleanup() {
      if (!isActive) return;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
      activeToolCleanup = null;
      isActive = false;

      document.removeEventListener('mousemove', onMouseMove, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKeyDown, true);

      document.body.style.cursor = originalCursor;
      document.body.style.userSelect = originalUserSelect;

      if (panel.parentNode) panel.remove();
      if (highlightBox) highlightBox.remove();

      log('[WDR] Font detector cleanup complete');
    }

    activeToolCleanup = cleanup;

    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
  }

  // ============================================================================
  // MEASUREMENT TOOL
  // ============================================================================

  function activateMeasureTool() {
    log('[WDR] Activating measurement tool');

    if (activeToolCleanup) activeToolCleanup();

    const originalCursor = document.body.style.cursor;
    const originalUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'crosshair';
    document.body.style.userSelect = 'none';

    let isActive = true;
    let isDrawing = false;
    let startX = 0, startY = 0, endX = 0, endY = 0;
    let rafId = null;
    let lastMoveEvent = null;
    let shiftHeld = false;

    // Create overlay to capture mouse events
    const overlay = createElement('div', {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      zIndex: Z_INDEX_MAX - 1,
      cursor: 'crosshair'
    });
    document.body.appendChild(overlay);

    // Create measurement box
    const measureBox = createElement('div', {
      position: 'fixed',
      border: `2px dashed ${COLORS.primary}`,
      backgroundColor: COLORS.overlayLight,
      zIndex: Z_INDEX_MAX - 2,
      display: 'none',
      pointerEvents: 'none'
    });
    document.body.appendChild(measureBox);

    // Create labels
    const createLabel = (color) => createElement('div', {
      position: 'fixed',
      backgroundColor: color,
      color: 'white',
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: '600',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      zIndex: Z_INDEX_MAX,
      display: 'none',
      pointerEvents: 'none'
    });

    const widthLabel = createLabel(COLORS.primary);
    const heightLabel = createLabel(COLORS.primary);
    const diagonalLabel = createLabel(COLORS.success);
    document.body.appendChild(widthLabel);
    document.body.appendChild(heightLabel);
    document.body.appendChild(diagonalLabel);

    // Create info panel
    const panel = createElement('div', {
      position: 'fixed',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: COLORS.overlay,
      color: 'white',
      padding: '16px 20px',
      borderRadius: '8px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '13px',
      zIndex: Z_INDEX_MAX,
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
      width: '260px',
      textAlign: 'center'
    });
    const measureHeader = createElement('div', { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' });
    const measureIcon = createElement('span', { fontSize: '18px' });
    measureIcon.textContent = '\u{1F4CF}';
    const measureTitle = createElement('span', { fontWeight: '600' });
    measureTitle.textContent = 'Measurement Tool';
    measureHeader.replaceChildren(measureIcon, measureTitle);

    const measureInstruction = createElement('div', { color: '#9CA3AF' });
    measureInstruction.textContent = 'Click and drag to measure';

    const mGrid = createElement('div', { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' });
    mGrid.style.display = 'none';

    const wCell = createElement('div', {});
    const wLabel = createElement('span', { color: '#9CA3AF' });
    wLabel.textContent = 'W:';
    const wValue = createElement('span', {});
    wCell.replaceChildren(wLabel, wValue);

    const hCell = createElement('div', {});
    const hLabel = createElement('span', { color: '#9CA3AF' });
    hLabel.textContent = 'H:';
    const hValue = createElement('span', {});
    hCell.replaceChildren(hLabel, hValue);

    const dCell = createElement('div', {});
    const dLabel = createElement('span', { color: '#9CA3AF' });
    dLabel.textContent = 'D:';
    const dValue = createElement('span', {});
    dCell.replaceChildren(dLabel, dValue);

    const aCell = createElement('div', {});
    const aLabel = createElement('span', { color: '#9CA3AF' });
    aLabel.textContent = 'A:';
    const aValue = createElement('span', {});
    aCell.replaceChildren(aLabel, aValue);

    mGrid.replaceChildren(wCell, hCell, dCell, aCell);

    const mFooter = createElement('div', { color: '#9CA3AF', fontSize: '11px', marginTop: '10px' });
    mFooter.textContent = 'Release to save';
    mFooter.style.display = 'none';

    panel.replaceChildren(measureHeader, measureInstruction, mGrid, mFooter);
    document.body.appendChild(panel);

    function formatArea(a) {
      if (a > 9999) return (a / 1000).toFixed(1) + 'k';
      return String(a);
    }

    function updateMeasurement() {
      const width = Math.abs(endX - startX);
      const height = Math.abs(endY - startY);
      const diagonal = Math.round(Math.sqrt(width * width + height * height));
      const area = width * height;
      const left = Math.min(startX, endX);
      const top = Math.min(startY, endY);

      measureBox.style.display = 'block';
      measureBox.style.left = left + 'px';
      measureBox.style.top = top + 'px';
      measureBox.style.width = width + 'px';
      measureBox.style.height = height + 'px';

      widthLabel.style.display = 'block';
      widthLabel.textContent = width + 'px';
      widthLabel.style.left = Math.max(2, left + width / 2 - 20) + 'px';
      widthLabel.style.top = (top - 24 < 0 ? top + 4 : top - 24) + 'px';

      heightLabel.style.display = 'block';
      heightLabel.textContent = height + 'px';
      heightLabel.style.left = Math.max(2, left - 50) + 'px';
      heightLabel.style.top = (top + height / 2 - 10) + 'px';

      diagonalLabel.style.display = 'block';
      diagonalLabel.textContent = diagonal + 'px';
      diagonalLabel.style.left = Math.max(2, left + width / 2 - 20) + 'px';
      diagonalLabel.style.top = (top + height / 2 - 10) + 'px';

      measureInstruction.style.display = 'none';
      measureHeader.style.marginBottom = '12px';
      mGrid.style.display = 'grid';
      mFooter.style.display = '';

      wValue.textContent = ' ' + width + 'px';
      hValue.textContent = ' ' + height + 'px';
      dValue.textContent = ' ' + diagonal + 'px';
      aValue.textContent = ' ' + formatArea(area) + ' px\u00B2';
    }

    function onMouseDown(e) {
      if (!isActive) return;
      shiftHeld = e.shiftKey;
      isDrawing = true;
      let x = e.clientX;
      let y = e.clientY;
      if (shiftHeld) {
        x = Math.round(x / 10) * 10;
        y = Math.round(y / 10) * 10;
      }
      startX = endX = x;
      startY = endY = y;
      e.preventDefault();
    }

    function onMouseMove(e) {
      if (!isActive || !isDrawing) return;
      lastMoveEvent = e;
      if (!rafId) rafId = requestAnimationFrame(processMove);
    }

    function processMove() {
      rafId = null;
      if (!isActive || !isDrawing || !lastMoveEvent) return;
      shiftHeld = lastMoveEvent.shiftKey;
      let x = lastMoveEvent.clientX;
      let y = lastMoveEvent.clientY;
      if (shiftHeld) {
        x = Math.round(x / 10) * 10;
        y = Math.round(y / 10) * 10;
      }
      endX = x;
      endY = y;
      updateMeasurement();
    }

    function onMouseUp(e) {
      if (!isActive || !isDrawing) return;

      isDrawing = false;
      shiftHeld = e.shiftKey;
      let x = e.clientX;
      let y = e.clientY;
      if (shiftHeld) {
        x = Math.round(x / 10) * 10;
        y = Math.round(y / 10) * 10;
      }
      endX = x;
      endY = y;
      updateMeasurement();

      const width = Math.abs(endX - startX);
      const height = Math.abs(endY - startY);
      const measurements = {
        width: width,
        height: height,
        diagonal: Math.round(Math.sqrt(width * width + height * height)),
        area: width * height
      };

      log('[WDR] Measurement taken:', measurements);

      safeSend({ action: 'measurementTaken', measurements });

      const savedWrap = createElement('div', { textAlign: 'center', padding: '15px' });
      const savedCheck = createElement('div', { color: COLORS.success, fontSize: '28px' });
      savedCheck.textContent = '\u2713';
      const savedTitle = createElement('div', { fontWeight: '600', marginTop: '8px' });
      savedTitle.textContent = 'Saved!';
      const savedMeasurements = createElement('div', { fontSize: '14px', marginTop: '8px' });
      savedMeasurements.textContent = measurements.width + ' x ' + measurements.height + ' px \u2014 ' + formatArea(measurements.area) + ' px\u00B2';
      savedWrap.replaceChildren(savedCheck, savedTitle, savedMeasurements);
      panel.replaceChildren(savedWrap);

      setTimeout(cleanup, 1500);
    }

    function onKeyDown(e) {
      if (e.key === 'Shift') { shiftHeld = true; return; }
      if (e.key === 'Escape' && isActive) {
        cleanup();
      }
    }

    function onKeyUp(e) {
      if (e.key === 'Shift') { shiftHeld = false; }
    }

    function cleanup() {
      if (!isActive) return;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
      activeToolCleanup = null;
      isActive = false;

      overlay.removeEventListener('mousedown', onMouseDown);
      overlay.removeEventListener('mousemove', onMouseMove);
      overlay.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mouseup', onMouseUp);
      document.documentElement.removeEventListener('mouseleave', onMouseLeave);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('keyup', onKeyUp, true);

      document.body.style.cursor = originalCursor;
      document.body.style.userSelect = originalUserSelect;

      [overlay, measureBox, widthLabel, heightLabel, diagonalLabel, panel].forEach(el => {
        if (el && el.parentNode) el.remove();
      });

      log('[WDR] Measurement tool cleanup complete');
    }

    activeToolCleanup = cleanup;

    overlay.addEventListener('mousedown', onMouseDown);
    overlay.addEventListener('mousemove', onMouseMove);
    overlay.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mouseup', onMouseUp);
    function onMouseLeave(e) {
      if (!isActive || !isDrawing) return;
      onMouseUp(e);
    }
    document.documentElement.addEventListener('mouseleave', onMouseLeave);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('keyup', onKeyUp, true);
  }

  // ============================================================================
  // COPY ALL COLORS TOOL
  // ============================================================================

  const COLOR_TOKEN_RE = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b|rgba?\([^)]+\)/g;

  function showCollectionToast(count) {
    const toast = createElement('div', {
      position: 'fixed',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: COLORS.overlay,
      color: 'white',
      padding: '12px 20px',
      borderRadius: '8px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '14px',
      zIndex: Z_INDEX_MAX,
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    });
    const checkSpan = createElement('span', { color: COLORS.success, fontSize: '20px' });
    checkSpan.textContent = '\u2713';
    const labelSpan = createElement('span', {});
    labelSpan.textContent = 'Copied ' + count + ' colors as CSS custom properties';
    toast.replaceChildren(checkSpan, labelSpan);
    document.body.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 2500);
  }

  async function collectPageColors() {
    log('[WDR] Collecting page colors');
    const colors = new Set();
    const MAX_ELEMENTS = 500;
    const MAX_COLORS = 64;

    function addRaw(raw) {
      if (!raw) return;
      if (raw === 'none' || raw === 'initial' || raw === 'inherit' || raw === 'unset') return;
      if ((!raw) || (raw === 'transparent') || (raw === 'rgba(0, 0, 0, 0)')) return;
      const hex = rgbToHex(raw);
      if (hex) colors.add(hex);
    }

    function extractTokens(value) {
      if (!value || value === 'none') return;
      const matches = value.match(COLOR_TOKEN_RE);
      if (!matches) return;
      for (const m of matches) addRaw(m);
    }

    const elements = document.querySelectorAll('*');
    let count = 0;
    for (const el of elements) {
      if (count >= MAX_ELEMENTS) break;
      if (colors.size >= MAX_COLORS) break;
      count++;

      const style = window.getComputedStyle(el);
      addRaw(style.color);
      addRaw(style.backgroundColor);
      addRaw(style.borderTopColor);
      addRaw(style.borderRightColor);
      addRaw(style.borderBottomColor);
      addRaw(style.borderLeftColor);
      extractTokens(style.backgroundImage);
      extractTokens(style.boxShadow);
      extractTokens(style.textShadow);
    }

    const result = Array.from(colors).slice(0, MAX_COLORS);

    const cssText = result.map((c, i) => '--color-' + (i + 1) + ': ' + c + ';').join('\n');
    await copyToClipboard(cssText);

    showCollectionToast(result.length);

    safeSend({
      action: 'pageColorsCollected',
      colors: result,
      hostname: location.hostname
    });

    log('[WDR] Page colors collected:', result.length);
  }

  // ============================================================================
  // MESSAGE HANDLER
  // ============================================================================

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    log('[WDR] Content script received:', message.action);

    switch (message.action) {
      case 'ping':
        sendResponse({ pong: true });
        return false;

      case 'activateColorPicker':
        activateColorPicker();
        sendResponse({ success: true });
        return false;

      case 'activateFontDetector':
        activateFontDetector();
        sendResponse({ success: true });
        return false;

      case 'activateMeasureTool':
        activateMeasureTool();
        sendResponse({ success: true });
        return false;

      case 'copyAllColors':
        collectPageColors();
        sendResponse({ success: true });
        return false;

      default:
        return false;
    }
  });

  log('[WDR] Content script initialization complete');
}
