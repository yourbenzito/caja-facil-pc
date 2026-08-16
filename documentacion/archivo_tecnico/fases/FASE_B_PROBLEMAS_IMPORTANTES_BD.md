# FASE B — CORRECCIÓN DE PROBLEMAS IMPORTANTES (Gravedad Media)

**Sistema:** POS Minimarket Chile  
**Motor:** IndexedDB (Electron / Browser)  
**Versión BD:** 16 → 17  
**Fecha de ejecución:** 2026-02-09  
**Auditoría base:** `BASE_DE_DATOS_APUNTES.md` (secciones 4.x)  
**Fase anterior:** `FASE_A_ERRORES_CRITICOS_BD.md` (cerrada)  
**Alcance:** Problemas importantes de rendimiento, consistencia y auditoría  

---

## RESUMEN EJECUTIVO

Se corrigieron 6 problemas de gravedad media. Ningún cambio es destructivo. Los datos existentes se preservan intactos. La versión de BD se incrementó de 16 a 17 para agregar índices.

| # | Problema | Categoría | Estado | Riesgo |
|---|----------|-----------|--------|--------|
| B1 | Índices faltantes en sales | Rendimiento | CORREGIDO | Nulo |
| B2 | Edición de compras no atómica | Consistencia | CORREGIDO | Bajo |
| B3 | Edición de ventas no atómica | Consistencia | CORREGIDO | Bajo |
| B4 | Eliminación de proveedores sin validación | Integridad | CORREGIDO | Nulo |
| B5 | Índices de credit stores no migran | Rendimiento | CORREGIDO | Nulo |
| B6 | Ventas sin campos de auditoría | Auditoría | CORREGIDO | Nulo |

---

## B1 — Índices faltantes en `sales`

### Evidencia

**Archivo:** `js/db.js` (antes de la corrección)  
Sales solo tenía 3 índices: `date`, `saleNumber`, `customerId`.

Queries que hacen full table scan por falta de índice:
- `SaleRepository.findByCashRegisterId()` — carga TODAS las ventas y filtra en JS
- `SaleRepository.findPending()` — carga todas y filtra `status === 'pending'`
- `SaleRepository.findByIdempotencyKey()` — carga todas y busca con `.find()`

### Impacto

Con N ventas en la BD:
- Cada apertura/cierre de caja ejecuta `findByCashRegisterId` → O(N) lectura
- Cada consulta de deuda ejecuta `findByCustomerId` + filtra por status → O(N)
- Cada creación de venta ejecuta `findByIdempotencyKey` → O(N)

Con miles de ventas, esto genera latencia perceptible.

### Solución implementada

**Archivo:** `js/db.js`  
Versión 16 → 17. Agregados 3 índices al store `sales`:

```javascript
if (!salesStore.indexNames.contains('cashRegisterId'))
    salesStore.createIndex('cashRegisterId', 'cashRegisterId', { unique: false });
if (!salesStore.indexNames.contains('status'))
    salesStore.createIndex('status', 'status', { unique: false });
if (!salesStore.indexNames.contains('idempotencyKey'))
    salesStore.createIndex('idempotencyKey', 'idempotencyKey', { unique: false });
```

El patrón `if (!indexNames.contains(...))` es seguro: no falla si el índice ya existe.

### Riesgos

- **Nulo.** Agregar índices a un store existente no modifica datos. IndexedDB construye el índice sobre los registros existentes automáticamente durante la migración.

### Lo que NO se corrigió

- Los repositorios (`SaleRepository.findByCashRegisterId`, etc.) aún hacen `findAll().filter()`. Se debería cambiar a `db.getByIndex()` para aprovechar los índices nuevos. Esto queda para una fase de optimización.

---

## B2 — Edición de compras no atómica

### Evidencia

**Archivo:** `js/controllers/SupplierController.js`, método `savePurchase()` (rama de edición)

