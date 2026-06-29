# 🧠 Contexto del Proyecto: Sistema de Ventas POS (Punto de Venta)

## ¿Qué es este proyecto?

Es un sistema de ventas (POS) de escritorio construido con:
- **Electron** (app de escritorio para Windows)
- **Frontend**: HTML + CSS + JavaScript vanilla (sin frameworks)
- **Backend**: Node.js + Express (corre localmente en puerto 3000)
- **Base de datos**: SQLite (archivo `backend/data/database.sqlite`)
- **Ruta del proyecto**: `c:\Sistema-Ventas-Negocio`

El sistema maneja ventas, clientes, productos, compras a proveedores, caja registradora, inventario y cuentas corrientes de clientes (fiados/crédito).

---

## 🗂️ Estructura del proyecto

```
c:\Sistema-Ventas-Negocio\
├── backend/
│   ├── server.js          ← API REST completa (Express + SQLite)
│   ├── schema.sql         ← Schema base de la BD
│   └── data/
│       └── database.sqlite ← Base de datos real
├── js/
│   ├── models/
│   │   └── Sale.js        ← Modelo de ventas (IndexedDB + API)
│   ├── services/
│   │   └── PaymentService.js ← Lógica de pagos
│   ├── views/
│   │   ├── customers.js   ← Vista de clientes y cuentas corrientes
│   │   ├── sales.js       ← Vista de ventas
│   │   └── purchases.js   ← Vista de compras
│   └── repositories/
│       └── SaleRepository.js
├── import_backup.js       ← Script para importar backups JSON
├── package.json
└── backup del 28/
    └── pos-backup-29-05-2026.json ← Backup más reciente importado
```

---

## 📊 Estado actual de la base de datos

- **Ventas**: 5,166 registros
- **Clientes**: 62 registros
- **Productos**: 491 registros
- **Compras**: 337 registros
- **Pagos (abonos)**: 599 registros

---

## 🔧 Cambios realizados en esta sesión

### 1. Corrección: Edición de ventas (bug anterior)
Se corrigió un bug donde al intentar editar una venta y cambiar un producto por otro, el sistema no permitía seleccionar el nuevo producto. Se revisaron y corrigieron los endpoints de API y el frontend en `js/views/sales.js`.

### 2. Nueva función: Registro de fecha exacta de pago (`paidAt`)

**Problema**: No había forma de saber exactamente cuándo un cliente pagó su deuda fiada.

**Solución implementada**:

#### Backend (`backend/server.js`)
- Se agregó columna `paidAt TEXT` a la tabla `sales` mediante migración automática.
- Se implementó migración histórica one-shot que corre al iniciar el servidor:
  - Para ventas completadas con abonos en `payments` → usa la fecha del último abono
  - Para ventas completadas sin abonos (pagadas al contado) → usa la fecha de creación
- Se actualizó `POST /api/complex/payment` para guardar `paidAt` al completarse una venta.
- Se actualizó `POST /api/complex/account-payment` para guardar `paidAt` en abonos en lote.

```sql
-- La migración histórica que corre automáticamente al iniciar:
UPDATE sales SET paidAt = (
    SELECT p.date FROM payments p WHERE p.saleId = sales.id ORDER BY p.date DESC LIMIT 1
)
WHERE paidAt IS NULL AND status IN ('completed','paid')
  AND EXISTS (SELECT 1 FROM payments p WHERE p.saleId = sales.id);

UPDATE sales SET paidAt = date
WHERE paidAt IS NULL AND status IN ('completed','paid');
```

#### Frontend Services (`js/services/PaymentService.js`)
- Se modificó `registerPayment()` para incluir `paidAt: new Date().toISOString()` al completar una venta.

#### Frontend Views (`js/views/customers.js`)
- Se actualizó la pestaña **"Ventas Pagadas"** en `showAccountDetails()` para mostrar:
  - `Finalizada el DD-MM-AAAA, HH:MM`
  - `📅 Pagada el DD-MM-AAAA, HH:MM (💵 Efectivo)` ← con icono del método de pago
- El método de pago se obtiene del campo `paymentMethod` de la venta, o del último registro en `payments` si el método es `credit`.

