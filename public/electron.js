const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');

function createWindow() {
  // Create the browser window.
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    title: "sing 综合管理系统",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      // Enable web security but allow local file access for production build
      webSecurity: false 
    }
  });

  // Load the app
  win.loadURL(
    isDev
      ? 'http://localhost:3000'
      : `file://${path.join(__dirname, '../build/index.html')}`
  );

  // Hide the default menu bar for a cleaner look (optional)
  win.setMenuBarVisibility(false);

  // Open DevTools in development mode
  if (isDev) {
    // win.webContents.openDevTools();
  }
}

// This method will be called when Electron has finished initialization
app.whenReady().then(createWindow);

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});