'use strict';
// WIBA - Desktop-App (Electron): startet den eingebauten Spielserver und oeffnet das Spielfenster
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const { startServer } = require('./server');

// Grafikkarte voll nutzen (auch auf Laptops mit zwei GPUs und auf ARM-Geraeten)
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('force_high_performance_gpu');
app.commandLine.appendSwitch('disable-background-timer-throttling');

let win = null;
let srv = null;

async function boot() {
  const saveFile = path.join(app.getPath('userData'), 'world-save-v3.json');
  try {
    srv = await startServer({ port: 31337, saveFile });
  } catch (e) {
    // Port belegt (z. B. zweites Spielfenster am selben PC): eigener Server auf freiem Port
    srv = await startServer({ port: 0, saveFile: null });
  }
  Menu.setApplicationMenu(null);
  win = new BrowserWindow({
    width: 1600, height: 900, minWidth: 960, minHeight: 600,
    backgroundColor: '#101418', title: 'WIBA', show: false,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
  });
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('before-input-event', (ev, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); ev.preventDefault(); }
    else if (input.key === 'F12') { win.webContents.toggleDevTools(); ev.preventDefault(); }
  });
  win.on('closed', () => { win = null; });
  win.loadURL('http://127.0.0.1:' + srv.port + '/');
}

app.whenReady().then(boot).catch((e) => { console.error(e); app.quit(); });
app.on('window-all-closed', () => { if (srv) srv.close(); app.quit(); });
