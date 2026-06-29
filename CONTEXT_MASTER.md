# CONTEXT_MASTER

## RESUMEN GENERAL

**Qué problema resuelve la aplicación:**
Proporciona una solución integral para la administración de un minimarket o negocio minorista (POS - Punto de Venta), permitiendo gestionar ventas, inventario, clientes, proveedores y flujos de caja de manera 100% offline y local.

**Cuál es su propósito principal:**
Automatizar y organizar el registro de transacciones comerciales diarias, controlar el stock de productos, administrar cuentas corrientes de clientes (fiados) y mantener la cuadratura de caja registradora sin depender de una conexión a internet constante.

**Qué tipo de usuarios la utilizan:**
- Administradores o dueños del minimarket.
- Cajeros o vendedores encargados de la atención al público.

**Qué procesos de negocio cubre:**
- **Ventas POS:** Emisión de boletas, ventas al contado y a crédito (fiado).
- **Control de Inventario:** Entradas, salidas, ajustes de stock y control de mermas.
- **Gestión de Caja:** Apertura, cierre, ingresos, egresos y cuadratura de la caja registradora.
- **Cuentas por Cobrar (Fiados):** Administración de saldos de clientes, registro de abonos y cancelación de deudas.
- **Compras y Proveedores:** Registro de facturas de compra, notas de crédito y pagos a proveedores.
- **Reportes:** Visualización de métricas de ventas, ganancias, y cierres de caja.

---

## DESCRIPCIÓN FUNCIONAL

- **Punto de Venta (POS):** Permite registrar productos mediante código de barras o búsqueda manual. Calcula subtotales, totales (aplicando la Ley de Redondeo 20.956 de Chile), e integra métodos de pago como efectivo, tarjeta, QR y crédito.
- **Gestión de Productos:** Creación, edición y eliminación de productos con atributos como costo, margen, precio, categoría y alertas de stock mínimo.
- **Gestión de Clientes y Cuentas Corrientes:** Registro de clientes y sus líneas de crédito. Permite abonar a deudas, consultar saldos y ver el historial de ventas pagadas/pendientes.
- **Control de Caja:** Registro de montos iniciales de caja, movimientos de efectivo manuales y cálculo de diferencias al cierre de turno.
- **Compras y Abastecimiento:** Registro de mercadería ingresada por compras a proveedores. Afecta directamente el inventario (stock) y el historial de costos.
- **Administración de Proveedores:** Base de datos de proveedores del negocio.
- **Reportes y Auditoría:** Gráficos estadísticos y listados de movimientos. La aplicación lleva un registro inmutable en una tabla de auditoría para operaciones críticas.
- **Gestión Multi-Negocio:** Soporta múltiples negocios (sucursales) en la misma base de datos, separados lógicamente por un `business_id`.
- **Integración de Pagos:** Preparación para integración con dispositivos MercadoPago Point (terminal).
- **Sistema de Backups:** Exportación e importación manual (y automática) de respaldos en formato JSON.

---

## FLUJO COMPLETO DEL USUARIO

1. **Inicio de Sesión:** El usuario inicia la aplicación (Electron) e ingresa al splash screen. Luego provee su negocio, usuario y contraseña. El sistema verifica credenciales y roles.
2. **Apertura de Caja:** Antes de vender, el cajero debe abrir la caja indicando un monto inicial en efectivo.
3. **Venta (POS):** En la vista principal (Dashboard/POS), el cajero escanea productos. El sistema añade el ítem al carrito y suma los montos.
4. **Pago de la Venta:** El cajero selecciona el método de pago. Si es al contado (efectivo/tarjeta), la venta se marca como completada y el stock se descuenta. Si es crédito, se asocia a un cliente y se marca como pendiente.
5. **Abono de Clientes (opcional):** El cliente vuelve otro día a pagar. El cajero ingresa al módulo de Clientes, busca la cuenta corriente y registra un abono. Si el abono cubre la deuda, las ventas pasan a completadas.
6. **Recepción de Mercadería (opcional):** El administrador ingresa una nueva compra en el módulo de Compras, lo que automáticamente aumenta el stock de los productos involucrados.
7. **Cierre de Caja:** Al finalizar el turno, el cajero declara el efectivo final. El sistema compara contra lo registrado en el sistema y genera un reporte de cuadratura (diferencias).
8. **Respaldo de Datos:** Al cerrar la aplicación, se puede generar un respaldo automático de la información para evitar pérdida de datos.

---

## MÓDULOS DEL SISTEMA

