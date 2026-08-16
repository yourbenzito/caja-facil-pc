# Auditoría de Stock – Sistema de Ventas (POS Minimarket)

**Tipo:** Análisis estático – sin modificación de datos ni ejecución de escrituras.  
**Alcance:** Detección de causas por las que el stock del sistema puede quedar desfasado respecto al stock físico real.  
**Base:** Código del proyecto (IndexedDB, JS, flujos de venta, compra, ajustes).

---

## 1. Resumen Ejecutivo

### Problema principal detectado

El stock “oficial” es un **valor guardado** en el objeto `Product` (campo `product.stock` en el store `products`). Ese valor se actualiza por **múltiples vías**, algunas de las cuales **no generan movimientos de stock** ni transacciones atómicas. Además, en **edición de ventas** solo se reconcilia stock para ítems **nuevos** o **eliminados**, no para **cambios de cantidad** en ítems ya existentes. La combinación de:

- actualización directa de stock desde producto/importación (sin movimientos),
- edición de venta que ignora cambios de cantidad en ítems existentes,
- flujos de compra/ajuste masivo no atómicos,
- ausencia de bloqueo o versionado ante concurrencia,

genera **desfases entre stock físico y stock en sistema**, sin trazabilidad completa para reconstruir el origen.

### Impacto en el negocio

- **Ventas bloqueadas en caja:** El sistema puede mostrar “Sin stock” o “Stock insuficiente” aunque en bodega sí haya producto (stock físico > stock sistema).
- **Ventas sobre stock inexistente:** Si el sistema tiene más stock del real (por ejemplo por edición de venta o por ajustes/importación mal usados), se pueden vender unidades que no existen.
- **Inventario y reportes poco confiables:** Valor de inventario, alertas de stock bajo y reportes dependen de un número que puede estar desincronizado.
- **Auditoría limitada:** No siempre es posible explicar por qué el stock llegó a un valor dado (falta de kardex estricto y de usuario en movimientos).

---

## 2. Flujo de Stock

### 2.1 Dónde se define el stock “oficial”

- **Entidad:** Objeto `Product` en IndexedDB, store `products`.
- **Campo:** `product.stock` (número; se guarda, no se calcula en tiempo real).
- **Archivos:** `js/models/Product.js`, `js/repositories/ProductRepository.js`, `js/db.js` (esquema).

El stock **no** se deriva de la suma de movimientos; es un valor que se **lee y escribe** en cada operación. Los registros en `stockMovements` son históricos/auditoría pero **no** se usan para recalcular `product.stock`.

### 2.2 Dónde y cómo se incrementa el stock

| Origen | Archivo / función | Método |
|--------|-------------------|--------|
| Alta de producto | `Product.create()` | `data.stock` inicial en `js/models/Product.js` |
| Compra nueva | `Purchase.create()` | Transacción: `products.put()`, `stockMovements.add()` en `js/models/Purchase.js` |
| Edición de compra (ítems nuevos) | `StockService.applyPurchaseStockForEdit()` | `Product.updateStock(..., 'add')` + `StockMovement.create()` en `js/services/StockService.js` |
| Edición de compra (deltas positivos) | `StockService.applyPurchaseQuantityDeltas()` | `Product.updateStock(..., 'add')` + movimiento en `js/services/StockService.js` |
| Devolución por eliminación de venta | `StockService.restoreSaleStock()` | `StockService.createAdjustment(productId, qty, reason)` (ajuste positivo) en `js/services/StockService.js` |
| Ajuste manual / masivo (positivo) | `StockService.createAdjustment()` | `Product.updateStock(..., 'add')` + `StockMovement.create()` en `js/services/StockService.js` |
| Edición directa de producto | `Product.update(id, data)` | Merge con `data.stock` en `BaseRepository.update()` → `db.put(products, updated)` – **sin movimiento** |
| Importación Excel/CSV | `Product.importProducts()` / flujo de productos | Crea/actualiza productos; si actualiza por barcode puede incluir `stock` → **sin movimiento** |

### 2.3 Dónde y cómo se descuenta el stock

