(function () {
  'use strict';

  let mode = 'off'; // 'off' | 'annotating' | 'passthrough'
  let strokes = [];
  let currentStroke = null;
  let canvas, ctx;
  let indicator;
  let brushColor = '#ff0000';
  let brushSize = 3;
  let isDrawing = false;
  let rafPending = false;

  // Scroll tracking — captures scroll from window, document, or inner containers
  let scrollX = 0;
  let scrollY = 0;
  let scrollContainer = null;

  function init() {
    createCanvas();
    createIndicator();
    setupEventListeners();
    syncScroll();
    setMode('off');
  }

  // --- Canvas ---
  // Fixed to the viewport. Strokes are stored in "absolute" coordinates
  // (clientX + scrollX at time of drawing). Rendered by subtracting the
  // current scroll offset so they track page content.

  function createCanvas() {
    canvas = document.createElement('canvas');
    canvas.id = 'chrome-annotate-canvas';
    Object.assign(canvas.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      zIndex: '2147483646',
      pointerEvents: 'none',
      display: 'none',
      margin: '0',
      padding: '0',
    });
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    sizeBuffer();
  }

  function sizeBuffer() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (canvas.width === w && canvas.height === h) return;
    canvas.width = w;
    canvas.height = h;
    redrawStrokes();
  }

  // --- Scroll tracking ---

  function syncScroll() {
    // Read current scroll from the best source available
    const wx = window.scrollX || window.pageXOffset || 0;
    const wy = window.scrollY || window.pageYOffset || 0;
    if (wx !== 0 || wy !== 0) {
      scrollX = wx;
      scrollY = wy;
      return;
    }
    // Check document.scrollingElement
    const se = document.scrollingElement;
    if (se && (se.scrollTop !== 0 || se.scrollLeft !== 0)) {
      scrollX = se.scrollLeft;
      scrollY = se.scrollTop;
      scrollContainer = se;
    }
  }

  function onScroll(e) {
    const target = e.target;
    if (target === document || target === document.documentElement || target === document.body) {
      scrollX = window.scrollX || window.pageXOffset || 0;
      scrollY = window.scrollY || window.pageYOffset || 0;
      scrollContainer = null;
    } else if (target instanceof Element) {
      scrollX = target.scrollLeft;
      scrollY = target.scrollTop;
      scrollContainer = target;
    }
    if (mode !== 'off') scheduleRedraw();
  }

  // --- Drawing ---

  function absCoords(e) {
    return {
      x: e.clientX + scrollX,
      y: e.clientY + scrollY,
    };
  }

  function redrawStrokes() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const sx = scrollX;
    const sy = scrollY;
    for (const stroke of strokes) {
      drawStroke(stroke, sx, sy);
    }
  }

  function drawStroke(stroke, sx, sy) {
    const pts = stroke.points;
    if (pts.length === 0) return;

    if (pts.length === 1) {
      ctx.beginPath();
      ctx.fillStyle = stroke.color;
      ctx.arc(pts[0].x - sx, pts[0].y - sy, stroke.width / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    ctx.beginPath();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(pts[0].x - sx, pts[0].y - sy);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x - sx, pts[i].y - sy);
    }
    ctx.stroke();
  }

  function scheduleRedraw() {
    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(() => {
        rafPending = false;
        redrawStrokes();
      });
    }
  }

  // --- Mode ---

  function setMode(newMode) {
    mode = newMode;

    if (mode === 'off') {
      canvas.style.display = 'none';
      canvas.style.pointerEvents = 'none';
    } else if (mode === 'annotating') {
      canvas.style.display = 'block';
      canvas.style.pointerEvents = 'auto';
      canvas.style.cursor = 'crosshair';
      syncScroll();
      redrawStrokes();
    } else if (mode === 'passthrough') {
      canvas.style.display = 'block';
      canvas.style.pointerEvents = 'none';
      canvas.style.cursor = 'default';
      syncScroll();
      redrawStrokes();
    }

    updateIndicator();

    try {
      chrome.runtime.sendMessage({ type: 'modeChanged', mode });
    } catch (_) {
      // popup may not be open
    }
  }

  function cycleMode() {
    if (mode === 'off') setMode('annotating');
    else if (mode === 'annotating') setMode('passthrough');
    else setMode('off');
  }

  // --- Indicator ---

  function createIndicator() {
    indicator = document.createElement('div');
    indicator.id = 'chrome-annotate-indicator';
    Object.assign(indicator.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      padding: '8px 16px',
      borderRadius: '20px',
      fontSize: '14px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontWeight: '600',
      zIndex: '2147483647',
      pointerEvents: 'none',
      transition: 'opacity 0.3s, transform 0.3s',
      boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
      opacity: '0',
      transform: 'translateY(10px)',
    });
    document.body.appendChild(indicator);
  }

  function updateIndicator() {
    if (mode === 'off') {
      indicator.style.opacity = '0';
      indicator.style.transform = 'translateY(10px)';
    } else if (mode === 'annotating') {
      indicator.textContent = 'Annotating';
      indicator.style.background = brushColor;
      indicator.style.color = getContrastColor(brushColor);
      indicator.style.opacity = '1';
      indicator.style.transform = 'translateY(0)';
    } else if (mode === 'passthrough') {
      indicator.textContent = 'Viewing';
      indicator.style.background = '#333';
      indicator.style.color = '#fff';
      indicator.style.opacity = '1';
      indicator.style.transform = 'translateY(0)';
    }
  }

  function getContrastColor(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000' : '#fff';
  }

  // --- Events ---

  function setupEventListeners() {
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // Allow scrolling with wheel while in annotating mode
    canvas.addEventListener('wheel', onWheel, { passive: false });

    // Capture-phase scroll listener catches scroll events from ANY element
    // (window, document, inner containers like <div style="overflow:auto">)
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });

    window.addEventListener('resize', () => sizeBuffer());

    document.addEventListener('keydown', onKeyDown);
    chrome.runtime.onMessage.addListener(onMessage);
  }

  function onMouseDown(e) {
    if (mode !== 'annotating') return;
    e.preventDefault();
    isDrawing = true;
    const coords = absCoords(e);
    currentStroke = {
      points: [coords],
      color: brushColor,
      width: brushSize,
    };
    strokes.push(currentStroke);
  }

  function onMouseMove(e) {
    if (mode !== 'annotating' || !isDrawing || !currentStroke) return;
    e.preventDefault();
    const coords = absCoords(e);
    const pts = currentStroke.points;
    pts.push(coords);

    // Incremental draw for performance
    const sx = scrollX;
    const sy = scrollY;
    const len = pts.length;
    ctx.beginPath();
    ctx.strokeStyle = currentStroke.color;
    ctx.lineWidth = currentStroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(pts[len - 2].x - sx, pts[len - 2].y - sy);
    ctx.lineTo(pts[len - 1].x - sx, pts[len - 1].y - sy);
    ctx.stroke();
  }

  function onMouseUp() {
    isDrawing = false;
    currentStroke = null;
  }

  function onWheel(e) {
    if (mode === 'annotating') {
      e.preventDefault();
      // Try scrolling the detected container first, then fall back to window
      if (scrollContainer && scrollContainer !== document.documentElement && scrollContainer !== document.body) {
        scrollContainer.scrollTop += e.deltaY;
        scrollContainer.scrollLeft += e.deltaX;
      } else {
        window.scrollBy(e.deltaX, e.deltaY);
      }
    }
  }

  function onKeyDown(e) {
    if (e.altKey && (e.key === 'a' || e.key === 'A')) {
      e.preventDefault();
      cycleMode();
    }
    if (e.ctrlKey && e.key === 'z' && mode !== 'off') {
      e.preventDefault();
      undo();
    }
    if (e.key === 'Escape' && mode !== 'off') {
      e.preventDefault();
      setMode('off');
    }
  }

  function undo() {
    if (strokes.length > 0) {
      strokes.pop();
      redrawStrokes();
    }
  }

  function clearAll() {
    strokes = [];
    redrawStrokes();
  }

  // --- Messaging ---

  function onMessage(msg, _sender, sendResponse) {
    switch (msg.type) {
      case 'cycleMode':
        cycleMode();
        sendResponse({ mode });
        break;
      case 'setMode':
        setMode(msg.mode);
        sendResponse({ mode });
        break;
      case 'getState':
        sendResponse({ mode, color: brushColor, size: brushSize });
        break;
      case 'setColor':
        brushColor = msg.color;
        updateIndicator();
        sendResponse({ color: brushColor });
        break;
      case 'setSize':
        brushSize = msg.size;
        sendResponse({ size: brushSize });
        break;
      case 'undo':
        undo();
        sendResponse({ ok: true });
        break;
      case 'clear':
        clearAll();
        sendResponse({ ok: true });
        break;
    }
    return true;
  }

  // --- Navigation detection ---
  // Clears annotations on SPA navigation (pushState/replaceState/popstate)

  function watchNavigation() {
    let currentUrl = location.href;

    function onNavigate() {
      if (location.href !== currentUrl) {
        currentUrl = location.href;
        clearAll();
        setMode('off');
      }
    }

    // Intercept History API (SPA navigation)
    const origPushState = history.pushState;
    const origReplaceState = history.replaceState;
    history.pushState = function () {
      origPushState.apply(this, arguments);
      onNavigate();
    };
    history.replaceState = function () {
      origReplaceState.apply(this, arguments);
      onNavigate();
    };

    // Back/forward buttons
    window.addEventListener('popstate', onNavigate);
  }

  // --- Init ---

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  watchNavigation();
})();
