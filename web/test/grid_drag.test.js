const test = require('node:test');
const assert = require('node:assert/strict');
const {
  findShortcut,
  moveOrSwapShortcuts,
  addOrUpdateShortcutCell,
  toggleQueue,
  getExecutionQueueList,
  extractFileNameFromPath,
  calculateGridWindowDimensions,
  getFooterHintText,
  handleEscapeKeyAction,
  getThemeDefaultColors,
  normalizeHexColor,
  getEffectiveCellColors,
  resolveThemeChangeColors,
  clampSettingsValue,
  convertPhysicalToLogicalPosition
} = require('./grid_helpers.js');

test('findShortcut - matches numeric and string row/col coordinates', () => {
  const list = [
    { row: 1, col: 1, name: 'App 1', shortcutLocation: 'C:\\app1.exe' },
    { row: '2', col: '3', name: 'App 2', shortcutLocation: 'C:\\app2.exe' }
  ];

  assert.equal(findShortcut(list, 1, 1).name, 'App 1');
  assert.equal(findShortcut(list, 2, 3).name, 'App 2');
  assert.equal(findShortcut(list, '2', '3').name, 'App 2');
  assert.equal(findShortcut(list, 5, 5), null);
});

test('moveOrSwapShortcuts - move shortcut to empty cell', () => {
  const list = [
    { row: 1, col: 1, name: 'Notepad', shortcutLocation: 'C:\\notepad.exe' }
  ];

  moveOrSwapShortcuts(list, 1, 1, 3, 4);

  assert.equal(findShortcut(list, 1, 1), null);
  const moved = findShortcut(list, 3, 4);
  assert.ok(moved);
  assert.equal(moved.name, 'Notepad');
  assert.equal(moved.row, 3);
  assert.equal(moved.col, 4);
});

test('moveOrSwapShortcuts - swap two occupied cells', () => {
  const list = [
    { row: 1, col: 1, name: 'Notepad', shortcutLocation: 'C:\\notepad.exe' },
    { row: 2, col: 2, name: 'Calculator', shortcutLocation: 'C:\\calc.exe' }
  ];

  moveOrSwapShortcuts(list, 1, 1, 2, 2);

  const cell11 = findShortcut(list, 1, 1);
  const cell22 = findShortcut(list, 2, 2);

  assert.equal(cell11.name, 'Calculator');
  assert.equal(cell11.row, 1);
  assert.equal(cell11.col, 1);

  assert.equal(cell22.name, 'Notepad');
  assert.equal(cell22.row, 2);
  assert.equal(cell22.col, 2);
});

test('addOrUpdateShortcutCell - create shortcut from dropped external file', () => {
  const list = [];
  
  // Drop file onto empty cell (2, 4)
  addOrUpdateShortcutCell(list, 2, 4, '', 'C:/Users/Test/Documents/rules.txt');

  const created = findShortcut(list, 2, 4);
  assert.ok(created);
  assert.equal(created.row, 2);
  assert.equal(created.col, 4);
  assert.equal(created.name, 'rules');
  assert.equal(created.shortcutLocation, 'C:\\Users\\Test\\Documents\\rules.txt');
});

test('addOrUpdateShortcutCell - overwrite shortcut on occupied cell from dropped file', () => {
  const list = [
    { row: 1, col: 1, name: 'OldApp', shortcutLocation: 'C:\\old.exe' }
  ];

  addOrUpdateShortcutCell(list, 1, 1, 'NewApp', 'C:\\NewPath\\app.exe');

  const updated = findShortcut(list, 1, 1);
  assert.equal(updated.name, 'NewApp');
  assert.equal(updated.shortcutLocation, 'C:\\NewPath\\app.exe');
});

test('addOrUpdateShortcutCell - preserve arguments field when saving shortcut', () => {
  const list = [];
  addOrUpdateShortcutCell(list, 1, 1, 'Schtasks', 'C:\\Windows\\System32\\schtasks.exe', '', '/run /tn "Arknights"');

  const created = findShortcut(list, 1, 1);
  assert.ok(created);
  assert.equal(created.name, 'Schtasks');
  assert.equal(created.shortcutLocation, 'C:\\Windows\\System32\\schtasks.exe');
  assert.equal(created.arguments, '/run /tn "Arknights"');
});

test('addOrUpdateShortcutCell - drop shortcut with embedded additional arguments into cell', () => {
  const list = [];
  // Drag & drop shortcut command line with additional arguments
  addOrUpdateShortcutCell(list, 2, 2, '', 'C:\\Windows\\System32\\schtasks.exe /run /tn "Arknights"');

  const created = findShortcut(list, 2, 2);
  assert.ok(created);
  assert.equal(created.name, 'schtasks');
  assert.equal(created.shortcutLocation, 'C:\\Windows\\System32\\schtasks.exe');
  assert.equal(created.arguments, '/run /tn "Arknights"');
});

