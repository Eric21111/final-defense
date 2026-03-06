// Preload file to keep renderer isolated. Exposes nothing for now but exists
// so Electron can enable contextIsolation without errors.
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('printBridge', {
  version: '1.0.0'
});



