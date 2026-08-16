# Paso 2: Bloqueo de escritura directa de stock

**Alcance:** Solo validaciones y flujos de escritura de producto.  
**Objetivo:** Impedir que `product.stock` se modifique fuera de StockService / movimientos de stock, y que todo cambio de stock pase por StockService y genere un StockMovement.  
**Regla:** No recalcular stock, no modificar stock existente, no tocar ventas/compras/ajustes manuales; solo bloquear o restringir rutas que escribían stock directo.

---

## 1. Problema detectado

### Situación anterior

El campo `product.stock` podía escribirse directamente desde:

- **Edición de producto (formulario):** El usuario cambiaba “Stock inicial” y guardaba; `ProductService.updateProduct(id, data)` llamaba a `Product.update(id, data)` con `data.stock`, y el repositorio hacía merge. El stock se actualizaba **sin** ningún movimiento de stock ni trazabilidad.
- **Importación de productos (Excel/CSV):** Si el producto ya existía (por barcode), se llamaba a `ProductService.updateProduct(existing.id, productData)` con `productData.stock` del archivo. El stock se pisaba **sin** movimiento.
- **Edición de compra (vista):** Tras guardar la compra editada, el código hacía `Product.update(product.id, product)` pasando el objeto producto completo (incluido `stock`). Se actualizaban coste y precio pero también se reescribía el stock con el valor actual del producto en memoria, pudiendo desalinear stock respecto a movimientos reales.

Además, cualquier uso genérico de `Product.update(id, data)` con `data.stock` (por ejemplo desde otro servicio o script) podía cambiar el stock sin pasar por StockService.

Consecuencias:

- **Integridad rota:** El inventario puede no coincidir con la suma de movimientos (ventas, compras, ajustes).
- **Sin trazabilidad:** No hay StockMovement que justifique el cambio.
- **Desfase acumulado:** Ajustes “a mano” desde ficha o importación generan diferencias entre stock físico y stock del sistema.

---

## 2. Rutas donde se escribía stock

### 2.1 Clasificación

| Ruta | Archivo / función | Tipo de escritura | Clasificación |
|------|-------------------|-------------------|----------------|
| Formulario edición producto | `ProductsView.saveProduct()` → `ProductController.saveProduct()` → `ProductService.updateProduct()` → `Product.update(id, data)` | Merge vía `data.stock` | **PROHIBIDA** – debe ignorarse o fallar |
| Importación (producto existente) | `ProductsView.importFromFile()` → `ProductService.updateProduct(existing.id, productData)` | Mismo flujo que arriba; `productData.stock` del Excel/CSV | **PROHIBIDA** – no actualizar stock en actualización por barcode |
| Edición compra (actualizar coste/precio) | `PurchasesView.savePurchase()` → `Product.update(product.id, product)` | Merge con objeto producto completo (incluye `stock`) | **PROHIBIDA** – solo deben actualizarse coste y precio |
| StockService – compra | `StockService.processPurchaseStock()` → `Product.update(item.productId, { cost, price, stock })` | Merge con `stock` calculado (compra) | **PERMITIDA** – único flujo legítimo de actualización de stock vía `Product.update` (junto con Purchase.create en transacción) |
| Purchase.create (transacción) | `Purchase.create()` | `productStore.put(updatedProduct)` dentro de transacción IDB | **PERMITIDA** – no usa `Product.update`; no modificada en este paso |
| Product.create (producto nuevo) | `Product.create(data)` | Alta nueva con `data.stock` (stock inicial) | **MANTENIDA** – stock inicial en alta; no es “cambio” de stock |
| Product.updateStock | `Product.updateStock(id, qty, operation)` | `_repository.replace(updated)` con `stock` calculado | **ÚNICA VÍA OFICIAL** – usada por StockService para ventas, ajustes, reversiones |
| BaseRepository.update / replace | Llamados desde `Product.update` y `Product.updateStock` | Put/merge en store `products` | **INDIRECTOS** – se controlan desde Product, no desde el repositorio |

### 2.2 Rutas que podrían transformarse en ajustes (no implementado)

