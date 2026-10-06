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

  // Guardado de PDF de caja en Escritorio
  saveCashPdfToDesktop: (data) =>
    ipcRenderer.invoke("saveCashPdfToDesktop", data),

  // Control de app
  reload: () => ipcRenderer.send("app:reload"),
  forceQuit: () => ipcRenderer.send("app:force-quit"),

  // Ventana Emergente (Popup) para Google OAuth
  openOAuthPopup: (url) =>
    ipcRenderer.invoke("auth:openOAuthPopup", url),
  
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
  },

  // APIs seguras para ventana de progreso de actualización (Context Isolation)
  onUpdateProgress: (callback) => {
    const listener = (_, progress) => callback(progress);
    ipcRenderer.on("update-progress", listener);
    return () => ipcRenderer.removeListener("update-progress", listener);
  },
  onUpdateComplete: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("update-complete", listener);
    return () => ipcRenderer.removeListener("update-complete", listener);
  }
});
