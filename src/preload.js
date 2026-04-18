const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  getCurrentWord: () => ipcRenderer.invoke('get-current-word'),
  refreshWallpaper: () => ipcRenderer.invoke('refresh-wallpaper'),
  completeSetup: (settings) => ipcRenderer.invoke('complete-setup', settings),
  selectWallpaper: () => ipcRenderer.invoke('select-wallpaper'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  openWordBrowser: () => ipcRenderer.invoke('open-word-browser'),
  getWordHistory: () => ipcRenderer.invoke('get-word-history'),
  saveQuizScore: (data) => ipcRenderer.invoke('save-quiz-score', data),
  getQuizBest: (range) => ipcRenderer.invoke('get-quiz-best', range),
  onNavigate: (cb) => ipcRenderer.on('navigate', (_, page) => cb(page))
});
