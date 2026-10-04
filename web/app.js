// TomLauncher V2 — Application Logic

// Dynamic Tauri IPC invoke call
async function invoke(cmd, args) {
  if (window.__TAURI__) {
    if (window.__TAURI__.core && typeof window.__TAURI__.core.invoke === 'function') {
      return await window.__TAURI__.core.invoke(cmd, args);
    }
    if (typeof window.__TAURI__.invoke === 'function') {
      return await window.__TAURI__.invoke(cmd, args);
    }
  }

  console.log(`[Mock Invoke] ${cmd}`, args);
  if (cmd === 'get_settings') {
    return JSON.parse(localStorage.getItem('tomlauncher_settings')) || {
      rows: 5,
      columns: 5,
      cellWidth: 150,
      cellHeight: 40,
      modifier: "Alt+Shift",
      key: "Z",
      centerMouseOnStartup: false,
      shortcutList: []
    };
  }
  if (cmd === 'save_settings') {
    localStorage.setItem('tomlauncher_settings', JSON.stringify(args.settings));
    return;
  }
  if (cmd === 'extract_icon') {
    return FALLBACK_SVG_ICON;
  }
  if (cmd === 'get_settings_path') {
    return 'C:\\Users\\User\\AppData\\Roaming\\TomLauncherV2\\settings.json';
  }
  if (cmd === 'open_settings_folder') {
    console.log('[Mock Invoke] open_settings_folder');
    return true;
  }
  return null;
}

const FALLBACK_SVG_ICON = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iIzNiODJmNiIgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIj48cGF0aCBkPSJNMTQgMkg2Yy0xLjEgMC0xLjk5LjktMS45OSAyTDQgMjBjMCAxLjEuODkgMiAxLjk5IDJIMThjMS4xIDAgMi0uOSAyLTJWODlsLTYtNnptMiAxNkg4di0yaDh2MnptMC00SDh2LTJoOHYJem0tMy01VjMuNUwxOC41IDlIMTN6Ii8+PC9zdmc+';

// Global App State
const state = {
  settings: {
    rows: 5,
    columns: 5,
    cellWidth: 150,
    cellHeight: 40,
    modifier: "Alt+Shift",
    key: "Z",
    centerMouseOnStartup: false,
    enableDebugLogging: false,
    theme: "dark",
    cellColor: undefined,
    highlightColor: undefined,
    shortcutList: []
  },
  mode: 'launch', // 'launch' | 'edit'
  queue: [], // List of shortcut entries queued for execution
  editingCell: null, // { row, col }
  draggedCell: null // { row, col }
};

// DOM Elements container
let elements = {};

function initElements() {
  elements = {
    hiddenFileInput: document.getElementById('hidden-file-input'),
    hiddenIconInput: document.getElementById('hidden-icon-input'),

    btnModeLaunch: document.getElementById('btn-mode-launch'),
    btnModeEdit: document.getElementById('btn-mode-edit'),
    btnSettings: document.getElementById('btn-settings'),
    queueBadge: document.getElementById('queue-badge'),
    queueCount: document.getElementById('queue-count'),
    grid: document.getElementById('launcher-grid'),
    gridWrapper: document.getElementById('launcher-grid-wrapper'),
    statusHint: document.getElementById('status-hint'),
    
    // Edit Modal
    modalEdit: document.getElementById('modal-edit'),
    editModalTitle: document.getElementById('edit-modal-title'),
    editName: document.getElementById('edit-name'),
    editPath: document.getElementById('edit-path'),
    editArgs: document.getElementById('edit-args'),
    editIcon: document.getElementById('edit-icon'),
    editIconPreview: document.getElementById('edit-icon-preview'),
    noIconText: document.getElementById('no-icon-text'),
    btnBrowseFile: document.getElementById('btn-browse-file'),
    btnBrowseIcon: document.getElementById('btn-browse-icon'),
    btnSaveEdit: document.getElementById('btn-save-edit'),
    btnDeleteShortcut: document.getElementById('btn-delete-shortcut'),
    btnCancelEdit: document.getElementById('btn-cancel-edit'),
    btnCloseEdit: document.getElementById('btn-close-edit'),

    // Settings Modal
    modalSettings: document.getElementById('modal-settings'),
    settingRows: document.getElementById('setting-rows'),
    settingCols: document.getElementById('setting-cols'),
    settingWidth: document.getElementById('setting-width'),
    settingHeight: document.getElementById('setting-height'),
    settingHotkey: document.getElementById('setting-hotkey'),
    settingCenterMouse: document.getElementById('setting-center-mouse'),
    settingDebugLogging: document.getElementById('setting-debug-logging'),
    settingTheme: document.getElementById('setting-theme'),
    settingCellColor: document.getElementById('setting-cell-color'),
    settingCellColorText: document.getElementById('setting-cell-color-text'),
    btnResetCellColor: document.getElementById('btn-reset-cell-color'),
    settingHighlightColor: document.getElementById('setting-highlight-color'),
    settingHighlightColorText: document.getElementById('setting-highlight-color-text'),
    btnResetHighlightColor: document.getElementById('btn-reset-highlight-color'),
    settingFilepath: document.getElementById('setting-filepath'),
    btnOpenSettingsFolder: document.getElementById('btn-open-settings-folder'),
    btnSaveSettings: document.getElementById('btn-save-settings'),
    btnCancelSettings: document.getElementById('btn-cancel-settings'),
    btnCloseSettings: document.getElementById('btn-close-settings'),
    btnExitApp: document.getElementById('btn-exit-app')
  };
}