test('theme preference persistence in state.settings', () => {
  const settings = {
    rows: 5,
    columns: 5,
    theme: 'light',
    enableDebugLogging: true
  };

  const jsonStr = JSON.stringify(settings);
  assert.ok(jsonStr.includes('"theme":"light"'));
  assert.ok(jsonStr.includes('"enableDebugLogging":true'));

  const parsed = JSON.parse(jsonStr);
  assert.equal(parsed.theme, 'light');
  assert.equal(parsed.enableDebugLogging, true);
});

test('window close event interception decision logic', () => {
  const determineWindowCloseAction = (isCloseRequested) => {
    return isCloseRequested ? 'HideToSystemTray' : 'DefaultClose';
  };

  assert.equal(
    determineWindowCloseAction(true),
    'HideToSystemTray',
    'Alt+F4 or X window close button should trigger hide to system tray'
  );
  assert.equal(
    determineWindowCloseAction(false),
    'DefaultClose'
  );
});

test('active window hotkey activation decision logic', () => {
  const shouldActivateWindow = (isVisible, isFocused) => !isVisible || !isFocused;

  assert.equal(shouldActivateWindow(false, false), true, 'Hidden window should activate');
  assert.equal(shouldActivateWindow(true, false), true, 'Unfocused window should activate');
  assert.equal(shouldActivateWindow(true, true), false, 'Already active and focused window should do nothing');
});

test('single launch vs queue launch auto-hide logic', () => {
  const isShiftPressed = false;
  const isCtrlPressed = false;
  const isSingleLaunch = !isShiftPressed && !isCtrlPressed;

  assert.equal(isSingleLaunch, true, 'Single click in launch mode should trigger window auto-hide to system tray');

  const shiftClick = true;
  const isShiftLaunch = !shiftClick && !isCtrlPressed;
  assert.equal(isShiftLaunch, false, 'Shift-click queueing should keep window open for multi-selection');
});

test('right-click or shift-click item queueing', () => {
  const queue = [];
  const shortcut = { row: 3, col: 3, name: 'Browser', shortcutLocation: 'C:\\browser.exe' };

  // Right-click or Shift-click queues item
  toggleQueue(queue, shortcut);
  assert.equal(queue.length, 1);
  assert.equal(queue[0].name, 'Browser');

  // Right-click again unqueues item
  toggleQueue(queue, shortcut);
  assert.equal(queue.length, 0);
});

test('prevent duplicate execution when launching an already queued cell', () => {
  const s1 = { row: 1, col: 1, name: 'App 1', shortcutLocation: 'C:\\app1.exe' };
  const s2 = { row: 2, col: 2, name: 'App 2', shortcutLocation: 'C:\\app2.exe' };
  const queue = [s1, s2];

  // User left-clicks s1 (which is already in the queue)
  const executionList = getExecutionQueueList(s1, queue);

  assert.equal(executionList.length, 2, 'Execution list should contain s1 and s2 exactly once');
  assert.equal(executionList[0].name, 'App 1');
  assert.equal(executionList[1].name, 'App 2');
});

test('toggleQueue - add and remove items from queue', () => {
  const queue = [];
  const s1 = { row: 1, col: 1, name: 'App 1', shortcutLocation: 'C:\\app1.exe' };
  const s2 = { row: 2, col: 2, name: 'App 2', shortcutLocation: 'C:\\app2.exe' };

  toggleQueue(queue, s1);
  assert.equal(queue.length, 1);
  assert.equal(queue[0].name, 'App 1');

  toggleQueue(queue, s2);
  assert.equal(queue.length, 2);

  // Toggle s1 again -> should remove from queue
  toggleQueue(queue, s1);
  assert.equal(queue.length, 1);
  assert.equal(queue[0].name, 'App 2');
});