Secuencia original (4 operaciones independientes, sin rollback):
```
1. StockService.revertPurchaseStock(removedItems)    // ESCRIBE BD
2. Purchase.update(purchaseId, data)                  // ESCRIBE BD
3. StockService.applyPurchaseStockForEdit(newItems)   // ESCRIBE BD
4. StockService.applyPurchaseQuantityDeltas(deltas)   // ESCRIBE BD
```

Si el paso 3 falla (ej: producto eliminado), los pasos 1 y 2 ya se ejecutaron → stock inconsistente.

### Impacto

- Stock de productos revertidos en paso 1 pero compra no actualizada correctamente
- Movimientos de stock parciales sin la contraparte
- Inventario descuadrado sin trazabilidad de la causa

### Solución implementada

**Archivo:** `js/controllers/SupplierController.js`

Tres fases:

**Fase 1 — Lectura y cálculo:** Se calculan todas las operaciones necesarias (removidos, nuevos, deltas) sin tocar la BD.

**Fase 2 — Prevalidación:** Se verifica que hay stock suficiente para TODAS las operaciones de resta antes de ejecutar cualquier cambio:
```javascript
for (const item of removedItems) {
    // Verificar que hay stock para revertir (restar)
    if (product.stock < qty) throw new Error('Stock insuficiente para revertir...');
}
for (const { productId, quantityDelta } of deltas) {
    if (quantityDelta < 0) { /* verificar stock */ }
}
```

**Fase 3 — Ejecución con rollback:** Cada operación se registra en un array `applied[]`. Si cualquier paso falla, se recorre `applied` en orden inverso, revirtiendo cada cambio:
```javascript
const applied = [];
try {
    // ejecutar paso a paso, registrando en applied[]
} catch (error) {
    // rollback: recorrer applied[] en orden inverso
    for (let i = applied.length - 1; i >= 0; i--) {
        // revertir: si sumamos → restar; si restamos → sumar; si actualizamos → restaurar original
    }
    throw new Error('Error al editar compra (cambios revertidos): ...');
}
```

### Riesgos

- **Bajo.** El rollback manual no es 100% garantizado (si falla el rollback mismo, queda parcialmente revertido). Se loguea con `console.error` para diagnóstico.
- Es mejor que la situación anterior (sin rollback alguno).
- Una transacción IndexedDB nativa sería ideal pero requiere reescribir todo el flujo de StockService (fuera de alcance de esta fase).

### Lo que NO se corrigió

- No se migró a una transacción IndexedDB nativa (requiere refactor grande de StockService).
- No se agregó log de auditoría para el rollback.

---

## B3 — Edición de ventas no atómica para stock

### Evidencia

**Archivo:** `js/models/Sale.js`, método `updateSale()`

Secuencia original: 3 bucles separados de operaciones de stock (restaurar eliminados, aplicar deltas, descontar nuevos), cada uno puede fallar a mitad dejando las anteriores aplicadas.

### Impacto

Idéntico a B2: stock inconsistente si falla a mitad de los ajustes.

### Solución implementada

**Archivo:** `js/models/Sale.js`

Misma estrategia de 3 fases que B2:

1. **Cálculo de operaciones:** Se pre-computan TODAS las operaciones de stock en un array `stockOps[]`:
   ```javascript
   stockOps = [
     { action: 'restore', productId: X, qty: N },  // Producto eliminado o delta negativo
     { action: 'deduct', productId: Y, qty: M },    // Producto nuevo o delta positivo
   ]
   ```

2. **Prevalidación completa:** Se verifica stock suficiente para TODAS las operaciones de tipo `deduct` antes de ejecutar nada:
   ```javascript
   for (const op of stockOps) {
       if (op.action !== 'deduct') continue;
       const validation = ProductValidator.validateStock(product, op.qty);
       if (!validation.valid) throw new Error(validation.error);
   }
   ```

3. **Ejecución con rollback:** Se ejecuta cada operación, registrando en `applied[]`. Si falla, se revierte todo en orden inverso.

