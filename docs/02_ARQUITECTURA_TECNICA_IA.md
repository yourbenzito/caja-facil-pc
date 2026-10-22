# 🧠 CAJA FÁCIL POS — ARQUITECTURA TÉCNICA E INGENIERÍA DEL SISTEMA (PARA LA IA Y SENIOR FULL STACK)

Este documento contiene la especificación arquitectónica completa de **Caja Fácil PC POS**. Diseñado para que cualquier Inteligencia Artificial o Desarrollador Senior Full Stack entienda instantáneamente las entrañas del sistema, sus patrones de diseño, flujos de datos y mecanismos de seguridad sin ambigüedades.

---

## 🏛️ 1. VISIÓN GENERAL DE LA ARQUITECTURA

Caja Fácil es una aplicación de escritorio de alto rendimiento construida bajo el paradigma **Offline-First Híbrido**:
* **Frontend:** Single Page Application (SPA) construida en **Vanilla JavaScript modular (ES6+)**, sin frameworks pesados (cero React/Vue/Angular), con manipulación directa y controlada del DOM y estilos en **Vanilla CSS**.
* **Contenedor Desktop:** **Electron**, gestionando ventanas nativas, ciclo de vida de la aplicación, comunicación con impresoras térmicas y aislamiento de procesos.
* **Backend de Servicios:** Servidor local **Node.js + Express** corriendo en el bucle local (`http://localhost:3000`), orquestado directamente desde el proceso principal de Electron.
* **Persistencia Local:** **SQLite 3** (`database.sqlite`) con modo WAL (Write-Ahead Logging), transacciones ACID y respaldos físicos automáticos diarios.
* **Capa Cloud & Multi-Dispositivo:** **Supabase Cloud (PostgreSQL)** conectando terminales PC y la app móvil vía APIs RESTful y WebSockets Realtime bidireccionales.

```
┌─────────────────────────────────────────────────────────────┐
│                    ELECTRON CONTAINER                       │
│                                                             │
│  ┌─────────────────────────┐     ┌────────────────────────┐ │
│  │   FRONTEND (SPA)        │     │  BACKEND LOCAL         │ │
│  │   Vanilla JS (MVC)      │◄───►│  Express (Port 3000)   │ │
│  │   Views / Repositories  │REST │  Routes / Security     │ │
│  └───────────┬─────────────┘     └───────────┬────────────┘ │
│              │ Realtime                      │ SQLite       │
└──────────────┼───────────────────────────────┼──────────────┘
               │ WebSockets                    ▼
               │                   ┌────────────────────────┐
               ▼                   │  SQLite Local Database │
┌─────────────────────────────┐    │  (database.sqlite)     │
│       SUPABASE CLOUD        │    └────────────────────────┘
│   PostgreSQL + Realtime     │
│   (Multi-Terminal Sync)     │
└─────────────────────────────┘
```

---

## 💾 2. CAPA DE PERSISTENCIA LOCAL (SQLITE) & RESILIENCIA

### A. Inicialización y Modo de Conexión
* **Ubicación del archivo:**
  * En Desarrollo: `./backend/data/database.sqlite`
  * En Producción (Empaquetado): `%APPDATA%\caja-facil-pos\data\database.sqlite`
* **Optimizaciones de Motor (`connection.js`):**
  * `PRAGMA journal_mode = WAL;` (Permite lecturas concurrentes sin bloquear escrituras).
  * `PRAGMA busy_timeout = 5000;` (Espera hasta 5 segundos ante contención de bloqueos).
  * `PRAGMA synchronous = NORMAL;` (Equilibrio perfecto entre velocidad de disco y seguridad ante apagones).

### B. Respaldo Físico Diario Automático
* En cada inicio del backend, `createDailyPhysicalBackup()` verifica si existe un backup del día (`database-YYYY-MM-DD.sqlite`) en `data/backups_sqlite/`.
* Si no existe, realiza una copia física a nivel de archivo con rotación automática que conserva los **últimos 7 días**.