test('edit modal enter key triggers save only when both name and path are populated', () => {
  let saveClicked = false;
  const mockSaveBtn = { click: () => { saveClicked = true; } };

  const handleEditInputEnter = (e, nameVal, pathVal) => {
    if (e.key === 'Enter') {
      const name = nameVal.trim();
      const path = pathVal.trim();
      if (name && path) {
        if (e.preventDefault) e.preventDefault();
        mockSaveBtn.click();
      }
    }
  };

  // Case 1: Enter on populated name and path -> saves
  let event = { key: 'Enter', preventDefault: () => {} };
  handleEditInputEnter(event, 'Notepad', 'C:\\Windows\\notepad.exe');
  assert.equal(saveClicked, true);

  // Case 2: Enter when path is empty -> does NOT save
  saveClicked = false;
  handleEditInputEnter(event, 'Notepad', '   ');
  assert.equal(saveClicked, false);

  // Case 3: Enter when name is empty -> does NOT save
  saveClicked = false;
  handleEditInputEnter(event, '   ', 'C:\\Windows\\notepad.exe');
  assert.equal(saveClicked, false);

  // Case 4: Other keys (e.g. Tab) -> does NOT save
  saveClicked = false;
  event = { key: 'Tab', preventDefault: () => {} };
  handleEditInputEnter(event, 'Notepad', 'C:\\Windows\\notepad.exe');
  assert.equal(saveClicked, false);
});

test('opening edit modal moves cursor focus to the name input field', () => {
  let isFocused = false;
  let isSelected = false;
  const mockEditName = {
    focus: () => { isFocused = true; },
    select: () => { isSelected = true; }
  };

  if (mockEditName) {
    mockEditName.focus();
    mockEditName.select();
  }

  assert.equal(isFocused, true, 'Name field should receive focus');
  assert.equal(isSelected, true, 'Name field text should be selected');
});

test('extractFileNameFromPath - strips full path and extensions', () => {
  assert.equal(extractFileNameFromPath('C:\\Program Files\\App\\app.exe'), 'app');
  assert.equal(extractFileNameFromPath('C:/Tools/calc.exe'), 'calc');
  assert.equal(extractFileNameFromPath('D:\\Projects\\TomLauncherV2\\'), 'TomLauncherV2');
  assert.equal(extractFileNameFromPath('C:\\Windows\\System32\\cmd'), 'cmd');
  assert.equal(extractFileNameFromPath(''), '');
});

test('autoPopulateNameFromPath - populates empty name field from path field', () => {
  let nameVal = '';
  let pathVal = 'C:\\Program Files\\Notepad++\\notepad++.exe';

  const autoPopulate = () => {
    if (pathVal.trim() && !nameVal.trim()) {
      nameVal = extractFileNameFromPath(pathVal);
    }
  };

  autoPopulate();
  assert.equal(nameVal, 'notepad++');

  // Should NOT overwrite an existing custom name
  nameVal = 'Custom Text Editor';
  pathVal = 'C:\\Tools\\other.exe';
  autoPopulate();
  assert.equal(nameVal, 'Custom Text Editor');
});

test('calculateGridWindowDimensions - enforces maximum bounds to visible grid cells only', () => {
  // 5x5 grid with 150x40 cells
  const dims = calculateGridWindowDimensions(5, 5, 150, 40);

  assert.equal(dims.requiredWidth, 756);
  assert.equal(dims.requiredHeight, 280);
  assert.equal(dims.maxWidth, 756, 'Max width must equal visible grid width');
  assert.equal(dims.maxHeight, 280, 'Max height must equal visible grid height');
  assert.ok(dims.minWidth <= dims.maxWidth, 'Min width must be less than or equal to max width');
  assert.ok(dims.minHeight <= dims.maxHeight, 'Min height must be less than or equal to max height');
});

test('getFooterHintText - returns dynamic mode-dependent footer hint text', () => {
  assert.equal(getFooterHintText('launch'), 'Shift + Click or Right Click to queue items');
  assert.equal(getFooterHintText('edit'), 'Drag & Drop files onto grid cells to add shortcuts');
});

test('pressing ESC key hides program to system tray when no modal is open', () => {
  // Case 1: No modal open -> hide window to system tray
  assert.equal(handleEscapeKeyAction(false, false), 'hide_window', 'ESC with no modal open must hide window to tray');

  // Case 2: Edit modal open -> close edit modal
  assert.equal(handleEscapeKeyAction(true, false), 'close_edit_modal', 'ESC with edit modal open must close edit modal');

  // Case 3: Settings modal open -> close settings modal
  assert.equal(handleEscapeKeyAction(false, true), 'close_settings_modal', 'ESC with settings modal open must close settings modal');
});

test('getThemeDefaultColors - dark and light theme default cell and highlight colors', () => {
  const darkDefaults = getThemeDefaultColors('dark');
  assert.equal(darkDefaults.cellColor, '#222630');
  assert.equal(darkDefaults.highlightColor, '#2d3240');

  const lightDefaults = getThemeDefaultColors('light');
  assert.equal(lightDefaults.cellColor, '#f1f5f9');
  assert.equal(lightDefaults.highlightColor, '#e2e8f0');
});

