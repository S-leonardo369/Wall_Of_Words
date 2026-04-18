const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, shell, nativeImage, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');

// Keep references alive
let tray = null;
let settingsWindow = null;
let store = null;
let wallpaperManager = null;
let isFirstRun = false;

// Load modules after app ready
async function loadModules() {
  const Store = require('electron-store');
  store = new Store({
    defaults: {
      firstRun: true,
      wallpaperSource: 'default',
      customWallpapers: [],
      wordsPerDay: 3,
      scheduleEnabled: true,
      currentWord: null,
      wordHistory: [],
      textPosition: { x: 50, y: 50 },
      setupComplete: false
    }
  });

  const WallpaperManager = require('./src/wallpaperManager');
  wallpaperManager = new WallpaperManager(store);
}

function createSettingsWindow(page = 'setup') {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    settingsWindow.webContents.send('navigate', page);
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 860,
    height: 620,
    minWidth: 700,
    minHeight: 500,
    frame: false,
    transparent: false,
    backgroundColor: '#1e1e2e',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'src', 'preload.js')
    },
    show: false
  });

  settingsWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  settingsWindow.once('ready-to-show', () => {
    settingsWindow.show();
    if (page !== 'setup') {
      settingsWindow.webContents.send('navigate', page);
    }
  });

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon.resize({ width: 16, height: 16 }));

  const updateMenu = () => {
    const currentWord = store.get('currentWord');
    const wordLabel = currentWord ? `Word: ${currentWord.word}` : 'No word loaded';

    const contextMenu = Menu.buildFromTemplate([
      { label: 'Wall of Words', enabled: false },
      { type: 'separator' },
      { label: wordLabel, enabled: false },
      { type: 'separator' },
      {
        label: 'Open Settings',
        click: () => createSettingsWindow('settings')
      },
      {
        label: 'Refresh Wallpaper',
        click: async () => {
          await wallpaperManager.updateWallpaper();
          updateMenu();
        }
      },
      { type: 'separator' },
      {
        label: 'Exit',
        click: () => {
          app.isQuiting = true;
          app.quit();
        }
      }
    ]);

    tray.setContextMenu(contextMenu);
  };

  tray.setToolTip('Wall of Words');
  updateMenu();

  tray.on('double-click', () => createSettingsWindow('settings'));

  // Expose updateMenu for wallpaper manager to call
  global.updateTrayMenu = updateMenu;
}

function setupScheduler() {
  // 8:00 AM
  cron.schedule('0 8 * * *', async () => {
    await wallpaperManager.updateWallpaper();
    if (global.updateTrayMenu) global.updateTrayMenu();
  });

  // 1:00 PM
  cron.schedule('0 13 * * *', async () => {
    await wallpaperManager.updateWallpaper();
    if (global.updateTrayMenu) global.updateTrayMenu();
  });

  // 7:00 PM
  cron.schedule('0 19 * * *', async () => {
    await wallpaperManager.updateWallpaper();
    if (global.updateTrayMenu) global.updateTrayMenu();
  });
}

function registerShortcuts() {
  globalShortcut.register('CommandOrControl+Shift+U', () => {
    const currentWord = store.get('currentWord');
    if (currentWord && currentWord.word) {
      const query = encodeURIComponent(currentWord.word);
      shell.openExternal(`https://www.merriam-webster.com/dictionary/${query}`);
    }
  });
}

function setupAutoLaunch() {
  app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: true,
    path: app.getPath('exe')
  });
}

// IPC Handlers
function setupIPC() {
  ipcMain.handle('get-settings', () => store.store);

  ipcMain.handle('save-settings', (event, settings) => {
    Object.entries(settings).forEach(([key, value]) => {
      store.set(key, value);
    });
    return true;
  });

  ipcMain.handle('get-current-word', () => store.get('currentWord'));

  ipcMain.handle('refresh-wallpaper', async () => {
    const result = await wallpaperManager.updateWallpaper();
    if (global.updateTrayMenu) global.updateTrayMenu();
    return result;
  });

  ipcMain.handle('complete-setup', async (event, settings) => {
    Object.entries(settings).forEach(([key, value]) => {
      store.set(key, value);
    });
    store.set('firstRun', false);
    store.set('setupComplete', true);
    setupAutoLaunch();
    await wallpaperManager.updateWallpaper();
    if (global.updateTrayMenu) global.updateTrayMenu();
    return true;
  });

  ipcMain.handle('select-wallpaper', async () => {
    const result = await dialog.showOpenDialog(settingsWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'bmp'] }]
    });
    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle('close-window', () => {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.close();
    }
  });

  ipcMain.handle('minimize-window', () => {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.minimize();
    }
  });

  ipcMain.handle('get-word-history', () => store.get('wordHistory', []));

  ipcMain.handle('save-quiz-score', (event, { range, score, total }) => {
    const key = `quizBest_${range}`;
    const prev = store.get(key, 0);
    const pct = Math.round((score / total) * 100);
    if (pct > prev) store.set(key, pct);
    return store.get(key);
  });

  ipcMain.handle('get-quiz-best', (event, range) => store.get(`quizBest_${range}`, null));

  ipcMain.handle('open-word-browser', () => {
    const currentWord = store.get('currentWord');
    if (currentWord && currentWord.word) {
      const query = encodeURIComponent(currentWord.word);
      shell.openExternal(`https://www.merriam-webster.com/dictionary/${query}`);
    }
  });
}

app.whenReady().then(async () => {
  await loadModules();
  setupIPC();
  createTray();

  const isFirstRun = store.get('firstRun', true);
  if (isFirstRun) {
    createSettingsWindow('setup');
  } else {
    // Silent startup — just set wallpaper and run in tray
    await wallpaperManager.updateWallpaper();
    if (global.updateTrayMenu) global.updateTrayMenu();
  }

  setupScheduler();
  registerShortcuts();
});

app.on('window-all-closed', (e) => {
  // Don't quit when all windows close — stay in tray
  e.preventDefault();
});

app.on('before-quit', () => {
  app.isQuiting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
