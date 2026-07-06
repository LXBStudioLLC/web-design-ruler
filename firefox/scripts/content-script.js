/**
 * Web Design Ruler Content Script (Firefox Build)
 * Version: 2.0.0
 *
 * FIREFOX-SPECIFIC: Uses browser.* namespace where available
 * Includes enhanced color picker with image/canvas/video support
 */

// Prevent duplicate injection
if (window.__WDR_CONTENT_SCRIPT_LOADED__) {
  console.log('[WDR-Firefox] Content script already loaded, skipping');
} else {
  window.__WDR_CONTENT_SCRIPT_LOADED__ = true;

  console.log('[WDR-Firefox] Content script loaded:', window.location.href);

  // Firefox compatibility - use browser.* if available, with robust detection
  let browserAPI;
  if (typeof browser !== 'undefined' && browser.runtime) {
    browserAPI = browser;
  } else if (typeof chrome !== 'undefined' && chrome.runtime) {
    browserAPI = chrome;
  } else {
    console.error('[WDR-Firefox] No browser API found in content script!');
  }

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
      console.error('[WDR-Firefox] RGB to HEX conversion error:', error);
      return '#000000';
    }
  }

  function createElement(tag, styles) {
    const el = document.createElement(tag);
    Object.assign(el.style, styles);
    return el;
  }

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
      textarea.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
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

    return 'rgb(255, 255, 255)';
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

  function extAlive() { try { return !!(browserAPI.runtime && browserAPI.runtime.id); } catch { return false; } }
  function safeSend(msg) { if (!extAlive()) return; try { browserAPI.runtime.sendMessage(msg).catch(() => {}); } catch (e) { console.warn('[WDR-Firefox] sendMessage failed:', e.message); } }

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
      console.warn('[WDR-Firefox] Cannot read image pixels (likely cross-origin):', error.message);
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
      console.warn('[WDR-Firefox] Cannot read canvas pixels:', error.message);
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
      console.warn('[WDR-Firefox] Cannot read video pixels:', error.message);
      return null;
    }
  }

  // ============================================================================
  // COLOR PICKER TOOL
  // ============================================================================

  function activateColorPicker() {
    console.log('[WDR-Firefox] Activating color picker (fallback mode with image support)');

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
    initSpan.textContent = 'Hover over any element. Click to pick background, or click swatches below. ESC to cancel.';

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
        console.warn('[WDR-Firefox] Cannot read media pixels (likely cross-origin):', error.message);
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
      console.log('[WDR-Firefox] Color picked:', selectedColor, 'label:', colorLabel, 'from:', currentSource);

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

    function onKeyDown(e) {
      if (e.key === 'Escape' && isActive) {
        console.log('[WDR-Firefox] Color picker cancelled');
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

      if (panel.parentNode) {
        panel.parentNode.removeChild(panel);
      }

      pickerCanvas = null;
      pickerCanvasKey = null;

      console.log('[WDR-Firefox] Color picker cleanup complete');
    }

    activeToolCleanup = cleanup;

    // Use capture phase to ensure we get the events first
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
  }

  // ============================================================================
  // FONT DETECTOR TOOL
  // ============================================================================

  function activateFontDetector() {
    console.log('[WDR-Firefox] Activating font detector');

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
      if (highlightBox) highlightBox.remove();

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
      safeSend({ action: 'fontDetected', fontDetails: details });

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
      if (e.key === 'Escape' && isActive) cleanup();
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

      console.log('[WDR-Firefox] Font detector cleanup complete');
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
    console.log('[WDR-Firefox] Activating measurement tool');

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

    const measureBox = createElement('div', {
      position: 'fixed',
      border: `2px dashed ${COLORS.primary}`,
      backgroundColor: COLORS.overlayLight,
      zIndex: Z_INDEX_MAX - 2,
      display: 'none',
      pointerEvents: 'none'
    });
    document.body.appendChild(measureBox);

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

    const mGrid = createElement('div', { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '12px' });
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

    mGrid.replaceChildren(wCell, hCell, dCell);

    const mFooter = createElement('div', { color: '#9CA3AF', fontSize: '11px', marginTop: '10px' });
    mFooter.textContent = 'Release to save';
    mFooter.style.display = 'none';

    panel.replaceChildren(measureHeader, measureInstruction, mGrid, mFooter);
    document.body.appendChild(panel);

    function updateMeasurement() {
      const width = Math.abs(endX - startX);
      const height = Math.abs(endY - startY);
      const diagonal = Math.round(Math.sqrt(width * width + height * height));
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
    }

    function onMouseDown(e) {
      if (!isActive) return;
      isDrawing = true;
      startX = endX = e.clientX;
      startY = endY = e.clientY;
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
      endX = lastMoveEvent.clientX;
      endY = lastMoveEvent.clientY;
      updateMeasurement();
    }

    function onMouseUp(e) {
      if (!isActive || !isDrawing) return;

      isDrawing = false;
      endX = e.clientX;
      endY = e.clientY;
      updateMeasurement();

      const measurements = {
        width: Math.abs(endX - startX),
        height: Math.abs(endY - startY),
        diagonal: Math.round(Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2)))
      };

      safeSend({ action: 'measurementTaken', measurements });

      const savedWrap = createElement('div', { textAlign: 'center', padding: '15px' });
      const savedCheck = createElement('div', { color: COLORS.success, fontSize: '28px' });
      savedCheck.textContent = '\u2713';
      const savedTitle = createElement('div', { fontWeight: '600', marginTop: '8px' });
      savedTitle.textContent = 'Saved!';
      const savedMeasurements = createElement('div', { fontSize: '14px', marginTop: '8px' });
      savedMeasurements.textContent = measurements.width + ' x ' + measurements.height + ' px';
      savedWrap.replaceChildren(savedCheck, savedTitle, savedMeasurements);
      panel.replaceChildren(savedWrap);

      setTimeout(cleanup, 1500);
    }

    function onKeyDown(e) {
      if (e.key === 'Escape' && isActive) cleanup();
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

      document.body.style.cursor = originalCursor;
      document.body.style.userSelect = originalUserSelect;

      [overlay, measureBox, widthLabel, heightLabel, diagonalLabel, panel].forEach(el => {
        if (el && el.parentNode) el.remove();
      });

      console.log('[WDR-Firefox] Measurement tool cleanup complete');
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
  }

  // ============================================================================
  // MESSAGE HANDLER
  // ============================================================================

  browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[WDR-Firefox] Content script received:', message.action);

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

      default:
        return false;
    }
  });

  console.log('[WDR-Firefox] Content script initialization complete');
}