// Property Accessors for flexible field casing
function getShortcutLocation(shortcut) {
  if (!shortcut) return '';
  return shortcut.shortcutLocation || shortcut.ShortcutLocation || shortcut.shortcut_location || '';
}

function getShortcutName(shortcut) {
  if (!shortcut) return '';
  return shortcut.name || shortcut.Name || '';
}

function getShortcutImage(shortcut) {
  if (!shortcut) return '';
  return shortcut.imageLocation || shortcut.ImageLocation || shortcut.image_location || '';
}

function getShortcutArguments(shortcut) {
  if (!shortcut) return '';
  return shortcut.arguments || shortcut.Arguments || '';
}

function getShortcutRow(shortcut) {
  if (!shortcut) return -1;
  if (shortcut.row !== undefined && shortcut.row !== null) return Number(shortcut.row);
  if (shortcut.Row !== undefined && shortcut.Row !== null) return Number(shortcut.Row);
  return -1;
}

function getShortcutCol(shortcut) {
  if (!shortcut) return -1;
  if (shortcut.col !== undefined && shortcut.col !== null) return Number(shortcut.col);
  if (shortcut.Column !== undefined && shortcut.Column !== null) return Number(shortcut.Column);
  if (shortcut.column !== undefined && shortcut.column !== null) return Number(shortcut.column);
  return -1;
}

// Toggle Shortcut Item in Execution Queue
function toggleQueueShortcut(shortcut) {
  if (!shortcut) return;
  const row = getShortcutRow(shortcut);
  const col = getShortcutCol(shortcut);
  const queueIdx = state.queue.findIndex(q => getShortcutRow(q) === Number(row) && getShortcutCol(q) === Number(col));
  if (queueIdx >= 0) {
    state.queue.splice(queueIdx, 1);
  } else {
    state.queue.push(shortcut);
  }
  updateQueueBadge();
  renderGrid();
}

// Handle Cell Click (Launch Mode & Edit Mode)
async function handleCellClick(e, row, col) {
  console.log('[handleCellClick]', { mode: state.mode, row, col });
  const shortcut = findShortcut(row, col);

  if (state.mode === 'edit') {
    openEditModal(row, col, shortcut);
    return;
  }

  // Launcher Mode: Always get fresh shortcut from state
  const path = getShortcutLocation(shortcut);
  if (!shortcut || !path || path.trim() === '') {
    console.log('[handleCellClick] Empty shortcut or path, returning');
    return;
  }

  if (e && (e.shiftKey || e.ctrlKey)) {
    // Toggle Queue Mode via Shift/Ctrl Click
    toggleQueueShortcut(shortcut);
  } else {
    // Immediate Launch
    await executeShortcut(shortcut);

    // Filter queue to prevent launching the clicked cell twice if it was already queued
    const clickRow = getShortcutRow(shortcut);
    const clickCol = getShortcutCol(shortcut);
    const remainingQueue = state.queue.filter(q => !(getShortcutRow(q) === clickRow && getShortcutCol(q) === clickCol));

    if (remainingQueue.length > 0) {
      for (const item of remainingQueue) {
        await executeShortcut(item);
      }
    }

    state.queue = [];
    updateQueueBadge();
    renderGrid();
  }
}

// Execute Shortcut via Rust Backend
async function executeShortcut(shortcut) {
  const path = getShortcutLocation(shortcut);
  const args = getShortcutArguments(shortcut);
  const name = getShortcutName(shortcut) || 'Shortcut';
  if (!shortcut || !path) return;

  console.log('[executeShortcut] Launching:', name, 'Path:', path, 'Args:', args);

  if (elements.statusHint) {
    elements.statusHint.innerHTML = `Launching <span class="hint-key">${name}</span>...`;
  }

  try {
    const res = await invoke('launch_program', { path, arguments: args });
    console.log('[executeShortcut] IPC result:', res);
  } catch (err) {
    console.error('[executeShortcut] Error:', err);
    alert(`Failed to launch shortcut (${name}):\nPath: ${path}\nError: ${err}`);
  } finally {
    setTimeout(() => {
      updateFooterHint();
    }, 2500);
  }
}

// Update Queue Badge Counter
function updateQueueBadge() {
  if (state.queue.length > 0) {
    elements.queueCount.textContent = state.queue.length;
    elements.queueBadge.classList.remove('hidden');
  } else {
    elements.queueBadge.classList.add('hidden');
  }
}

// Dynamically resize window to fit grid dimensions perfectly
function fitWindowToGrid() {
  const { rows, columns, cellWidth, cellHeight } = state.settings;
  invoke('resize_window_to_grid', {
    rows: Number(rows),
    columns: Number(columns),
    cellWidth: Number(cellWidth),
    cellHeight: Number(cellHeight)
  }).catch(() => {});
}

// Hide application window to system tray
function hideWindow() {
  invoke('hide_window').catch((err) => {
    console.error('Failed to hide window:', err);
  });
}

// Initialize Application
async function init() {
  initElements();
  await loadSettings();
  setupEventListeners();
  setupTauriFileDropListener();
  renderGrid();
  fitWindowToGrid();
  if (state.settings.centerMouseOnStartup) {
    invoke('center_cursor').catch(() => {});
  }
}

// Theme & Custom Color Utilities
function getThemeDefaultColors(theme) {
  if (theme === 'light') {
    return {
      cellColor: '#f1f5f9',
      highlightColor: '#e2e8f0'
    };
  }
  return {
    cellColor: '#222630',
    highlightColor: '#2d3240'
  };
}

