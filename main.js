const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');

const userDataPath = path.join(app.getPath('userData'), 'users.json');

function loadUsers() {
  try {
    if (fs.existsSync(userDataPath)) {
      return JSON.parse(fs.readFileSync(userDataPath, 'utf-8'));
    }
  } catch (e) {}
  return [];
}

function saveUsers(users) {
  fs.writeFileSync(userDataPath, JSON.stringify(users, null, 2));
}

let mainWindow;
let chatWindow;
let videoWindow;
let currentUser = null;
let isAlwaysOnTop = true;
let isDarkMode = true;

const CHAT_WIDTH = 350;
const CHAT_HEIGHT = 600;
const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 400;

const isDev = process.argv.includes('--dev');

function createMainWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  const centerX = Math.round((screenWidth - CHAT_WIDTH) / 2);
  const centerY = Math.round((screenHeight - CHAT_HEIGHT) / 2);

  mainWindow = new BrowserWindow({
    width: CHAT_WIDTH,
    height: CHAT_HEIGHT,
    minWidth: 200,
    minHeight: 300,
    x: centerX,
    y: centerY,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: false,
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.loadFile(path.join(__dirname, 'main.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
    chatWindow = null;
    videoWindow = null;
    currentUser = null;
  });

  console.log('[Twitch Chat Overlay] Main window created');
}

function createChatWindow(user) {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  const gap = 5;
  const totalHeight = VIDEO_HEIGHT + gap + CHAT_HEIGHT;
  let startY = Math.round((screenHeight - totalHeight) / 2);
  if (startY < 0) startY = 10;
  const centerX = Math.round((screenWidth - VIDEO_WIDTH) / 2);

  let videoH = VIDEO_HEIGHT;
  let chatH = CHAT_HEIGHT;
  if (totalHeight > screenHeight) {
    const availH = screenHeight - 20;
    videoH = Math.round(availH * 0.55);
    chatH = Math.round(availH * 0.45);
    startY = 10;
  }

  chatWindow = new BrowserWindow({
    width: CHAT_WIDTH,
    height: chatH,
    x: centerX + VIDEO_WIDTH + gap,
    y: startY,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: false,
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  if (isDev) {
    chatWindow.webContents.openDevTools({ mode: 'detach' });
  }

  chatWindow.loadFile(path.join(__dirname, 'chat.html'), {
    query: { user }
  });

  chatWindow.webContents.on('did-finish-load', () => {
    chatWindow.webContents.send('always-on-top-changed', isAlwaysOnTop);
  });

  chatWindow.on('closed', () => {
    chatWindow = null;
  });

  return { startY, chatH };
}

function openStreams(user) {
  if (videoWindow) {
    videoWindow.close();
  }
  if (chatWindow) {
    chatWindow.close();
  }

  currentUser = user;

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  const gap = 5;
  const totalHeight = VIDEO_HEIGHT + gap + CHAT_HEIGHT;
  let startY = Math.round((screenHeight - totalHeight) / 2);
  if (startY < 0) startY = 10;
  const centerX = Math.round((screenWidth - VIDEO_WIDTH) / 2);

  let videoH = VIDEO_HEIGHT;
  let chatH = CHAT_HEIGHT;
  if (totalHeight > screenHeight) {
    const availH = screenHeight - 20;
    videoH = Math.round(availH * 0.55);
    chatH = Math.round(availH * 0.45);
    startY = 10;
  }

  const videoAspectRatio = 16 / 9;

  const { startY: chatStartY, chatH: chatHeight } = createChatWindow(user);

  videoWindow = new BrowserWindow({
    width: VIDEO_WIDTH,
    height: videoH,
    minWidth: 320,
    minHeight: Math.round(320 * 9 / 16),
    x: centerX,
    y: startY,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: false,
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  const topbarHeight = 32;
  let resizingTimeout;
  videoWindow.on('resize', () => {
    clearTimeout(resizingTimeout);
    resizingTimeout = setTimeout(() => {
      const [width, height] = videoWindow.getSize();
      const videoHeight = height - topbarHeight;
      const fromWidth = Math.round(videoHeight * videoAspectRatio);
      const fromHeight = Math.round(width / videoAspectRatio) + topbarHeight;
      if (Math.abs(height - fromHeight) > Math.abs(width - fromWidth)) {
        videoWindow.setSize(width, fromHeight);
      } else {
        videoWindow.setSize(fromWidth, height);
      }
    }, 10);
  });

  if (isDev) {
    videoWindow.webContents.openDevTools({ mode: 'detach' });
  }

  videoWindow.loadFile(path.join(__dirname, 'video.html'), {
    query: { user }
  });

  videoWindow.on('closed', () => {
    videoWindow = null;
  });

  videoWindow.webContents.send('sync-theme', isDarkMode);

  if (mainWindow) {
    mainWindow.hide();
  }

  console.log(`[Twitch Chat Overlay] Opened streams for: ${user}`);
}

function closeStreams() {
  if (videoWindow) {
    videoWindow.close();
    videoWindow = null;
  }
  if (chatWindow) {
    chatWindow.close();
    chatWindow = null;
  }
  currentUser = null;
  if (mainWindow) {
    mainWindow.show();
  }
}

ipcMain.on('minimize-window', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.minimize();
});

ipcMain.on('close-window', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win === mainWindow) {
    mainWindow.close();
  } else if (win === chatWindow) {
    chatWindow.close();
  } else if (win === videoWindow) {
    videoWindow.close();
  }
});

ipcMain.on('toggle-always-on-top', (event) => {
  isAlwaysOnTop = !isAlwaysOnTop;
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(isAlwaysOnTop, 'screen-saver');
  }
  if (chatWindow) {
    chatWindow.setAlwaysOnTop(isAlwaysOnTop, 'screen-saver');
  }
  if (videoWindow) {
    videoWindow.setAlwaysOnTop(isAlwaysOnTop, 'screen-saver');
  }
  event.sender.send('always-on-top-changed', isAlwaysOnTop);
  console.log(`[Twitch Chat Overlay] Always on top: ${isAlwaysOnTop}`);
});

ipcMain.on('open-streams', (event, user) => {
  openStreams(user);
});

ipcMain.on('close-streams', () => {
  closeStreams();
});

ipcMain.on('toggle-theme', (event) => {
  isDarkMode = !isDarkMode;
  if (chatWindow) {
    chatWindow.webContents.send('theme-changed', isDarkMode);
  }
  if (videoWindow) {
    videoWindow.webContents.send('theme-changed', isDarkMode);
  }
  event.sender.send('theme-changed', isDarkMode);
  console.log(`[Twitch Chat Overlay] Dark mode: ${isDarkMode}`);
});

ipcMain.handle('get-users', () => {
  return loadUsers();
});

ipcMain.handle('add-user', (event, userName) => {
  const users = loadUsers();
  const existing = users.find(u => u.name.toLowerCase() === userName.toLowerCase());
  if (!existing) {
    users.unshift({ name: userName, isFavorite: false });
  }
  saveUsers(users);
  return users;
});

ipcMain.handle('remove-user', (event, userName) => {
  let users = loadUsers();
  users = users.filter(u => u.name.toLowerCase() !== userName.toLowerCase());
  saveUsers(users);
  return users;
});

ipcMain.handle('toggle-favorite', (event, userName) => {
  const users = loadUsers();
  const user = users.find(u => u.name.toLowerCase() === userName.toLowerCase());
  if (user) {
    user.isFavorite = !user.isFavorite;
  }
  saveUsers(users);
  return users;
});

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (!mainWindow) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

process.on('uncaught-exception', (error) => {
  console.error('[Twitch Chat Overlay] Uncaught exception:', error);
});