| Origen | Archivo / función | Método |
|--------|-------------------|--------|
| Venta nueva | `SaleService.createSale()` | Transacción: `sales.add()`, `products.put()`, `stockMovements.add()` en `js/services/SaleService.js` |
| Edición de venta (ítems nuevos) | `Sale.updateSale()` → `StockService.processSaleStock()` | `Product.updateStock(..., 'subtract')` + movimiento tipo `sale` en `js/models/Sale.js`, `js/services/StockService.js` |
| Edición de venta (ítem eliminado) | `Sale.updateSale()` → `StockService.restoreSaleStock()` | Ajuste positivo (devolución) en `js/models/Sale.js` |
| Eliminación de venta | `Sale.delete()` → `StockService.restoreSaleStock()` | Ajuste positivo por cada ítem en `js/models/Sale.js` |
| Edición de compra (ítems quitados) | `StockService.revertPurchaseStock()` | `Product.updateStock(..., 'subtract')` + movimiento tipo `adjustment` en `js/services/StockService.js` |
| Eliminación de compra | `Purchase.delete()` → `StockService.revertPurchaseStock()` | Mismo `subtract` por ítem en `js/models/Purchase.js` |
| Ajuste manual / masivo (negativo) | `StockService.createAdjustment()` | `Product.updateStock(..., 'subtract')` + movimiento en `js/services/StockService.js` |
| Pérdida / consumo | `StockService.createLoss()`, `createConsumption()` | `Product.updateStock(..., 'subtract')` + movimiento en `js/services/StockService.js` |

### 2.4 Diagrama lógico del flujo de stock (texto)

```
                    ┌─────────────────────────────────────────────────────────┐
                    │           FUENTE DE VERDAD: product.stock                │
                    │              (store "products" IndexedDB)                │
                    └─────────────────────────────────────────────────────────┘
                                          ▲  ▼
    INCREMENTOS                          │  │                          DECREMENTOS
    ─────────────                        │  │                          ─────────────
    • Purchase.create (transacción)       │  │   • SaleService.createSale (transacción)
    • applyPurchaseStockForEdit           │  │   • processSaleStock (venta / edición ítems nuevos)
    • applyPurchaseQuantityDeltas (+)    │  │   • revertPurchaseStock (compra editada/eliminada)
    • restoreSaleStock (venta eliminada)  │  │   • createAdjustment (-) / createLoss / createConsumption
    • createAdjustment (+)                │  │
    • Product.update(id, { stock })  ⚠️   │  │   Edición venta: solo ítems NUEVOS/ELIMINADOS;
    • Product.create / import  ⚠️        │  │   cambio de CANTIDAD en ítem existente NO toca stock ⚠️
                    ─────────────────────┘  └────────────────────────────────────────────
                                    │
                                    ▼
                    ┌─────────────────────────────────────────────────────────┐
                    │  stockMovements (auditoría; NO recalcula product.stock)  │
                    │  type: sale | purchase | adjustment | loss | consumption │
                    │  reason, reference, date; SIN userId                    │
                    └─────────────────────────────────────────────────────────┘
```

### 2.5 Archivos críticos (paths + función)

| Path | Función en stock |
|------|-------------------|
| `js/models/Product.js` | `updateStock()`, `create()`, `update()` – lectura/escritura de `product.stock` |
| `js/models/Purchase.js` | `create()` (transacción compra+productos+movimientos), `delete()` (reversión stock) |
| `js/models/Sale.js` | `updateSale()` (reconciliación ítems nuevos/eliminados; no cantidades), `delete()` (restauración stock) |
| `js/services/SaleService.js` | `createSale()` – transacción venta + productos + movimientos |
| `js/services/StockService.js` | `processSaleStock`, `restoreSaleStock`, `revertPurchaseStock`, `applyPurchaseStockForEdit`, `applyPurchaseQuantityDeltas`, `createAdjustment`, `createLoss`, `createConsumption` |
| `js/models/StockMovement.js` | `create()` – alta de movimiento (siempre `add`, no reemplazo) |
| `js/controllers/POSController.js` | `completeSale()` – validación stock + llamada a `Sale.create()` |
| `js/controllers/SupplierController.js` | `savePurchase()` – flujo edición compra: revert → update compra → apply ítems nuevos → apply deltas |
| `js/views/inventory.js` | `saveBulkAdjustment()`, `saveAdjustment()`, `saveQuickAdjustment()` – ajustes sin transacción global |
| `js/views/products.js` | `saveProduct()` – envía `stock` en formulario → `Product.update()` sin movimiento |
| `js/views/purchases.js` | `savePurchase()` – nuevo vs edición; edición delega en `SupplierController.savePurchase()` |
| `js/views/sales.js` | `saveSale()`, `removeSaleItem()`, `deleteSale()` – edición/eliminación venta |
| `js/db.js` | Esquema: stores `products`, `stockMovements` (y demás) |
| `js/repositories/BaseRepository.js` | `update()`, `replace()` – merge/put que permite pisar `stock` sin movimiento |

