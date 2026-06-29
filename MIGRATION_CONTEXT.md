# MIGRATION_CONTEXT

## FUNCIONALIDADES EXISTENTES

### Críticas
- **Venta de POS:** Ingreso de productos al carrito, cálculo de subtotales, totales, e impuestos, y soporte para múltiples métodos de pago (Efectivo, Tarjeta, Crédito/Fiado).
- **Gestión de Stock:** Descuento automático de inventario al vender y aumento al recibir compras.
- **Gestión de Caja:** Apertura y cierre de turnos, declaración de efectivo final y cálculo de cuadraturas/diferencias.
- **Cuentas Corrientes (Fiados):** Venta a clientes con línea de crédito, gestión de saldos adeudados, y registro de abonos parciales o totales.
- **Autenticación y Seguridad:** Login local con usuarios restringidos por roles (`admin`, `cashier`) y validación de complejidad de contraseñas.
- **Soporte Multi-Sucursal Local:** Filtrado riguroso de datos por `business_id`.

### Importantes
- **Gestión de Productos y Categorías:** CRUD completo del catálogo con control de márgenes, costos netos e IVA.
- **Compras y Proveedores:** Registro de facturas de abastecimiento.
- **Historial de Precios y Costos:** Trazabilidad inmutable de por qué y cuándo cambió el precio de un producto.
- **Auditoría (Audit Logs):** Registro de las acciones sensibles que realiza el personal.
- **Ley del Redondeo (Chile):** Aplicación de Ley 20.956 para cobros en efectivo/débito.

### Opcionales
- Integración directa con SDK/Terminal de MercadoPago (Point).
- Visualización de gráficas de alto nivel (Dashboard) en tiempo real, lo cual es deseable pero no bloquea la operación básica del negocio.
- Script de backups locales exportables por archivo (en web puede suplirse por respaldos en la nube gestionados por el equipo).

---

## FUNCIONALIDADES OBLIGATORIAS
*(Deben mantenerse exactamente iguales en una versión web)*

1. **Ley de Redondeo (20.956):** El algoritmo matemático de aproximar a la decena exacta según la terminación 1-5 (abajo) o 6-9 (arriba) no debe alterarse bajo ningún motivo legal.
2. **Desglose Fiscal Boletas:** El cálculo del IVA (`Total - Redondeo(Total / 1.19)`) y el monto base neto.
3. **Flujo de Venta a Crédito (Fiado):** La venta permanece "pendiente" hasta que la suma de sus "pagos (abonos)" cubra el total. Esto es el corazón del comercio de barrio.
4. **Cuadratura Ciega de Caja:** El cajero debe declarar el monto físico de cierre sin que el sistema le diga primero "cuánto debería haber". Esto previene fraudes.

---

## FUNCIONALIDADES MEJORABLES
*(Optimizar sin alterar reglas de negocio)*

1. **Catálogo de Productos y Sincronización:** En lugar de recargar todos los productos de golpe (como se suele hacer en el front local), se debe implementar paginación/infinite scroll, o sincronización diferencial (sync en background) para agilizar el inicio si la BD crece a miles de SKU.
2. **Reportes:** La generación de reportes locales puede consumir mucha memoria. En web, la agregación pesada debería delegarse a la base de datos o servidor remoto y entregar solo las estadísticas pre-calculadas.
3. **Autenticación (SaaS):** Migrar de una arquitectura donde cada máquina tiene un admin maestro y un JWT temporal, a un sistema OAuth/OIDC estándar, posiblemente con JWT de corto alcance y Refresh Tokens en HttpOnly cookies para prevenir robos XSS.

---

## REGLAS DE NEGOCIO INMUTABLES

- **Validación Matemática Exacta:** `Subtotal - Descuento` debe ser exactamente igual al `Total`.
- **Registro Inmutable de Stock/Dinero:** Nunca hacer `UPDATE` sobre un inventario o una caja. Todo se rige por movimientos (`stockMovements` y `cashMovements`). El saldo es el resultado de la suma de movimientos históricos.
- **Roles:** El cajero solo puede ver los datos de su turno y hacer transacciones, nunca ver reportes globales de ganancias ni modificar el historial auditado.
- **Aislamiento Multi-Tenant (`business_id`):** Ninguna query del sistema puede realizarse sin el filtro `business_id` implícito o explícito, protegiendo la privacidad de sucursales independientes.