#### Métodos de pago disponibles:
| Valor en BD | Etiqueta mostrada |
|---|---|
| `cash` | 💵 Efectivo |
| `card` | 💳 Tarjeta |
| `qr` | 📱 QR |
| `mixed` | 🔄 Mixto |
| `credit` | 💳 Crédito |
| `other` | ➕ Otro |

### 3. Script de importación de backups (`import_backup.js`)

Se creó un script permanente en la raíz del proyecto para importar backups JSON:

```bash
# Forma simple (detecta el backup automáticamente):
npm run importar

# Especificando el archivo:
node import_backup.js mi-backup.json
```

**Lo que hace el script**:
1. Busca el archivo `.json` de backup (auto-detect o parámetro)
2. Hace respaldo automático del SQLite actual en `backend/data/database_respaldo_XXXX.sqlite`
3. Limpia e importa todas las tablas en orden correcto (respetando FK)
4. Ejecuta la migración de `paidAt` en lote (muy rápida, SQL puro)
5. Muestra resumen final

**Importante**: El script reemplaza TODOS los datos pero mantiene el código intacto.

---

## 🏗️ Arquitectura de datos clave

### Tabla `sales`
```sql
CREATE TABLE sales (
    id INTEGER PRIMARY KEY,
    saleNumber TEXT,
    date TEXT,
    customerId TEXT,
    items TEXT,           -- JSON con los productos
    total REAL,
    paidAmount REAL,
    paymentMethod TEXT,   -- cash, card, qr, mixed, credit, other
    status TEXT,          -- pending, partial, completed, paid
    paidAt TEXT,          -- ← NUEVO: fecha exacta de pago
    cashRegisterId INTEGER,
    business_id INTEGER,
    ...
);
```

### Tabla `payments` (abonos)
```sql
CREATE TABLE payments (
    id INTEGER PRIMARY KEY,
    saleId INTEGER,       -- FK a sales.id
    amount REAL,
    paymentMethod TEXT,
    date TEXT,
    business_id INTEGER,
    ...
);
```

### Tabla `customers`
```sql
CREATE TABLE customers (
    id INTEGER PRIMARY KEY,
    name TEXT,
    phone TEXT,
    balanceCredit REAL,   -- saldo a favor del cliente
    business_id INTEGER,
    ...
);
```

---

## 📋 Flujo de cuentas de clientes (fiados)

1. Se hace una venta con `paymentMethod = 'credit'` → `status = 'pending'`
2. El cliente abona → se crea registro en `payments` → si `paidAmount >= total` → `status = 'completed'` y se guarda `paidAt`
3. En la vista de clientes (`showAccountDetails`), hay 3 pestañas:
   - **Deuda Pendiente**: ventas con `status = 'pending'` o `'partial'`
   - **Ventas Pagadas**: ventas con `status = 'completed'` o `'paid'` → muestra `paidAt`
   - **Historial de Abonos**: todos los registros de `payments`

---

## 🔄 Plan pendiente (para mañana)

1. **Importar backup nuevo del negocio**: El usuario tiene otro PC en el negocio con datos más actuales. Mañana traerá el backup JSON más reciente, lo copiará a la carpeta raíz y ejecutará `npm run importar`.

2. **Pasar el sistema al otro PC**: Copiar la carpeta completa `c:\Sistema-Ventas-Negocio` al otro computador. Si `node_modules` da problemas, ejecutar `npm install` en el otro PC.

---

## ⚠️ Cosas importantes a tener en cuenta

1. El sistema funciona en **modo Electron** (app) con `npm start`, o en **modo web** accediendo a `localhost:3000` cuando el backend corre con `npm run server`.

2. La migración de `paidAt` **se ejecuta automáticamente cada vez que inicia el servidor** (solo actúa sobre ventas con `paidAt IS NULL`), por lo que es seguro reiniciar.

3. Si se importa un backup viejo sin la columna `paidAt`, el sistema la crea automáticamente al iniciar gracias a `runSchemaMigrations()` en `backend/server.js`.

4. El backup de seguridad antes del último import está en:
   `backend/data/database_antes_import_1780114638721.sqlite`

5. El sistema tiene soporte para **múltiples negocios** (`business_id`). El negocio actual es `"benzokoorp"`.