- **Edición de producto con cambio de “Stock inicial”:** En el futuro podría abrir un ajuste con motivo “Ajuste desde ficha de producto” y usuario, en lugar de escribir stock directo. En este paso **no** se implementa; solo se evita que ese cambio se persista.
- **Importación con “Stock actual” en producto existente:** Podría generar un ajuste por diferencia entre stock actual y valor del archivo. En este paso **no** se implementa; solo se evita que la importación actualice stock en productos existentes (quitando `stock` del payload en `updateProduct`).

---

## 3. Medidas de bloqueo aplicadas

### 3.1 Product.update(id, data, options)

**Archivo:** `js/models/Product.js`

- Se añade un tercer parámetro opcional: `options = { allowStock: false }`.
- Si `data` contiene la propiedad `stock` (con cualquier valor) y `options.allowStock !== true`, se **lanza** un error antes de llamar al repositorio:
  - Mensaje: `"El stock no puede modificarse directamente. Use StockService o Ajustes de inventario para cambios de stock."`
- Si `allowStock: true`, se permite escribir `stock` (uso restringido a StockService / flujo de compra).
- No se modifica la firma de `Product.updateStock` ni del repositorio; solo se valida en la capa Product.

### 3.2 ProductService.updateProduct(id, data)

**Archivo:** `js/services/ProductService.js`

- Antes de llamar a `Product.update`, se **elimina** `stock` del payload: `const { stock, ...rest } = data;` y se pasa `{ ...rest, expiryDate }`.
- Efecto: tanto el formulario de edición como la importación (que usa `updateProduct` para productos existentes) **nunca** envían `stock` a `Product.update`. El stock del producto no se modifica en actualizaciones; cualquier cambio de stock debe hacerse por StockService / ajustes.

### 3.3 PurchasesView.savePurchase

**Archivo:** `js/views/purchases.js`

- Tras guardar la compra editada, en lugar de `Product.update(product.id, product)` se llama a `Product.update(product.id, { cost: item.cost, price: item.price })`.
- Efecto: solo se actualizan coste y precio del producto; el stock **no** se toca y no se reescribe desde el objeto en memoria.

### 3.4 StockService.processPurchaseStock

**Archivo:** `js/services/StockService.js`

- La llamada a `Product.update(item.productId, { cost, price, stock }, ...)` se mantiene; se añade el tercer argumento: `{ allowStock: true }`.
- Efecto: este es el **único** flujo que sigue pudiendo escribir `stock` a través de `Product.update`, de forma explícita y controlada, sin tocar la lógica de compras (solo se autoriza la escritura de stock en este punto).

### 3.5 Lo que no se modificó

- **Product.create:** Sigue aceptando `data.stock` para stock inicial en productos nuevos.
- **Product.updateStock:** Sigue siendo la vía usada por StockService para ventas, ajustes y reversiones; no se cambia.
- **Purchase.create:** Sigue actualizando stock dentro de su transacción IDB con `productStore.put`; no usa `Product.update`.
- **Ventas, ajustes manuales, BaseRepository, esquema IndexedDB:** Sin cambios.

---

## 4. Casos de prueba teóricos

*No se han ejecutado contra datos reales.*

### 4.1 Usuario edita producto y cambia stock

- **Acción:** En la ficha de producto, el usuario cambia “Stock inicial” de 10 a 50 y guarda.
- **Flujo:** `ProductsView.saveProduct` → `ProductController.saveProduct(data)` → `ProductService.updateProduct(id, data)`. En `updateProduct` se hace `const { stock, ...rest } = data` y se llama a `Product.update(id, { ...rest, expiryDate })` **sin** `stock`.
- **Resultado esperado:** La venta se guarda; el resto de campos (nombre, precio, etc.) se actualizan; **el stock del producto no cambia** (sigue en 10). No se genera StockMovement.
- **Nota:** Si en el futuro alguien llamara directamente `Product.update(id, { stock: 50 })` sin `allowStock: true`, debería **fallar** con el mensaje de error indicado.

### 4.2 Importación intenta actualizar stock en producto existente

