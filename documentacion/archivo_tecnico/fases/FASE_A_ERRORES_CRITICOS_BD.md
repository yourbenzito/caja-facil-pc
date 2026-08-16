# FASE A — CORRECCIÓN DE ERRORES CRÍTICOS DE BASE DE DATOS

**Sistema:** POS Minimarket Chile  
**Motor:** IndexedDB (Electron / Browser)  
**Fecha de ejecución:** 2026-02-09  
**Auditoría base:** `BASE_DE_DATOS_APUNTES.md`  
**Alcance:** SOLO errores críticos verificados (5 puntos)  
**Archivos modificados:** `js/db.js`, `js/models/Product.js`, `js/services/ProductService.js`, `js/controllers/ReportController.js`, `js/views/reports.js`  

---

## RESUMEN EJECUTIVO

Se corrigieron 5 errores críticos identificados en la auditoría de base de datos. Todos fueron verificados antes de implementar. Ninguna corrección es destructiva: no se eliminan datos, no se modifican registros existentes, no se cambian esquemas de índices existentes.

| # | Error | Gravedad | Estado | Riesgo de la corrección |
|---|-------|----------|--------|------------------------|
| A1 | Store `passwordResets` faltante | CRÍTICO (runtime crash) | CORREGIDO | Nulo — solo agrega store nuevo |
| A2 | Falta unicidad en barcode/username/saleNumber | CRÍTICO (datos duplicados) | CORREGIDO (app-level) | Nulo — solo agrega validación |
| A3 | Rentabilidad usa costo actual, no histórico | CRÍTICO (reportes incorrectos) | CORREGIDO | Bajo — fallback seguro para ventas antiguas |
| A4 | `Product.delete()` sin validación | CRÍTICO (datos huérfanos) | CORREGIDO | Nulo — solo bloquea borrados peligrosos |
| A5 | Doble conteo de ingresos en rentabilidad | CRÍTICO (contabilidad inflada) | CORREGIDO | Bajo — cambia cifras de reporte (ahora correctas) |

---

## ERROR A1 — Store `passwordResets` faltante

### Evidencia

**Archivo:** `js/db.js` (versión 15, líneas 18-161)  
**Modelo afectado:** `PasswordReset` → `PasswordResetRepository` → store `'passwordResets'`

El store `passwordResets` es referenciado por:
- `PasswordResetRepository` (constructor: `super('passwordResets')`)
- `PasswordReset.isRateLimited()` — llamado en `auth.js` línea 618
- `PasswordReset.logAttempt()` — llamado en `auth.js` líneas 660, 710, 735, 824, 918

Pero **NO existe** en la definición de `onupgradeneeded` de `db.js`. Los 15 stores definidos son: products, categories, sales, customers, suppliers, purchases, cashRegisters, cashMovements, stockMovements, settings, users, payments, expenses, customerCreditDeposits, customerCreditUses.

**Búsqueda realizada:** `grep -i "passwordReset" js/db.js` → 0 resultados.

### Impacto

Cuando un usuario intenta recuperar su contraseña:
1. `PasswordReset.isRateLimited('local')` se ejecuta (auth.js:618)
2. Internamente llama a `PasswordResetRepository.countRecentFailedAttempts()`
3. Que llama a `this.findAll()` → `db.getAll('passwordResets')`
4. IndexedDB lanza `NotFoundError: Failed to execute 'transaction' on 'IDBDatabase': One of the specified object stores was not found.`
5. El flujo de recuperación de contraseña **se aborta completamente**

### Solución implementada

**Archivo:** `js/db.js`  
**Cambios:**
1. Versión de BD incrementada de 15 a 16 (línea 4)
2. Store `passwordResets` agregado con:
   - `keyPath: 'id'`, `autoIncrement: true`
   - Índice `userId` (no unique)
   - Índice `date` (no unique)
3. Patrón idéntico al de los otros stores recientes (customerCreditDeposits, etc.)

### Riesgos

- **Nulo.** Agregar un store nuevo no afecta stores existentes.
- La migración de versión (15 → 16) se ejecuta automáticamente al abrir la BD.
- IndexedDB preserva todos los datos existentes durante la migración.
- Si el upgrade falla por cualquier razón, la BD queda en versión 15 (sin cambios).

### Lo que NO se corrigió

- No se agregaron más índices (ej: `ipAddress`). Suficiente para la funcionalidad actual.
- No se cambió la lógica de `auth.js` (funciona correctamente una vez que el store existe).