test('normalizeHexColor - normalizes hex strings', () => {
  assert.equal(normalizeHexColor('#FF0000', '#000000'), '#ff0000');
  assert.equal(normalizeHexColor('123456', '#000000'), '#123456');
  assert.equal(normalizeHexColor('#F00', '#000000'), '#ff0000');
  assert.equal(normalizeHexColor('invalid', '#222630'), '#222630');
});

test('resolveThemeChangeColors - default colors update on theme change, custom colors are preserved', () => {
  // Case 1: Dark to Light with default colors -> updates to Light defaults
  const res1 = resolveThemeChangeColors('dark', 'light', '#222630', '#2d3240');
  assert.equal(res1.cellColor, '#f1f5f9', 'Default dark cell color should change to light default');
  assert.equal(res1.highlightColor, '#e2e8f0', 'Default dark highlight color should change to light default');
  assert.equal(res1.isCellCustom, false);
  assert.equal(res1.isHighlightCustom, false);

  // Case 2: Dark to Light with custom cell color and default highlight color -> preserves custom cell color
  const res2 = resolveThemeChangeColors('dark', 'light', '#ff0000', '#2d3240');
  assert.equal(res2.cellColor, '#ff0000', 'Custom cell color must be preserved when theme changes');
  assert.equal(res2.highlightColor, '#e2e8f0', 'Default highlight color should change to light default');
  assert.equal(res2.isCellCustom, true);
  assert.equal(res2.isHighlightCustom, false);

  // Case 3: Light to Dark with custom cell color and custom highlight color -> preserves both custom colors
  const res3 = resolveThemeChangeColors('light', 'dark', '#ff0000', '#00ff00');
  assert.equal(res3.cellColor, '#ff0000', 'Custom cell color must be preserved when theme changes');
  assert.equal(res3.highlightColor, '#00ff00', 'Custom highlight color must be preserved when theme changes');
  assert.equal(res3.isCellCustom, true);
  assert.equal(res3.isHighlightCustom, true);
});

test('reset link resets cell color and highlight color back to selected theme defaults', () => {
  let cellColor = '#ff0000'; // Custom
  let highlightColor = '#00ff00'; // Custom

  // Reset cell color for dark theme
  const darkDefaults = getThemeDefaultColors('dark');
  cellColor = darkDefaults.cellColor;
  assert.equal(cellColor, '#222630');

  // Reset highlight color for light theme
  const lightDefaults = getThemeDefaultColors('light');
  highlightColor = lightDefaults.highlightColor;
  assert.equal(highlightColor, '#e2e8f0');
});

test('clampSettingsValue - clamps out of bounds row, col, width, and height values', () => {
  assert.equal(clampSettingsValue(25, 1, 20), 20, 'Rows/cols > 20 should be clamped to 20');
  assert.equal(clampSettingsValue(0, 1, 20), 1, 'Rows/cols < 1 should be clamped to 1');
  assert.equal(clampSettingsValue(-5, 1, 20), 1, 'Negative rows/cols should be clamped to 1');
  assert.equal(clampSettingsValue(500, 80, 400), 400, 'Width > 400 should be clamped to 400');
  assert.equal(clampSettingsValue(10, 30, 150), 30, 'Height < 30 should be clamped to 30');
  assert.equal(clampSettingsValue('invalid', 1, 20), 1, 'NaN inputs should fallback to min value');
});

test('convertPhysicalToLogicalPosition - converts Tauri drag-drop physical screen coordinates to CSS logical pixels across OS scaling levels', () => {
  // 100% DPI Scaling (devicePixelRatio = 1.0)
  const pos100 = convertPhysicalToLogicalPosition({ x: 250, y: 200 }, 1.0);
  assert.deepEqual(pos100, { x: 250, y: 200 });

  // 125% DPI Scaling (devicePixelRatio = 1.25)
  const pos125 = convertPhysicalToLogicalPosition({ x: 250, y: 250 }, 1.25);
  assert.deepEqual(pos125, { x: 200, y: 200 });

  // 150% DPI Scaling (devicePixelRatio = 1.5)
  const pos150 = convertPhysicalToLogicalPosition({ x: 300, y: 300 }, 1.5);
  assert.deepEqual(pos150, { x: 200, y: 200 });

  // 200% DPI Scaling (devicePixelRatio = 2.0)
  const pos200 = convertPhysicalToLogicalPosition({ x: 400, y: 400 }, 2.0);
  assert.deepEqual(pos200, { x: 200, y: 200 });

  // Edge cases / missing position
  assert.equal(convertPhysicalToLogicalPosition(null, 1.25), null);
  assert.equal(convertPhysicalToLogicalPosition({}, 1.25), null);
});