- **Acción:** Se importa un Excel donde un producto existente (mismo barcode) tiene “Stock actual” 100.
- **Flujo:** Para ese producto se llama `ProductService.updateProduct(existing.id, productData)` con `productData.stock = 100`. En `updateProduct` se quita `stock` del payload y se llama a `Product.update(id, { ...rest, expiryDate })`.
- **Resultado esperado:** El producto se actualiza con nombre, precio, categoría, etc. del archivo; **el stock no se modifica** (no se usa el 100 del Excel). No se genera movimiento.

### 4.3 Edición de compra (solo coste/precio)

- **Acción:** El usuario edita una compra y cambia coste o precio de un ítem; guarda.
- **Flujo:** `PurchasesView.savePurchase` → tras `SupplierController.savePurchase`, para cada ítem se hace `Product.update(product.id, { cost: item.cost, price: item.price })`.
- **Resultado esperado:** Solo coste y precio del producto se actualizan; el stock del producto **no** se altera. Las compras siguen actualizando stock solo mediante el flujo normal de compra (Purchase.create o StockService según corresponda).

### 4.4 Venta / compra siguen funcionando

- **Venta:** Sigue usando `Product.updateStock(..., 'subtract')` y `StockService.processSaleStock`; no usa `Product.update` con stock. Sin cambios.
- **Compra nueva:** Sigue usando transacción en `Purchase.create` o `StockService.processPurchaseStock` con `Product.update(..., { allowStock: true })`. Sin cambios de comportamiento; solo se explicita la autorización de escritura de stock en ese punto.

---

## 5. Riesgos y limitaciones

### 5.1 Riesgos

- **Código que llame a Product.update con stock sin allowStock:** Cualquier nuevo código o script que haga `Product.update(id, { stock: x })` **fallará** con el mensaje explícito. Es el comportamiento deseado para evitar escritura directa.
- **ProductRepository o BaseRepository usados directamente:** Si en el futuro alguien hace `Product._repository.update(id, { stock: x })` o accede al store `products` por otra vía, el bloqueo de `Product.update` no aplica; la protección es a nivel de la API pública `Product.update`.
- **Purchase.create:** Sigue escribiendo stock con `productStore.put(updatedProduct)` dentro de la transacción; no pasa por `Product.update`. No se ha tocado en este paso; la regla era no tocar lógica de compras.

### 5.2 Limitaciones

- **Stock inicial en producto nuevo:** Sigue siendo posible en `Product.create`. No se ha restringido en este paso (el requisito era “todo **cambio** de stock” por StockService).
- **Ajustes automáticos:** No se implementan; si el usuario “corrige” el número en la ficha, ese valor se ignora en la actualización. Para corregir stock debe usar Ajustes de inventario (StockService).
- **Un único punto con allowStock: true:** Solo `StockService.processPurchaseStock` usa `allowStock: true`. Cualquier otro flujo que necesite escribir stock en el futuro debería usar `Product.updateStock` o StockService, o en casos muy acotados documentar y usar `allowStock: true` con criterio.

---

## 6. Qué queda protegido a partir de este paso

- **Edición de producto (formulario):** El campo “Stock inicial” puede seguir visible, pero su valor **no** se persiste en la actualización; el stock solo puede cambiar por StockService / ajustes.
- **Importación (productos existentes):** La columna “Stock actual” del Excel/CSV **no** actualiza el stock de productos ya existentes; el resto de campos sí.
- **Edición de compra (actualización de coste/precio):** Ya **no** se reescribe el stock del producto al guardar la compra editada; solo coste y precio.
- **Cualquier otro uso de Product.update con stock:** **Falla** de forma explícita salvo que se use `allowStock: true` (restringido a StockService en este paso).
- **Ventas y ajustes:** Siguen usando solo `Product.updateStock` y StockService; no se ven afectados por este paso y mantienen trazabilidad vía StockMovement.

Con esto, todo **cambio** de stock en productos existentes queda canalizado por `Product.updateStock` (y por tanto por StockService y movimientos de stock), salvo el flujo explícito de compra que usa `Product.update(..., { allowStock: true })` y que ya genera StockMovement en el mismo flujo.

---

**Fin del documento.**  
Este archivo es para revisión por un auditor externo. No se han implementado ajustes automáticos ni se ha tocado ningún otro flujo (ventas, compras, ajustes manuales, esquema IDB).
