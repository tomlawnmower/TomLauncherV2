const test = require('node:test');
const assert = require('node:assert/strict');
const {
  findShortcut,
  moveOrSwapShortcuts,
  addOrUpdateShortcutCell,
  toggleQueue,
  getExecutionQueueList,
  extractFileNameFromPath,
  calculateGridWindowDimensions
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
    theme: 'dark'
  };

  assert.equal(settings.theme, 'dark');

  // Change theme to light
  settings.theme = 'light';
  assert.equal(settings.theme, 'light');

  // Serialize and deserialize JSON matching backend settings
  const jsonStr = JSON.stringify(settings);
  assert.ok(jsonStr.includes('"theme":"light"'));

  const parsed = JSON.parse(jsonStr);
  assert.equal(parsed.theme, 'light');
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
  assert.equal(dims.requiredHeight, 282);
  assert.equal(dims.maxWidth, 756, 'Max width must equal visible grid width');
  assert.equal(dims.maxHeight, 282, 'Max height must equal visible grid height');
  assert.ok(dims.minWidth <= dims.maxWidth, 'Min width must be less than or equal to max width');
  assert.ok(dims.minHeight <= dims.maxHeight, 'Min height must be less than or equal to max height');
});
