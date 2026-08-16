# Paso 3: Atomicidad de ajustes masivos

**Alcance:** Solo flujo de ajuste masivo de stock.  
**Objetivo:** Que los ajustes masivos sean atómicos: o se aplican todos o no se aplica ninguno (con rollback en caso de fallo durante la aplicación).  
**Reglas:** No tocar ventas, compras, importaciones, Product.updateStock ni esquema IndexedDB; mantener StockService; prevalidar y fallar completo si un ítem no es válido.

---

## 1. Problema original

Los ajustes masivos se aplicaban **producto por producto** en un bucle. Si ocurría un error en un producto intermedio (por ejemplo stock insuficiente, producto inexistente o error inesperado de StockService):

- Los productos **anteriores** ya habían sido ajustados (stock y movimientos grabados).
- Los productos **siguientes** no se procesaban.
- El inventario quedaba en **estado inconsistente**: solo una parte del lote masivo aplicada, sin forma de deshacer desde la misma operación.

Además, no existía una **prevalidación global**: se validaba implícitamente en cada llamada a `createAdjustment` / `createLoss` / `createConsumption`, de modo que el primer fallo aparecía a mitad del proceso.

---

## 2. Flujo actual del ajuste masivo

### 2.1 Dónde se ejecuta

- **Vista:** `js/views/inventory.js` → `InventoryView.saveBulkAdjustment()`.
- **Servicio:** Las operaciones de stock se delegan en `StockMovement.createAdjustment` / `createLoss` / `createConsumption` (que a su vez llaman a `StockService.createAdjustment`, `createLoss`, `createConsumption`).

### 2.2 Flujo anterior (paso a paso)

1. Usuario selecciona productos y cantidades en “Nuevo Ajuste Masivo” y elige tipo (Ajuste / Pérdida / Consumo) y motivo.
2. Al hacer clic en “Guardar Ajuste Masivo”, se ejecutaba:
   - Validación en vista: al menos un producto, cantidad ≠ 0, en pérdida/consumo cantidad positiva.
   - Un `for` sobre `this.selectedProducts`:
     - Por cada producto: `StockMovement.createAdjustment(id, quantity, reason)` o `createLoss` / `createConsumption`.
   - Si una de esas llamadas lanzaba (por ejemplo “Stock insuficiente” o “Producto no encontrado”), el `catch` mostraba el mensaje pero **los ítems ya procesados no se revertían**.

### 2.3 Dónde se producía el estado parcial

- En el bucle, **entre** la iteración N (ya aplicada) y la N+1 (que falla). El estado de la base de datos quedaba con los ítems 1..N ajustados y los N+1..M sin tocar.

### 2.4 Errores que pueden ocurrir a mitad del loop

- **Producto inexistente:** `Product.getById` devuelve null → `StockService` lanza “Producto no encontrado”.
- **Cantidad inválida:** 0, null o negativa en pérdida/consumo → rechazado por el servicio.
- **Stock insuficiente:** En ajuste con cantidad negativa o en pérdida/consumo, `product.stock < |qty|` → “Stock insuficiente para ajuste” / equivalente.
- **Error inesperado:** Fallo de IndexedDB, red, etc. durante `Product.updateStock` o `StockMovement.create`.

### 2.5 Validaciones que faltaban

- **Prevalidación global:** No se comprobaban **todos** los ítems antes de aplicar ninguno (producto existe, cantidad válida, stock suficiente para restas). La validación era “al vuelo” en cada ítem, con riesgo de estado parcial.

---

## 3. Estrategia de atomicidad elegida

Se aplicó una **combinación de prevalidación completa y rollback manual**:

### 3.1 Prevalidación completa (Option A)

- **StockService.validateBulkAdjustment(items, type):**
  - Recorre **todos** los ítems.
  - Por cada uno: producto existe, cantidad válida (no 0, en pérdida/consumo positiva), y si aplica **stock suficiente** (ajuste con cantidad negativa o pérdida/consumo).
  - Si **alguna** validación falla, **lanza** con mensaje claro (producto, motivo). No se aplica **ningún** ajuste.

### 3.2 Aplicación con rollback (Option B parcial)

- **StockService.applyBulkAdjustmentAtomic(items, type, reason):**
  1. Normaliza ítems (`productId`/`id`, `quantity`) y filtra cantidad 0.
  2. Llama a `validateBulkAdjustment(items, type)`. Si falla, no aplica nada.
  3. Aplica un ítem a la vez con `createAdjustment` / `createLoss` / `createConsumption`, registrando en un array `applied` (productId, quantity, type).
  4. Si en algún ítem se lanza un error:
     - Para cada ítem ya aplicado (en **orden inverso**), ejecuta un **rollback** llamando a `StockService.createAdjustment` con la cantidad opuesta (para ajuste: signo contrario; para pérdida/consumo: devolver la misma cantidad con motivo “Rollback ajuste masivo: …”).
     - Vuelve a lanzar el error original para que la vista muestre el mensaje.

Así se garantiza:

- **Si la prevalidación falla:** no se escribe nada.
- **Si la aplicación falla a mitad:** se revierten solo los ítems ya aplicados en esa misma operación, dejando el inventario como antes de intentar el ajuste masivo.

No se usan transacciones IndexedDB multi-store ni nuevas tablas; solo la API actual de StockService y movimientos de tipo `adjustment` para el rollback.

---

## 4. Cambios realizados

### 4.1 StockService (`js/services/StockService.js`)

