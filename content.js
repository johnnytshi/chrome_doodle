(function () {
  'use strict';

  let mode = 'off'; // 'off' | 'annotating' | 'passthrough'
  let tool = 'pen'; // 'pen' | 'arrow'
  let strokes = [];
  let currentStroke = null;
  let canvas, ctx;
  let toolbar;
  let toolbarVisible = false;
  let brushColor = '#ff0000';
  let brushSize = 3;
  let isDrawing = false;
  let rafPending = false;

  const PALETTE = [
    '#ff0000', '#ff6600', '#ffcc00', '#33cc33',
    '#0099ff', '#6633cc', '#ff33cc', '#ffffff',
    '#000000',
  ];

  // Scroll tracking
  let scrollX = 0;
  let scrollY = 0;
  let scrollContainer = null;

  function init() {
    createCanvas();
    createToolbar();
    setupEventListeners();
    syncScroll();
    setMode('off');
  }

  // --- Canvas ---

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

  // --- Toolbar ---

  function createToolbar() {
    toolbar = document.createElement('div');
    toolbar.id = 'chrome-annotate-toolbar';

    const shadow = toolbar.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      :host {
        all: initial;
      }
      .toolbar {
        position: fixed;
        top: 12px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 2147483647;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        background: rgba(30, 30, 30, 0.92);
        backdrop-filter: blur(12px);
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 12px;
        color: #eee;
        user-select: none;
        pointer-events: auto;
      }
      .sep {
        width: 1px;
        height: 22px;
        background: rgba(255,255,255,0.15);
        margin: 0 2px;
      }
      .tool-btn {
        width: 28px;
        height: 28px;
        border: 2px solid transparent;
        border-radius: 6px;
        background: rgba(255,255,255,0.08);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.12s;
        padding: 0;
      }
      .tool-btn:hover {
        background: rgba(255,255,255,0.18);
      }
      .tool-btn.active {
        border-color: #4a90d9;
        background: rgba(74,144,217,0.2);
      }
      .tool-btn svg {
        width: 16px;
        height: 16px;
        fill: none;
        stroke: #ddd;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .tool-btn.active svg {
        stroke: #7bb8f5;
      }
      .swatch {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        border: 2px solid transparent;
        cursor: pointer;
        transition: all 0.12s;
        padding: 0;
        box-sizing: border-box;
      }
      .swatch:hover {
        transform: scale(1.2);
      }
      .swatch.active {
        border-color: #fff;
        box-shadow: 0 0 0 1px rgba(0,0,0,0.3);
      }
      .size-slider {
        width: 70px;
        height: 4px;
        -webkit-appearance: none;
        appearance: none;
        background: rgba(255,255,255,0.2);
        border-radius: 2px;
        outline: none;
        cursor: pointer;
      }
      .size-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #fff;
        cursor: pointer;
      }
      .mode-btn {
        padding: 4px 10px;
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 6px;
        background: transparent;
        color: #ccc;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.12s;
        white-space: nowrap;
      }
      .mode-btn:hover {
        background: rgba(255,255,255,0.1);
        color: #fff;
      }
      .mode-btn.active {
        background: rgba(74,144,217,0.3);
        border-color: #4a90d9;
        color: #7bb8f5;
      }
      .action-btn {
        padding: 4px 8px;
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 6px;
        background: transparent;
        color: #aaa;
        font-size: 11px;
        cursor: pointer;
        transition: all 0.12s;
      }
      .action-btn:hover {
        background: rgba(255,255,255,0.1);
        color: #fff;
      }
      .action-btn.danger:hover {
        background: rgba(220,50,50,0.25);
        border-color: rgba(220,50,50,0.5);
        color: #ff8888;
      }
    `;

    const bar = document.createElement('div');
    bar.className = 'toolbar';

    // Mode buttons
    const modes = [
      { id: 'annotating', label: 'Draw' },
      { id: 'passthrough', label: 'View' },
    ];
    modes.forEach((m) => {
      const btn = document.createElement('button');
      btn.className = 'mode-btn';
      btn.dataset.mode = m.id;
      btn.textContent = m.label;
      btn.addEventListener('click', () => setMode(m.id));
      bar.appendChild(btn);
    });

    bar.appendChild(sep());

    // Tool buttons (pen + arrow)
    const penBtn = document.createElement('button');
    penBtn.className = 'tool-btn active';
    penBtn.dataset.tool = 'pen';
    penBtn.title = 'Pen';
    penBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M3 21l1.5-4.5L17.5 3.5a1.41 1.41 0 0 1 2 2L6.5 18.5Z"/><path d="M15 5l2 2"/></svg>`;
    penBtn.addEventListener('click', () => setTool('pen'));
    bar.appendChild(penBtn);

    const arrowBtn = document.createElement('button');
    arrowBtn.className = 'tool-btn';
    arrowBtn.dataset.tool = 'arrow';
    arrowBtn.title = 'Arrow';
    arrowBtn.innerHTML = `<svg viewBox="0 0 24 24"><line x1="5" y1="19" x2="19" y2="5"/><polyline points="12 5 19 5 19 12"/></svg>`;
    arrowBtn.addEventListener('click', () => setTool('arrow'));
    bar.appendChild(arrowBtn);

    bar.appendChild(sep());

    // Color swatches
    PALETTE.forEach((color) => {
      const s = document.createElement('button');
      s.className = 'swatch' + (color === brushColor ? ' active' : '');
      s.style.background = color;
      if (color === '#ffffff') {
        s.style.border = '2px solid ' + (color === brushColor ? '#fff' : 'rgba(255,255,255,0.3)');
      }
      s.dataset.color = color;
      s.addEventListener('click', () => {
        brushColor = color;
        updateSwatches(shadow);
      });
      bar.appendChild(s);
    });

    bar.appendChild(sep());

    // Size slider
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'size-slider';
    slider.min = '1';
    slider.max = '20';
    slider.value = String(brushSize);
    slider.addEventListener('input', () => {
      brushSize = parseInt(slider.value, 10);
    });
    bar.appendChild(slider);

    bar.appendChild(sep());

    // Action buttons
    const undoBtn = document.createElement('button');
    undoBtn.className = 'action-btn';
    undoBtn.textContent = 'Undo';
    undoBtn.addEventListener('click', undo);
    bar.appendChild(undoBtn);

    const clearBtn = document.createElement('button');
    clearBtn.className = 'action-btn danger';
    clearBtn.textContent = 'Clear';
    clearBtn.addEventListener('click', clearAll);
    bar.appendChild(clearBtn);

    shadow.appendChild(style);
    shadow.appendChild(bar);
    document.body.appendChild(toolbar);
    toolbar.style.display = 'none';
  }

  function sep() {
    const d = document.createElement('div');
    d.className = 'sep';
    return d;
  }

  function updateSwatches(shadow) {
    shadow.querySelectorAll('.swatch').forEach((s) => {
      const c = s.dataset.color;
      const isActive = c === brushColor;
      s.classList.toggle('active', isActive);
      if (c === '#ffffff') {
        s.style.border = '2px solid ' + (isActive ? '#fff' : 'rgba(255,255,255,0.3)');
      }
    });
  }

  function setTool(newTool) {
    tool = newTool;
    const shadow = toolbar.shadowRoot;
    shadow.querySelectorAll('.tool-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tool === newTool);
    });
  }

  function updateToolbarModes() {
    if (!toolbar) return;
    const shadow = toolbar.shadowRoot;
    shadow.querySelectorAll('.mode-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
  }

  function showToolbar() {
    toolbarVisible = true;
    toolbar.style.display = 'block';
    if (mode === 'off') setMode('annotating');
  }

  function hideToolbar() {
    toolbarVisible = false;
    toolbar.style.display = 'none';
    setMode('off');
  }

  function toggleToolbar() {
    if (toolbarVisible) hideToolbar();
    else showToolbar();
  }

  // --- Scroll tracking ---

  function syncScroll() {
    const wx = window.scrollX || window.pageXOffset || 0;
    const wy = window.scrollY || window.pageYOffset || 0;
    if (wx !== 0 || wy !== 0) {
      scrollX = wx;
      scrollY = wy;
      return;
    }
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

    if (stroke.tool === 'arrow') {
      drawArrow(stroke, sx, sy);
      return;
    }

    // Pen stroke
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

  function drawArrow(stroke, sx, sy) {
    const pts = stroke.points;
    if (pts.length < 2) return;

    const start = pts[0];
    const end = pts[pts.length - 1];
    const x1 = start.x - sx;
    const y1 = start.y - sy;
    const x2 = end.x - sx;
    const y2 = end.y - sy;

    const headLen = Math.max(12, stroke.width * 4);
    const angle = Math.atan2(y2 - y1, x2 - x1);

    // Shaft
    ctx.beginPath();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Arrowhead
    ctx.beginPath();
    ctx.fillStyle = stroke.color;
    ctx.moveTo(x2, y2);
    ctx.lineTo(
      x2 - headLen * Math.cos(angle - Math.PI / 6),
      y2 - headLen * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      x2 - headLen * Math.cos(angle + Math.PI / 6),
      y2 - headLen * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
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

    updateToolbarModes();

    try {
      chrome.runtime.sendMessage({ type: 'modeChanged', mode });
    } catch (_) {
      // popup may not be open
    }
  }

  function cycleMode() {
    if (mode === 'off') {
      showToolbar();
      setMode('annotating');
    } else if (mode === 'annotating') {
      setMode('passthrough');
    } else {
      hideToolbar();
    }
  }

  // --- Events ---

  function setupEventListeners() {
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
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
      tool: tool,
    };
    strokes.push(currentStroke);
  }

  function onMouseMove(e) {
    if (mode !== 'annotating' || !isDrawing || !currentStroke) return;
    e.preventDefault();
    const coords = absCoords(e);

    if (currentStroke.tool === 'arrow') {
      // For arrow, only keep start and current end
      if (currentStroke.points.length === 1) {
        currentStroke.points.push(coords);
      } else {
        currentStroke.points[1] = coords;
      }
      redrawStrokes();
    } else {
      // Pen: incremental draw
      const pts = currentStroke.points;
      pts.push(coords);
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
  }

  function onMouseUp() {
    isDrawing = false;
    currentStroke = null;
  }

  function onWheel(e) {
    if (mode === 'annotating') {
      e.preventDefault();
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
      hideToolbar();
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
      case 'toggleToolbar':
        toggleToolbar();
        sendResponse({ ok: true });
        break;
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

  function watchNavigation() {
    let currentUrl = location.href;

    function onNavigate() {
      if (location.href !== currentUrl) {
        currentUrl = location.href;
        clearAll();
        hideToolbar();
      }
    }

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