---

## MODELO DE DATOS

### Entidades y Relaciones (Esquema simplificado)
- **`businesses`** (1) --> (N) **`users`**, **`products`**, **`sales`**, **`customers`**
- **`customers`** (1) --> (N) **`sales`**, **`payments`**
- **`sales`** (1) --> (N) **`payments`** (Abonos)
- **`cashRegisters`** (1) --> (N) **`sales`**, **`cashMovements`**
- **`products`** (1) --> (N) **`stockMovements`**, **`productCostHistory`**, **`productPriceHistory`**

### Restricciones Críticas
- PK compuestas requeridas en `settings (key, business_id)`.
- Restricción UNIQUE para usuarios y teléfonos POR NEGOCIO: `UNIQUE(username, business_id)`.
- Límite de bloqueos de login (`loginAttempts`) para evitar fuerza bruta.

### Validaciones
- **Contraseñas:** Mínimo 8 caracteres, 1 mayúscula, 1 minúscula, 1 número y 1 carácter especial obligatorio.

---

## ARQUITECTURA ACTUAL

**¿Qué partes son reutilizables?**
- **VanillaJS Services & Validators:** Reglas matemáticas como `computeFiscalFromTotal`, `roundPrice`, y la lógica de validación de pago en `PaymentValidator.js` se pueden portar tal cual como funciones puras (TypeScript/JS) al backend y frontend.
- **SQL / Migraciones:** El diseño de la base de datos es extremadamente maduro. El modelo de datos puede mapearse uno-a-uno a PostgreSQL o MySQL usando TypeORM/Prisma sin mayor pérdida.

**¿Qué partes deberían reescribirse?**
- **Frontend (UI/DOM):** Todo el manejo del DOM manual actual (`document.getElementById()`, eventos puros) debe reescribirse bajo un framework moderno (React, Vue, Svelte) para un estado reactivo y mejor mantenibilidad.
- **Backend (Express Local):** Las consultas SQLite están altamente acopladas al objeto nativo `sqlite3` usando callbacks (`dbGet`, `dbRun`). Deberían reescribirse usando un ORM que facilite inyección de dependencias y pruebas unitarias.

**¿Qué partes deben eliminarse?**
- `main.js` (Lógica de Electron e IPC).
- `import_backup.js` y el script manual de exportación de SQLite. El resguardo local pasará a ser centralizado en nube o usando `IndexedDB` manejado por service workers si se adopta arquitectura PWA.
- Servidor HTTP embebido.

---

## DEPENDENCIAS TÉCNICAS

**Dificultan la migración web:**
1. **`sqlite3` nativo:** Incompatible nativamente con el navegador y requiere un host. Para versión web pura deberá cambiarse a PostgreSQL (backend nube) y posiblemente LocalForage/RxDB para persistencia offline web.
2. **`electron` y `electron-builder`:** Dependencias de sistema operativo, totalmente innecesarias en web.
3. El manejo actual de Archivos (backups por FS local).

---

## RIESGOS DE MIGRACIÓN

*(Pasar de Electron + SQLite Local -> Arquitectura Web Moderna)*

1. **Pérdida de la cualidad "100% Offline":** Actualmente, el negocio sigue vendiendo sin problemas aunque se corte el internet. Si la app web se construye solo con SSR o requerimiento de DB remota obligatoria, el negocio quedará paralizado sin internet.
   - *Mitigación:* Desarrollar una PWA Offline-First estricta (React/Vue + IndexedDB/RxDB/WatermelonDB) y un background-sync worker que empuje las transacciones al backend de la nube cuando vuelva la red.
