

const path = require('path');
const { app, BrowserWindow, dialog } = require('electron');
const { startPrintServer } = require('./printService');

const PRINT_SERVER_PORT = Number(process.env.PRINT_BRIDGE_PORT || 3000);
let mainWindow;
let server;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 520,
    height: 460,
    resizable: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Create the Express server before the Electron window so failures are surfaced.
async function bootstrap() {
  try {
    server = await startPrintServer({
      port: PRINT_SERVER_PORT,
      printerAddress: process.env.PRINTER_BT_ADDRESS,
      printerChannel: Number(process.env.PRINTER_BT_CHANNEL || 1)
    });
  } catch (error) {
    dialog.showErrorBox('Print Bridge Error', `Could not start print server: ${error.message}`);
    app.quit();
    return;
  }

  createWindow();
}

app.whenReady().then(bootstrap);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (server) {
    server.close();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});



