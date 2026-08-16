# BASE DE DATOS - APUNTES Y AUDITORÍA COMPLETA

**Sistema:** POS Minimarket Chile  
**Motor:** IndexedDB (navegador / Electron)  
**Versión BD:** 15  
**Fecha de auditoría:** 2026-02-09  

---

## RESUMEN EJECUTIVO

El sistema tiene una arquitectura razonable (Repository → Model → Service → Controller → View) con buenos patrones como transacciones atómicas para ventas, idempotencia, y cálculo dinámico de deudas. Sin embargo, se detectaron problemas reales que van desde errores que causan fallos en runtime hasta oportunidades de mejora para profesionalizar la base de datos.

---

## ÍNDICE

1. [Esquema actual de la BD](#1-esquema-actual-de-la-bd)
2. [Lo que está bien hecho](#2-lo-que-está-bien-hecho)
3. [ERRORES CRÍTICOS (Gravedad Alta)](#3-errores-críticos-gravedad-alta)
4. [PROBLEMAS IMPORTANTES (Gravedad Media)](#4-problemas-importantes-gravedad-media)
5. [MEJORAS RECOMENDADAS (Gravedad Baja)](#5-mejoras-recomendadas-gravedad-baja)
6. [Lo que le falta a la BD para ser profesional](#6-lo-que-le-falta-a-la-bd-para-ser-profesional)
7. [Mapa de relaciones (ERD conceptual)](#7-mapa-de-relaciones-erd-conceptual)

---

## 1. ESQUEMA ACTUAL DE LA BD

### Object Stores (tablas) definidos en `db.js`

| # | Store | keyPath | autoIncrement | Índices |
|---|-------|---------|---------------|---------|
| 1 | `products` | id | Sí | barcode, name, category, expiryDate |
| 2 | `categories` | id | Sí | (ninguno) |
| 3 | `sales` | id | Sí | date, saleNumber, customerId |
| 4 | `customers` | id | Sí | name |
| 5 | `suppliers` | id | Sí | name |
| 6 | `purchases` | id | Sí | date, supplierId |
| 7 | `cashRegisters` | id | Sí | openDate, status |
| 8 | `cashMovements` | id | Sí | cashRegisterId, type, date |
| 9 | `stockMovements` | id | Sí | productId, date, type |
| 10 | `settings` | key (string) | No | (ninguno) |
| 11 | `users` | id | Sí | username, phone |
| 12 | `payments` | id | Sí | saleId, customerId, date, cashRegisterId |
| 13 | `expenses` | id | Sí | category, date, cashRegisterId |
| 14 | `customerCreditDeposits` | id | Sí | cashRegisterId, customerId, date |
| 15 | `customerCreditUses` | id | Sí | customerId, date |

**Total: 15 Object Stores**

---

## 2. LO QUE ESTÁ BIEN HECHO

### 2.1 Transacciones atómicas
- **Creación de ventas:** Sale + actualización de stock de cada producto + movimientos de stock se ejecutan en UNA transacción IndexedDB. Si algo falla, todo se revierte.
- **Registro de pagos:** Creación del pago + actualización del `paidAmount`/`status` de la venta se ejecutan atómicamente con optimistic locking.

### 2.2 Idempotencia en ventas
- `SaleService.createSale()` usa `idempotencyKey` para evitar ventas duplicadas si el usuario hace doble clic o hay un retry. Buena práctica.

### 2.3 Patrón Repository
- Separación clara: `BaseRepository` con CRUD genérico, repositorios especializados con queries de dominio. Facilita cambiar de motor de BD en el futuro.

### 2.4 Cálculo dinámico de deuda
- La deuda del cliente **nunca se almacena**, se calcula como `SUM(total - paidAmount)` de ventas con `status = 'pending' | 'partial'`. Elimina el riesgo de datos inconsistentes entre la deuda guardada y las ventas reales.

### 2.5 Protección de stock
- El stock no se puede modificar directamente vía `Product.update()` (lanza excepción). Solo se modifica vía `StockService` o `Product.updateStock()`, lo que garantiza que siempre se registre un movimiento.

### 2.6 Validaciones de integridad en eliminación
- `Customer.delete()` verifica que el cliente no tenga deudas ni saldo a favor antes de eliminar.
- `Sale.delete()` restaura stock y elimina pagos asociados.
- `CashRegister` impide abrir dos cajas simultáneamente.

### 2.7 Costo histórico en ventas
- `costAtSale` se graba en cada ítem de la venta al momento de crearla. Esto permite calcular rentabilidad real incluso si el costo del producto cambia después.

### 2.8 Backup y restauración
- Exportación/importación JSON completa.
- Auto-backup configurable en Electron.
- Backup al cerrar la aplicación.
- Preserva IDs originales en la restauración.

### 2.9 Rate limiting en recuperación de contraseña
- Máximo 5 intentos por hora. Buena práctica de seguridad.

---

## 3. ERRORES CRÍTICOS (Gravedad Alta)

### 3.1 ❌ Store `passwordResets` NO EXISTE en la BD

**Verificado:** El modelo `PasswordReset` y `PasswordResetRepository` usan el store `'passwordResets'`, pero este **NO está definido en `db.js`** (líneas 18-161).

**Impacto:** Cualquier intento de recuperar contraseña que intente logear el intento (`PasswordReset.logAttempt()`) causará un **error de runtime**: `NotFoundError: No objectStore named 'passwordResets'`. Esto puede romper el flujo de recuperación de contraseña completamente.

**Prueba:**  
```
- db.js define 15 stores: products, categories, sales, customers, suppliers, purchases, 
  cashRegisters, cashMovements, stockMovements, settings, users, payments, expenses, 
  customerCreditDeposits, customerCreditUses.
- 'passwordResets' NO está en la lista.
- PasswordResetRepository.constructor() → super('passwordResets') → intentará abrir 
  transacción en store inexistente → CRASH.
```

**Solución:** Agregar el object store `passwordResets` en `db.js` e incrementar la versión de la BD.

---

### 3.2 ❌ Ningún índice es UNIQUE — riesgo de datos duplicados

**Verificado:** En `db.js`, todos los índices se crean con `{ unique: false }`. No existe ni un solo `{ unique: true }`.

**Impacto real:**
- **`barcode` en productos:** Se pueden crear dos productos con el mismo código de barras. La validación existe a nivel de servicio (`ProductService.createProduct()` verifica `getByBarcode`), pero NO al editar. Un update puede duplicar barcode sin ser detectado.
- **`username` en usuarios:** Se pueden crear dos usuarios con el mismo nombre. La validación existe en `User.create()`, pero depende de leer toda la tabla y comparar — race condition posible.
- **`saleNumber` en ventas:** Se genera con `MAX + 1`, pero sin índice único. Si dos ventas se crean simultáneamente, podrían recibir el mismo número.

**Prueba:**
```
db.js línea 29: productStore.createIndex('barcode', 'barcode', { unique: false });
db.js línea 122: userStore.createIndex('username', 'username', { unique: false });
db.js línea 47: salesStore.createIndex('saleNumber', 'saleNumber', { unique: false });
```

**Solución:** Cambiar a `{ unique: true }` para `barcode`, `username`, y `saleNumber`. Mantener `{ unique: false }` para índices de búsqueda como `name`, `category`, `date`, etc.

---

### 3.3 ❌ Reporte de rentabilidad usa costo ACTUAL, no histórico

**Verificado:** `ReportController.getProfitability()` (líneas 97-100) calcula el costo de ventas así:

```javascript
const product = await Product.getById(item.productId);
const itemCost = product.cost * item.quantity;
```

Usa `product.cost` (costo **actual** del producto) en vez de `item.costAtSale` (costo al momento de la venta).

**Impacto:** Si el costo de un producto cambió desde que se vendió, el reporte de rentabilidad muestra cifras **incorrectas**. Ejemplo: vendiste a costo $500, luego el proveedor subió a $800 → el reporte mostrará pérdida cuando en realidad hubo ganancia.

**Prueba:**
```
ReportController.js línea 98: const product = await Product.getById(item.productId);
ReportController.js línea 100: const itemCost = product.cost * item.quantity;
// Debería ser: const itemCost = (item.costAtSale || product.cost) * item.quantity;
```

**Solución:** Usar `item.costAtSale` cuando esté disponible, fallback a `product.cost` para ventas antiguas sin migrar.

---

### 3.4 ❌ `Product.delete()` no valida integridad referencial

**Verificado:** `Product.delete()` (línea 39) simplemente elimina el producto sin verificar nada:

```javascript
static async delete(id) {
    return await this._repository.delete(id);
}
```

**Impacto:** Se puede eliminar un producto que:
- Tiene ventas asociadas (los ítems de venta quedan con `productId` huérfano).
- Tiene movimientos de stock pendientes.
- Está en compras no pagadas.
- Tiene stock > 0 (se pierde inventario sin rastro).

**Prueba:**
```
Product.js línea 39-41: No hay validación antes de delete.
Comparar con Customer.delete() que SÍ valida deudas antes de eliminar.
```

**Solución:** Validar antes de eliminar: verificar que no tenga ventas recientes, stock > 0, o movimientos pendientes. O implementar borrado lógico (marcar como inactivo en vez de eliminar).

---

### 3.5 ❌ Doble conteo de ingresos en reporte de rentabilidad

**Verificado:** `ReportController.getProfitability()` (líneas 94-95 y 145-146):

```javascript
// Línea 94-95: Suma total de cada venta
for (const sale of sales) {
    totalRevenue += sale.total;
    
// Línea 145-146: TAMBIÉN suma pagos de clientes
const totalPayments = paymentsInRange.reduce(...);
totalRevenue += totalPayments;
```

**Impacto:** Si una venta a crédito de $10,000 se creó en el período, y el cliente pagó $10,000 en el mismo período, el reporte muestra $20,000 de ingresos cuando el real es $10,000. Los pagos de deuda **no son ingresos nuevos**, son cobros de ingresos ya contabilizados en la venta.

**Solución:** Los pagos de deuda no deben sumarse a `totalRevenue`. Solo deben considerarse las ventas. Los pagos son flujo de efectivo, no ingreso.

---

## 4. PROBLEMAS IMPORTANTES (Gravedad Media)

### 4.1 ⚠️ Falta índice `cashRegisterId` en ventas

**Verificado:** Sales NO tiene índice en `cashRegisterId`. El método `SaleRepository.findByCashRegisterId()` hace:

```javascript
const sales = await this.findAll();  // Carga TODAS las ventas
return sales.filter(sale => sale.cashRegisterId === cashRegisterId);
```

**Impacto:** Con miles de ventas, cada apertura/cierre de caja o consulta de resumen carga TODA la tabla en memoria y filtra. Lento y costoso.

**Solución:** Agregar índice `cashRegisterId` en el store `sales`.

---

### 4.2 ⚠️ Falta índice `status` en ventas

**Verificado:** No hay índice `status` en sales. `AccountService.getCustomerBalance()` obtiene **todas** las ventas del cliente y filtra por `status === 'pending' || 'partial'` en JavaScript.

**Impacto:** Cada vez que se consulta la deuda de un cliente, se cargan todas sus ventas (incluyendo completadas). En clientes con muchas compras, esto es ineficiente.

---

### 4.3 ⚠️ `findByIdempotencyKey` hace full table scan

**Verificado:** `SaleRepository.findByIdempotencyKey()` carga todas las ventas y busca con `.find()`. No hay índice `idempotencyKey`.

**Impacto:** Con cada venta creada, se escanea toda la tabla de ventas. Con miles de ventas esto se vuelve lento. Además, el campo `idempotencyKey` es efímero (solo dura una sesión), así que la mayoría de ventas ni siquiera lo tiene.

---

### 4.4 ⚠️ La venta no tiene campos de auditoría

**Verificado:** El modelo `Sale` no tiene `createdAt`, `updatedAt`, ni `createdBy`.

**Prueba:**
```
- Product.js: SÍ tiene createdAt, updatedAt
- Customer.js: SÍ tiene updatedAt  
- Purchase.js: SÍ tiene createdAt, updatedAt
- Expense.js: SÍ tiene createdAt, updatedAt
- Sale.js: NO tiene ninguno ← inconsistencia
```

**Impacto:** No se puede saber cuándo fue modificada una venta ni quién la modificó. Dificulta auditoría.

---

### 4.5 ⚠️ Edición de compra NO es atómica

**Verificado:** `SupplierController.savePurchase()` al editar hace múltiples operaciones secuenciales:

```javascript
await StockService.revertPurchaseStock(removedItems, purchaseId);  // Paso 1
await Purchase.update(purchaseId, data);                            // Paso 2
await StockService.applyPurchaseStockForEdit(newItemsOnly, ...);   // Paso 3
await StockService.applyPurchaseQuantityDeltas(deltas, ...);       // Paso 4
```

**Impacto:** Si falla en el paso 3, los pasos 1 y 2 ya se ejecutaron. El stock queda inconsistente. Comparar con la creación de compra que SÍ es atómica.

---

### 4.6 ⚠️ Edición de venta (`Sale.updateSale`) no es atómica para stock

**Verificado:** `Sale.updateSale()` ejecuta restauraciones/descuentos de stock secuencialmente, luego actualiza la venta con `repository.replace()`. Si la restauración de stock falla a mitad, los ítems anteriores ya se restauraron.

**Impacto:** Mismo riesgo que 4.5. Podría quedar stock parcialmente restaurado.

---

### 4.7 ⚠️ `Supplier.delete()` no valida compras pendientes

**Verificado:** Similar a `Product.delete()`, `Supplier.delete()` no verifica si el proveedor tiene compras no pagadas antes de eliminar.

---

### 4.8 ⚠️ Indexes en `customerCreditDeposits` y `customerCreditUses` no se migran

**Verificado:** Estos stores se crean con `if (!db.objectStoreNames.contains(...))`. Si la BD fue creada antes de agregar estos stores, los índices se crean correctamente. PERO si el store ya existía (por una versión intermedia sin índices), los índices NO se agregan porque el bloque entero se salta.

**Prueba:**
```
db.js líneas 149-160: Solo crean índices dentro del IF de creación del store.
Comparar con líneas 24-32 (products): crean índices por SEPARADO del store.
```

---

## 5. MEJORAS RECOMENDADAS (Gravedad Baja)

### 5.1 💡 Falta borrado lógico (soft delete)

Ninguna entidad implementa soft delete. Cuando se elimina un producto, cliente, etc., desaparece permanentemente. En un sistema de ventas profesional, los registros deben marcarse como `deletedAt` o `active: false` para mantener integridad histórica.

### 5.2 💡 Falta tabla de `auditLog` (log de auditoría)

No existe un registro centralizado de quién hizo qué y cuándo. Ejemplo: quién eliminó un producto, quién anuló una venta, quién cambió un precio. Solo hay movimientos de stock y pagos, pero no un log general.

### 5.3 💡 Falta campo `createdBy` / `updatedBy`

Ningún modelo registra qué usuario creó o modificó el registro. El sistema tiene autenticación pero no la usa para auditoría.

### 5.4 💡 Falta tabla de `returns` (devoluciones)

No hay un modelo para devoluciones de clientes. Si un cliente devuelve un producto, no hay manera de registrarlo formalmente con motivo, fecha y restauración de stock asociada.

### 5.5 💡 Falta tabla de `priceHistory` (historial de precios)

Cuando se cambia el precio o costo de un producto, no queda registro del precio anterior ni cuándo cambió. Solo se sobrescribe.

### 5.6 💡 Falta tabla de `purchasePayments` (pagos a proveedores)

Las compras tienen `paidAmount` y `registerPayment()`, pero no existe una tabla separada de pagos a proveedores (equivalente a la tabla `payments` para ventas). Esto impide rastrear pagos parciales con fecha y método.

### 5.7 💡 Falta tabla de `discounts` o `promotions`

El sistema maneja descuentos como un número plano en la venta. No hay registro de promociones, descuentos por volumen, o descuentos por cliente.

### 5.8 💡 Los settings son key-value sin tipado

`settings` usa `keyPath: 'key'` sin esquema. No hay validación de qué keys existen ni qué tipo de valor tienen. Cualquier cosa se puede meter.

### 5.9 💡 Falta índice compuesto `[customerId, status]` en ventas

Para calcular deuda, siempre se filtra por `customerId` + `status in (pending, partial)`. Un índice compuesto optimizaría esta consulta.

### 5.10 💡 Categorías sin relación formal con productos

`categories` es un store separado, pero `products` guarda la categoría como string (`product.category = 'Bebidas'`), no como FK. Si se renombra una categoría, los productos existentes quedan con el nombre viejo.

---

## 6. LO QUE LE FALTA A LA BD PARA SER PROFESIONAL

### Comparación: BD actual vs. BD profesional de sistema de ventas

| Entidad/Feature | Actual | Profesional | Estado |
|---|---|---|---|
| Productos | ✅ | ✅ | OK |
| Categorías | ✅ (sin FK) | ✅ (con FK) | Mejorable |
| Ventas | ✅ | ✅ | OK |
| Ítems de venta | ❌ (embebidos en venta) | ✅ (tabla separada) | Falta |
| Clientes | ✅ | ✅ | OK |
| Proveedores | ✅ | ✅ | OK |
| Compras | ✅ | ✅ | OK |
| Ítems de compra | ❌ (embebidos en compra) | ✅ (tabla separada) | Falta |
| Pagos de clientes | ✅ | ✅ | OK |
| Pagos a proveedores | ❌ | ✅ (tabla separada) | **Falta** |
| Caja registradora | ✅ | ✅ | OK |
| Movimientos de caja | ✅ | ✅ | OK |
| Movimientos de stock | ✅ | ✅ | OK |
| Gastos | ✅ | ✅ | OK |
| Usuarios | ✅ | ✅ | OK |
| Roles/Permisos | ❌ | ✅ (tabla roles + permisos) | **Falta** |
| Log de auditoría | ❌ | ✅ | **Falta** |
| Devoluciones | ❌ | ✅ | **Falta** |
| Historial de precios | ❌ | ✅ | **Falta** |
| Promociones/Descuentos | ❌ | ✅ | **Falta** |
| Sucursales/Tiendas | ❌ | ✅ (multi-sucursal) | Falta |
| Impuestos (IVA) | ❌ | ✅ (tabla impuestos) | Falta |
| Métodos de pago | ❌ (hardcoded) | ✅ (tabla configurable) | Falta |
| Unidades de medida | ❌ (hardcoded: unit/weight) | ✅ (tabla configurable) | Falta |
| Soft delete | ❌ | ✅ | **Falta** |
| Campos de auditoría (createdBy, updatedBy) | Parcial | ✅ en todas las tablas | **Falta** |
| Índices únicos | ❌ | ✅ | **Falta** |
| Integridad referencial en delete | Parcial | ✅ en todas las FK | Mejorable |
| Backup/Restore | ✅ | ✅ | OK |

### Nota sobre ítems embebidos vs. tabla separada

Actualmente los ítems de venta y compra están **embebidos** dentro del objeto de la venta/compra como arrays. En una BD profesional, estos serían tablas separadas (`sale_items`, `purchase_items`) con FK a la venta/compra.

**Ventajas de tabla separada:**
- Consultas directas (ej: "¿cuántas unidades del producto X se vendieron este mes?" sin cargar todas las ventas)
- Índices por producto
- Menor carga de datos

**Realidad para IndexedDB:**
IndexedDB no soporta JOINs, así que embeber ítems es una decisión pragmática válida. El costo es que las consultas por producto requieren cargar todas las ventas y filtrar en JS. Para volúmenes pequeños-medianos (< 10,000 ventas) es aceptable.

---

## 7. MAPA DE RELACIONES (ERD CONCEPTUAL)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│  categories  │     │  suppliers   │     │     users        │
│              │     │              │     │                  │
│  id (PK)     │     │  id (PK)     │     │  id (PK)         │
│  name        │     │  name        │     │  username         │
│  color       │     │  phone       │     │  passwordHash     │
│              │     │  email       │     │  role             │
└──────┬───────┘     │  address     │     │  recoveryHash     │
       │(string,     └──────┬───────┘     └──────────────────┘
       │ no FK)             │
       │                    │ 1:N
┌──────▼───────┐     ┌──────▼───────┐
│  products    │     │  purchases   │
│              │     │              │
│  id (PK)     │     │  id (PK)     │
│  name        │     │  supplierId  │──→ suppliers.id
│  barcode     │     │  items[]     │──→ (embebido, ref products.id)
│  price       │     │  total       │
│  cost        │     │  paidAmount  │
│  stock       │     │  date        │
│  minStock    │     └──────────────┘
│  maxStock    │
│  category    │──→ categories.name (string, NO FK)
│  type        │
│  expiryDate  │
└──────┬───────┘
       │ 1:N
┌──────▼───────────┐
│  stockMovements  │
│                  │
│  id (PK)         │
│  productId       │──→ products.id
│  type            │    (sale/purchase/adjustment/loss/consumption)
│  quantity        │
│  reference       │──→ sale.id o purchase.id (sin FK formal)
│  date            │
│  reason          │
└──────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│  customers   │     │    sales     │     │  cashRegisters   │
│              │     │              │     │                  │
│  id (PK)     │◄──┐│  id (PK)     │     │  id (PK)         │
│  name        │   ││  saleNumber  │     │  initialAmount   │
│  phone       │   ││  customerId  │──→  │  status           │
│  email       │   ││  items[]     │──→ (embebido)│  openDate │
│  balanceCredit│  ││  total       │     │  closeDate       │
│  creditLimit │   ││  paidAmount  │     └────────┬─────────┘
└──────┬───────┘   ││  status      │              │ 1:N
       │           ││  paymentMethod│     ┌───────▼─────────┐
       │           ││  cashRegisterId│──→ │  cashMovements  │
       │           │└──────┬───────┘     │                 │
       │ 1:N       │       │             │  id (PK)        │
┌──────▼────────┐  │       │ 1:N         │  cashRegisterId │
│   payments    │  │┌──────▼───────┐     │  type (in/out)  │
│               │  ││              │     │  amount         │
│  id (PK)      │  ││              │     │  reason         │
│  saleId       │──┘│              │     └─────────────────┘
│  customerId   │──→│              │
│  amount       │   │              │     ┌──────────────────┐
│  paymentMethod│   │              │     │    expenses      │
│  date         │   │              │     │                  │
│  cashRegisterId│  │              │     │  id (PK)         │
└───────────────┘   │              │     │  description     │
                    │              │     │  amount          │
┌───────────────────┤              │     │  category        │
│ customerCredit    │              │     │  cashRegisterId  │
│ Deposits          │              │     │  date            │
│                   │              │     └──────────────────┘
│  id (PK)          │              │
│  customerId ──→ customers.id     │
│  amount           │              │
│  paymentMethod    │              │
│  cashRegisterId   │              │
└───────────────────┤              │
                    │              │
┌───────────────────┤              │
│ customerCredit    │              │
│ Uses              │              │
│                   │              │
│  id (PK)          │              │
│  customerId ──→ customers.id     │
│  saleId ──→ sales.id             │
│  amount           │              │
└───────────────────┘              │

⚠️ passwordResets (modelo existe, store NO definido en db.js)
```

---

## RESUMEN DE HALLAZGOS POR GRAVEDAD

### 🔴 CRÍTICOS (5) — Causan errores reales o datos incorrectos
| # | Problema | Impacto |
|---|----------|---------|
| 3.1 | Store `passwordResets` no existe | Crash al intentar logear recovery |
| 3.2 | Ningún índice es unique | Datos duplicados posibles |
| 3.3 | Rentabilidad usa costo actual, no histórico | Reportes incorrectos |
| 3.4 | `Product.delete()` sin validación | Datos huérfanos |
| 3.5 | Doble conteo de ingresos en rentabilidad | Revenue inflado |

### 🟡 IMPORTANTES (8) — Rendimiento o riesgo de inconsistencia
| # | Problema | Impacto |
|---|----------|---------|
| 4.1 | Falta índice cashRegisterId en sales | Full scan en cada cierre de caja |
| 4.2 | Falta índice status en sales | Lento para calcular deudas |
| 4.3 | idempotencyKey sin índice | Full scan por cada venta |
| 4.4 | Ventas sin campos de auditoría | Sin trazabilidad |
| 4.5 | Edición de compra no atómica | Riesgo de stock inconsistente |
| 4.6 | Edición de venta no atómica para stock | Riesgo de stock inconsistente |
| 4.7 | Supplier.delete() sin validación | Datos huérfanos |
| 4.8 | Índices de credit stores no se migran | Posibles queries sin índice |

### 🟢 MEJORAS (10) — Para profesionalizar el sistema
| # | Mejora |
|---|--------|
| 5.1 | Soft delete |
| 5.2 | Tabla de auditLog |
| 5.3 | Campos createdBy/updatedBy |
| 5.4 | Tabla de devoluciones |
| 5.5 | Historial de precios |
| 5.6 | Pagos a proveedores (tabla separada) |
| 5.7 | Promociones/Descuentos |
| 5.8 | Settings con esquema tipado |
| 5.9 | Índice compuesto [customerId, status] |
| 5.10 | Categorías con FK formal |

---

*Documento generado como auditoría técnica. No se realizaron cambios en el código.*
