# Auditoría de Stock — Problemas Encontrados y Soluciones Aplicadas

Fecha: Febrero 2026  
Motivo: Sospecha de cambios de stock inexplicables de un día para otro.

---

## Problema 1 (CRÍTICO): Race Condition en Creación de Ventas y Compras

### Descripción
Los productos se leían FUERA de la transacción de IndexedDB, y se escribían DENTRO de ella. Si dos operaciones se ejecutaban simultáneamente (o una interrumpía a la otra), la segunda podía sobrescribir los cambios de la primera, causando **pérdida de actualizaciones de stock**.

### Ejemplo del problema
```
1. Venta A lee: Producto X tiene stock = 100
2. Venta B lee: Producto X tiene stock = 100 (aún no se escribió Venta A)
3. Venta A escribe: stock = 100 - 5 = 95 ✓
4. Venta B escribe: stock = 100 - 3 = 97 ✗ (debería ser 92)
```

### Archivos afectados
- `js/services/SaleService.js` — `createSale()`
- `js/models/Purchase.js` — `create()`

### Solución aplicada
Los productos ahora se leen **DENTRO** de la transacción IndexedDB usando `productStore.get()`. Esto garantiza que cada operación lee el stock más actualizado, ya que IndexedDB serializa las operaciones dentro de una transacción `readwrite`.

```
Antes: pre-lectura → transacción(escritura)
Ahora: transacción(lectura → cálculo → escritura)  ← Todo atómico
```

---

## Problema 2 (CRÍTICO): Operaciones No-Atómicas en Edición/Eliminación de Ventas

### Descripción
La edición y eliminación de ventas ejecutaban múltiples operaciones secuenciales (`await` tras `await`). Si una fallaba a mitad del proceso, los cambios anteriores quedaban aplicados sin la venta actualizada — **stock restaurado parcialmente, movimientos huérfanos, datos inconsistentes**.

### Ejemplo del problema
```
Editar Venta (3 productos):
1. Restaurar stock Producto A  ✓ (se ejecutó)
2. Descontar stock Producto B  ✗ (error aquí)
3. Descontar stock Producto C  — (nunca se ejecutó)
→ Producto A tiene stock extra, Producto B y C correctos
→ MovimientoStock para Producto A queda sin la venta actualizada = HUÉRFANO
```

### Archivos afectados
- `js/models/Sale.js` — `updateSale()` y `delete()`
- `js/services/SaleReturnService.js` — `processReturn()`

### Solución aplicada
Todas las operaciones (actualización de stock + creación de movimientos + actualización/eliminación de venta + eliminación de pagos) ahora se ejecutan en una **única transacción IndexedDB**. Si cualquier operación falla, **todo se revierte automáticamente** — la base de datos queda exactamente como estaba antes.

```
Antes: await op1(); await op2(); await op3(); // Si op2 falla, op1 ya modificó la BD
Ahora: transaction { op1; op2; op3; }          // Si op2 falla, nada se modifica
```

---

## Problema 3 (CRÍTICO): Rollback Incompleto — Movimientos Huérfanos

### Descripción
Cuando ocurría un error en las operaciones secuenciales, el rollback manual:
- Revertía el stock del producto (usando `Product.updateStock`)
- **NO eliminaba los registros de StockMovement ya creados**

Esto creaba "movimientos fantasma" en el Kardex — registros que indican que algo pasó, pero el stock del producto no refleja ese movimiento.

### Archivos afectados
- `js/models/Sale.js` — `updateSale()` (rollback)
- `js/controllers/SupplierController.js` — `savePurchase()` edit (rollback)

### Solución aplicada
Al usar transacciones atómicas (Problema 2), **no se necesita rollback manual**. Si falla cualquier operación, IndexedDB revierte TODO automáticamente — productos, movimientos, venta — como si nunca hubiera pasado.

---

## Problema 4 (MODERADO): Doble Escritura de Costo en Edición de Compras

