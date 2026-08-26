const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getShortcutLocation,
  getShortcutName,
  getShortcutImage,
  getShortcutArguments,
  getShortcutRow,
  getShortcutCol
} = require('./grid_helpers.js');

test('Property Accessors - camelCase JSON entries', () => {
  const item = {
    row: 1,
    col: 2,
    name: 'Notepad',
    shortcutLocation: 'C:\\Windows\\notepad.exe',
    arguments: '/run /tn "Arknights"',
    imageLocation: 'C:\\Icons\\notepad.png'
  };

  assert.equal(getShortcutRow(item), 1);
  assert.equal(getShortcutCol(item), 2);
  assert.equal(getShortcutName(item), 'Notepad');
  assert.equal(getShortcutLocation(item), 'C:\\Windows\\notepad.exe');
  assert.equal(getShortcutArguments(item), '/run /tn "Arknights"');
  assert.equal(getShortcutImage(item), 'C:\\Icons\\notepad.png');
});

test('Property Accessors - PascalCase legacy XML entries', () => {
  const legacyItem = {
    Row: '3',
    Column: '4',
    Name: 'Calculator',
    ShortcutLocation: 'C:\\Windows\\calc.exe',
    Arguments: '/test',
    ImageLocation: ''
  };

  assert.equal(getShortcutRow(legacyItem), 3);
  assert.equal(getShortcutCol(legacyItem), 4);
  assert.equal(getShortcutName(legacyItem), 'Calculator');
  assert.equal(getShortcutLocation(legacyItem), 'C:\\Windows\\calc.exe');
  assert.equal(getShortcutArguments(legacyItem), '/test');
  assert.equal(getShortcutImage(legacyItem), '');
});

test('Property Accessors - Falsy and missing inputs', () => {
  assert.equal(getShortcutRow(null), -1);
  assert.equal(getShortcutCol(undefined), -1);
  assert.equal(getShortcutLocation(null), '');
  assert.equal(getShortcutName(null), '');
  assert.equal(getShortcutArguments(null), '');
  assert.equal(getShortcutImage(null), '');
});

test('Property Accessors - Row and Col 0 coercion', () => {
  const zeroItem = { row: 0, col: 0, name: 'ZeroItem', shortcutLocation: 'C:\\zero.exe' };
  assert.equal(getShortcutRow(zeroItem), 0);
  assert.equal(getShortcutCol(zeroItem), 0);
});
