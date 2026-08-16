# Paso 1: Edición de ventas – Ajuste de stock por delta de cantidad

**Alcance:** Solo lógica de edición de ventas.  
**Objetivo:** Corregir el desfase de stock cuando se cambia la cantidad de un ítem existente en una venta.  
**Regla:** Usar delta de cantidad (cantidad nueva − cantidad anterior); mantener StockService y validaciones.

---

## 1. Resumen del problema

### Situación anterior

Al **editar** una venta:

- Si se **agregan ítems nuevos** → el stock se descontaba correctamente.
- Si se **eliminan ítems** → el stock se devolvía correctamente.
- Si se **cambia la cantidad** de un ítem que ya estaba en la venta → el stock **no** se ajustaba.

La lógica comparaba solo “productos que desaparecen” (restaurar todo) y “productos que aparecen” (descontar todo). Los productos que seguían en la venta pero con otra cantidad no generaban ningún movimiento de stock, lo que producía un **desfase acumulado** entre stock físico y stock del sistema.

### Comportamiento esperado

Para cada producto en la venta editada:

- **Delta = cantidad nueva − cantidad anterior.**
- **Delta &gt; 0** (aumentó cantidad) → descontar `delta` del stock.
- **Delta &lt; 0** (disminuyó cantidad) → devolver `|delta|` al stock.
- **Delta = 0** → no tocar stock.

Así, el stock queda alineado con la cantidad total vendida según la versión actual de la venta.

---

## 2. Análisis del código actual

### 2.1 Dónde se edita una venta

- **Punto de entrada:** `Sale.updateSale(saleId, updateData)` en `js/models/Sale.js`.
- **Quién lo llama:** Vista de ventas al guardar cambios (`js/views/sales.js`: `saveSale()`, `removeSaleItem()`), y otros flujos que actualizan venta (p. ej. clientes, pagos).
- **Datos que llegan:** `updateData` puede incluir `items` (array de ítems con `productId`, `quantity`, `total`, etc.), además de `paymentMethod`, `status`, `paidAmount`, etc.

### 2.2 Dónde se comparan ítems antiguos vs nuevos

En `Sale.updateSale()`, justo al inicio del bloque `if (updateData.items && Array.isArray(updateData.items))`:

- **Antiguos:** `sale.items` (ítems actuales de la venta en BD) → se agregan a `oldByProduct` (cantidad por `productId`) y `oldProductIds` (set de IDs).
- **Nuevos:** `updateData.items` (ítems que el usuario quiere dejar) → se agregan a `newByProduct` y `newProductIds`.

Se usan dos conjuntos:

- `oldProductIds`: productos que estaban en la venta.
- `newProductIds`: productos que quedan en la venta después de editar.

### 2.3 Qué lógica ignoraba los cambios de cantidad

La lógica anterior solo hacía:

1. **Productos solo en `oldProductIds`** (eliminados de la venta): restaurar `oldByProduct[productId]`.
2. **Productos solo en `newProductIds`** (nuevos en la venta): validar stock y descontar `newByProduct[productId]`.

No había ningún caso para **productos que están en ambos** (`oldProductIds` ∩ `newProductIds`). Para esos, aunque la cantidad cambiara (p. ej. de 2 a 5 o de 5 a 2), no se ejecutaba ni `restoreSaleStock` ni `processSaleStock`, por lo que el stock no se ajustaba.

---

## 3. Nueva lógica propuesta (implementada)

### 3.1 Cálculo del delta por producto

Para cada `productId` que está **tanto en la venta antigua como en la nueva**:

- `oldQty = oldByProduct[productId]` (suma de cantidades de ese producto en ítems antiguos).
- `newQty = newByProduct[productId]` (suma de cantidades en ítems nuevos).
- **Delta = newQty − oldQty.**

Interpretación:

- **Delta &gt; 0:** se venden más unidades que antes → hay que **descontar** `delta` del stock.
- **Delta &lt; 0:** se venden menos unidades que antes → hay que **devolver** `|delta|` al stock.
- **Delta = 0:** no hay cambio de cantidad → no se toca el stock.

### 3.2 Flujo de stock corregido

El orden de operaciones en `updateSale()` queda así:

1. **Solo productos eliminados** (en `oldProductIds`, no en `newProductIds`):  
   Restaurar la cantidad antigua con `StockService.restoreSaleStock([{ productId, quantity: oldQty }], saleId)`.

2. **Productos en ambos con cambio de cantidad** (en `oldProductIds` ∩ `newProductIds` con delta ≠ 0):  
   - Si **delta &lt; 0:** devolver `|delta|` con `StockService.restoreSaleStock([{ productId, quantity: |delta| }], saleId)`.  
   - Si **delta &gt; 0:** validar stock con `ProductValidator.validateStock(product, delta)`; si es válido, descontar con `StockService.processSaleStock([{ productId, quantity: delta }], saleId)`; si no, **lanzar error** y no guardar la venta.

3. **Solo productos nuevos** (en `newProductIds`, no en `oldProductIds`):  
   Validar stock y descontar la cantidad nueva con `StockService.processSaleStock([{ productId, quantity: newQty }], saleId)`.

4. **Actualización del documento de venta:**  
   Recalcular totales, `paidAmount`, `status` y hacer `_repository.replace(updated)` como antes.

Si en el paso 2 (delta &gt; 0) la validación de stock falla, se lanza `Error` y no se llega al `replace`, por lo que la venta no se guarda y el stock no queda inconsistente.

### 3.3 Archivos y funciones involucradas