---

## 3. Análisis de todos los movimientos de stock

Para cada evento se indica: ¿suma/resta stock?, ¿puede ejecutarse más de una vez?, ¿tiene rollback?, ¿puede quedar inconsistente?, ¿puede ejecutarse parcialmente?

| Evento | Suma | Resta | ¿Se puede ejecutar 2+ veces? | ¿Rollback? | ¿Inconsistencia posible? | ¿Ejecución parcial? |
|--------|------|-------|------------------------------|------------|---------------------------|----------------------|
| **Venta confirmada** | No | Sí (transacción) | Sí (doble clic / reintento) → doble descuento | Sí (transacción) | Solo si doble request | No dentro de una transacción |
| **Venta cancelada** | N/A | N/A | N/A | N/A | N/A | N/A |
| **Venta eliminada** | Sí (restore) | No | Sí (doble delete) → doble devolución | No automático | Sí si falla a mitad de ítems | Sí (por ítem en loop) |
| **Venta editada** | Solo ítems eliminados | Solo ítems nuevos | Sí | No global | **Sí:** cambio de cantidad en ítem existente no toca stock | Sí (restore/process por ítem) |
| **Compra nueva** | Sí (transacción) | No | Sí (doble guardado) → doble suma | Sí (transacción) | No dentro de transacción | No |
| **Compra editada** | Ítems nuevos + deltas (+) | Ítems quitados + deltas (-) | Sí | No (revert → update → apply) | Sí si falla apply/deltas tras update | Sí (varios pasos secuenciales) |
| **Compra eliminada** | No | Sí (revert) | Sí (doble delete) → doble resta | No | Sí si revert falla a mitad o stock &lt; qty | Sí (revert por ítem) |
| **Ajuste manual** | Si qty &gt; 0 | Si qty &lt; 0 | Sí (doble clic) | No | Poco probable | No (un producto) |
| **Ajuste masivo** | Según signo por producto | Según signo | Sí | No | **Sí:** fallo en producto N deja 1..N-1 aplicados | **Sí** (loop sin transacción) |
| **Pérdida / consumo** | No | Sí | Sí | No | Poco probable | No (un producto) |
| **Devolución (elim. venta)** | Sí (ajuste) | No | Sí si eliminan 2 veces | No | Sí si restore falla a mitad | Sí (por ítem) |
| **Doble submit venta** | No | Sí x2 | **Sí** (dos ventas, dos descuentos) | No entre requests | **Sí** (stock de menos) | N/A |
| **Cierre inesperado** | Depende de qué se estaba haciendo | Idem | N/A | Solo si estaba dentro de transacción IDB | **Sí** en flujos multi-paso | Sí en edición compra/venta, ajuste masivo |
| **Offline / sincronización** | N/A | N/A | No hay sync multi-dispositivo en código | N/A | N/A | N/A |

---

## 4. Detección de descuentos invisibles y riesgos de integridad

### 4.1 Descuentos duplicados o desalineados

- **No hay descuento en front y otro en back:** El POS no descuenta stock en memoria; solo valida y llama a `Sale.create()`. El único descuento real es en `SaleService.createSale()` dentro de la transacción. No se detecta doble descuento en capas distintas.
- **Riesgo real:** **Doble ejecución de `Sale.create()`** (doble clic, reintento, dos pestañas): dos transacciones, dos ventas, dos descuentos de stock. No hay idempotencia (token, id de operación) en la creación de venta.