function normalizeHexColor(val, fallback = '#222630') {
  if (!val) return fallback;
  let str = String(val).trim();
  if (!str.startsWith('#')) {
    str = '#' + str;
  }
  if (/^#[0-9a-fA-F]{6}$/.test(str)) {
    return str.toLowerCase();
  }
  if (/^#[0-9a-fA-F]{3}$/.test(str)) {
    const r = str[1], g = str[2], b = str[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return fallback;
}

function applyThemeAndColors() {
  const theme = state.settings.theme || 'dark';
  document.documentElement.setAttribute('data-theme', theme);

  const defaults = getThemeDefaultColors(theme);
  const cellColor = normalizeHexColor(state.settings.cellColor, defaults.cellColor);
  const highlightColor = normalizeHexColor(state.settings.highlightColor, defaults.highlightColor);

  document.documentElement.style.setProperty('--cell-color', cellColor);
  document.documentElement.style.setProperty('--highlight-color', highlightColor);
}

function resolveThemeChangeColors(previousTheme, newTheme, currentCellColor, currentHighlightColor) {
  const prevDefaults = getThemeDefaultColors(previousTheme);
  const newDefaults = getThemeDefaultColors(newTheme);

  const normCurrentCell = normalizeHexColor(currentCellColor, prevDefaults.cellColor);
  const normPrevDefaultCell = prevDefaults.cellColor.toLowerCase();

  const normCurrentHighlight = normalizeHexColor(currentHighlightColor, prevDefaults.highlightColor);
  const normPrevDefaultHighlight = prevDefaults.highlightColor.toLowerCase();

  const isCellCustom = normCurrentCell !== normPrevDefaultCell;
  const isHighlightCustom = normCurrentHighlight !== normPrevDefaultHighlight;

  return {
    cellColor: isCellCustom ? normCurrentCell : newDefaults.cellColor,
    highlightColor: isHighlightCustom ? normCurrentHighlight : newDefaults.highlightColor,
    isCellCustom,
    isHighlightCustom
  };
}

// Load Settings from Backend
async function loadSettings() {
  try {
    const loaded = await invoke('get_settings');
    if (loaded && loaded.rows) {
      state.settings = loaded;
    }
    if (!state.settings.theme) state.settings.theme = 'dark';
    applyThemeAndColors();
    if (elements.settingTheme) {
      elements.settingTheme.value = state.settings.theme;
    }
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

// Save Settings to Backend
async function saveSettings() {
  try {
    await invoke('save_settings', { settings: state.settings });
  } catch (err) {
    console.error('Failed to save settings:', err);
  }
}

// Update dynamic footer hint text based on active mode
function updateFooterHint() {
  if (!elements.statusHint) return;
  if (state.mode === 'edit') {
    elements.statusHint.innerHTML = 'Drag &amp; Drop files onto grid cells to add shortcuts';
  } else {
    elements.statusHint.innerHTML = '<span class="hint-key">Shift + Click</span> or <span class="hint-key">Right Click</span> to queue items';
  }
}

// Render Launcher Grid
function renderGrid() {
  const { rows, columns, cellWidth, cellHeight } = state.settings;

  // Apply Grid Styles
  elements.grid.style.gridTemplateRows = `repeat(${rows}, ${cellHeight}px)`;
  elements.grid.style.gridTemplateColumns = `repeat(${columns}, ${cellWidth}px)`;

  elements.grid.innerHTML = '';

  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= columns; c++) {
      const shortcut = findShortcut(r, c);
      const cellEl = createCellElement(r, c, shortcut);
      elements.grid.appendChild(cellEl);
    }
  }

  // Update Body Mode Class & Footer Hint
  if (state.mode === 'edit') {
    document.body.classList.add('edit-mode');
  } else {
    document.body.classList.remove('edit-mode');
  }
  updateFooterHint();
}

// Find shortcut for cell (1-indexed) - coerce to Number
function findShortcut(row, col) {
  if (!state.settings.shortcutList) return null;
  return state.settings.shortcutList.find(s => getShortcutRow(s) === Number(row) && getShortcutCol(s) === Number(col));
}

// Global Drag State Flags
let dragSession = null;
let wasJustDragging = false;

// Icon memory cache to avoid redundant IPC calls & shell file queries
const iconCache = new Map();

async function getCachedIcon(path) {
  if (!path) return null;
  if (iconCache.has(path)) return iconCache.get(path);
  try {
    const iconData = await invoke('extract_icon', { path });
    if (iconData) {
      iconCache.set(path, iconData);
      return iconData;
    }
  } catch (_) {}
  return null;
}

// Create Cell DOM Element
function createCellElement(row, col, shortcut) {
  const cell = document.createElement('div');
  const path = getShortcutLocation(shortcut);
  cell.className = `cell-shortcut ${shortcut && path ? '' : 'empty'}`;
  cell.style.width = `${state.settings.cellWidth}px`;
  cell.style.height = `${state.settings.cellHeight}px`;
  cell.dataset.row = row;
  cell.dataset.col = col;

  // Check if queued
  const isQueued = state.queue.some(q => getShortcutRow(q) === Number(row) && getShortcutCol(q) === Number(col));
  if (isQueued) {
    cell.classList.add('queued');
  }

  if (shortcut && path) {
    const img = document.createElement('img');
    img.className = 'cell-icon';
    img.style.pointerEvents = 'none';

    const customImg = getShortcutImage(shortcut);
    if (customImg && customImg.trim() !== '') {
      img.src = customImg;
    } else {
      img.src = FALLBACK_SVG_ICON;
      getCachedIcon(path)
        .then(iconData => { if (iconData) img.src = iconData; })
        .catch(() => {});
    }

    const name = document.createElement('span');
    name.className = 'cell-name';
    name.style.pointerEvents = 'none';
    name.textContent = getShortcutName(shortcut) || 'Shortcut';

    cell.appendChild(img);
    cell.appendChild(name);
  } else {
    const label = document.createElement('span');
    label.className = 'cell-empty-label';
    label.style.pointerEvents = 'none';
    label.textContent = state.mode === 'edit' ? `+ (${row},${col})` : '';
    cell.appendChild(label);
  }

  // Native Click Listener (Runs in both Launch Mode and Edit Mode)
  cell.addEventListener('click', (e) => {
    if (wasJustDragging) {
      wasJustDragging = false;
      return;
    }
    handleCellClick(e, row, col);
  });

  // Context Menu / Right-Click Listener (Queue item in Launch Mode | Open Edit Modal in Edit Mode)
  cell.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (state.mode === 'launch') {
      const s = findShortcut(row, col);
      const path = getShortcutLocation(s);
      if (s && path && path.trim() !== '') {
        toggleQueueShortcut(s);
      }
    } else if (state.mode === 'edit') {
      const s = findShortcut(row, col);
      openEditModal(row, col, s);
    }
  });

  // Pointer Events for Edit Mode Drag & Drop ONLY
  setupCellPointerEvents(cell, row, col, shortcut);

  // OS File Drop Handler (for external files dropped from File Explorer)
  cell.addEventListener('dragover', (e) => e.preventDefault());
  cell.addEventListener('drop', (e) => handleExternalFileDrop(e, row, col));

  return cell;
}

