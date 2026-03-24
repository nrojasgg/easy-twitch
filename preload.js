const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('minimize-window'),
  close: () => ipcRenderer.send('close-window'),
  togglePin: () => ipcRenderer.send('toggle-always-on-top'),
  openStreams: (user) => ipcRenderer.send('open-streams', user),
  closeStreams: () => ipcRenderer.send('close-streams'),
  toggleTheme: () => ipcRenderer.send('toggle-theme'),
  onPinChanged: (callback) => {
    ipcRenderer.on('always-on-top-changed', (event, isOnTop) => callback(isOnTop));
  },
  onStreamsOpened: (callback) => {
    ipcRenderer.on('streams-opened', (event, user) => callback(user));
  },
  onStreamsClosed: (callback) => {
    ipcRenderer.on('streams-closed', () => callback());
  },
  onThemeChanged: (callback) => {
    ipcRenderer.on('theme-changed', (event, isDark) => callback(isDark));
  },
  getUsers: () => ipcRenderer.invoke('get-users'),
  addUser: (user) => ipcRenderer.invoke('add-user', user),
  removeUser: (user) => ipcRenderer.invoke('remove-user', user),
  toggleFavorite: (user) => ipcRenderer.invoke('toggle-favorite', user),
});