### C. Operaciones Silenciosas (`dbRunSilent`)
* Para evitar "actividad fantasma" que engañe al detector de inactividad de la UI, las tareas de fondo (como marcar `is_synced = 1`) utilizan `dbRunSilent(sql, params)`. Esta función ejecuta la consulta SQL **sin actualizar** la marca de tiempo `lastActivity = Date.now()`.

### D. Migraciones de Esquema Seguras
* Ubicadas en `backend/database/migrations.js`. Se ejecutan secuencialmente al arrancar. Añaden dinámicamente columnas faltantes mediante `ALTER TABLE ... ADD COLUMN` envueltos en chequeos de `PRAGMA table_info`, asegurando compatibilidad con bases de datos creadas en versiones previas.

---

## ⚡ 3. MOTOR DE SINCRONIZACIÓN CLOUD Y MULTI-TERMINAL

El sistema de sincronización (`backend/routes/sync.js` y `js/services/SyncService.js`) mantiene coordinadas múltiples terminales (`PC-1`, `PC-2`, `Mobile`) a través de Supabase Cloud.

### A. Identidad de Terminal (`terminal_id`)
* Cada instalación genera y persiste en `localStorage` un identificador único: `term_XXXX_timestamp`.
* Este identificador se propaga en todas las operaciones (`sales`, `cashRegisters`, `stockMovements`), permitiendo que el Centro de Reportes separe o consolide el rendimiento de cada máquina física.

### B. Ciclo PUSH (Local ➔ Supabase Cloud)
1. El backend consulta registros con `is_synced = 0`.
2. Se transmiten a Supabase mediante clientes con permisos administrativos (`supabaseAdmin`).
3. Al recibir confirmación `200 OK`, el backend marca localmente `is_synced = 1` utilizando `dbRunSilent`.

### C. Ciclo PULL (Supabase Cloud ➔ Local)
1. Cada PC solicita cambios ocurridos desde su último `last_sync_timestamp`.
2. Filtra registros donde `terminal_id != mi_terminal` (evita descargarse sus propios datos).
3. **Mapeo Robusto de Clientes:** Descarga e inserta/actualiza `balance_credit` en SQLite local.
4. **Inserción Segura de Categorías:** Aplica `INSERT OR IGNORE INTO categories` previniendo colisiones de claves primarias.

### D. Supabase Realtime & Canal Broadcast
* La app se suscribe al canal `pos_realtime_pc_${userId}`:
  * **Eventos de Base de Datos (`postgres_changes`):** Al detectar cambios en tablas clave (`sales`, `products`, `customers`, etc.), activa una sincronización incremental debounced.
  * **Canal Broadcast Directo (`sync_signal`):** Envía pulsos ultraligeros de computadora a computadora sin pasar por disco:
    * `store_closing`: La PC principal notifica a la PC 2 que está iniciando el cierre de local para pausar las ventas durante el cuadre.
    * `store_reopened`: Notifica la habilitación de un nuevo turno de ventas.

---

## 🔒 4. SEGURIDAD, AUTENTICACIÓN Y PROTECCIÓN ANTIFRAUDE

### A. Autenticación y Sesiones
* **JWT Local (`jsonwebtoken`):** Toda petición a la API REST `/api/*` requiere un Bearer Token firmado con una clave secreta (`JWT_SECRET`) generada aleatoriamente durante la instalación inicial.
* **Hashing Criptográfico:** Contraseñas protegidas mediante `bcryptjs` con salt de 10 rondas.
* **Separación Multi-Negocio:** Cada consulta SQL de negocio incluye obligatoriamente el filtro `business_id = ?` inyectado desde el token o encabezado validado.