- **Dashboard:** Resumen visual (gráficos) de ventas, productos populares y alertas de stock.
- **POS (Punto de Venta):** Interfaz rápida para registro de transacciones.
- **Productos / Inventario:** Mantenedor del catálogo y control de movimientos (kardex).
- **Clientes:** Directorio y gestión de cuentas por cobrar (Crédito).
- **Proveedores y Compras:** Registro de facturas, notas de crédito y abonos a proveedores.
- **Caja:** Control de aperturas, cierres, ingresos/retiros y arqueos.
- **Reportes:** Exportación de datos estadísticos sobre el rendimiento del negocio.
- **Configuración:** Ajustes del sistema (nombre negocio, impresión, usuarios).
- **Auditoría:** Visor del `auditLogs` para ver qué usuario hizo qué cambio.

---

## ARQUITECTURA DEL SISTEMA

- **Tipo de Aplicación:** Desktop Application (Aplicación de Escritorio).
- **Frontend:** HTML5, Vanilla JavaScript, CSS Puro. No utiliza frameworks reactivos (sin React/Vue/Angular). Se apoya fuertemente en Manipulación directa del DOM y VanillaJS (MVC-like).
- **Backend:** Node.js con Express.js, ejecutado como un proceso local por la aplicación.
- **Base de Datos:** SQLite 3 (base de datos relacional en archivo local).
- **Framework Contenedor:** Electron (empaquetador de la webapp como ejecutable de Windows).
- **Librerías Clave:** Chart.js (Gráficos), jsPDF/AutoTable (Generación de tickets y reportes PDF), SheetJS / xlsx (Manejo de Excels), jsonwebtoken / bcryptjs (Seguridad).
- **APIs Externas / Servicios:** SDK de MercadoPago (`mercadopago.js`).

---

## ESTRUCTURA DEL PROYECTO

- **`/backend/`:** Contiene toda la lógica del servidor API REST local.
  - `server.js`: El corazón de la API. Rutas, validaciones, consultas a SQLite y middleware.
  - `schema.sql`: Definición de todas las tablas y scripts de migración (DDL).
  - `data/database.sqlite`: Archivo físico de la base de datos de producción.
- **`/js/`:** Lógica del Frontend (Vanilla JS).
  - `/models/`: Clases o definiciones de estructuras de datos.
  - `/repositories/`: Intermediarios que hacen fetch hacia el backend (Patrón Repositorio).
  - `/services/`: Lógica de negocio del frontend (cálculos fiscales, flujos de caja).
  - `/controllers/` y `/views/`: Manipulación del DOM y manejo de eventos.
  - `/utils/`: Helpers como formateadores, validadores, debounce, atajos de teclado y el API Client (`api-client.js`).
- **`/css/`:** Hojas de estilo Vanilla para la interfaz gráfica.
- **`main.js`:** Archivo principal de Electron. Arranca la ventana, intercepta el cierre, orquesta el inicio del backend Node.js e inyecta configuraciones.
- **`import_backup.js`:** Script utility en Node para restauración de datos por emergencia a partir de un JSON.
- **`index.html`:** Única vista (Single Page Application - SPA) donde se inyectan dinámicamente los módulos JS.

---

## MODELO DE DATOS

**Tablas Principales:**
- **businesses:** Entidad superior. Permite tener múltiples sucursales u organizaciones en la misma BD.
- **users:** Usuarios del sistema, con roles (admin/cashier) asociados a un negocio.
- **products:** Catálogo. Se relaciona con los movimientos de stock e historial de precios.
- **sales:** Cabeceras de ventas con sus subtotales, totales y estatus. Contiene los detalles (items) en un campo JSON.
- **payments:** Abonos o pagos realizados a ventas. (Relación 1 Venta -> Muchos Pagos).
- **cashRegisters:** Turnos de caja. Se abren y cierran, registrando el usuario y montos de inicio/fin.
- **cashMovements:** Todos los movimientos de dinero amarrados a un id de `cashRegisters`.
- **customers / suppliers:** Entidades de contacto y líneas de crédito comerciales.
- **stockMovements:** Bitácora inmutable de entradas y salidas de inventario.
- **auditLogs:** Historial de actividades críticas de los usuarios para trazabilidad.

**Flujo de la Información:**
1. Al crear una Venta en POS, se inserta un registro en `sales`.
2. Si el pago es en efectivo, se inserta en `payments` y automáticamente genera un `cashMovements` en el turno actual (`cashRegisters`).
3. Al mismo tiempo, se insertan registros de resta de inventario en `stockMovements` y se actualiza la tabla `products` en su campo stock.
4. Si hay errores o eliminaciones, se registran en `auditLogs`.

---

## APIS Y COMUNICACIONES

- **Arquitectura RESTful:** El Frontend y el Backend se comunican exclusivamente vía API REST sobre `http://localhost:3000`.
- **Endpoints detectados:**
  - `POST /api/auth/login`: Validación de usuario y contraseña. Retorna un JWT (`token`).
  - `POST /api/auth/register`: Creación de negocios y administrador inicial.
  - `POST /api/auth/change-password`: Modificación de clave forzada o manual.
  - `GET /api/status`: Heartbeat / Chequeo del backend.
  - `GET /api/export/business`: Obtención de todo el volcado json del negocio.
  - `POST /api/payments/mercadopago/*`: Integración con SDK MercadoPago.
  - Variedad de endpoints CRUD implícitos (manejados posiblemente por generadores dinámicos o definidos explícitamente) para ventas, compras, etc.