// Attach Pointer Events (Handles Edit Mode Drag & Drop ONLY)
function setupCellPointerEvents(cell, row, col, shortcut) {
  cell.addEventListener('pointerdown', (e) => {
    if (state.mode !== 'edit') return;
    if (e.button !== 0) return; // Left click only

    const path = getShortcutLocation(shortcut);
    if (!shortcut || !path) return;

    dragSession = {
      srcRow: Number(row),
      srcCol: Number(col),
      startX: e.clientX,
      startY: e.clientY,
      isDragging: false,
      shortcut: shortcut,
      pointerId: e.pointerId
    };

    try {
      cell.setPointerCapture(e.pointerId);
    } catch (_) {}
  });

  cell.addEventListener('pointermove', (e) => {
    if (!dragSession || dragSession.srcRow !== Number(row) || dragSession.srcCol !== Number(col)) return;

    const dx = Math.abs(e.clientX - dragSession.startX);
    const dy = Math.abs(e.clientY - dragSession.startY);

    if (!dragSession.isDragging && (dx > 5 || dy > 5)) {
      dragSession.isDragging = true;
      document.body.classList.add('is-dragging');
      cell.classList.add('drag-source');
      createDragGhost(dragSession.shortcut, e.clientX, e.clientY);
    }

    if (dragSession.isDragging) {
      updateDragGhost(e.clientX, e.clientY);
      updateDragOverTarget(e.clientX, e.clientY);
    }
  });

  cell.addEventListener('pointerup', async (e) => {
    if (!dragSession || dragSession.srcRow !== Number(row) || dragSession.srcCol !== Number(col)) return;

    try {
      cell.releasePointerCapture(dragSession.pointerId);
    } catch (_) {}

    const wasDragging = dragSession.isDragging;
    const srcRow = dragSession.srcRow;
    const srcCol = dragSession.srcCol;

    cleanupDragGhost();
    document.body.classList.remove('is-dragging');
    cell.classList.remove('drag-source');
    clearAllDragOver();

    if (wasDragging) {
      wasJustDragging = true;

      // Find target cell under cursor at drop position
      const targetCellEl = getCellFromPoint(e.clientX, e.clientY);
      if (targetCellEl) {
        const dstRow = Number(targetCellEl.dataset.row);
        const dstCol = Number(targetCellEl.dataset.col);

        if (dstRow > 0 && dstCol > 0 && !(dstRow === srcRow && dstCol === srcCol)) {
          const srcShortcut = findShortcut(srcRow, srcCol);
          const dstShortcut = findShortcut(dstRow, dstCol);

          if (srcShortcut) {
            if (dstShortcut) {
              // SWAP shortcuts between source and target cells
              srcShortcut.row = dstRow;
              srcShortcut.col = dstCol;
              dstShortcut.row = srcRow;
              dstShortcut.col = srcCol;
            } else {
              // MOVE source shortcut to empty target cell
              srcShortcut.row = dstRow;
              srcShortcut.col = dstCol;
            }

            await saveSettings();
            renderGrid();
          }
        }
      }
    }

    dragSession = null;
  });

  cell.addEventListener('pointercancel', () => {
    cleanupDragGhost();
    document.body.classList.remove('is-dragging');
    cell.classList.remove('drag-source');
    clearAllDragOver();
    dragSession = null;
  });
}

