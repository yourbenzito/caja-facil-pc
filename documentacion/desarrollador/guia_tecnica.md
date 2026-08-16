# Documentación Técnica – Sistema de Ventas La Kurva

Documentación para desarrolladores: arquitectura, módulos, base de datos y mejoras implementadas.

**Versión:** 1.2.0

---

## Índice

1. [Stack y entorno](#stack-y-entorno)
2. [Arquitectura](#arquitectura)
3. [Base de datos (IndexedDB)](#base-de-datos-indexeddb)
4. [Estructura del código](#estructura-del-código)
5. [Flujo de datos](#flujo-de-datos)
6. [Mejoras implementadas (v1.1.0)](#mejoras-implementadas-v110)
7. [Mejoras de auditoría (v1.2.0)](#mejoras-de-auditoría-v120)
8. [Scripts y utilidades](#scripts-y-utilidades)

---

## Stack y entorno

- **Runtime:** Electron (app desktop).
- **Frontend:** HTML, CSS, JavaScript vanilla (sin frameworks).
- **Base de datos:** IndexedDB (almacenamiento local).
- **PWA:** Service Worker, `manifest.json` (instalable).
- **Moneda:** CLP (Peso Chileno) en formateo y reportes.

---

## Arquitectura

El sistema implementa una arquitectura híbrida **Offline-First MVC / Repository** con soporte para un backend local Express + SQLite 3 y almacenamiento resiliente en IndexedDB:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Vistas Frontend (15)                              │
│ (pos.js, sales.js, expenses.js, creditNotes.js, ai-copilot.js, auditLogs…)  │
└──────────────────────┬──────────────────────────────┬───────────────────────┘
                       │                              │
                       ▼                              ▼
┌──────────────────────────────┐              ┌──────────────────────────────┐
│  ApiClient / Repositorios    │              │  Controladores y Servicios   │
│  (Rest API cliente Node.js)  │              │ (SaleService, StockService)  │
└──────────────┬───────────────┘              └──────────────┬───────────────┘
               │                                             │
               ▼                                             ▼
┌──────────────────────────────┐              ┌──────────────────────────────┐
│  Servidor REST Express       │              │  IndexedDB Fallback / Local  │
│  (backend/server.js)         │              │  (js/db.js - v13)            │
└──────────────┬───────────────┘              └──────────────────────────────┘
               │
               ▼
┌──────────────────────────────┐
│  SQLite 3 (database.sqlite)  │
└──────────────────────────────┘
```

- **Views (15 Módulos):** Renderizado DOM y captura de eventos (`dashboard.js`, `pos.js`, `sales.js`, `products.js`, `inventory.js`, `customers.js`, `suppliers.js`, `purchases.js`, `cash.js`, `expenses.js`, `creditNotes.js`, `ai-copilot.js`, `auditLogs.js`, `reports.js`, `settings.js`).
- **Controllers & Services:** Orquestación de lógica de negocio (SaleService, StockService, PaymentService, AccountService, ProductService).
- **Repositories & ApiClient:** Abstracción de persistencia que redirige operaciones a SQLite via Express local o IndexedDB.
- **Validators:** ProductValidator, SaleValidator, PaymentValidator, ExpenseValidator.

---

## Base de datos

### 1. Backend SQLite 3 (`backend/data/database.sqlite`)
Motor relacional principal para entornos locales con Electron. Tablas principales: `businesses`, `users`, `products`, `sales`, `payments`, `purchases`, `expenses`, `sale_returns`, `cash_registers`, `cash_movements`, `customers`, `suppliers`, `stock_movements`, `audit_logs`.

### 2. IndexedDB (`POSMinimarket` v13)
Motor local en navegador/Chromium para operaciones sin servidor. Stores principales: `products`, `sales`, `customers`, `suppliers`, `purchases`, `cashRegisters`, `cashMovements`, `payments`, `stockMovements`, `expenses`, `saleReturns`, `auditLogs`, `users`, `categories`.

---

## Estructura del Código

```
Sistema-Ventas-Negocio/
├── backend/                  # Servidor API REST Express local
│   ├── server.js             # Enrutador principal y consultas SQLite
│   ├── schema.sql            # Definición DDL de tablas e índices
│   └── database/             # Conexión y utilidades SQLite
├── js/
│   ├── app.js                # Router Single Page Application
│   ├── auth.js               # Autenticación, sesión y PIN
│   ├── db.js                 # Esquema IndexedDB
│   ├── controllers/          # Controladores de lógica de UI
│   ├── models/               # Modelos de dominio (Sale, Product, CashRegister, Expense, etc.)
│   ├── repositories/         # Capa de repositorios
│   ├── services/             # Lógica pesada (SaleService, StockService, ProductService)
│   ├── validators/           # Reglas de validación
│   ├── views/                # 15 módulos de vistas de la aplicación
│   └── utils/                # ApiClient, Backup, Formatter, Keyboard, Alerts
```

---

## Flujos de Datos Avanzados

- **Crear venta (POS):** POS -> POSController -> SaleService.createSale -> Registra Venta + StockService.processSaleStock. Rollback automático si no hay stock.
- **Emisión de Nota de Crédito / Devolución:** CreditNotesView -> SaleReturn.create -> Reingreso automático de ítems devueltos vía StockService.restoreSaleStock + Reembolso en caja o crédito a favor de cliente.
- **Registro de Gasto Operacional:** ExpensesView -> Expense.create -> Si método de pago es `efectivo`, genera automáticamente un `cashMovement` de salida en la caja abierta actual.
- **Calculadora de Cajas en Compra:** PurchasesView -> desglose de caja (`unidadesPorCaja` * `cantidadCajas`), cálculo de costo neto/bruto unitario -> asignación automática a `PurchaseItem.unitCost` -> actualización de costo promedio del producto en inventario.
- **Copiloto IA:** AICopilot View -> ApiClient.post('/ai/query') -> Agregaciones en backend/SQLite sobre ventas, mermas y productos críticos -> Respuesta estructurada conversacional.
- **Cerrar caja:** Vista Caja → CashController → CashRegister.close(); resumen por método de pago vía SaleRepository.getTotalByPaymentMethod; cuadratura solo con efectivo contado.
- **Editar venta:** Vista Ventas → Controller → Sale.updateSale (reconciliación de ítems) → StockService.restoreSaleStock / processSaleStock según diferencias de cantidad.
- **Eliminar compra:** Purchase.delete → StockService.revertPurchaseStock → luego borrado en BD.

---

## Mejoras implementadas (v1.1.0)

### Caja (cuadratura y consistencia)

| Archivo | Cambio |
|---------|--------|
| `js/models/CashRegister.js` | En `close()` y `getSummary()` se eliminó la suma duplicada de pagos de deuda; se usa solo el resumen de ventas por método de pago (`salesPaymentSummary`). Corrección de bug donde `salesPaymentSummary` no estaba definido en `close()`. |
| `js/views/cash.js` | El valor enviado al cerrar caja es solo el **efectivo contado** (no la suma de todos los medios). Botón «Historial de esta caja» usa el `id` de la caja correctamente. Modal del historial con fondo oscuro y texto claro para mejor contraste. |
| `js/repositories/SaleRepository.js` | En `getTotalByPaymentMethod()`: para ventas `pending`/`partial` sin `paymentDetails`, se evita doble conteo con registros de `Payment`; si no hay Payment y hay `paidAmount`, se atribuye al método de la venta o efectivo. |

### Stock e inventario

| Archivo | Cambio |
|---------|--------|
| `js/validators/ProductValidator.js` | Validación de stock para tipo `weight`; uso de `parseFloat` y validación de cantidad. |
| `js/models/Product.js` | `updateStock()` usa `parseFloat` y lanza error si la resta dejaría stock negativo. |
| `js/models/Sale.js` | En `updateSale()`: reconciliación de stock al cambiar ítems (por `productId`). Si `newQty < oldQty` → `StockService.restoreSaleStock`; si `newQty > oldQty` → validar y `StockService.processSaleStock`. |
| `js/models/Purchase.js` | En `delete()`: se llama a `StockService.revertPurchaseStock()` antes de eliminar la compra. |
| `js/services/SaleService.js` | En `createSale()`: si `StockService.processSaleStock()` falla después de crear la venta, se elimina la venta (`Sale._repository.delete(saleId)`). |
| `js/services/StockService.js` | `processSaleStock()` valida stock con `ProductValidator.validateStock()` antes de restar. `createAdjustment()`: si cantidad es negativa, valida stock suficiente; si es 0, no hace nada. |
| `js/repositories/ProductRepository.js` | `findLowStock()` usa `parseFloat` y trata `minStock` indefinido como 0. |
| `js/views/inventory.js` | Tarjeta «Valor Inventario» renombrada a «Valor Inventario Precio Costo». Nueva tarjeta «Valor Inventario Precio Venta». Ambos calculados con datos actuales de productos (stock × costo / stock × precio). |

---

## Mejoras de auditoría (v1.2.0)

Implementación de las 8 correcciones derivadas de la auditoría del sistema (ver [historial_cambios.md](historial_cambios.md)).

| # | Área | Cambio técnico |
|---|------|----------------|
| 1 | Validación | ProductValidator en ProductController e importación; SaleValidator rechaza total ≠ suma ítems; unicidad barcode. |
| 2 | Preload (Electron) | Whitelist getPath; validación tipo/tamaño/JSON en backup. |
| 3 | Inventario | Campo `expiryDate` en Product (índice en DB); columna y filtro «Próx. a vencer» en Productos e Inventario. |
| 4 | Clientes | Campo `creditLimit` en Customer; SaleService valida deuda + venta ≤ límite antes de crear venta fiada. |
| 5 | Transacciones | SaleService.createSale usa una transacción IndexedDB sobre sales + products + stockMovements (rollback automático). |
| 6 | Backup | Rotación (últimos 30 archivos); verificación post-escritura (tamaño y contenido JSON). |
| 7 | Servicios | ProductService (createProduct/updateProduct) con validación centralizada; controller e importación lo usan. |
| 8 | UX | updateCashRegister6, deleteCashRegister y generación de código de recuperación usan modal `confirm(message, callback)`. |

**Archivos nuevos:** `js/services/ProductService.js`.  
**DB:** versión 13 (índice `expiryDate` en products).

---

## Scripts y utilidades

- **Backup/restauración:** `js/utils/backup.js` (export/import JSON).
- **Utilidades de BD:** `js/utils/db-utilities.js`.
- **Migraciones/ajustes de caja:** `js/utils/createHistoricalCashRegister.js`, `updateCashRegister6.js`, `fixCashMovementsSync.js`, `verifyCashRegister.js`, `deleteCashRegister.js`.
- **Coste histórico:** `js/utils/migrateHistoricalCost.js`.
- **Teclado:** `js/utils/keyboard.js` (atajos globales).
- **Formateo:** `js/utils/formatter.js` (CLP, fechas, etc.).

Para ejecutar la app en desarrollo: `npm start` (o el script definido en `package.json`). En producción se usa el ejecutable Electron empaquetado.

---

**Última actualización:** Febrero 2026