### 4.2 Lógica duplicada o dispersa

- **Validación de stock:** En `POSController.completeSale()` se valida con `validateStock()` (lectura de `product.stock`); luego `SaleService.createSale()` vuelve a validar con `ProductValidator.validateStock()`. Entre ambas lecturas otra pestaña/venta puede consumir stock → condición de carrera.
- **Edición de venta:** La lógica “solo ítems nuevos / solo ítems eliminados” está solo en `Sale.updateSale()`. La vista `sales.js` permite cambiar cantidad y total por ítem; al guardar, esos cambios **no** se traducen en descuento/restauración adicional. El documento de venta queda con cantidades nuevas pero el stock no se ajusta.

### 4.3 Descuento antes de validar / aunque falle

- **Venta:** La validación y el descuento ocurren dentro de la misma transacción en `SaleService.createSale()`. Si falla la validación, la transacción aborta y no se descuenta. Correcto.
- **Edición de compra:** En `SupplierController.savePurchase()` (edición): primero `revertPurchaseStock(removedItems)`, luego `Purchase.update()`, luego `applyPurchaseStockForEdit(newItemsOnly)`, luego `applyPurchaseQuantityDeltas()`. Si falla en apply o deltas, la compra ya está actualizada en BD pero el stock no refleja la nueva compra → inconsistencia.

### 4.4 Falta de rollback en errores

- **Eliminación de venta:** `Sale.delete()` hace `restoreSaleStock(sale.items)` en un loop por ítem. Si falla en el 2º producto, el 1º ya devolvió stock y la venta sigue existiendo hasta que falle el delete. Parcialmente ejecutado.
- **Ajuste masivo:** `InventoryView.saveBulkAdjustment()` hace un `for` llamando `createAdjustment`/`createLoss`/`createConsumption` por producto. No hay transacción. Fallo en el producto N deja los N-1 anteriores aplicados.
- **Eliminación de compra:** `Purchase.delete()` llama `revertPurchaseStock(purchase.items)`. Si un producto tiene menos stock del que la compra sumó (por ventas posteriores), `Product.updateStock(..., 'subtract')` lanza “Stock insuficiente” y puede abortar a mitad → compra quizá no se borra pero parte del stock ya se restó.

### 4.5 Condiciones mal evaluadas

- **Edición de venta – ítems “iguales”:** Se comparan `oldProductIds` y `newProductIds`. Si el usuario solo cambia la cantidad de un ítem (mismo productId), el producto no es “nuevo” ni “eliminado”, por tanto no se ejecuta ni `processSaleStock` ni `restoreSaleStock` para ese cambio de cantidad. Comportamiento coherente con el código pero **incorrecto** para la integridad: la venta guarda la nueva cantidad pero el stock no.
- **revertPurchaseStock:** Usa `Product.updateStock(..., 'subtract')`. Si el stock actual es menor que la cantidad a revertir (por ventas), lanza y puede dejar estado intermedio.

### 4.6 Async / await / promesas

- No se detectan `await` olvidados en los flujos críticos revisados. Los bucles que aplican stock usan `await` en las llamadas a servicio/modelo. El riesgo es de **orden** y **atomicidad** (varios pasos sin transacción), no de falta de await.

### 4.7 Transacciones atómicas

- **Sí hay transacción:** `Purchase.create()`, `SaleService.createSale()` – una transacción IDB que incluye compra/venta + productos + movimientos.
- **No hay transacción:** Edición de compra (`SupplierController.savePurchase`), edición de venta (`Sale.updateSale` + StockService), eliminación de venta/compra, ajuste masivo, y cualquier flujo que use `Product.update(id, { stock })` o importación.

---

## 5. Simulaciones teóricas (sin ejecutar)

### 5.1 Venta que “falla” después de descontar stock