| Archivo | Función / bloque | Cambio |
|--------|----------------------------------|--------|
| `js/models/Sale.js` | `Sale.updateSale(saleId, updateData)` | Se añade el bloque que recorre productos en `oldProductIds` ∩ `newProductIds`, calcula delta y llama a `restoreSaleStock` (delta &lt; 0) o valida y llama a `processSaleStock` (delta &gt; 0). |
| `js/services/StockService.js` | `processSaleStock`, `restoreSaleStock` | Sin cambios; se reutilizan tal cual. |
| `js/validators/ProductValidator.js` | `validateStock` | Sin cambios; se usa para validar antes de descontar cuando delta &gt; 0. |

No se modifican: compras, ajustes, productos, importaciones, ni ningún otro flujo.

---

## 4. Casos de prueba teóricos

Todos son **teóricos**; no se han ejecutado contra datos reales.

### 4.1 Editar venta aumentando cantidad

- **Antes:** Venta con ítem A cantidad 2 (stock ya descontado 2).  
- **Edición:** Usuario cambia A a cantidad 5 y guarda.  
- **Delta:** +3.  
- **Acción:** Validar que haya al menos 3 unidades de A; descontar 3 con `processSaleStock`.  
- **Impacto esperado en stock:** Stock de A disminuye en 3. Documento de venta queda con 5 unidades de A.

### 4.2 Editar venta disminuyendo cantidad

- **Antes:** Venta con ítem B cantidad 5 (stock ya descontado 5).  
- **Edición:** Usuario cambia B a cantidad 2 y guarda.  
- **Delta:** −3.  
- **Acción:** Devolver 3 con `restoreSaleStock`.  
- **Impacto esperado en stock:** Stock de B aumenta en 3. Documento de venta queda con 2 unidades de B.

### 4.3 Editar venta sin cambiar cantidad

- **Antes:** Venta con ítem C cantidad 4.  
- **Edición:** Usuario no cambia cantidad de C (o cambia solo precio/total) y guarda.  
- **Delta:** 0.  
- **Acción:** No llamar a `restoreSaleStock` ni `processSaleStock` para C.  
- **Impacto esperado en stock:** Stock de C sin cambio.

### 4.4 Editar venta con stock insuficiente (delta &gt; 0)

- **Antes:** Venta con ítem D cantidad 1. Stock actual de D = 2.  
- **Edición:** Usuario cambia D a cantidad 5. Delta = +4; hay solo 2 en stock.  
- **Acción:** `ProductValidator.validateStock(product, 4)` debe devolver `valid: false`. Se lanza `Error(validation.error)`.  
- **Impacto esperado:** La venta **no** se actualiza; el stock **no** se modifica; el usuario ve el mensaje de stock insuficiente.

### 4.5 Edición mixta: eliminar ítem, añadir otro, cambiar cantidad de un tercero

- **Antes:** Venta con A=2, B=3.  
- **Edición:** Se quita A, se deja B pero con cantidad 1, se agrega C=4.  
- **Acciones:**  
  - Restaurar 2 de A (ítem eliminado).  
  - Para B: delta = 1 − 3 = −2 → devolver 2.  
  - Para C: ítem nuevo → descontar 4 (tras validar).  
- **Impacto esperado:** Stock A +2, B +2, C −4; venta queda con B=1 y C=4.

---

## 5. Riesgos y validaciones

### 5.1 Qué errores previene esta corrección

- **Desfase por cambio de cantidad:** Al editar solo cantidades de ítems existentes, el stock pasa a reflejar la nueva cantidad vendida (vía delta).
- **Stock negativo en aumento de cantidad:** Si el usuario sube la cantidad y no hay stock suficiente, la validación (`ProductValidator.validateStock`) impide el descuento y se lanza error, por lo que no se guarda la venta y el stock no se toca.
- **Coherencia con StockService:** Toda modificación de stock sigue pasando por `StockService.processSaleStock` y `StockService.restoreSaleStock`, por lo que se generan movimientos de stock (venta o ajuste) y se mantiene una sola capa de lógica de stock.

### 5.2 Qué errores NO cubre (fuera de alcance de este paso)

- **Doble submit de edición:** Si el usuario envía dos veces “Guardar” en la edición, se podría aplicar dos veces el delta. No se ha implementado idempotencia en este paso.
- **Concurrencia:** Otra pestaña o usuario podría vender el mismo producto mientras se edita la venta; la validación es con el stock actual en el momento de guardar, no con bloqueo.
- **Orden de operaciones y atomicidad:** Las llamadas a `restoreSaleStock` y `processSaleStock` son secuenciales; si falla una en el medio, las anteriores ya se aplicaron. No hay una única transacción IDB que englobe todos los movimientos de stock de la edición (igual que antes).
- **Otros flujos:** No se tocan compras, ajustes, importaciones, ni la escritura directa de stock desde ficha de producto; los desfases que puedan producir esos flujos siguen fuera del alcance.

### 5.3 Validaciones que se mantienen

- Validación de stock antes de descontar (delta &gt; 0 o ítem nuevo): `ProductValidator.validateStock(product, quantity)`.
- Uso exclusivo de `StockService` para restar y devolver stock (`processSaleStock`, `restoreSaleStock`).
- Si la validación falla, se lanza `Error` y no se ejecuta `_repository.replace(updated)`, por lo que la venta no se actualiza y no se aplican cambios de stock.

---

## 6. Condición final

- **Alcance:** Solo edición de ventas; lógica de stock por delta de cantidad en ítems existentes.
- **No incluido en este paso:** Compras, ajustes, productos, importaciones, idempotencia, transacciones globales, concurrencia.
- **Implementación:** Cambio único en `js/models/Sale.js` en `Sale.updateSale()`, reutilizando `StockService` y `ProductValidator` sin modificar otros flujos.

Este documento sirve como reporte técnico para auditoría externa del paso 1.