---

## ERROR A2 — Falta de unicidad en barcode/username/saleNumber

### Evidencia

**Archivo:** `js/db.js`  
Todos los índices se crean con `{ unique: false }`:
- Línea 29: `productStore.createIndex('barcode', 'barcode', { unique: false })`
- Línea 122: `userStore.createIndex('username', 'username', { unique: false })`
- Línea 47: `salesStore.createIndex('saleNumber', 'saleNumber', { unique: false })`

### Análisis de riesgo: ¿Por qué NO hacer `unique: true` en producción?

**Razón 1 — Barcode vacío:**  
`Product.create()` (línea 6) asigna `barcode: data.barcode || ''`. Muchos productos no tienen código de barras y tienen `barcode: ''`. Si hacemos el índice `unique: true`, **solo un producto podría tener barcode vacío**, rompiendo la BD para todos los demás.

**Razón 2 — Migración destructiva:**  
IndexedDB requiere que al hacer un índice `unique: true`, TODOS los valores existentes sean únicos. Si hay duplicados (legítimos como `barcode: ''`), **la migración falla**, **la BD no abre**, y **la aplicación no arranca**. Esto en producción con datos reales es inaceptable.

**Razón 3 — No hay rollback automático:**  
Si la migración falla a mitad, IndexedDB puede quedar en estado inconsistente. No hay un mecanismo de rollback elegante.

### Validaciones existentes (verificadas)

| Campo | Validación al CREAR | Validación al ACTUALIZAR |
|-------|---------------------|--------------------------|
| `barcode` | SÍ — `ProductService.createProduct()` verifica duplicados | **NO** — `updateProduct()` no verificaba |
| `username` | SÍ — `User.create()` verifica duplicados | N/A (username no se cambia) |
| `saleNumber` | SÍ — generado secuencialmente con `MAX+1` | N/A (no se edita) |

### Solución implementada

**Archivo:** `js/services/ProductService.js`  
**Cambio:** Se agregó validación de unicidad de barcode en `updateProduct()`:

```javascript
// A2 FIX: Validar unicidad de barcode al actualizar
if (data.barcode && String(data.barcode).trim() !== '') {
    const trimmedBarcode = String(data.barcode).trim();
    const existing = await Product.getByBarcode(trimmedBarcode);
    if (existing && existing.id !== parseInt(id)) {
        throw new Error(`El código de barras "${trimmedBarcode}" ya está asignado al producto "${existing.name}"`);
    }
}
```

**Archivo:** `js/db.js`  
**Cambio:** Comentario de auditoría explicando la decisión de mantener `unique: false`:

```javascript
// NOTA AUDITORÍA A2: barcode NO es unique a nivel de IndexedDB porque muchos productos
// tienen barcode = '' (vacío). Hacer unique rompería la migración en producción.
// La unicidad de barcode se valida a nivel de aplicación en ProductService (create y update).
// Lo mismo aplica para users.username y sales.saleNumber: validados en capa de servicio.
```

### Riesgos

- **Nulo.** Solo se agrega validación, no se cambian índices ni datos.
- La validación lanza error descriptivo si se intenta asignar un barcode duplicado.
- Barcode vacío (`''`) sigue permitido para múltiples productos (comportamiento correcto).

### Lo que NO se corrigió

- No se cambiaron los índices a `unique: true` (demasiado riesgoso en producción).
- No se buscaron duplicados existentes (requiere intervención manual del operador).
- `saleNumber` sigue sin protección contra race condition (improbable en uso single-user de Electron, y la idempotencia existente mitiga el riesgo).

---

## ERROR A3 — Rentabilidad usa costo actual, no histórico

### Evidencia

**Archivo:** `js/controllers/ReportController.js`, método `getProfitability()`  
**Líneas originales 97-100:**

```javascript
const product = await Product.getById(item.productId);
if (product) {
    const itemCost = product.cost * item.quantity;  // ← USA COSTO ACTUAL
```

El sistema ya graba `item.costAtSale` al crear ventas (en `POSController.completeSale()`, línea 175):
```javascript
costAtSale: product ? (parseFloat(product.cost) || 0) : 0
```

Pero `getProfitability()` **ignora** este dato y consulta el costo actual del producto.

### Impacto

**Ejemplo concreto:**
- Producto "Arroz" se vendió a costo $500 el 1 de enero
- El 15 de enero, el proveedor subió el costo a $900
- El reporte de enero muestra que vendiste a $500 pero costó $900 → "pérdida" ficticia
- El costo real al momento de la venta era $500 → debería mostrar ganancia