### B. Blindaje Antifraude Contable
* En `backend/routes/rest.js`, se implementó el bloqueo explícito de sentencias `DELETE` sobre las tablas financieras críticas:
  * `sales`
  * `cashRegisters`
  * `saleReturns`
  * `debtPaymentSessions`
* Ningún usuario o petición puede borrar físicamente una venta o un turno de caja; toda corrección debe procesarse mediante notas de crédito o anulaciones auditadas.

### C. Sanitización y Prevención de Inyecciones
* **Backend:** 100% de las consultas a SQLite están parametrizadas con placeholders `?` en arrays `[param1, param2]`.
* **Frontend:** Toda inserción dinámica de texto provisto por el usuario (nombres de productos, clientes, notas) se procesa a través de la función de escape `safeHTML()`.

---

## 📂 5. MAPA DE ARCHIVOS Y ESTRUCTURA DEL CÓDIGO

```
├── backend/
│   ├── data/                  # Base de datos SQLite y respaldos automáticos
│   ├── database/
│   │   ├── connection.js      # Conexión SQLite, WAL, backups diarios y dbRunSilent
│   │   └── migrations.js      # Migraciones dinámicas de esquema
│   ├── routes/
│   │   ├── auth.js            # Login, registro, cambio de contraseña, roles
│   │   ├── complex.js         # Lógica compleja (Ventas atómicas, transacciones)
│   │   ├── rest.js            # Endpoints CRUD con bloqueo antifraude
│   │   └── sync.js            # Motor de sincronización PUSH/PULL con Supabase
│   ├── server.js              # Inicialización de Express y orquestación
│   └── supabase.js            # Configuración de clientes Supabase Cloud
├── js/
│   ├── app.js                 # Router SPA, inicializador global y eventos
│   ├── controllers/           # Coordinadores entre UI y Repositorios
│   │   ├── CashController.js  # Lógica de turnos, arqueos y validación de retiros
│   │   └── POSController.js   # Gestión del carrito, balanza y venta
│   ├── models/                # Modelos de datos (Product, Customer, Sale, etc.)
│   ├── repositories/          # Acceso a datos y llamadas al API backend
│   │   └── CashRegisterRepository.js # Filtro multi-terminal por terminal_id
│   ├── services/
│   │   ├── NotificationCenter.js # Campana de notificaciones y alertas en vivo
│   │   ├── StockService.js       # Ajustes, consumos y anulación auditada de stock
│   │   └── SyncService.js        # WebSockets Realtime y Broadcast entre PCs
│   ├── utils/                 # TouchNumpad, formateadores de moneda, safeHTML
│   └── views/                 # Vistas modulares SPA (pos.js, cash.js, reports.js, etc.)
├── docs/                      # Documentación oficial del proyecto
├── main.js                    # Proceso principal de Electron y ventana nativa
└── package.json               # Dependencias y configuración de electron-builder
```

---

## 📦 6. CICLO DE VIDA DEL EMPAQUETADO (ELECTRON-BUILDER)

* **Script de compilación:** `npm run build` invoca a `electron-builder`.
* **Detección de Entorno:**
  ```javascript
  const IS_PACKAGED = __dirname.includes('.asar');
  ```
* **Manejo de Variables de Entorno en el Instalador:**
  * En producción, Electron no permite escribir dentro de `app.asar`.
  * Por ello, `server.js` detecta `IS_PACKAGED` y lee/crea el archivo `.env` en la carpeta `userData` del sistema operativo: `%APPDATA%\caja-facil-pos\.env`.
  * Si es la primera instalación en una máquina, crea automáticamente el archivo `.env` en `userData` y genera llaves criptográficas únicas para esa máquina. Las credenciales de Supabase se configuran de forma segura y aislada en ese `.env` local.
* **Archivos Críticos Desempaquetados (`asarUnpack`):**
  * `sqlite3` (Binario C++ nativo que requiere ejecución fuera del asar).
  * `backend/server.js` y `backend/schema.sql`.
  * `backend/data/database.sqlite`.