// Drag Ghost Element Helpers
function createDragGhost(shortcut, x, y) {
  cleanupDragGhost();
  const ghost = document.createElement('div');
  ghost.id = 'drag-ghost-preview';
  ghost.style.width = `${state.settings.cellWidth}px`;
  ghost.style.height = `${state.settings.cellHeight}px`;

  const img = document.createElement('img');
  img.className = 'cell-icon';
  const customImg = getShortcutImage(shortcut);
  img.src = customImg || FALLBACK_SVG_ICON;

  const name = document.createElement('span');
  name.className = 'cell-name';
  name.textContent = getShortcutName(shortcut) || 'Shortcut';

  ghost.appendChild(img);
  ghost.appendChild(name);
  document.body.appendChild(ghost);
  updateDragGhost(x, y);
}

function updateDragGhost(x, y) {
  const ghost = document.getElementById('drag-ghost-preview');
  if (ghost) {
    ghost.style.left = `${x}px`;
    ghost.style.top = `${y}px`;
  }
}

function cleanupDragGhost() {
  const ghost = document.getElementById('drag-ghost-preview');
  if (ghost) ghost.remove();
}

function getCellFromPoint(x, y) {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  return el.closest('.cell-shortcut');
}

function updateDragOverTarget(x, y) {
  clearAllDragOver();
  const targetCell = getCellFromPoint(x, y);
  if (targetCell) {
    targetCell.classList.add('drag-over');
  }
}

function clearAllDragOver() {
  document.querySelectorAll('.cell-shortcut.drag-over').forEach(el => el.classList.remove('drag-over'));
}

// Add or Update Shortcut in Grid Cell
async function addOrUpdateShortcutCell(dstRow, dstCol, name, filePath, customIcon = '', argumentsStr = '') {
  let cleanInput = filePath.trim().replace(/^file:\/\/\/?/, '');
  cleanInput = decodeURIComponent(cleanInput);

  let targetPath = cleanInput;
  let targetArgs = argumentsStr || '';
  let targetName = name || '';
  let targetIcon = customIcon || '';

  try {
    const resolved = await invoke('resolve_shortcut', { path: cleanInput });
    if (resolved && resolved.target_path) {
      targetPath = resolved.target_path;
      if (!targetArgs && resolved.arguments) {
        targetArgs = resolved.arguments;
      }
      if (!targetName && resolved.name) {
        targetName = resolved.name;
      }
      if (!targetIcon && resolved.icon_path) {
        targetIcon = resolved.icon_path;
      }
    }
  } catch (_) {}

  if (targetPath.includes('/') && !targetPath.startsWith('http://') && !targetPath.startsWith('https://')) {
    targetPath = targetPath.replace(/\//g, '\\');
  }

  if (!targetName) {
    targetName = extractFileNameFromPath(targetPath) || 'Shortcut';
  }

  let shortcut = findShortcut(dstRow, dstCol);
  if (!shortcut) {
    shortcut = {
      row: Number(dstRow),
      col: Number(dstCol),
      name: targetName,
      shortcutLocation: targetPath,
      arguments: targetArgs,
      imageLocation: targetIcon
    };
    state.settings.shortcutList.push(shortcut);
  } else {
    shortcut.name = targetName;
    shortcut.shortcutLocation = targetPath;
    shortcut.arguments = targetArgs;
    if (targetIcon) shortcut.imageLocation = targetIcon;
  }

  await saveSettings();
  renderGrid();
}

// External OS File Drop Handler (for files dropped from Windows File Explorer)
async function handleExternalFileDrop(e, dstRow, dstCol) {
  e.preventDefault();
  e.stopPropagation();

  if (state.mode !== 'edit') return;

  let filePath = '';
  let name = '';

  if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    const droppedFile = e.dataTransfer.files[0];
    filePath = droppedFile.path || droppedFile.name;
    name = droppedFile.name ? droppedFile.name.replace(/\.[^/.]+$/, "") : '';
  } else if (e.dataTransfer) {
    const textData = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text/uri-list');
    if (textData) {
      filePath = textData.trim();
    }
  }

  if (filePath) {
    await addOrUpdateShortcutCell(dstRow, dstCol, name, filePath);
  }
}

function convertPhysicalToLogicalPosition(pos, scaleFactor = window.devicePixelRatio || 1) {
  if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number') return null;
  const dpi = scaleFactor > 0 ? scaleFactor : 1;
  return {
    x: pos.x / dpi,
    y: pos.y / dpi
  };
}

// Tauri 2.0 Native Window File Drop Listener
function setupTauriFileDropListener() {
  if (window.__TAURI__ && window.__TAURI__.event && typeof window.__TAURI__.event.listen === 'function') {
    window.__TAURI__.event.listen('tauri://drag-drop', async (event) => {
      console.log('[Tauri DragDrop Event]', event);
      if (state.mode !== 'edit') return;

      const paths = event.payload && event.payload.paths ? event.payload.paths : [];
      const pos = event.payload && event.payload.position ? event.payload.position : null;

      if (paths.length > 0 && pos) {
        const scaleFactor = window.devicePixelRatio || 1;
        const logicalPos = convertPhysicalToLogicalPosition(pos, scaleFactor);
        const targetEl = logicalPos ? document.elementFromPoint(logicalPos.x, logicalPos.y) : null;
        const cellEl = targetEl ? targetEl.closest('.cell-shortcut') : null;
        if (cellEl) {
          const dstRow = Number(cellEl.dataset.row);
          const dstCol = Number(cellEl.dataset.col);
          const filePath = paths[0];
          const name = filePath.split(/[\\/]/).pop().replace(/\.[^/.]+$/, "");
          await addOrUpdateShortcutCell(dstRow, dstCol, name, filePath);
        }
      }
    }).catch(() => {});
  }
}