### Solución implementada

**Archivo:** `js/controllers/ReportController.js`

```javascript
// FIX A3: Usar costo histórico (costAtSale) cuando exista.
// Fallback a costo actual del producto SOLO para ventas antiguas sin migrar.
let itemCost;
if (item.costAtSale !== undefined && item.costAtSale !== null) {
    itemCost = parseFloat(item.costAtSale) * item.quantity;
} else {
    // Fallback: ventas anteriores a la migración de costAtSale
    const product = await Product.getById(item.productId);
    itemCost = product ? (parseFloat(product.cost) || 0) * item.quantity : 0;
}
```

**Lógica del fallback:**
1. Si `item.costAtSale` existe → usarlo (dato preciso del momento de la venta)
2. Si no existe → usar `product.cost` actual (aproximación para ventas antiguas)
3. Si el producto fue eliminado → costo = 0 (conservador, no inventa datos)

### Riesgos

- **Bajo.** Los reportes ahora pueden mostrar cifras diferentes a las anteriores.
  - **Antes:** usaba costo actual (incorrecto si cambió)
  - **Ahora:** usa costo histórico (correcto)
  - Los números cambian porque ahora son correctos, no porque se rompió algo.
- Ventas antiguas sin `costAtSale` siguen usando el fallback (costo actual). Esto es inevitable sin una migración masiva de datos históricos.

### Lo que NO se corrigió

- No se ejecutó la migración `migrateHistoricalCost.js` sobre datos existentes (requiere decisión del operador).
- No se recalcularon reportes históricos.
- El fallback para ventas sin `costAtSale` es una aproximación, no dato exacto.

---

## ERROR A4 — Eliminación peligrosa de productos

### Evidencia

**Archivo:** `js/models/Product.js`, líneas 39-41 originales:

```javascript
static async delete(id) {
    return await this._repository.delete(id);
}
```

Sin ninguna validación. Comparar con `Customer.delete()` que SÍ valida deudas pendientes antes de eliminar (Customer.js, líneas 36-68).

### Impacto

Se puede eliminar un producto que:
1. **Tiene stock > 0** → se pierde inventario sin rastro
2. **Tiene movimientos de stock** → el kardex y diagnóstico de inventario quedan con productId huérfano
3. **Aparece en ventas** → los ítems de venta apuntan a un producto inexistente, corrompiendo:
   - Historial de ventas
   - Reportes de rentabilidad (el fallback de A3 retorna costo 0 para producto eliminado)
   - Detalle de venta del cliente

### Solución implementada

**Archivo:** `js/models/Product.js`

Se agregaron 3 validaciones antes de permitir la eliminación:

```javascript
static async delete(id) {
    const product = await this.getById(id);
    if (!product) throw new Error('Producto no encontrado');

    // Check 1: Stock > 0
    if (currentStock > 0) {
        throw new Error(`No se puede eliminar... tiene X unidades en stock`);
    }

    // Check 2: Movimientos de stock
    const movements = await StockMovement.getByProduct(id);
    if (movements && movements.length > 0) {
        throw new Error(`No se puede eliminar... tiene X movimientos de inventario`);
    }

    // Check 3: Aparece en ventas
    const allSales = await Sale.getAll();
    const salesWithProduct = allSales.filter(sale =>
        sale.items && sale.items.some(item => parseInt(item.productId) === parseInt(id))
    );
    if (salesWithProduct.length > 0) {
        throw new Error(`No se puede eliminar... aparece en X venta(s)`);
    }

    return await this._repository.delete(id);
}
```

### Riesgos

- **Nulo.** Solo bloquea eliminaciones peligrosas. No modifica ni elimina datos.
- Productos sin stock, sin movimientos y sin ventas se pueden eliminar normalmente.
- Los mensajes de error son descriptivos y orientan al usuario sobre qué hacer.

### Lo que NO se corrigió

- No se implementó soft delete (marcado como `deletedAt`). Queda para una fase de profesionalización.
- No se optimizó la consulta de ventas (actualmente escanea todas las ventas). Queda para fase de rendimiento.
- No se agregó validación para compras asociadas (menor riesgo porque las compras ya se procesaron en stock).

---

## ERROR A5 — Doble conteo de ingresos en rentabilidad

### Evidencia

**Archivo:** `js/controllers/ReportController.js`, método `getProfitability()`  
**Líneas originales:**