- **Escenario:** No ocurre en venta nueva porque el descuento es dentro de la misma transacción. Si la transacción falla, no se descuenta.
- **Escenario alternativo:** Edición de venta. Se agrega un ítem nuevo → `processSaleStock` descuenta; luego `Sale._repository.replace(updated)` falla (ej. disco/IDB). Resultado: stock ya descontado, venta no actualizada → **stock de menos**.

### 5.2 Venta guardada dos veces

- **Escenario:** Usuario hace doble clic en “Completar venta” o la red reintenta el mismo request. Se ejecutan dos `Sale.create()` con los mismos ítems.
- **Resultado esperado:** Una sola venta y un solo descuento.
- **Resultado posible actual:** Dos ventas y dos descuentos de stock → **stock de menos**.

### 5.3 Ajuste masivo que pisa stock previo

- **Escenario:** Ajuste masivo de 5 productos; el 3º falla (ej. validación “stock insuficiente”). Los productos 1 y 2 ya tienen stock actualizado y movimiento creado.
- **Resultado esperado:** Todo o nada.
- **Resultado posible actual:** Productos 1 y 2 ajustados, 3 falla, 4 y 5 no se procesan → **inconsistencia y desfase** según lo que se quiso hacer.

### 5.4 Compra editada sin recalcular stock

- **Escenario:** Edición de compra: se quita un ítem (revert), se actualiza la compra, y al aplicar “applyPurchaseStockForEdit” o “applyPurchaseQuantityDeltas” ocurre un error. La compra en BD ya tiene los ítems nuevos; el stock no.
- **Resultado esperado:** Compra y stock siempre alineados.
- **Resultado posible actual:** Compra refleja menos (o más) ítems de los que el stock refleja → **desfase**.

### 5.5 Eliminación de venta sin devolver stock

- **Escenario:** `Sale.delete()` llama `restoreSaleStock(sale.items)`. En el 2º ítem, `createAdjustment` falla (ej. producto borrado o error de BD). El 1º ítem ya devolvió stock; la venta no se ha borrado aún (el delete viene después).
- **Resultado esperado:** Rollback de la restauración del 1º ítem y venta intacta, o al menos estado consistente.
- **Resultado posible actual:** Parte del stock devuelto, venta aún existente; si luego se reintenta delete, puede haber doble devolución en el 1º ítem → **stock de más**.

### 5.6 Edición de venta cambiando solo cantidades

- **Escenario:** Venta con producto A cantidad 2. Usuario edita a cantidad 5 y guarda. `updateSale` recibe los mismos productIds; solo aplica restore para ítems que ya no están y process para ítems nuevos. El producto A sigue en la venta; no se considera “nuevo” ni “eliminado”.
- **Resultado esperado:** Descontar 3 unidades más de A.
- **Resultado posible actual:** La venta queda guardada con 5 unidades de A pero el stock solo se descontó 2 (en la venta original) → **stock de más** en sistema respecto a lo vendido.

### 5.7 Edición de producto con campo “Stock inicial”

- **Escenario:** En formulario de producto el usuario cambia “Stock inicial” de 10 a 50 y guarda. `ProductsView.saveProduct()` envía `data` con `stock: 50`. `ProductController.saveProduct` → `ProductService.updateProduct` → `Product.update(id, data)`. BaseRepository hace merge y `db.put(products, updated)`.
- **Resultado esperado:** Si se permite cambiar stock desde producto, debería generarse un movimiento y/o validación.
- **Resultado posible actual:** `product.stock` pasa a 50 sin ningún `StockMovement`. Si antes el stock real era 10 por ventas/ajustes, ahora hay 40 unidades “inventadas” → **desfase y sin trazabilidad**.

---

## 6. Validaciones críticas del sistema