function extractFileNameFromPath(fullPath) {
  if (!fullPath) return '';
  let cleanPath = fullPath.trim().replace(/[\\/]+$/, '');
  let fileName = cleanPath.split(/[\\/]/).pop() || '';
  if (fileName.includes('.')) {
    const extIndex = fileName.lastIndexOf('.');
    if (extIndex > 0) {
      fileName = fileName.substring(0, extIndex);
    }
  }
  return fileName;
}

function autoPopulateNameFromPath() {
  if (!elements.editPath || !elements.editName) return;
  const path = elements.editPath.value.trim();
  const currentName = elements.editName.value.trim();
  if (path && !currentName) {
    elements.editName.value = extractFileNameFromPath(path);
  }
}

// Modals Management
function openEditModal(row, col, shortcut) {
  state.editingCell = { row: Number(row), col: Number(col) };
  elements.editModalTitle.textContent = `Edit Cell (Row ${row}, Col ${col})`;
  elements.editName.value = getShortcutName(shortcut);
  elements.editPath.value = getShortcutLocation(shortcut);
  if (elements.editArgs) elements.editArgs.value = getShortcutArguments(shortcut);
  elements.editIcon.value = getShortcutImage(shortcut);
  
  autoPopulateNameFromPath();
  updateIconPreview();
  elements.modalEdit.classList.remove('hidden');

  if (elements.editName) {
    elements.editName.focus();
    setTimeout(() => {
      if (elements.editName) {
        elements.editName.focus();
        elements.editName.select();
      }
    }, 0);
  }
}

function closeEditModal() {
  elements.modalEdit.classList.add('hidden');
  state.editingCell = null;
}

async function updateIconPreview() {
  const path = elements.editPath.value.trim();
  const customIcon = elements.editIcon.value.trim();

  if (customIcon) {
    elements.editIconPreview.src = customIcon;
    elements.editIconPreview.classList.remove('hidden');
    elements.noIconText.classList.add('hidden');
  } else if (path) {
    try {
      const data = await getCachedIcon(path);
      if (data) {
        elements.editIconPreview.src = data;
        elements.editIconPreview.classList.remove('hidden');
        elements.noIconText.classList.add('hidden');
        return;
      }
    } catch (_) {}
    elements.editIconPreview.classList.add('hidden');
    elements.noIconText.classList.remove('hidden');
  } else {
    elements.editIconPreview.classList.add('hidden');
    elements.noIconText.classList.remove('hidden');
  }
}

let lastSettingsModalTheme = 'dark';

function openSettingsModal() {
  elements.settingRows.value = state.settings.rows;
  elements.settingCols.value = state.settings.columns;
  elements.settingWidth.value = state.settings.cellWidth;
  elements.settingHeight.value = state.settings.cellHeight;
  elements.settingHotkey.value = `${state.settings.modifier}+${state.settings.key}`;
  elements.settingCenterMouse.checked = state.settings.centerMouseOnStartup;
  if (elements.settingDebugLogging) {
    elements.settingDebugLogging.checked = !!state.settings.enableDebugLogging;
  }
  
  const theme = state.settings.theme || 'dark';
  elements.settingTheme.value = theme;
  lastSettingsModalTheme = theme;

  const defaults = getThemeDefaultColors(theme);
  const cellColor = normalizeHexColor(state.settings.cellColor, defaults.cellColor);
  const highlightColor = normalizeHexColor(state.settings.highlightColor, defaults.highlightColor);

  if (elements.settingCellColor) elements.settingCellColor.value = cellColor;
  if (elements.settingCellColorText) elements.settingCellColorText.value = cellColor;
  if (elements.settingHighlightColor) elements.settingHighlightColor.value = highlightColor;
  if (elements.settingHighlightColorText) elements.settingHighlightColorText.value = highlightColor;

  invoke('get_settings_path')
    .then((pathStr) => {
      if (elements.settingFilepath && pathStr) {
        elements.settingFilepath.value = pathStr;
      }
    })
    .catch((err) => console.error('Failed to get settings path:', err));

  elements.modalSettings.classList.remove('hidden');
}

function closeSettingsModal() {
  elements.modalSettings.classList.add('hidden');
}

// Open File Picker Trigger
async function triggerFilePicker() {
  // Method 1: Try Rust IPC RFD File Picker
  try {
    const selected = await invoke('pick_file');
    if (selected) {
      try {
        const resolved = await invoke('resolve_shortcut', { path: selected });
        if (resolved && resolved.target_path) {
          elements.editPath.value = resolved.target_path;
          if (resolved.arguments && elements.editArgs) {
            elements.editArgs.value = resolved.arguments;
          }
          if (resolved.name && elements.editName && !elements.editName.value.trim()) {
            elements.editName.value = resolved.name;
          }
        } else {
          elements.editPath.value = selected;
          autoPopulateNameFromPath();
        }
      } catch (_) {
        elements.editPath.value = selected;
        autoPopulateNameFromPath();
      }
      updateIconPreview();
      return;
    }
  } catch (e) {
    console.warn('Rust IPC pick_file failed, falling back to HTML file input:', e);
  }

  // Method 2: Fallback to HTML5 File Input
  if (elements.hiddenFileInput) {
    elements.hiddenFileInput.value = '';
    elements.hiddenFileInput.click();
  }
}