### Descripción
Al editar una compra, `SupplierController.savePurchase()` aplicaba los cambios de stock, y luego `PurchasesView.savePurchase()` ejecutaba un loop adicional que **sobrescribía el costo del producto con el valor crudo del formulario**, ignorando el cálculo de costo promedio ponderado.

### Ejemplo del problema
```
Producto X: stock=50, costo promedio=100
Compra: 10 unidades a costo=80
Costo promedio correcto: (50*100 + 10*80) / 60 = 96.67
Lo que pasaba: costo se sobrescribía a 80 (el valor del formulario)
```

### Archivos afectados
- `js/views/purchases.js` — `savePurchase()` (loop redundante)
- `js/controllers/SupplierController.js` — `savePurchase()` (faltaba cálculo de costo)

### Solución aplicada
1. El loop redundante en `PurchasesView` fue eliminado.
2. El cálculo de costo promedio ponderado se integró dentro de la transacción atómica del `SupplierController`, usando la fórmula:
```
costoPromedio = (stockOtro * costoActual + cantidadCompra * costoCompra) / stockTotal
```

---

## Problema 5 (MODERADO): Rollback Incompleto en Edición de Compras

### Descripción
Igual que el Problema 3, pero en el flujo de edición de compras. El rollback del `SupplierController` revertía stock pero no limpiaba los movimientos ya creados.

### Solución aplicada
Misma que Problema 3 — transacción atómica elimina la necesidad de rollback manual.

---

## Problema 6 (MODERADO): Importación de Backup Sobrescribe Stock Sin Registro

### Descripción
Al importar un backup, `BackupManager.importData()` usaba `db.put()` para cada producto, **sobrescribiendo silenciosamente el stock actual** con los valores del backup (que podrían ser de días o semanas atrás). No se creaba ningún movimiento de stock ni se dejaba registro de los cambios.

### Ejemplo del problema
```
Stock actual: Producto X = 45 unidades (después de 3 días de ventas)
Importar backup de hace 3 días: Producto X = 80 unidades
→ Stock ahora: 80 (se "ganaron" 35 unidades fantasma)
→ No hay movimiento que explique el cambio
```

### Archivo afectado
- `js/utils/backup.js` — `importData()`

### Solución aplicada
1. **Backup automático** antes de importar — si falla, se pregunta al usuario antes de continuar sin backup.
2. **Snapshot de stock** antes de importar — se registran los valores actuales de stock.
3. **Log de diferencias** después de importar — se compara stock antes/después y se registra en `console.warn` y `AuditLogService` cada producto cuyo stock cambió.
4. **Mensaje de advertencia** mejorado que avisa al usuario sobre los riesgos.

---

## Problema 7 (MENOR): Consumo Registrado Como Pérdida

### Descripción
En el ajuste rápido de inventario, cuando el tipo era `'consumption'` (consumo), se llamaba a `StockMovement.createLoss()` en lugar de `StockMovement.createConsumption()`. Ambos restan stock, pero el tipo de movimiento en el Kardex era incorrecto.

### Archivo afectado
- `js/views/inventory.js` — `saveAdjustment()`

### Solución aplicada
Se separó el `else if` para que `'loss'` llame a `createLoss()` y `'consumption'` llame a `createConsumption()`.

---

## Resumen de Impacto

| # | Problema | Severidad | Causa Raíz | Efecto en Stock |
|---|---------|-----------|------------|-----------------|
| 1 | Race condition en ventas/compras | CRÍTICO | Pre-lectura fuera de transacción | Pérdida de actualizaciones |
| 2 | Operaciones no-atómicas | CRÍTICO | `await` secuencial sin transacción | Estado parcial / inconsistente |
| 3 | Movimientos huérfanos | CRÍTICO | Rollback no limpia movimientos | Kardex corrupto |
| 4 | Doble escritura de costo | MODERADO | Loop redundante en vista | Costo promedio incorrecto |
| 5 | Rollback incompleto (compras) | MODERADO | Igual que #3 | Kardex corrupto |
| 6 | Import sobrescribe stock | MODERADO | `db.put()` directo sin registro | Stock retrocede en el tiempo |
| 7 | Consumo como pérdida | MENOR | `createLoss` en vez de `createConsumption` | Tipo de movimiento incorrecto |

