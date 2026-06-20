import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { initDatabase, getDb } from './db';
import { initIpcHandlers } from './ipc';
import { startScheduler } from './scheduler';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    title: '宠物寄养酒店管理系统',
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  initDatabase();
  initIpcHandlers();
  createWindow();
  startScheduler();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  const db = getDb();
  if (db) db.close();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