### Riesgos

- **Bajo.** Mismo riesgo que B2: rollback manual no 100% garantizado.
- La prevalidación reduce drásticamente la probabilidad de fallo durante ejecución.

### Lo que NO se corrigió

- No se migró a transacción IndexedDB nativa.
- Los movimientos de stock (StockMovement) creados antes del fallo no se eliminan en el rollback (solo se revierte el stock del producto). Esto deja movimientos "huérfanos" pero el stock queda correcto.

---

## B4 — Eliminación peligrosa de proveedores

### Evidencia

**Archivo:** `js/models/Supplier.js`, líneas 21-23 originales:
```javascript
static async delete(id) {
    return await this._repository.delete(id);
}
```

Sin validación. Idéntico al problema ya corregido en `Product.delete()` (Fase A, error A4).

### Impacto

Se puede eliminar un proveedor que:
- Tiene compras registradas → las compras quedan con `supplierId` huérfano
- Tiene compras pendientes de pago → se pierde la trazabilidad de la deuda

### Solución implementada

**Archivo:** `js/models/Supplier.js`

Dos niveles de validación:

1. **Compras con saldo pendiente:** Bloqueo con mensaje que incluye el monto de deuda total:
   ```
   No se puede eliminar "Proveedor X" porque tiene N compra(s) con saldo pendiente
   (deuda total: $XXX). Pague las compras antes de eliminar.
   ```

2. **Compras pagadas (historial):** Bloqueo con mensaje descriptivo:
   ```
   No se puede eliminar "Proveedor X" porque tiene N compra(s) registrada(s).
   Eliminar este proveedor dejaría compras huérfanas.
   ```

Solo se permite eliminar proveedores sin compras asociadas.

### Riesgos

- **Nulo.** Solo bloquea eliminaciones peligrosas. No modifica datos.

---

## B5 — Índices de credit stores no migran correctamente

### Evidencia

**Archivo:** `js/db.js`, líneas 152-164 (antes de corrección):
```javascript
// PROBLEMA: Índices dentro del bloque de creación del store
if (!db.objectStoreNames.contains('customerCreditDeposits')) {
    const creditDepositStore = db.createObjectStore(...);
    creditDepositStore.createIndex('cashRegisterId', ...);  // Solo se crea si el store es NUEVO
    creditDepositStore.createIndex('customerId', ...);
    creditDepositStore.createIndex('date', ...);
}
// Si el store ya existe (de una versión anterior sin índices), los índices NUNCA se crean
```

Comparar con el patrón correcto usado para `products` (líneas 28-36):
```javascript
if (!db.objectStoreNames.contains('products')) {
    productStore = db.createObjectStore(...);
} else {
    productStore = tx.objectStore('products');  // ACCEDE al store existente
}
// Índices se crean AFUERA del if — funcionan tanto para stores nuevos como existentes
if (!productStore.indexNames.contains('barcode'))
    productStore.createIndex('barcode', ...);
```

### Impacto

Si un usuario tenía la BD en una versión donde los stores `customerCreditDeposits` / `customerCreditUses` se crearon sin índices (o con índices parciales), las queries por `customerId` o `cashRegisterId` no pueden usar índice y hacen full scan.

### Solución implementada

**Archivo:** `js/db.js`

Se adoptó el patrón correcto para ambos stores:
```javascript
let creditDepositStore;
if (!db.objectStoreNames.contains('customerCreditDeposits')) {
    creditDepositStore = db.createObjectStore(...);
} else {
    creditDepositStore = tx.objectStore('customerCreditDeposits');
}
if (!creditDepositStore.indexNames.contains('cashRegisterId'))
    creditDepositStore.createIndex('cashRegisterId', ...);
if (!creditDepositStore.indexNames.contains('customerId'))
    creditDepositStore.createIndex('customerId', ...);
if (!creditDepositStore.indexNames.contains('date'))
    creditDepositStore.createIndex('date', ...);
```

### Riesgos

