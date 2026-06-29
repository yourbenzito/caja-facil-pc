const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const http = require("http");
const { fork } = require("child_process");
const updater = require("./js/updater");

const BACKEND_PORT = process.env.PORT || 3000;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;

// Instancia única: Evitar múltiples instancias que causen bloqueos de puertos y base de datos
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.log("[Electron] Ya hay otra instancia en ejecución. Cerrando esta instancia...");
  app.quit();
  process.exit(0);
}

// Iniciar servidor backend
let serverProcess = null;
function startBackendServer() {
  try {
    const serverPath = path.join(__dirname, "backend", "server.js");
    // Usamos require en lugar de fork para simplificar en empaquetado, 
    // pero guardamos referencia si es posible (aunque require no retorna el proceso)
    require(serverPath);
    console.log("[Electron] Backend iniciado directamente.");
  } catch (err) {
    console.error("[Electron] Backend error:", err);
  }
}

if (gotTheLock) {
  startBackendServer();
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});


// Configurar directorio de caché antes de app.ready para evitar "Unable to create cache" / "Acceso denegado"
const appName = "sistema-ventas";
const userDataPath = path.join(
  process.env.APPDATA || (process.platform === "win32" ? path.join(os.homedir(), "AppData", "Roaming") : os.homedir()),
  appName
);
const cachePath = path.join(userDataPath, "Cache");
app.commandLine.appendSwitch("disk-cache-dir", cachePath);
app.commandLine.appendSwitch("disable-gpu-cache"); // Evitar error GPU Cache Creation failed por permisos en Windows

/** @type {Electron.BrowserWindow|null} */
let mainWindow = null;
let activeBluetoothCallback = null;
let quitTimeoutId = null;
let isQuitting = false;

/**
 * Crea la ventana principal de la aplicación
 */
// Esperar a que el backend esté listo antes de cargar
// OPTIMIZACIÓN: 30 intentos con 200ms = 6 segundos máximo (reducido de 10s para inicio más rápido)
function waitForServer(url, maxAttempts = 30) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      attempts++;
      http.get(url, (res) => {
        resolve();
      }).on('error', () => {
        if (attempts >= maxAttempts) {
          reject(new Error(`Backend no respondió después de ${maxAttempts} intentos`));
        } else {
          setTimeout(check, 200); // Reducido de 500ms a 200ms
        }
      });
    };
    check();
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Manejador del diálogo de selección de Bluetooth nativo de Electron
  mainWindow.webContents.on('select-bluetooth-device', (event, deviceList, callback) => {
    event.preventDefault();
    activeBluetoothCallback = callback;
    // Enviar lista de dispositivos encontrados al frontend
    mainWindow.webContents.send('bluetooth:devices-found', deviceList);
  });

  try {
    // Esperar a que el servidor backend esté listo
    console.log('[Electron] Esperando al backend en', BACKEND_URL, '...');
    await waitForServer(BACKEND_URL);
    console.log('[Electron] Backend listo. Cargando app...');
    mainWindow.loadURL(BACKEND_URL);
  } catch (err) {
    console.error('[Electron] Error:', err.message);
    // Fallback: cargar index.html directamente
    console.log('[Electron] Fallback: cargando index.html local');
    mainWindow.loadFile("index.html");
  }
  mainWindow.on("close", (e) => {
    if (isQuitting) return;
    
    // Si la ventana se cierra, tratarlo como una señal de salida
    e.preventDefault();
    app.quit();
  });

  return mainWindow;
}

// Verificar actualizaciones automáticamente después de que la ventana se crea
app.whenReady().then(async () => {
  if (mainWindow) {
    // Esperar 10 segundos antes de verificar actualizaciones para no ralentizar el inicio
    // Aumentado de 5s a 10s para permitir que la app cargue completamente primero
    setTimeout(async () => {
      try {
        const updateAvailable = await updater.checkForUpdates();
        if (updateAvailable) {
          updater.showUpdateAvailable(mainWindow);
        }
      } catch (error) {
        console.error('[Updater] Error verificando actualizaciones:', error);
      }
    }, 10000);
  }
});

const BACKUP_MAX_FILES = 30; // Mantener últimos 30 backups

/**
 * Escribe backup en disco (carpeta userData/backups), verifica escritura y rota archivos antiguos.
 */
