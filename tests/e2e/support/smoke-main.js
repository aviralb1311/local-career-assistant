const { app, BrowserWindow } = require('electron');
console.error('[smoke-main] started');
app.whenReady().then(() => {
  console.error('[smoke-main] ready');
  const win = new BrowserWindow({ width: 400, height: 300, show: true });
  win.webContents.on('did-finish-load', () => console.error('SMOKE_WINDOW_READY'));
  win.loadURL('data:text/html,<h1>smoke</h1>').then(() => console.error('[smoke-main] loadURL done')).catch(e => console.error('[smoke-main] loadURL err', e));
});
app.on('window-all-closed', () => { console.error('[smoke-main] all closed'); app.quit(); });
app.on('will-quit', () => console.error('[smoke-main] will-quit'));
