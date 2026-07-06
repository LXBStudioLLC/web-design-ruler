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

  function rgbToHex(rgb) {
    if (!rgb) return '#000000';
    if (rgb.startsWith('#')) return rgb.toUpperCase();

    try {
      const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
      if (!match) return '#000000';

      const r = parseInt(match[1], 10);
      const g = parseInt(match[2], 10);
      const b = parseInt(match[3], 10);

      return '#' + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      }).join('').toUpperCase();
    } catch (error) {
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

      // Scale coordinates if image is displayed at different size
      const scaleX = canvas.width / img.clientWidth;
      const scaleY = canvas.height / img.clientHeight;
      const scaledX = Math.floor(x * scaleX);
      const scaledY = Math.floor(y * scaleY);

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
      const scaleX = canvas.width / canvas.clientWidth;
      const scaleY = canvas.height / canvas.clientHeight;
      const scaledX = Math.floor(x * scaleX);
      const scaledY = Math.floor(y * scaleY);

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
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      canvas.width = video.videoWidth || video.clientWidth;
      canvas.height = video.videoHeight || video.clientHeight;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const scaleX = canvas.width / video.clientWidth;
      const scaleY = canvas.height / video.clientHeight;
      const scaledX = Math.floor(x * scaleX);
      const scaledY = Math.floor(y * scaleY);

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
    console.log('[WDR-Firefox] Activating color picker with image support and dual color detection');

    if (activeToolCleanup) activeToolCleanup();

    const originalCursor = document.body.style.cursor;
    const originalUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'crosshair';
    document.body.style.userSelect = 'none';

    let isActive = true;
    let currentBgColor = null;
    let currentTextColor = null;
    let currentPixelColor = null; // For image/canvas/video
    let currentSource = 'element'; // 'element', 'image', 'canvas', 'video'

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
    panel.innerHTML = '<span>Hover over any element. Click to pick background, or click swatches below. ESC to cancel.</span>';
    document.body.appendChild(panel);

    function onMouseMove(e) {
      if (!isActive) return;

      const element = document.elementFromPoint(e.clientX, e.clientY);
      if (!element || element === panel || panel.contains(element)) return;

      // Get element bounds for relative coordinates
      const rect = element.getBoundingClientRect();
      const relX = e.clientX - rect.left;
      const relY = e.clientY - rect.top;

      currentPixelColor = null;
      currentSource = 'element';

      // Try to get pixel color for media elements
      if (element.tagName === 'IMG') {
        currentPixelColor = getColorFromImage(element, relX, relY);
        currentSource = 'image';
      } else if (element.tagName === 'CANVAS') {
        currentPixelColor = getColorFromCanvas(element, relX, relY);
        currentSource = 'canvas';
      } else if (element.tagName === 'VIDEO') {
        currentPixelColor = getColorFromVideo(element, relX, relY);
        currentSource = 'video';
      }

      // Always get background and text colors for regular elements
      const bgColor = getBackgroundColor(element);
      currentBgColor = rgbToHex(bgColor);
      const textColor = getTextColor(element);
      currentTextColor = rgbToHex(textColor);

      // Build panel content based on element type
      if (currentPixelColor && currentSource !== 'element') {
        // For media elements, show pixel color
        const sourceLabel = currentSource === 'image' ? 'image' :
                           currentSource === 'canvas' ? 'canvas' :
                           currentSource === 'video' ? 'video' : '';
        panel.style.pointerEvents = 'auto';
        panel.innerHTML = `
          <div style="display:flex;align-items:center;gap:8px;cursor:pointer;" data-color-type="pixel" title="Click to select pixel color">
            <span style="display:inline-block;width:28px;height:28px;background-color:${currentPixelColor};border:2px solid white;border-radius:4px;box-shadow:0 0 0 1px rgba(0,0,0,0.2);"></span>
            <div>
              <div style="font-family:monospace;font-size:14px;font-weight:600;">${currentPixelColor}</div>
              <div style="font-size:10px;color:#9CA3AF;">${sourceLabel} pixel</div>
            </div>
          </div>
        `;
      } else {
        // For regular elements, show both background and text colors
        panel.style.pointerEvents = 'auto';
        panel.innerHTML = `
          <div style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:4px 8px;border-radius:4px;transition:background 0.2s;" data-color-type="bg" title="Click to select background color">
            <span style="display:inline-block;width:28px;height:28px;background-color:${currentBgColor};border:2px solid white;border-radius:4px;box-shadow:0 0 0 1px rgba(0,0,0,0.2);"></span>
            <div>
              <div style="font-family:monospace;font-size:14px;font-weight:600;">${currentBgColor}</div>
              <div style="font-size:10px;color:#9CA3AF;">background</div>
            </div>
          </div>
          <div style="width:1px;height:36px;background:rgba(255,255,255,0.3);"></div>
          <div style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:4px 8px;border-radius:4px;transition:background 0.2s;" data-color-type="text" title="Click to select text color">
            <span style="display:inline-block;width:28px;height:28px;background-color:${currentTextColor};border:2px solid white;border-radius:4px;box-shadow:0 0 0 1px rgba(0,0,0,0.2);"></span>
            <div>
              <div style="font-family:monospace;font-size:14px;font-weight:600;">${currentTextColor}</div>
              <div style="font-size:10px;color:#9CA3AF;">text</div>
            </div>
          </div>
        `;
      }
    }

    function selectColor(selectedColor, colorLabel) {
      console.log('[WDR-Firefox] Color picked:', selectedColor, 'label:', colorLabel, 'from:', currentSource);

      safeSend({ action: 'colorPicked', color: selectedColor });

      // Show confirmation
      panel.innerHTML = `
        <span style="color:${COLORS.success};font-size:20px;">&#10003;</span>
        <span>Copied ${colorLabel}: ${selectedColor}</span>
      `;

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
        cleanup();
      }
    }

    function cleanup() {
      if (!isActive) return;
      activeToolCleanup = null;
      isActive = false;

      document.removeEventListener('mousemove', onMouseMove, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKeyDown, true);

      document.body.style.cursor = originalCursor;
      document.body.style.userSelect = originalUserSelect;

      if (panel.parentNode) panel.remove();
    }

    activeToolCleanup = cleanup;

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
    panel.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
        <span style="font-size:18px;">Aa</span>
        <span style="font-weight:600;">Font Detector</span>
      </div>
      <div style="color:#9CA3AF;">Hover over text to see font details. Click to select.</div>
    `;
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
      const familyDisplay = details.fontFamily;

      panel.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
          <span style="font-size:18px;">Aa</span>
          <span style="font-weight:600;">Font Detector</span>
        </div>
        <div style="padding:10px;background:rgba(255,255,255,0.1);border-radius:4px;margin-bottom:12px;">
          <div style="font-family:${details.fontFamilyStack};font-size:18px;font-weight:600;">${familyDisplay}</div>
        </div>
        <div style="display:grid;grid-template-columns:90px 1fr;gap:6px;font-size:12px;">
          <span style="color:#9CA3AF;">Size:</span><span>${details.fontSize}</span>
          <span style="color:#9CA3AF;">Weight:</span><span>${details.fontWeight}</span>
          <span style="color:#9CA3AF;">Style:</span><span>${details.fontStyle}</span>
          <span style="color:#9CA3AF;">Color:</span>
          <span style="display:flex;align-items:center;gap:6px;">
            ${details.color}
            <span style="width:14px;height:14px;background:${details.color};border:1px solid rgba(255,255,255,0.3);border-radius:2px;"></span>
          </span>
          <span style="color:#9CA3AF;">Line Height:</span><span>${details.lineHeight}</span>
        </div>
        <div style="text-align:center;color:#9CA3AF;font-size:11px;margin-top:12px;">Click to select</div>
      `;
    }

    function onMouseMove(e) {
      if (!isActive) return;

      const element = document.elementFromPoint(e.clientX, e.clientY);
      if (!element || element === panel || element === highlightBox) return;
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

      panel.innerHTML = `
        <div style="text-align:center;padding:20px;">
          <div style="color:${COLORS.success};font-size:28px;">&#10003;</div>
          <div style="font-weight:600;margin-top:8px;">Font Selected!</div>
          <div style="color:#9CA3AF;font-size:12px;margin-top:4px;">CSS copied to clipboard</div>
        </div>
      `;

      setTimeout(cleanup, 1500);
    }

    function onKeyDown(e) {
      if (e.key === 'Escape' && isActive) cleanup();
    }

    function cleanup() {
      if (!isActive) return;
      activeToolCleanup = null;
      isActive = false;

      document.removeEventListener('mousemove', onMouseMove, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKeyDown, true);

      document.body.style.cursor = originalCursor;
      document.body.style.userSelect = originalUserSelect;

      if (panel.parentNode) panel.remove();
      if (highlightBox) highlightBox.remove();
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
    panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:8px;">
        <span style="font-size:18px;">&#x1F4CF;</span>
        <span style="font-weight:600;">Measurement Tool</span>
      </div>
      <div style="color:#9CA3AF;">Click and drag to measure</div>
    `;
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
      widthLabel.style.left = (left + width / 2 - 20) + 'px';
      widthLabel.style.top = (top - 24) + 'px';

      heightLabel.style.display = 'block';
      heightLabel.textContent = height + 'px';
      heightLabel.style.left = (left - 50) + 'px';
      heightLabel.style.top = (top + height / 2 - 10) + 'px';

      diagonalLabel.style.display = 'block';
      diagonalLabel.textContent = diagonal + 'px';
      diagonalLabel.style.left = (left + width / 2 - 20) + 'px';
      diagonalLabel.style.top = (top + height / 2 - 10) + 'px';

      panel.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:12px;">
          <span style="font-size:18px;">&#x1F4CF;</span>
          <span style="font-weight:600;">Measurement Tool</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;font-size:12px;">
          <div><span style="color:#9CA3AF;">W:</span> ${width}px</div>
          <div><span style="color:#9CA3AF;">H:</span> ${height}px</div>
          <div><span style="color:#9CA3AF;">D:</span> ${diagonal}px</div>
        </div>
        <div style="color:#9CA3AF;font-size:11px;margin-top:10px;">Release to save</div>
      `;
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
      endX = e.clientX;
      endY = e.clientY;
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

      panel.innerHTML = `
        <div style="text-align:center;padding:15px;">
          <div style="color:${COLORS.success};font-size:28px;">&#10003;</div>
          <div style="font-weight:600;margin-top:8px;">Saved!</div>
          <div style="font-size:14px;margin-top:8px;">${measurements.width} x ${measurements.height} px</div>
        </div>
      `;

      setTimeout(cleanup, 1500);
    }

    function onKeyDown(e) {
      if (e.key === 'Escape' && isActive) cleanup();
    }

    function cleanup() {
      if (!isActive) return;
      activeToolCleanup = null;
      isActive = false;

      overlay.removeEventListener('mousedown', onMouseDown);
      overlay.removeEventListener('mousemove', onMouseMove);
      overlay.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('keydown', onKeyDown, true);

      document.body.style.cursor = originalCursor;
      document.body.style.userSelect = originalUserSelect;

      [overlay, measureBox, widthLabel, heightLabel, diagonalLabel, panel].forEach(el => {
        if (el && el.parentNode) el.remove();
      });
    }

    activeToolCleanup = cleanup;

    overlay.addEventListener('mousedown', onMouseDown);
    overlay.addEventListener('mousemove', onMouseMove);
    overlay.addEventListener('mouseup', onMouseUp);
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
        return true;

      case 'activateColorPicker':
        activateColorPicker();
        sendResponse({ success: true });
        return true;

      case 'activateFontDetector':
        activateFontDetector();
        sendResponse({ success: true });
        return true;

      case 'activateMeasureTool':
        activateMeasureTool();
        sendResponse({ success: true });
        return true;

      default:
        return false;
    }
  });

  console.log('[WDR-Firefox] Content script initialization complete');
}