function writeBackupToDisk(jsonString) {
  const backupsDir = path.join(app.getPath("userData"), "backups");
  try {
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 19).replace(/[-:T]/g, "-");
    const filename = `pos-backup-${dateStr}.json`;
    const filepath = path.join(backupsDir, filename);
    fs.writeFileSync(filepath, jsonString, "utf8");

    // Verificación post-escritura: leer y comprobar tamaño
    const readBack = fs.readFileSync(filepath, "utf8");
    const expectedLen = Buffer.byteLength(jsonString, "utf8");
    const actualLen = Buffer.byteLength(readBack, "utf8");
    if (actualLen !== expectedLen || actualLen === 0) {
      try {
        fs.unlinkSync(filepath);
      } catch (e) { }
      return { ok: false, error: "Verificación del backup falló: tamaño incorrecto" };
    }
    if (readBack.charAt(0) !== "{") {
      try {
        fs.unlinkSync(filepath);
      } catch (e) { }
      return { ok: false, error: "Verificación del backup falló: contenido inválido" };
    }

    // Rotación: mantener solo los últimos BACKUP_MAX_FILES
    const files = fs.readdirSync(backupsDir)
      .filter((f) => f.startsWith("pos-backup-") && f.endsWith(".json"))
      .map((f) => ({
        name: f,
        path: path.join(backupsDir, f),
        mtime: fs.statSync(path.join(backupsDir, f)).mtime.getTime()
      }))
      .sort((a, b) => b.mtime - a.mtime);
    for (let i = BACKUP_MAX_FILES; i < files.length; i++) {
      try {
        fs.unlinkSync(files[i].path);
      } catch (e) {
        console.warn("No se pudo eliminar backup antiguo:", files[i].name, e.message);
      }
    }

    return { ok: true, path: filepath };
  } catch (err) {
    console.error("Error writing backup:", err);
    return { ok: false, error: err.message };
  }
}

/**
 * Inicialización de la aplicación
 * Persistencia real: IndexedDB en el renderer (js/db.js). No se usa SQLite en main.
 */
app.whenReady().then(async () => {
  try {
    const ud = app.getPath("userData");
    try {
      fs.mkdirSync(ud, { recursive: true });
      fs.mkdirSync(cachePath, { recursive: true });
    } catch (e) {
      console.warn("No se pudo crear directorios de caché:", e.message);
    }

    const win = await createWindow();
    if (win) {
      console.log('[Electron] Aplicación lista.');
    }
  } catch (error) {
    console.error("❌ Fatal error during startup:", error);
    app.quit();
  }
});

// --- IPC: Rutas y backup (con whitelist y validación) ---

const ALLOWED_GETPATH_NAMES = ["userData", "temp", "appData", "home", "documents", "desktop", "logs"];

ipcMain.handle("getPath", (_, name) => {
  const n = typeof name === "string" ? name.trim() : "";
  if (!ALLOWED_GETPATH_NAMES.includes(n)) {
    throw new Error(`getPath: nombre no permitido. Permitidos: ${ALLOWED_GETPATH_NAMES.join(", ")}`);
  }
  return app.getPath(n);
});

const BACKUP_MAX_BYTES = 100 * 1024 * 1024; // 100 MB

function validateBackupPayload(jsonString) {
  if (typeof jsonString !== "string") {
    return { ok: false, error: "El backup debe ser un string" };
  }
  if (Buffer.byteLength(jsonString, "utf8") > BACKUP_MAX_BYTES) {
    return { ok: false, error: `El backup supera el tamaño máximo (${BACKUP_MAX_BYTES / 1024 / 1024} MB)` };
  }
  try {
    JSON.parse(jsonString);
  } catch (e) {
    return { ok: false, error: "El contenido del backup no es JSON válido" };
  }
  return { ok: true };
}

ipcMain.handle("backup:saveToDisk", (_, jsonString) => {
  const validation = validateBackupPayload(jsonString);
  if (!validation.ok) return validation;
  return writeBackupToDisk(jsonString);
});

// --- Cierre con backup opcional ---

// --- Cierre con backup opcional ---

app.on("before-quit", (e) => {
  if (isQuitting) return;
  
  // Si no hay ventana o está destruida, salir directo
  if (!mainWindow || mainWindow.isDestroyed()) {
    isQuitting = true;
    return;
  }

  // Prevenir cierre inmediato para intentar backup
  e.preventDefault();
  
  // Enviar señal al renderer
  mainWindow.webContents.send("app:beforeQuit");
  
  // Timeout de seguridad: si el renderer no responde en 2s, cerrar de todos modos
  // (Reducido de 4s a 2s para mejor respuesta)
  quitTimeoutId = setTimeout(() => {
    isQuitting = true;
    app.quit();
  }, 2000);
});

// Forzar cierre desde el renderer (ej: botón X o confirmación de salida)
ipcMain.on("app:force-quit", () => {
    isQuitting = true;
    app.quit();
});

// Recargar aplicación
ipcMain.on("app:reload", () => {
    if (mainWindow) mainWindow.reload();
});

ipcMain.on("backup:data", (_, jsonString) => {
  if (quitTimeoutId) {
    clearTimeout(quitTimeoutId);
    quitTimeoutId = null;
  }
  const validation = validateBackupPayload(jsonString);
  if (!validation.ok) {
    console.error("Backup on close rejected:", validation.error);
  } else {
    writeBackupToDisk(jsonString);
  }
  isQuitting = true; 
  app.exit(0);
});

ipcMain.on("backup:skip", () => {
  if (quitTimeoutId) {
    clearTimeout(quitTimeoutId);
    quitTimeoutId = null;
  }
  isQuitting = true;
  app.exit(0);
});

// --- IPC: Bluetooth Impresora ---
ipcMain.on("bluetooth:select-device", (_, deviceId) => {
  if (activeBluetoothCallback) {
    activeBluetoothCallback(deviceId);
    activeBluetoothCallback = null;
  }
});

ipcMain.on("bluetooth:cancel", () => {
  if (activeBluetoothCallback) {
    activeBluetoothCallback('');
    activeBluetoothCallback = null;
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
