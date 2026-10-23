const { app, BrowserWindow } = require('electron');
app.whenReady().then(() => {
  const win = new BrowserWindow({ width: 400, height: 300, show: true });
  win.loadURL('data:text/html,<h1>smoke</h1>');
  win.webContents.on('did-finish-load', () => console.log('SMOKE_WINDOW_READY'));
});
app.on('window-all-closed', () => app.quit());