- **Autenticación:** Todo endpoint bajo `/api/*` (excepto auth y status) requiere un encabezado `Authorization: Bearer <JWT>`. Además, requiere encabezado `x-business-id`.
- **Comunicación IPC (Electron):** Se usa para funciones del SO como elegir carpetas (`getPath`) o guardar archivos de backup grandes (`backup:saveToDisk`) usando `ipcMain` e `ipcRenderer`.

---

## ROLES Y PERMISOS

- **Roles identificados:** `admin` y `cashier` (Cajero).
- **Permisos (Implícitos / Explícitos):**
  - **Administrador (`admin`):** Acceso total. Puede borrar historial, modificar productos, revisar reportes financieros y configurar usuarios.
  - **Cajero (`cashier`):** Restringido. Permisos limitados principalmente al módulo POS (Ventas), Apertura/Cierre de su propia caja y revisión de clientes. (Controlado en frontend por `PermissionService.js` y ocultamiento de menús, y en backend mediante middleware `requireRole`).
- **Validaciones Especiales:** Existen validaciones como `forcePasswordChange` para obligar a rotar claves.

---

## REGLAS DE NEGOCIO

- **Ley de Redondeo (Chile - Ley 20.956):** Todos los montos totales de ventas en efectivo o débito deben ser redondeados a la decena (terminación en 1-5 baja, 6-9 sube).
- **Cálculos Fiscales:** El IVA se calcula como Total - Redondeo(Total / 1.19). Existe además un cálculo de comisión sugerida interna (40%).
- **Multi-tenant / Negocios:** La información es estricta por `business_id`. Un usuario solo puede ver datos de su negocio activo.
- **Ventas a Crédito:** Una venta a crédito entra en estado `pending`. Solo cambia a `completed` cuando el flujo de caja (`payments`) iguala el Total de la venta.
- **Cajas:** No se pueden procesar ventas ni movimientos de efectivo si no hay un turno de caja (`cashRegisters`) en estado abierto (`open`) asignado al usuario.
- **Costos Netos y Precios:** Los productos manejan costo neto, costo con IVA, porcentaje de margen y precio final. Al actualizar el costo, debe registrarse la justificación en `productCostHistory`.

---

## DEPENDENCIAS CRÍTICAS

- **SQLite3:** (Módulo nativo compilado) Motor fundamental. Sin él, la aplicación no almacena nada.
- **Express.js:** Levanta el servidor local.
- **Electron:** Empaquetado de la aplicación e interfaz de sistema de ventanas y recursos de sistema de archivos.
- **jsPDF y SheetJS:** Necesarios para la facturación (tickets/boletas impresas) e informes contables para el negocio.
- **Conectividad Mínima (Internet):** Si bien el foco es "100% Offline", requiere internet únicamente si se utilizan los terminales y SDK de **MercadoPago**, o para verificar vigencia de suscripción en el sistema SaaS de la app madre.

---

## FUNCIONALIDADES INCOMPLETAS O EN DESARROLLO

- *Información no verificable exhaustivamente, pero inferida del código:*
  - Existen variables de integración con "Suscripciones / Gateway" y un sistema `expiryDate` que sugiere que hubo (o hay) un validador de licencias online (SaaS), el cual actualmente está evadido o se describe como "removido para versión escritorio".
  - Se visualizan estructuras para Terminales POS Físicos (MercadoPago Point) a través de los endpoints de `/api/payments/mercadopago/send-to-terminal`, sugiriendo que la integración física con lectores puede estar en pruebas o parcialmente implementada.

---

## LIMITACIONES DETECTADAS

- **Tamaño de Base de Datos:** Al utilizar un único archivo SQLite (`database.sqlite`), puede haber limitantes de concurrencia intensa en modo multi-sucursal bajo alta exigencia de I/O, aunque el `PRAGMA journal_mode = WAL` ayuda a mitigarlo.
- **Escalabilidad de Backups:** El IPC limita los backups JSON a 100 MB (`BACKUP_MAX_BYTES`). Superado este límite, el sistema de autosalvado en el cierre del sistema fallará.
- **Acoplamiento Front-Back Local:** El frontend depende ciegamente de `localhost:3000`. Si el puerto 3000 está ocupado en la máquina del cliente por otro software, la app podría colgarse en la pantalla de splash al no poder responder la API de Electron.
- **Seguridad Física:** Al ser una app offline (SQLite local), si la computadora es infectada por ransomware o robada sin respaldos externos actualizados, toda la información contable se pierde irremediablemente.
