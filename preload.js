const { contextBridge, ipcRenderer } = require("electron");

/**
 * API mínima expuesta al renderer (contextIsolation + sin nodeIntegration).
 * - Productos: stubs (la app usa IndexedDB en el renderer).
 * - Rutas y backup: operaciones que requieren proceso main (fs, paths).
 */
contextBridge.exposeInMainWorld("api", {
  // Rutas del sistema (solo en Electron)
  getPath: (name) =>
    ipcRenderer.invoke("getPath", name),

  // Backup a disco (carpeta userData/backups)
  backupSaveToDisk: (jsonString) =>
    ipcRenderer.invoke("backup:saveToDisk", jsonString),

  // Control de app
  reload: () => ipcRenderer.send("app:reload"),
  forceQuit: () => ipcRenderer.send("app:force-quit"),
  
  // Cierre con backup opcional
  onBeforeQuit: (callback) => {
    ipcRenderer.on("app:beforeQuit", callback);
  },
  sendBackupData: (jsonString) => {
    ipcRenderer.send("backup:data", jsonString);
  },
  sendBackupSkip: () => {
    ipcRenderer.send("backup:skip");
  },

  // APIs para impresoras Bluetooth
  bluetoothSelectDevice: (deviceId) => ipcRenderer.send("bluetooth:select-device", deviceId),
  bluetoothCancel: () => ipcRenderer.send("bluetooth:cancel"),
  onBluetoothDevicesFound: (callback) => {
    const listener = (_, deviceList) => callback(deviceList);
    ipcRenderer.on("bluetooth:devices-found", listener);
    return () => ipcRenderer.removeListener("bluetooth:devices-found", listener);
  }
});
