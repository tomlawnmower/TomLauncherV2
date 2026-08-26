// Pure JS grid & accessor logic for TomLauncher V2

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

function findShortcut(shortcutList, row, col) {
  if (!shortcutList) return null;
  return shortcutList.find(s => getShortcutRow(s) === Number(row) && getShortcutCol(s) === Number(col)) || null;
}

function moveOrSwapShortcuts(shortcutList, srcRow, srcCol, targetRow, targetCol) {
  if (srcRow === targetRow && srcCol === targetCol) return shortcutList;

  const srcShortcut = findShortcut(shortcutList, srcRow, srcCol);
  const dstShortcut = findShortcut(shortcutList, targetRow, targetCol);

  if (!srcShortcut) return shortcutList;

  if (dstShortcut) {
    // Swap
    srcShortcut.row = Number(targetRow);
    srcShortcut.col = Number(targetCol);
    dstShortcut.row = Number(srcRow);
    dstShortcut.col = Number(srcCol);
  } else {
    // Move
    srcShortcut.row = Number(targetRow);
    srcShortcut.col = Number(targetCol);
  }

  return shortcutList;
}

function splitPathAndArgsJS(rawPath, rawArgs = '') {
  const trimmedPath = rawPath.trim();
  const trimmedArgs = rawArgs.trim();

  if (trimmedArgs) {
    return { targetPath: trimmedPath, argumentsStr: trimmedArgs };
  }

  if (!trimmedPath) {
    return { targetPath: '', argumentsStr: '' };
  }

  if (trimmedPath.startsWith('http://') || trimmedPath.startsWith('https://')) {
    return { targetPath: trimmedPath, argumentsStr: '' };
  }

  if (trimmedPath.startsWith('"')) {
    const endQuoteIdx = trimmedPath.indexOf('"', 1);
    if (endQuoteIdx > 0) {
      const target = trimmedPath.substring(1, endQuoteIdx);
      const rest = trimmedPath.substring(endQuoteIdx + 1).trim();
      return { targetPath: target, argumentsStr: rest };
    }
  }

  const lower = trimmedPath.toLowerCase();
  const exts = ['.exe', '.bat', '.cmd', '.com', '.lnk', '.ps1', '.vbs'];
  for (const ext of exts) {
    const idx = lower.indexOf(ext);
    if (idx >= 0) {
      const splitPos = idx + ext.length;
      const target = trimmedPath.substring(0, splitPos);
      const rest = trimmedPath.substring(splitPos).trim();
      return { targetPath: target, argumentsStr: rest };
    }
  }

  return { targetPath: trimmedPath, argumentsStr: '' };
}

function addOrUpdateShortcutCell(shortcutList, dstRow, dstCol, name, filePath, customIcon = '', argumentsStr = '') {
  let cleanInput = filePath.trim().replace(/^file:\/\/\/?/, '');
  cleanInput = decodeURIComponent(cleanInput);

  const { targetPath: rawTarget, argumentsStr: resolvedArgs } = splitPathAndArgsJS(cleanInput, argumentsStr);

  let targetPath = rawTarget;
  if (targetPath.includes('/') && !targetPath.startsWith('http://') && !targetPath.startsWith('https://')) {
    targetPath = targetPath.replace(/\//g, '\\');
  }

  let cleanName = name || targetPath.split(/[\\/]/).pop().replace(/\.[^/.]+$/, "") || 'Shortcut';

  let shortcut = findShortcut(shortcutList, dstRow, dstCol);
  if (!shortcut) {
    shortcut = {
      row: Number(dstRow),
      col: Number(dstCol),
      name: cleanName,
      shortcutLocation: targetPath,
      arguments: resolvedArgs,
      imageLocation: customIcon || ''
    };
    shortcutList.push(shortcut);
  } else {
    shortcut.name = cleanName;
    shortcut.shortcutLocation = targetPath;
    shortcut.arguments = resolvedArgs;
    if (customIcon) shortcut.imageLocation = customIcon;
  }

  return shortcutList;
}

function toggleQueue(queue, shortcut) {
  const row = getShortcutRow(shortcut);
  const col = getShortcutCol(shortcut);
  const idx = queue.findIndex(q => getShortcutRow(q) === row && getShortcutCol(q) === col);

  if (idx >= 0) {
    queue.splice(idx, 1);
  } else {
    queue.push(shortcut);
  }

  return queue;
}

function getExecutionQueueList(clickedShortcut, currentQueue) {
  const clickRow = getShortcutRow(clickedShortcut);
  const clickCol = getShortcutCol(clickedShortcut);
  
  const remaining = currentQueue.filter(q => !(getShortcutRow(q) === clickRow && getShortcutCol(q) === clickCol));
  return [clickedShortcut, ...remaining];
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

function calculateGridWindowDimensions(rows, columns, cellWidth, cellHeight, extraW = 0, extraH = 0) {
  const gridWidth = (columns * cellWidth) + (Math.max(0, columns - 1) * 1);
  const gridHeight = (rows * cellHeight) + (Math.max(0, rows - 1) * 1);

  const requiredWidth = Math.max(320, gridWidth + 2);
  const requiredHeight = gridHeight + 48 + 28 + 2;

  const targetWidth = requiredWidth + extraW;
  const targetHeight = requiredHeight + extraH;

  const minW = Math.min(200, targetWidth);
  const minH = Math.min(140, targetHeight);

  return {
    requiredWidth: targetWidth,
    requiredHeight: targetHeight,
    maxWidth: targetWidth,
    maxHeight: targetHeight,
    minWidth: minW,
    minHeight: minH
  };
}

module.exports = {
  getShortcutLocation,
  getShortcutName,
  getShortcutImage,
  getShortcutArguments,
  getShortcutRow,
  getShortcutCol,
  findShortcut,
  moveOrSwapShortcuts,
  addOrUpdateShortcutCell,
  toggleQueue,
  getExecutionQueueList,
  extractFileNameFromPath,
  calculateGridWindowDimensions
};