```javascript
// Línea 94-95: Suma TOTAL de cada venta al revenue
for (const sale of sales) {
    totalRevenue += sale.total;  // ← $10,000 por venta a crédito
    ...
}

// Línea 140-141: TAMBIÉN suma pagos de clientes
const totalPayments = paymentsInRange.reduce((sum, p) => sum + p.amount, 0);
totalRevenue += totalPayments;  // ← +$10,000 cuando el cliente paga
```

### Impacto

**Ejemplo concreto:**
- Se crea una venta a crédito por $10,000 → revenue += $10,000
- El cliente paga $10,000 en el mismo período → revenue += $10,000
- **Revenue reportado: $20,000** (incorrecto)
- **Revenue real: $10,000** (la venta se registra UNA vez)

Esto infla artificialmente:
- Ingresos
- Ganancia bruta
- Ganancia neta
- Márgenes de rentabilidad

### Fundamento contable

En contabilidad por base devengado (accrual basis):
- **Ingreso (revenue)** se reconoce al momento de la venta, independiente de cuándo se cobra
- **Pago de deuda** es flujo de caja (cash flow), NO ingreso nuevo

El código original mezcla ambos conceptos. Los pagos de clientes son cobros de ingresos **ya contabilizados** en la venta original.

### Solución implementada

**Archivo:** `js/controllers/ReportController.js`

```javascript
// FIX A5: Revenue = SOLO ventas del período (base devengado)
// Los pagos de clientes se informan aparte como flujo de caja
for (const sale of sales) {
    totalRevenue += sale.total;
}
// totalRevenue += totalPayments;  ← ELIMINADO (era el doble conteo)
```

El dato de pagos se incluye en la respuesta como campo informativo:
```javascript
return {
    revenue: totalRevenue,
    // ... otros campos ...
    cashFlowFromPayments: totalPayments,  // Informativo, NO sumado a revenue
};
```

**Archivo:** `js/views/reports.js`

- Etiqueta "Ventas + Pagos" cambiada a "Total ventas del período"
- Etiqueta "Ingresos (Ventas + Pagos de Clientes)" cambiada a "Ingresos por Ventas"
- Se agrega línea informativa al final del estado de resultados:
  "Cobros de deuda recibidos (flujo de caja, no ingreso): $X" (solo si > 0)

### Riesgos

- **Bajo.** Las cifras del reporte cambiarán (ahora son menores y correctas).
  - **Antes:** Revenue inflado = ventas + pagos de deuda
  - **Ahora:** Revenue correcto = solo ventas
  - El usuario puede notar que los números bajaron. Esto es correcto.
- Si hay procesos externos que dependen del campo `revenue` inflado, necesitarán ajuste (no se detectaron).

### Lo que NO se corrigió

- No se implementó un reporte separado de flujo de caja (cash flow statement).
- No se distingue entre ventas cobradas vs. ventas a crédito en el revenue.
- No se recalcularon reportes históricos exportados previamente.

---

## ARCHIVOS MODIFICADOS (RESUMEN)

| Archivo | Cambios |
|---------|---------|
| `js/db.js` | Versión 15→16, store `passwordResets` agregado, comentario A2 |
| `js/models/Product.js` | `delete()` con 3 validaciones de integridad |
| `js/services/ProductService.js` | `updateProduct()` valida unicidad de barcode |
| `js/controllers/ReportController.js` | `getProfitability()` usa `costAtSale`, elimina doble conteo |
| `js/views/reports.js` | Etiquetas corregidas, línea informativa de flujo de caja |

## VERIFICACIONES POST-IMPLEMENTACIÓN

- [ ] Linter: 0 errores en todos los archivos modificados
- [ ] La app arranca correctamente (migración BD 15→16)
- [ ] Recuperación de contraseña no lanza error de runtime
- [ ] Reportes de rentabilidad muestran cifras sin doble conteo
- [ ] No se puede eliminar un producto con stock, ventas o movimientos
- [ ] No se puede asignar un barcode duplicado al editar un producto
- [ ] Ventas nuevas usan `costAtSale`; ventas antiguas usan fallback

## LO QUE NO SE TOCÓ EN ESTA FASE

- Rendimiento (índices faltantes, full table scans)
- Atomicidad de edición de compras/ventas
- Soft delete
- Log de auditoría
- Campos `createdBy`/`updatedBy`
- Profesionalización del esquema de BD

---

*Documento generado para revisión de auditor externo.*