- **Nulo.** Si los índices ya existían, `indexNames.contains()` los detecta y no intenta recrearlos.

---

## B6 — Campos de auditoría mínimos en Sale

### Evidencia

**Modelos con `createdAt`/`updatedAt`:**
- Product.js: SÍ (`createdAt` en create, `updatedAt` en update/stock)
- Customer.js: SÍ (`updatedAt` en update)
- Purchase.js: SÍ (`createdAt`, `updatedAt`)
- Expense.js: SÍ (`createdAt`, `updatedAt`)
- Supplier.js: SÍ (`createdAt`)

**Sale.js: NO tiene ninguno.** No se puede saber cuándo fue creada ni cuándo fue la última modificación de una venta.

### Impacto

- No se puede auditar cuándo se modificó una venta
- No se puede detectar ventas que fueron editadas mucho después de su creación
- Inconsistencia con el resto de los modelos

### Solución implementada

**Archivo:** `js/services/SaleService.js` (creación de venta)
```javascript
const sale = {
    ...campos existentes...,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
};
```

**Archivo:** `js/models/Sale.js` (en `updateSale`)
```javascript
const updated = {
    ...sale,
    ...updateData,
    updatedAt: new Date().toISOString()
};
```

**Archivo:** `js/models/Sale.js` (en `registerPayment`)
```javascript
const updated = {
    ...sale,
    paidAmount: ...,
    status: ...,
    updatedAt: new Date().toISOString()
};
```

### Compatibilidad con ventas existentes

Las ventas anteriores NO tienen `createdAt` ni `updatedAt`. Esto es intencionado:
- No se modifican ventas existentes (no destructivo)
- Al leer una venta sin `createdAt`, se puede usar `sale.date` como fallback
- Al leer una venta sin `updatedAt`, se asume que nunca fue modificada

### Riesgos

- **Nulo.** Los campos nuevos solo se agregan a ventas nuevas o editadas. Las ventas existentes siguen funcionando normalmente (los campos simplemente no existen, no causan error).

### Lo que NO se corrigió

- No se agregó `createdBy`/`updatedBy` (requiere pasar el usuario autenticado por toda la cadena de llamadas, es un cambio estructural que queda para Fase C).
- No se migraron ventas existentes para añadir `createdAt` retroactivamente.

---

## ARCHIVOS MODIFICADOS

| Archivo | Cambios |
|---------|---------|
| `js/db.js` | Versión 16→17, 3 índices en sales, fix patrón credit stores |
| `js/controllers/SupplierController.js` | `savePurchase()` con prevalidación y rollback |
| `js/models/Sale.js` | `updateSale()` con prevalidación y rollback, `updatedAt` en update/payment |
| `js/models/Supplier.js` | `delete()` con validación de compras asociadas |
| `js/services/SaleService.js` | `createdAt`/`updatedAt` en creación de venta |

## VERIFICACIONES POST-IMPLEMENTACIÓN

- [x] Linter: 0 errores en todos los archivos modificados
- [ ] La app arranca correctamente (migración BD 16→17)
- [ ] Índices `cashRegisterId`, `status`, `idempotencyKey` presentes en sales
- [ ] Edición de compra: si falla un paso, el stock se revierte
- [ ] Edición de venta: si falla un paso, el stock se revierte
- [ ] No se puede eliminar un proveedor con compras
- [ ] Credit stores tienen todos sus índices
- [ ] Ventas nuevas tienen `createdAt` y `updatedAt`
- [ ] Al editar una venta, `updatedAt` se actualiza

## LO QUE NO SE TOCÓ EN ESTA FASE

- Optimización de repositorios para usar los nuevos índices (B1 complemento)
- Transacciones IndexedDB nativas para B2/B3 (requiere refactor de StockService)
- Campos `createdBy`/`updatedBy`
- Soft delete
- Log de auditoría centralizado
- Nuevas tablas de negocio

---

*Documento generado para revisión de auditor externo.*