| Pregunta | Respuesta | Detalle |
|----------|-----------|--------|
| ¿Permite stock negativo? | **No** en operaciones que usan `Product.updateStock()` | `Product.updateStock(..., 'subtract')` lanza si `newStock < 0`. Pero `Product.update(id, { stock: -1 })` desde producto/importación **sí** podría escribirlo si no se valida en ProductValidator/Product.update. ProductValidator.validate() rechaza stock &lt; 0 en datos de producto. |
| ¿Valida stock solo en frontend? | No solo | POS valida en `completeSale()` y SaleService valida de nuevo en `createSale()`. Ambos. |
| ¿Valida stock solo en backend? | No | Hay validación en front (POS) y en servicio (SaleService, ProductValidator). |
| ¿Bloquea ventas sin stock real? | Sí, por valor en BD | Si `product.stock < qty`, la validación falla y la transacción de venta no suma el put del producto. Correcto mientras no haya condición de carrera (dos ventas leyendo el mismo stock). |
| ¿Usa transacciones? | Parcial | Solo en `Purchase.create()` y `SaleService.createSale()`. No en ediciones ni en eliminaciones ni en ajustes masivos. |
| ¿Usa locks / atomicidad? | No locks | IndexedDB no tiene locks de fila. Dos pestañas pueden leer el mismo producto, validar, y ambas hacer put; la última escritura gana → condición de carrera. |
| ¿Maneja concurrencia? | No | No hay versionado optimista ni bloqueo. Múltiples pestañas o usuarios pueden desincronizar stock. |

---

## 7. Trazabilidad y auditoría

### 7.1 Lo que existe

- **Historial de movimientos:** Store `stockMovements` con `productId`, `type`, `quantity`, `reference` (saleId/purchaseId), `date`, `reason`, `cost_value`, `sale_value`.
- **Tipos:** `sale`, `purchase`, `adjustment`, `loss`, `consumption`.
- **Consultas:** `StockMovement.getByProduct()`, `getByType()`, `getByDateRange()`; vista Inventario muestra últimos movimientos.

### 7.2 Lo que no existe o es débil

