/**
 * Web Design Ruler Content Script (Chrome Build)
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

  // ============================================================================
  // COLOR PICKER TOOL
  // ============================================================================

  /**
   * Activate color picker using EyeDropper API (Chrome/Edge)
   * This provides true screen-wide color picking including images
   */
  async function activateColorPickerEyeDropper() {
    log('[WDR] Activating color picker with EyeDropper API');

    // Mutual exclusion with the fallback tools: without this, the native
    // dropper can stack on top of an active measure/font/picker session.
    if (activeToolCleanup) activeToolCleanup();

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

      // Copy to clipboard; the toast reports the actual result
      const copied = await copyToClipboard(color);
      showColorPickedToast(color, copied);

    } catch (error) {
      if (error.name === 'AbortError') {
        log('[WDR] EyeDropper cancelled by user');
        // The background set the ● badge on activation; without this it
        // stays lit forever after the user cancels the native dropper.
        safeSend({ action: 'toolCancelled' });
      } else {
        console.error('[WDR] EyeDropper error:', error);
        safeSend({ action: 'toolCancelled' });
        // The native dropper failed to open (e.g. no transient user
        // activation) — give the user the in-page picker instead.
        activateColorPickerFallback();
      }
    }
  }

  /**
   * Show a brief toast notification for picked color
   * @param {string} color - HEX color
   */
  function showColorPickedToast(color, copied) {
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
    const checkSpan = createElement('span', { color: copied ? COLORS.success : '#F59E0B', fontSize: '20px' });
    checkSpan.textContent = copied ? '\u2713' : '\u26A0';
    const swatchSpan = createElement('span', { display: 'inline-block', width: '24px', height: '24px', backgroundColor: color, border: '2px solid white', borderRadius: '4px' });
    const labelSpan = createElement('span', {});
    labelSpan.textContent = (copied ? 'Copied: ' : 'Picked (clipboard copy failed): ') + color;
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
    let isFinishing = false; // color committed; ignore further input until the delayed cleanup runs
    let currentBgColor = null;
    let currentTextColor = null;
    let currentPixelColor = null; // For image/canvas/video
    let currentSource = 'element'; // 'element', 'image', 'canvas', 'video'
    let rafId = null;
    let lastMoveEvent = null;
    let pickerCanvas = null;
    let pickerCanvasEl = null;
    let pickerCanvasKey = null;
    // Media elements whose pixels we cannot read (cross-origin taint):
    // remembered so we don't re-probe and re-warn on every mousemove.
    const taintedMedia = new WeakSet();

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
        if (taintedMedia.has(element)) return null;

        // Backing (natural) pixel dimensions. Bail while the media is not
        // ready: an undecoded IMG or a VIDEO without a decoded frame draws
        // nothing, and getImageData would report transparent black as #000000.
        let backingW = 0, backingH = 0;
        if (element.tagName === 'IMG') {
          if (!element.complete || !(element.naturalWidth > 0)) return null;
          backingW = element.naturalWidth;
          backingH = element.naturalHeight;
        } else if (element.tagName === 'CANVAS') {
          backingW = element.width;
          backingH = element.height;
        } else { // VIDEO
          if (element.readyState < 2 || !(element.videoWidth > 0)) return null;
          backingW = element.videoWidth;
          backingH = element.videoHeight;
        }
        if (!backingW || !backingH) return null;

        const cs = window.getComputedStyle(element);
        const borderLeft = parseFloat(cs.borderLeftWidth) || 0;
        const borderTop = parseFloat(cs.borderTopWidth) || 0;
        const paddingLeft = parseFloat(cs.paddingLeft) || 0;
        const paddingTop = parseFloat(cs.paddingTop) || 0;
        const paddingRight = parseFloat(cs.paddingRight) || 0;
        const paddingBottom = parseFloat(cs.paddingBottom) || 0;

        // Content box: clientWidth/Height include padding but not borders.
        const contentW = element.clientWidth - paddingLeft - paddingRight;
        const contentH = element.clientHeight - paddingTop - paddingBottom;
        if (contentW <= 0 || contentH <= 0) return null;

        // Cursor position within the content box; padding/border strips show
        // background rather than media pixels.
        const contentX = relX - borderLeft - paddingLeft;
        const contentY = relY - borderTop - paddingTop;
        if (contentX < 0 || contentY < 0 || contentX >= contentW || contentY >= contentH) return null;

        // Rectangle the media is actually drawn into (object-fit), using the
        // backing dimensions as the natural size.
        let fit = cs.objectFit || 'fill';
        if (fit === 'scale-down') {
          fit = (backingW <= contentW && backingH <= contentH) ? 'none' : 'contain';
        }
        let drawnW, drawnH;
        if (fit === 'contain' || fit === 'cover') {
          const s = fit === 'contain'
            ? Math.min(contentW / backingW, contentH / backingH)
            : Math.max(contentW / backingW, contentH / backingH);
          drawnW = backingW * s;
          drawnH = backingH * s;
        } else if (fit === 'none') {
          drawnW = backingW;
          drawnH = backingH;
        } else { // fill (and anything unrecognized)
          drawnW = contentW;
          drawnH = contentH;
        }

        // Computed object-position resolves to two lengths/percentages:
        // percentages distribute the leftover space, px values are offsets.
        const posParts = (cs.objectPosition || '50% 50%').split(/\s+/);
        const offsetFor = (part, leftover) => {
          if (!part) return leftover / 2;
          return part.endsWith('%') ? (parseFloat(part) / 100) * leftover : (parseFloat(part) || 0);
        };
        const drawnX = offsetFor(posParts[0], contentW - drawnW);
        const drawnY = offsetFor(posParts[1], contentH - drawnH);

        // Outside the drawn media (contain/none letterboxing) the element's
        // background shows through — let the caller fall back to it.
        if (contentX < drawnX || contentY < drawnY || contentX >= drawnX + drawnW || contentY >= drawnY + drawnH) return null;

        const srcKey = element.tagName === 'IMG' ? (element.currentSrc || element.src || '') : '';
        const key = element.clientWidth + 'x' + element.clientHeight + '_' + backingW + 'x' + backingH + '_' + srcKey;
        // Cache is valid only for the SAME element with unchanged dimensions/source;
        // canvas and video frames change over time, so those are redrawn every sample.
        if (pickerCanvasEl !== element || pickerCanvasKey !== key) {
          pickerCanvas = document.createElement('canvas');
          pickerCanvas.width = backingW;
          pickerCanvas.height = backingH;
          pickerCanvas.getContext('2d').drawImage(element, 0, 0, pickerCanvas.width, pickerCanvas.height);
          pickerCanvasEl = element;
          pickerCanvasKey = key;
        } else if (element.tagName !== 'IMG') {
          const redrawCtx = pickerCanvas.getContext('2d');
          // Clear first: an animated canvas with transparent regions would
          // otherwise blend the previous frame into this sample.
          redrawCtx.clearRect(0, 0, pickerCanvas.width, pickerCanvas.height);
          redrawCtx.drawImage(element, 0, 0, pickerCanvas.width, pickerCanvas.height);
        }

        const ctx = pickerCanvas.getContext('2d');
        const sx = Math.min(backingW - 1, Math.max(0, Math.floor((contentX - drawnX) * (backingW / drawnW))));
        const sy = Math.min(backingH - 1, Math.max(0, Math.floor((contentY - drawnY) * (backingH / drawnH))));
        const pixel = ctx.getImageData(sx, sy, 1, 1).data;
        return '#' + [pixel[0], pixel[1], pixel[2]].map(v => {
          const hex = v.toString(16);
          return hex.length === 1 ? '0' + hex : hex;
        }).join('').toUpperCase();
      } catch (error) {
        taintedMedia.add(element);
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
      if (!isActive || isFinishing || !lastMoveEvent) return;

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
      isFinishing = true;
      log('[WDR] Color picked:', selectedColor, 'label:', colorLabel, 'from:', currentSource);

      // Notify background script (single-writer: background handles storage)
      safeSend({
        action: 'colorPicked',
        color: selectedColor
      });

      // Copy to clipboard, then show a confirmation that reflects the result
      copyToClipboard(selectedColor).then((copied) => {
        const confirmCheck = createElement('span', { color: copied ? COLORS.success : '#F59E0B', fontSize: '20px' });
        confirmCheck.textContent = copied ? '\u2713' : '\u26A0';
        const confirmText = createElement('span', {});
        confirmText.textContent = (copied ? 'Copied ' : 'Copy failed \u2014 picked ') + colorLabel + ': ' + selectedColor;
        panel.replaceChildren(confirmCheck, confirmText);
      });

      setTimeout(cleanup, 1000);
    }

    function onClick(e) {
      if (!isActive || isFinishing) return;

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
      if (!isActive || isFinishing) return;
      e.preventDefault();
      e.stopPropagation();
      if (currentTextColor) {
        selectColor(currentTextColor, 'text');
      }
    }

    function onKeyDown(e) {
      if (e.key === 'Escape' && isActive) {
        log('[WDR] Color picker cancelled');
        cleanup('cancelled');
      }
    }

    // Wheel/keyboard scrolling moves the page under a stationary cursor:
    // re-resolve the hovered element (client coordinates stay viewport-valid).
    function onScroll() {
      if (!isActive || isFinishing || !lastMoveEvent) return;
      if (!rafId) rafId = requestAnimationFrame(processMove);
    }

    function cleanup(reason) {
      if (!isActive) return;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
      activeToolCleanup = null;
      isActive = false;
      if (reason === 'cancelled') safeSend({ action: 'toolCancelled' });

      document.removeEventListener('mousemove', onMouseMove, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('contextmenu', onContextMenu, true);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('scroll', onScroll, true);

      document.body.style.cursor = originalCursor;
      document.body.style.userSelect = originalUserSelect;

      if (panel.parentNode) {
        panel.parentNode.removeChild(panel);
      }

      pickerCanvas = null;
      pickerCanvasEl = null;
      pickerCanvasKey = null;

      log('[WDR] Color picker cleanup complete');
    }

    activeToolCleanup = cleanup;

    // Use capture phase to ensure we get the events first
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('contextmenu', onContextMenu, true);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
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
    let isFinishing = false; // font committed; ignore further input until the delayed cleanup runs
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

      // A "web font" is one the page provides via @font-face: the page's
      // FontFaceSet lists CSS-connected faces only, never system fonts.
      // This must run here, in the page document — the popup's FontFaceSet
      // knows nothing about the inspected page.
      let isWebFont = false;
      try {
        if (document.fonts) {
          for (const face of document.fonts) {
            // CSS font-family matching is case-insensitive; compare likewise.
            if (face.status === 'loaded' && face.family.replace(/^["']|["']$/g, '').toLowerCase() === renderedFont.toLowerCase()) {
              isWebFont = true;
              break;
            }
          }
        }
      } catch (e) { /* FontFaceSet unavailable — leave false */ }

      return {
        fontFamily: renderedFont,
        isWebFont: isWebFont,
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
      if (!isActive || isFinishing || !lastMoveEvent) return;

      const e = lastMoveEvent;
      const element = document.elementFromPoint(e.clientX, e.clientY);
      if (!element || element === panel || panel.contains(element) || (highlightBox && highlightBox.contains(element))) return;
      if (element === highlightedElement) return;

      highlightedElement = element;
      createHighlight(element);
      updatePanel(element);
    }

    function onClick(e) {
      if (!isActive || isFinishing || !highlightedElement) return;

      e.preventDefault();
      e.stopPropagation();

      isFinishing = true;

      const details = getFontDetails(highlightedElement);
      log('[WDR] Font detected:', details);

      safeSend({ action: 'fontDetected', fontDetails: details });

      // Copy CSS to clipboard; the sub-line reports the actual result
      const fontConfirmWrap = createElement('div', { textAlign: 'center', padding: '20px' });
      const fontConfirmCheck = createElement('div', { color: COLORS.success, fontSize: '28px' });
      fontConfirmCheck.textContent = '\u2713';
      const fontConfirmTitle = createElement('div', { fontWeight: '600', marginTop: '8px' });
      fontConfirmTitle.textContent = 'Font Selected!';
      const fontConfirmSub = createElement('div', { color: '#9CA3AF', fontSize: '12px', marginTop: '4px' });
      copyToClipboard(details.css).then((copied) => {
        fontConfirmSub.textContent = copied ? 'CSS copied to clipboard' : 'Clipboard copy failed \u2014 font saved';
      });
      fontConfirmWrap.replaceChildren(fontConfirmCheck, fontConfirmTitle, fontConfirmSub);
      panel.replaceChildren(fontConfirmWrap);

      setTimeout(cleanup, 1500);
    }

    function onKeyDown(e) {
      if (e.key === 'Escape' && isActive) {
        cleanup('cancelled');
      }
    }

    // Wheel/keyboard scrolling moves the page under a stationary cursor: the
    // fixed-position highlight would drift off its element. Clear the identity
    // early-return and re-resolve at the same client coordinates.
    function onScroll() {
      if (!isActive || isFinishing || !lastMoveEvent) return;
      highlightedElement = null;
      if (!rafId) rafId = requestAnimationFrame(processMove);
    }

    function cleanup(reason) {
      if (!isActive) return;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
      activeToolCleanup = null;
      isActive = false;
      if (reason === 'cancelled') safeSend({ action: 'toolCancelled' });

      document.removeEventListener('mousemove', onMouseMove, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('scroll', onScroll, true);

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
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
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
    let isFinishing = false; // measurement committed; ignore further input until the delayed cleanup runs
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
      if (!isActive || isFinishing) return;
      if (e.button !== 0) return; // left button only: a right-click must not start (or commit) a measurement
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
      if (e.button !== 0) return; // releases of other buttons don't end the drag

      isDrawing = false;
      isFinishing = true;
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
        cleanup('cancelled');
      }
    }

    function onKeyUp(e) {
      if (e.key === 'Shift') { shiftHeld = false; }
    }

    // Swallow the native context menu while measuring (capture phase so the
    // page never sees it); the guard above already keeps right-clicks from
    // becoming measurements.
    function onContextMenu(e) {
      if (!isActive) return;
      e.preventDefault();
      e.stopPropagation();
    }

    function cleanup(reason) {
      if (!isActive) return;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
      activeToolCleanup = null;
      isActive = false;
      if (reason === 'cancelled') safeSend({ action: 'toolCancelled' });

      overlay.removeEventListener('mousedown', onMouseDown);
      overlay.removeEventListener('mousemove', onMouseMove);
      overlay.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mouseup', onMouseUp);
      document.documentElement.removeEventListener('mouseleave', onMouseLeave);
      document.removeEventListener('contextmenu', onContextMenu, true);
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
    document.addEventListener('contextmenu', onContextMenu, true);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('keyup', onKeyUp, true);
  }

  // ============================================================================
  // COPY ALL COLORS TOOL
  // ============================================================================

  // Computed styles serialize real colors as rgb()/rgba(); a bare-hex branch
  // could only ever match url(...) fragments (e.g. "sprite.svg#fad") and
  // produced false-positive "colors" the background then rejected.
  const COLOR_TOKEN_RE = /rgba?\([^)]+\)/g;

  function showCollectionToast(count, copied) {
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
    const checkSpan = createElement('span', { color: copied ? COLORS.success : '#F59E0B', fontSize: '20px' });
    checkSpan.textContent = copied ? '\u2713' : '\u26A0';
    const labelSpan = createElement('span', {});
    labelSpan.textContent = copied
      ? 'Copied ' + count + ' colors as CSS custom properties'
      : 'Clipboard copy failed \u2014 ' + count + ' colors saved to palette';
    toast.replaceChildren(checkSpan, labelSpan);
    document.body.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 2500);
  }

  async function collectPageColors() {
    log('[WDR] Collecting page colors');
    const colors = new Set();
    const MAX_ELEMENTS = 5000;
    const MAX_COLORS = 64;
    const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'META', 'LINK', 'TITLE', 'NOSCRIPT', 'TEMPLATE']);

    function addRaw(raw) {
      if (!raw || raw === 'none' || raw === 'initial' || raw === 'inherit' || raw === 'unset'
        || raw === 'transparent' || raw === 'rgba(0, 0, 0, 0)') return;
      const hex = rgbToHex(raw);
      if (hex) colors.add(hex);
    }

    function extractTokens(value) {
      if (!value || value === 'none') return;
      const matches = value.match(COLOR_TOKEN_RE);
      if (!matches) return;
      for (const m of matches) addRaw(m);
    }

    // Seed with the root elements — the page's own background usually lives
    // on html/body and background-color does not inherit to descendants —
    // then scan body content only: head/script/style nodes have no rendered
    // colors and would otherwise burn the element budget before real content.
    const elements = document.body
      ? [document.documentElement, document.body, ...document.body.querySelectorAll('*')]
      : [];
    let count = 0;
    for (const el of elements) {
      if (count >= MAX_ELEMENTS) break;
      if (colors.size >= MAX_COLORS) break;
      if (SKIP_TAGS.has(el.tagName)) continue;
      if (typeof el.checkVisibility === 'function' && !el.checkVisibility()) continue;
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
    const copied = await copyToClipboard(cssText);

    showCollectionToast(result.length, copied);

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