// Open Icon Picker Trigger
async function triggerIconPicker() {
  // Method 1: Try Rust IPC RFD File Picker
  try {
    const selected = await invoke('pick_image');
    if (selected) {
      elements.editIcon.value = selected;
      updateIconPreview();
      return;
    }
  } catch (e) {
    console.warn('Rust IPC pick_image failed, falling back to HTML icon input:', e);
  }

  // Method 2: Fallback to HTML5 Icon Input
  if (elements.hiddenIconInput) {
    elements.hiddenIconInput.value = '';
    elements.hiddenIconInput.click();
  }
}

let editPathDebounceTimer = null;

// Setup Event Listeners
function setupEventListeners() {
  // Mode switch buttons
  elements.btnModeLaunch.addEventListener('click', () => {
    state.mode = 'launch';
    elements.btnModeLaunch.classList.add('active');
    elements.btnModeEdit.classList.remove('active');
    renderGrid();
  });

  elements.btnModeEdit.addEventListener('click', () => {
    state.mode = 'edit';
    elements.btnModeEdit.classList.add('active');
    elements.btnModeLaunch.classList.remove('active');
    renderGrid();
  });

  // Settings button
  elements.btnSettings.addEventListener('click', openSettingsModal);

  // Edit Modal Buttons
  elements.btnCancelEdit.addEventListener('click', closeEditModal);
  elements.btnCloseEdit.addEventListener('click', closeEditModal);
  elements.editPath.addEventListener('input', () => {
    autoPopulateNameFromPath();
    clearTimeout(editPathDebounceTimer);
    editPathDebounceTimer = setTimeout(() => {
      updateIconPreview();
    }, 200);
  });
  elements.editPath.addEventListener('change', autoPopulateNameFromPath);
  elements.editIcon.addEventListener('input', updateIconPreview);

  const handleEditInputEnter = (e) => {
    if (e.key === 'Enter') {
      autoPopulateNameFromPath();
      const name = elements.editName.value.trim();
      const path = elements.editPath.value.trim();
      if (name && path) {
        e.preventDefault();
        elements.btnSaveEdit.click();
      }
    }
  };

  elements.editName.addEventListener('keydown', handleEditInputEnter);
  elements.editPath.addEventListener('keydown', handleEditInputEnter);
  if (elements.editArgs) elements.editArgs.addEventListener('keydown', handleEditInputEnter);

  elements.btnSaveEdit.addEventListener('click', async () => {
    if (!state.editingCell) return;
    const { row, col } = state.editingCell;
    const path = elements.editPath.value.trim();
    const args = elements.editArgs ? elements.editArgs.value.trim() : '';
    let name = elements.editName.value.trim();
    if (!name && path) {
      name = extractFileNameFromPath(path);
      elements.editName.value = name;
    }
    const icon = elements.editIcon.value.trim();

    if (!path && !name && !args) {
      // Remove shortcut if cleared
      state.settings.shortcutList = state.settings.shortcutList.filter(s => !(getShortcutRow(s) === Number(row) && getShortcutCol(s) === Number(col)));
    } else {
      let shortcut = findShortcut(row, col);
      if (!shortcut) {
        shortcut = { row: Number(row), col: Number(col), name: name || 'Shortcut', shortcutLocation: path, arguments: args, imageLocation: icon };
        state.settings.shortcutList.push(shortcut);
      } else {
        shortcut.name = name || 'Shortcut';
        shortcut.shortcutLocation = path;
        shortcut.arguments = args;
        shortcut.imageLocation = icon;
      }
    }

    await saveSettings();
    closeEditModal();
    renderGrid();
  });

  elements.btnDeleteShortcut.addEventListener('click', async () => {
    if (!state.editingCell) return;
    const { row, col } = state.editingCell;
    state.settings.shortcutList = state.settings.shortcutList.filter(s => !(getShortcutRow(s) === Number(row) && getShortcutCol(s) === Number(col)));
    await saveSettings();
    closeEditModal();
    renderGrid();
  });

  // Browse File Button Event Listener
  if (elements.btnBrowseFile) {
    elements.btnBrowseFile.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      triggerFilePicker();
    });
  }

  // Browse Icon Button Event Listener
  if (elements.btnBrowseIcon) {
    elements.btnBrowseIcon.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      triggerIconPicker();
    });
  }

  // HTML5 Hidden Inputs Event Listeners
  if (elements.hiddenFileInput) {
    elements.hiddenFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];
        const path = file.path || file.name;
        elements.editPath.value = path;
        autoPopulateNameFromPath();
        updateIconPreview();
      }
    });
  }

  if (elements.hiddenIconInput) {
    elements.hiddenIconInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];
        const path = file.path || file.name;
        elements.editIcon.value = path;
        updateIconPreview();
      }
    });
  }

  // Settings Theme & Color Picker Event Listeners
  if (elements.settingTheme) {
    elements.settingTheme.addEventListener('change', (e) => {
      const newTheme = e.target.value;
      const currentCell = elements.settingCellColorText ? elements.settingCellColorText.value : '';
      const currentHighlight = elements.settingHighlightColorText ? elements.settingHighlightColorText.value : '';

      const resolved = resolveThemeChangeColors(lastSettingsModalTheme, newTheme, currentCell, currentHighlight);
      lastSettingsModalTheme = newTheme;

      if (elements.settingCellColor) elements.settingCellColor.value = resolved.cellColor;
      if (elements.settingCellColorText) elements.settingCellColorText.value = resolved.cellColor;
      if (elements.settingHighlightColor) elements.settingHighlightColor.value = resolved.highlightColor;
      if (elements.settingHighlightColorText) elements.settingHighlightColorText.value = resolved.highlightColor;
    });
  }

  if (elements.settingCellColor && elements.settingCellColorText) {
    elements.settingCellColor.addEventListener('input', (e) => {
      elements.settingCellColorText.value = e.target.value;
    });
    elements.settingCellColorText.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (/^#?[0-9a-fA-F]{6}$/.test(val)) {
        elements.settingCellColor.value = normalizeHexColor(val);
      }
    });
  }

  if (elements.settingHighlightColor && elements.settingHighlightColorText) {
    elements.settingHighlightColor.addEventListener('input', (e) => {
      elements.settingHighlightColorText.value = e.target.value;
    });
    elements.settingHighlightColorText.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (/^#?[0-9a-fA-F]{6}$/.test(val)) {
        elements.settingHighlightColor.value = normalizeHexColor(val);
      }
    });
  }

  if (elements.btnResetCellColor) {
    elements.btnResetCellColor.addEventListener('click', () => {
      const theme = (elements.settingTheme && elements.settingTheme.value) || 'dark';
      const defaultColor = getThemeDefaultColors(theme).cellColor;
      if (elements.settingCellColor) elements.settingCellColor.value = defaultColor;
      if (elements.settingCellColorText) elements.settingCellColorText.value = defaultColor;
    });
  }

  if (elements.btnResetHighlightColor) {
    elements.btnResetHighlightColor.addEventListener('click', () => {
      const theme = (elements.settingTheme && elements.settingTheme.value) || 'dark';
      const defaultColor = getThemeDefaultColors(theme).highlightColor;
      if (elements.settingHighlightColor) elements.settingHighlightColor.value = defaultColor;
      if (elements.settingHighlightColorText) elements.settingHighlightColorText.value = defaultColor;
    });
  }

  if (elements.btnOpenSettingsFolder) {
    elements.btnOpenSettingsFolder.addEventListener('click', async () => {
      try {
        await invoke('open_settings_folder');
      } catch (err) {
        console.error('Failed to open settings folder:', err);
      }
    });
  }

  // Settings Modal Buttons
  elements.btnCancelSettings.addEventListener('click', closeSettingsModal);
  elements.btnCloseSettings.addEventListener('click', closeSettingsModal);

  if (elements.btnExitApp) {
    elements.btnExitApp.addEventListener('click', async () => {
      await invoke('exit_app');
    });
  }

  elements.btnSaveSettings.addEventListener('click', async () => {
    const clampVal = (val, min, max) => Math.max(min, Math.min(max, val));

    state.settings.rows = clampVal(parseInt(elements.settingRows.value, 10) || 5, 1, 20);
    state.settings.columns = clampVal(parseInt(elements.settingCols.value, 10) || 5, 1, 20);
    state.settings.cellWidth = clampVal(parseInt(elements.settingWidth.value, 10) || 150, 80, 400);
    state.settings.cellHeight = clampVal(parseInt(elements.settingHeight.value, 10) || 40, 30, 150);

    elements.settingRows.value = state.settings.rows;
    elements.settingCols.value = state.settings.columns;
    elements.settingWidth.value = state.settings.cellWidth;
    elements.settingHeight.value = state.settings.cellHeight;

    state.settings.centerMouseOnStartup = elements.settingCenterMouse.checked;
    if (elements.settingDebugLogging) {
      state.settings.enableDebugLogging = elements.settingDebugLogging.checked;
    }

    const hotkeyStr = elements.settingHotkey.value.trim();
    if (hotkeyStr.includes('+')) {
      const parts = hotkeyStr.split('+');
      state.settings.key = parts.pop();
      state.settings.modifier = parts.join('+');
    } else {
      state.settings.key = hotkeyStr;
      state.settings.modifier = '';
    }

    const theme = elements.settingTheme.value || 'dark';
    state.settings.theme = theme;

    const cellColorVal = (elements.settingCellColorText && elements.settingCellColorText.value.trim()) || (elements.settingCellColor && elements.settingCellColor.value);
    const highlightColorVal = (elements.settingHighlightColorText && elements.settingHighlightColorText.value.trim()) || (elements.settingHighlightColor && elements.settingHighlightColor.value);

    const themeDefaults = getThemeDefaultColors(theme);
    state.settings.cellColor = normalizeHexColor(cellColorVal, themeDefaults.cellColor);
    state.settings.highlightColor = normalizeHexColor(highlightColorVal, themeDefaults.highlightColor);

    applyThemeAndColors();

    await saveSettings();
    closeSettingsModal();
    renderGrid();
    fitWindowToGrid();
  });

  // Modal Backdrop Click Dismiss Listeners
  if (elements.modalEdit) {
    elements.modalEdit.addEventListener('click', (e) => {
      if (e.target === elements.modalEdit) {
        closeEditModal();
      }
    });
  }
  if (elements.modalSettings) {
    elements.modalSettings.addEventListener('click', (e) => {
      if (e.target === elements.modalSettings) {
        closeSettingsModal();
      }
    });
  }

  // Global Escape Key Listener (closes modals if open, else hides window to tray)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const isEditModalOpen = elements.modalEdit && !elements.modalEdit.classList.contains('hidden');
      const isSettingsModalOpen = elements.modalSettings && !elements.modalSettings.classList.contains('hidden');

      if (isEditModalOpen) {
        closeEditModal();
      } else if (isSettingsModalOpen) {
        closeSettingsModal();
      } else {
        hideWindow();
      }
    }
  });
}

// Start Application on Load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