- **Usuario responsable:** No se guarda `userId` (o equivalente) en `StockMovement`. No se puede auditar “quién” hizo el movimiento.
- **Motivo obligatorio:** `reason` puede ir vacío en ventas/compras (se usa referencia tipo “Compra #N” / “Devolución por eliminación de venta #N”). En ajustes el usuario puede no completar motivo.
- **Kardex estricto:** El stock “oficial” es `product.stock`, no la suma de movimientos. Si en algún momento se pisó stock con `Product.update()` o importación, el kardex (suma de movimientos) no coincidirá con el stock actual.
- **Reconstrucción histórica:** Se puede aproximar con movimientos por producto y por rango de fechas, pero no hay garantía de que el stock en una fecha pasada sea reproducible porque: (1) el valor actual puede haber sido alterado por actualización directa de stock, (2) no hay snapshot de “stock al cierre del día” persistido de forma explícita.

### 7.3 Debilidad crítica

**No existe una única fuente de verdad reconstruible:** el stock se puede modificar por vías que no generan movimiento (edición de producto, importación) y la edición de venta no reconcilia cambios de cantidad en ítems existentes. Por tanto, **no** se puede garantizar la reconstrucción del stock histórico solo a partir de movimientos, ni auditar de forma fiable el origen de cada cambio sin usuario en el movimiento y sin prohibir la escritura directa de stock.

---

## 8. Errores críticos, probables y riesgos futuros

### 8.1 Errores críticos

| ID | Descripción técnica | Archivo / función | Escenario | Impacto en stock | Nivel |
|----|---------------------|------------------|-----------|-------------------|--------|
| C1 | Edición de venta no actualiza stock cuando solo cambia la cantidad de ítems existentes | `js/models/Sale.js` – `updateSale()` | Usuario edita venta y cambia cantidad de un ítem (ej. 2 → 5) y guarda | Venta queda con cantidad nueva; stock no se descuenta (o no se devuelve si bajan). Desfase permanente | Crítico |
| C2 | Stock se puede pisar desde formulario de producto sin movimiento | `js/views/products.js` – `saveProduct()`; `js/models/Product.js` – `update()`; `ProductService.updateProduct()` | Usuario edita producto y cambia “Stock inicial” y guarda | `product.stock` se actualiza por merge; no se crea `StockMovement`. Desfase y sin trazabilidad | Crítico |
| C3 | Ajuste masivo no es atómico; fallo en un producto deja el resto aplicado | `js/views/inventory.js` – `saveBulkAdjustment()` | Ajuste masivo de N productos; falla en el k-ésimo | Productos 1..k-1 ya tienen stock y movimiento actualizados; k..N no. Inconsistencia y desfase | Crítico |
| C4 | Edición de compra: compra se actualiza antes de aplicar stock; si falla apply/deltas, BD compra y stock desalineados | `js/controllers/SupplierController.js` – `savePurchase()` (rama `data.id`) | Editar compra (quitar/agregar ítems o cambiar cantidades); fallo en `applyPurchaseStockForEdit` o `applyPurchaseQuantityDeltas` | Compra guardada con ítems nuevos; stock no refleja esos ítems o deltas. Desfase | Crítico |

### 8.2 Errores probables

| ID | Descripción técnica | Archivo / función | Escenario | Impacto en stock | Nivel |
|----|---------------------|------------------|-----------|-------------------|--------|
| P1 | Doble ejecución de venta (doble clic / reintento) crea dos ventas y descuenta dos veces | `js/controllers/POSController.js` – `completeSale()`; `Sale.create()` | Usuario hace doble clic en “Completar venta” o reintento de request | Dos ventas, doble descuento de los mismos ítems → stock de menos | Alto |
| P2 | Eliminación de venta: restore por ítem; si falla en medio, parte del stock devuelto y venta aún existe | `js/models/Sale.js` – `delete()` | Eliminar venta con varios ítems; fallo en el 2º o posterior al restaurar | Stock parcialmente devuelto; venta sigue en BD. Reintento puede doble-devolver. Stock de más posible | Alto |
| P3 | Eliminación de compra: revert restará stock; si algún producto tiene menos stock del que la compra sumó, lanza y puede abortar a mitad | `js/models/Purchase.js` – `delete()`; `StockService.revertPurchaseStock()` | Eliminar compra después de haber vendido parte de ese stock | “Stock insuficiente” en revert; parte de ítems ya restados. Compra puede quedar y stock inconsistente | Alto |
| P4 | Condición de carrera: dos ventas simultáneas del mismo producto leen el mismo stock, ambas validan y ambas escriben | IndexedDB + `Product.updateStock` / `SaleService.createSale()` | Dos cajas/pestañas vendiendo el mismo producto al mismo tiempo | Una venta podría “pasar” con stock que la otra ya consumió; última escritura gana. Stock de menos o venta sobre stock inexistente | Alto |
| P5 | Importación de productos (Excel/CSV) puede actualizar productos por barcode con nuevo stock sin movimiento | `js/models/Product.js` – `importProducts()`; flujo de importación en products view | Importar archivo que incluye “Stock actual” y barcode existente | Stock actualizado sin movimiento. Desfase y sin trazabilidad | Medio |

### 8.3 Riesgos futuros

| ID | Descripción técnica | Archivo / función | Escenario | Impacto en stock | Nivel |
|----|---------------------|------------------|-----------|-------------------|--------|
| R1 | Sin idempotencia en creación de venta: cualquier reintento duplica venta y descuento | `Sale.create` / `SaleService.createSale` | Red inestable, PWA en móvil, usuario que repite “Guardar” | Mismo que P1 | Alto |
| R2 | Sin usuario en movimientos: imposible auditar quién hizo un ajuste o corrección incorrecta | `StockMovement.create()`; store `stockMovements` | Revisión posterior de por qué un producto quedó con X unidades | No se puede atribuir responsabilidad | Medio |
| R3 | Cierre inesperado (navegador/Electron) en medio de edición de compra/venta o ajuste masivo deja estado a medias | Cualquier flujo multi-paso sin transacción | Cierre durante `savePurchase` (edición) o `saveBulkAdjustment` | Stock y documentos desalineados | Medio |
| R4 | Uso de “Stock inicial” en producto como corrección rápida por el usuario ante desfase, perpetuando el problema | Formulario producto + C2 | Usuario “arregla” el número de stock a ojo sin ajuste con motivo | Desfase oculto y kardex no reconstruible | Medio |

---

## 9. Casos de prueba teóricos

| # | Escenario simulado | Resultado esperado | Resultado posible actual |
|---|--------------------|--------------------|---------------------------|
| 1 | Venta con doble submit (mismo carrito, dos llamadas a Sale.create) | Una venta, un descuento | Dos ventas, dos descuentos |
| 2 | Editar venta: cambiar cantidad de ítem existente de 2 a 5 | Descontar 3 unidades más | No se descuenta; venta guarda 5, stock solo descontó 2 |
| 3 | Editar producto: cambiar solo “Stock inicial” de 10 a 50 | Movimiento de ajuste o al menos registro de cambio | Solo product.stock = 50; sin movimiento |
| 4 | Ajuste masivo de 3 productos; el 2º falla (stock insuficiente en resta) | Ningún cambio o los 3 aplicados | 1º aplicado, 2º falla, 3º no se ejecuta |
| 5 | Eliminar compra cuyo ítem ya fue vendido en parte (stock actual &lt; cantidad de la compra) | Revertir solo lo posible o rechazar con mensaje claro | Error “Stock insuficiente” a mitad de revert; estado intermedio |
| 6 | Dos pestañas venden el último mismo producto (stock 1) al mismo tiempo | Una venta exitosa y una rechazada por stock | Ambas pueden leer stock=1; una o ambas escriben; última gana; posible stock negativo o doble venta |
| 7 | Eliminar venta de 3 ítems; fallo al restaurar stock del 2º ítem | Rollback de la devolución del 1º y venta no eliminada | 1º ítem ya devuelto; venta sigue; reintento puede doble-devolver 1º ítem |

---

## 10. Recomendaciones (sin implementar)

### 10.1 Modelo de kardex

- Mantener `product.stock` como valor de lectura rápida pero **derivado** o **reconciliado** con un kardex: por ejemplo, “stock = suma de movimientos hasta la fecha” o “stock = último cierre + movimientos desde cierre”.
- Toda modificación de stock **obligatoriamente** por movimiento (alta en `stockMovements`) con tipo, cantidad, referencia, motivo, usuario, fecha. Prohibir `Product.update(id, { stock })` desde formulario/importación para “corregir” número; en su lugar, obligar ajuste con motivo y usuario.

### 10.2 Separación stock físico vs lógico

- **Stock lógico (sistema):** el que usa el POS para validar ventas (actualmente `product.stock`).
- **Stock físico (conteo):** resultado de inventario físico; no sobrescribir automáticamente el lógico. Usar diferencias para generar ajustes con motivo “Conteo físico dd/mm/aaaa” y usuario, de modo que el kardex quede trazable.

### 10.3 Reglas mínimas de integridad

- **Una transacción por operación de stock:** Cualquier flujo que modifique compra/venta y stock (edición de compra, edición de venta, eliminación de venta/compra, ajuste masivo) debería ejecutarse en una sola transacción IDB o equivalente (o patrón compensación con idempotencia).
- **Reconciliación de cantidades en edición de venta:** Al editar ítems, calcular deltas por productId (nueva cantidad − cantidad anterior) y aplicar `processSaleStock` / `restoreSaleStock` según el signo del delta, no solo “nuevos” vs “eliminados”.
- **No permitir escritura directa de stock:** Quitar “Stock inicial” editable en formulario de producto para productos ya existentes, o que ese campo solo cree movimiento de ajuste con motivo “Ajuste desde ficha de producto” y usuario.

### 10.4 Validaciones obligatorias

- **Idempotencia en venta:** Clave/token de operación (ej. idempotency key por carrito + timestamp o hash) para que dos requests iguales no creen dos ventas.
- **Concurrencia:** Versionado optimista en `Product` (ej. `version` o `updatedAt` estricto): al descontar, leer `version`, calcular nuevo stock, escribir solo si `version` no cambió; si cambió, reintentar lectura y validación.
- **Revert de compra:** Antes de revertir, comprobar que `product.stock >= quantity` por cada ítem; si no, no eliminar compra y mostrar mensaje claro (“No se puede eliminar: el stock actual de X es menor que la cantidad de esta compra”).

---

**Fin del reporte.**  
Este documento es únicamente de análisis y recomendaciones; no se ha implementado ningún cambio en código ni en datos.