- **validateBulkAdjustment(items, type):** Nueva función. Valida que todos los ítems tengan producto existente, cantidad válida y, cuando corresponda, stock suficiente. Lanza en el primer ítem inválido.
- **applyBulkAdjustmentAtomic(items, type, reason):** Nueva función. Acepta ítems con `productId` o `id` y `quantity`. Normaliza, prevalida, aplica uno a uno y, ante fallo, hace rollback de los aplicados y re-lanza.

### 4.2 Vista (`js/views/inventory.js`)

- **saveBulkAdjustment():** Deja de hacer el `for` con `StockMovement.createAdjustment` / `createLoss` / `createConsumption`. Pasa a llamar una sola vez a `StockService.applyBulkAdjustmentAtomic(this.selectedProducts, type, reason)`. Las validaciones de UI (cantidad ≠ 0, positiva en pérdida/consumo) se mantienen; la validación de negocio (existencia de producto, stock suficiente) queda centralizada en StockService.

---

## 5. Casos de prueba teóricos

*No ejecutados contra datos reales.*

### 5.1 Ajuste masivo de 5 productos → falla el 3º → ninguno aplicado (por prevalidación)

- **Escenario:** 5 productos; el 3º tiene cantidad negativa (ajuste) y stock actual menor que |cantidad|.
- **Flujo:** Se llama `applyBulkAdjustmentAtomic` → `validateBulkAdjustment` recorre los 5; al validar el 3º detecta stock insuficiente y **lanza**.
- **Resultado esperado:** No se aplica ningún ajuste; se muestra el mensaje de error; el inventario no cambia.

### 5.2 Ajuste masivo de 5 productos → falla el 3º durante la aplicación → rollback

- **Escenario:** Prevalidación pasa (por ejemplo stock suficiente en todos). Al aplicar el 3º ítem ocurre un error inesperado (por ejemplo fallo de IndexedDB).
- **Flujo:** Se aplican ítems 1 y 2; al aplicar el 3º se lanza; se ejecuta rollback: se revierte 2 y luego 1 (createAdjustment con cantidad opuesta / devolución).
- **Resultado esperado:** Inventario vuelve al estado anterior al clic en “Guardar”; se muestra el error; no queda estado parcial.

### 5.3 Ajuste masivo válido → todos aplicados

- **Escenario:** N productos, todos con producto existente, cantidad válida y stock suficiente donde aplica.
- **Flujo:** Prevalidación pasa; se aplican los N ítems sin error.
- **Resultado esperado:** Todos los productos quedan ajustados; se muestra éxito; movimientos creados según tipo (adjustment / loss / consumption).

### 5.4 Ajuste masivo con stock justo

- **Escenario:** Ajuste tipo “Pérdida” con cantidad 10 y producto con stock exactamente 10.
- **Flujo:** Validación comprueba `currentStock >= 10` → pasa; `createLoss` resta 10.
- **Resultado esperado:** Stock queda en 0; movimiento de pérdida creado; sin error.

### 5.5 Producto inexistente en la lista

- **Escenario:** Uno de los ítems tiene `productId` de un producto ya eliminado (o ID erróneo).
- **Flujo:** En `validateBulkAdjustment`, `Product.getById` devuelve null para ese ítem.
- **Resultado esperado:** Se lanza “Producto no encontrado (ID: …)”; no se aplica ningún ajuste.

---

## 6. Riesgos y limitaciones

### 6.1 Riesgos

- **Fallos durante el rollback:** Si al revertir un ítem falla `createAdjustment` (por ejemplo por otro error de BD), se registra en consola y se sigue con el resto del rollback; el error original se re-lanza. En el peor caso podría quedar un ítem revertido y otro no si el rollback falla a mitad; es un caso raro y no se añadió lógica adicional en este paso.
- **Concurrencia:** Si otra operación (venta, compra, otro ajuste) modifica el stock de un producto entre la prevalidación y la aplicación, la prevalidación podría haber pasado pero luego fallar al aplicar (por ejemplo stock insuficiente). En ese caso se hace rollback de lo ya aplicado en esta operación; el comportamiento sigue siendo “todo o nada” para este ajuste masivo.

### 6.2 Limitaciones

- **No se usa transacción IndexedDB:** La atomicidad se logra con prevalidación + aplicación secuencial + rollback manual. No hay una transacción única que englobe todos los puts/adds.
- **Rollback visible en historial:** Los movimientos de rollback son ajustes con motivo “Rollback ajuste masivo: …”; quedan en el historial de movimientos. No se borran los movimientos ya creados antes del fallo.
- **Solo ajustes masivos:** No se modifican ajustes unitarios, ventas, compras ni importaciones.

---

## 7. Qué se garantiza después de este paso

- **Prevalidación:** Si algún ítem es inválido (producto inexistente, cantidad inválida, stock insuficiente), **no se aplica ningún** ajuste del lote; se muestra el error correspondiente.
- **Atomicidad ante fallo en aplicación:** Si la prevalidación pasó pero falla un ítem al aplicar (error inesperado de StockService o de BD), se **revierte** cada ítem ya aplicado en esa misma operación, de modo que el inventario no queda con “mitad del masivo” aplicado.
- **Mismo comportamiento de stock:** Sigue usándose solo StockService (createAdjustment, createLoss, createConsumption); no se toca Product.updateStock ni otros flujos.
- **Sin cambios de esquema:** No se introducen tablas ni cambios en IndexedDB; solo lógica en servicio y vista.

Este documento es para revisión por un auditor externo. No se han implementado mejoras fuera del flujo de ajustes masivos.