2. **Migración del Histórico:** Los clientes locales guardan su historia de cientos de transacciones en su `.sqlite` físico local. Habrá que proveer una interfaz o endpoint que permita "Subir tu archivo SQLite" para migrar la data al nuevo servidor en la nube sin pérdida.
3. **Latencia del Servidor en POS:** El cajero escanea productos muy rápido (milisegundos con SQLite local). Una mala arquitectura web con una llamada de red por escaneo provocará frustración e invalidará el software por latencia.

---

# WEBAPP_MASTER_CONTEXT

*(Documento consolidado de Especificación Funcional para el Equipo de Desarrollo / IA)*

### QUÉ HACE EL SISTEMA
CajaFácil es un Sistema de Punto de Venta (POS) B2B B2C enfocado en comercios minoristas (minimarkets, almacenes). Su rol es procesar y documentar ventas rápidas, y mantener las finanzas del comercio estructuradas, protegiendo las "Cuentas Corrientes" de los vecinos (fiados) y la cuadratura del cajero en turno.

### CÓMO FUNCIONA
Se basa en turnos de caja finitos. No hay acciones contables sin caja abierta. Toda reducción de inventario genera un movimiento positivo de dinero. Admite pagos en múltiples partes e incluso pagos diferidos (Crédito). Responde a la reglamentación fiscal chilena (Redondeo Ley 20.956, desglose básico IVA boletas vs neto).

### MÓDULOS DEL SISTEMA
1. **Core POS:** Carrito transaccional rápido (optimizado para lector de códigos de barra).
2. **Inventario & Compras:** Recepción de proveedores, alteración de costos y ajuste manual de mermas.
3. **Entidades:** Mantenedores de Clientes (para asignar deudas) y Proveedores.
4. **Tesorero (Caja):** Control de flujo de efectivo por turno de trabajador.
5. **Insights (Reportes):** Cierres históricos, estadísticas, y auditorías inmutables de seguridad.

### QUÉ DATOS MANEJA
- **Datos transaccionales altamente sensibles:** Cierres de caja, histórico de movimientos contables y saldos a favor o en contra de clientes (`balanceCredit`).
- **Metadata fiscal:** Redondeos exigidos y cálculos de comisiones netas de rentabilidad.

### QUÉ REGLAS EXISTEN (MANDATORIAS)
- Los montos en Efectivo deben redondearse a decenas exactas (Ley Chile).
- Los "créditos" solo se dan por pagados (`completed`) cuando el acumulado de ingresos por abonos (`payments`) iguala al `total` exigible de la venta.
- Toda eliminación (ej. anular una venta) requiere un "soft-delete" y/o generación de Notas de Crédito, más un reporte automático e inmutable en `auditLogs` para prevenir robos de cajeros.
- Todas las contraseñas exigen mayúsculas, minúsculas, números y caracteres especiales.

### QUÉ DEBE MANTENERSE EN LA NUEVA WEB
- **Latencia Cero en Caja:** El Punto de Venta no puede depender de la velocidad de Internet para agregar un ítem al carrito. La base de productos activa debe estar cacheada.
- **Multitenant Natural:** La lógica estricta de partición horizontal de datos mediante `business_id` para garantizar un entorno seguro SaaS.
- **Modelado en Base de Datos:** Las FKs y Constraints de la tabla `schema.sql` base son oro puro para replicar en el nuevo esquema.

### QUÉ PUEDE MEJORARSE
- **Framework de UI:** Salir del Vanilla JS y adoptar un entorno tipado (TypeScript) y declarativo (ej: React/NextJS o Vue/Nuxt) para escalar el proyecto y prevenir errores en tiempo de ejecución de manipulación del DOM.
- **Arquitectura de Sincronización:** Adoptar un modelo **Local-First PWA**. Guardar en IndexedDB localmente, responder al cajero al instante y usar un Service Worker que dispare las mutaciones a un backend Serverless (AWS/Vercel) en segundo plano. Esto anula por completo el riesgo de perder conectividad (preservando el espíritu offline de la app anterior) al mismo tiempo que habilita gestión en la Nube SaaS.

---
*Fin del Documento de Contexto de Migración.*