---

## Problema 8 (RESIDUAL): Ajustes Individuales No-Atómicos en StockService

### Descripción
`StockService.createAdjustment()`, `createLoss()`, y `createConsumption()` ejecutaban la actualización de stock (`Product.updateStock`) y la creación del movimiento (`StockMovement.create`) como operaciones separadas. Si la creación del movimiento fallaba, el stock ya estaba modificado sin registro.

### Archivos afectados
- `js/services/StockService.js` — `createAdjustment()`, `createLoss()`, `createConsumption()`, `applyBulkAdjustmentAtomic()`

### Solución aplicada
Cada método ahora usa una transacción IndexedDB única que lee el producto, actualiza el stock, y crea el movimiento atómicamente. `applyBulkAdjustmentAtomic()` ahora procesa TODOS los items en una sola transacción (en lugar de rollback manual).

---

## Problema 9 (RESIDUAL): Race Condition en Edición de Producto con Stock

### Descripción
`ProductService.updateProduct()` calculaba la diferencia de stock fuera de la transacción:
1. Lee producto (stock = 40)
2. Calcula diferencia (usuario quiere 50, diff = +10)
3. Aplica ajuste (+10)

Si entre pasos 1 y 3 otro proceso cambiaba el stock (ej. venta reduce a 35), el ajuste aplicaba +10 al stock stale, resultando en 45 en vez de 50.

### Archivo afectado
- `js/services/ProductService.js` — `updateProduct()`

### Solución aplicada
Se creó `StockService.setStock()` que establece el stock a un valor absoluto calculando la diferencia **dentro** de la transacción. `ProductService.updateProduct()` ahora usa `setStock(id, targetStock, reason)` en lugar de calcular la diferencia externamente.

---

## Problema 10 (RESIDUAL): Purchase.delete() No-Atómico

### Descripción
`Purchase.delete()` llamaba a `StockService.revertPurchaseStock()` (operación secuencial no-atómica) para revertir el stock y luego eliminaba la compra. Si la reversión de stock fallaba parcialmente, la compra podría eliminarse con stock solo parcialmente revertido.

### Archivo afectado
- `js/models/Purchase.js` — `delete()`

### Solución aplicada
Reescrito con una transacción IndexedDB única que revierte stock, crea movimientos de ajuste y elimina la compra atómicamente.

---

## Problema 11 (RESIDUAL): InventoryView.saveSetStockManually() — Race Condition

### Descripción
Al establecer stock manualmente desde inventario, la diferencia se calculaba fuera de la transacción. Si otro proceso cambiaba el stock entre el cálculo y la aplicación, el resultado sería incorrecto.

### Archivo afectado
- `js/views/inventory.js` — `saveSetStockManually()`

### Solución aplicada
Reemplazado `StockMovement.createAdjustment(productId, difference, reason)` por `StockService.setStock(productId, newStock, reason)` que calcula la diferencia dentro de la transacción atómica.

---

## Archivos Modificados

1. `js/services/SaleService.js` — Transacción atómica con lecturas internas
2. `js/models/Purchase.js` — `create()` y `delete()` atómicos con lecturas internas
3. `js/models/Sale.js` — `updateSale()` y `delete()` atómicos
4. `js/services/SaleReturnService.js` — `processReturn()` atómico
5. `js/controllers/SupplierController.js` — Edición de compra atómica + costo promedio
6. `js/views/purchases.js` — Eliminado loop redundante de costo/precio
7. `js/views/inventory.js` — Tipo de movimiento corregido + `setStock()` para ajuste manual
8. `js/utils/backup.js` — Backup automático pre-importación + log de cambios en import y Excel
9. `js/services/StockService.js` — Métodos de ajuste/pérdida/consumo atómicos + nuevo `setStock()` + bulk atómico
10. `js/services/ProductService.js` — Usa `setStock()` para edición de producto
