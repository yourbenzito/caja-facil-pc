# Paso 4: Idempotencia en la creación de ventas

**Alcance:** Solo flujo de creación de ventas.  
**Objetivo:** Que una misma intención de venta no se procese más de una vez; reintentos o doble clic no deben duplicar ventas ni descuentos de stock.  
**Reglas:** No recalcular ventas ni stock histórico, no cambiar esquema IndexedDB, no tocar compras/ajustes/productos, no dependencias externas. La clave idempotente es opcional (ventas antiguas sin clave siguen siendo válidas).

---

## 1. Problema original

La creación de ventas **no era idempotente**. Si `SaleService.createSale()` se ejecutaba dos veces con la misma intención (mismo carrito, mismo pago):

- Se creaban **dos** ventas en la base de datos.
- El stock se **descontaba dos veces** (una por cada transacción).
- El inventario quedaba **incorrecto** (menos stock del real).

Causas típicas:

- **Doble clic** en “Completar venta”.
- **Reintentos** automáticos (red, timeout).
- **Lag** o cierre inesperado del navegador tras el primer envío exitoso, con reintento del usuario.

---

## 2. Flujo actual de creación de ventas

1. **Origen:** El usuario confirma la venta desde el POS → `POSController.completeSale(paymentMethod, isPending, paymentDetails)`.
2. Se validan carrito, caja, cliente (si aplica), stock por ítem, dinero a favor (si aplica).
3. Se construye `saleData` (customerId, items, total, paymentMethod, cashRegisterId, status, paidAmount, etc.).
4. Se llama a **`Sale.create(saleData)`** → **`SaleService.createSale(saleData)`**.
5. En `createSale`: validación de datos, número de venta, validación de crédito (si aplica), validación de stock y preparación de productos/movimientos, **transacción IDB** (alta de venta + actualización de productos + alta de movimientos de stock).
6. Vuelta al controller: descuento de dinero a favor del cliente, alta de `CustomerCreditUse` (si aplica), comprobaciones, **clearCart**, notificación y retorno de la venta.

**Datos que definen una “misma intención de venta”:** mismo carrito (ítems y cantidades), mismo cliente, mismo total y forma de pago, en un mismo “intento” de completar (mismo clic o mismo reintento). En la práctica se identifica con una **clave idempotente** generada una sola vez por ese intento y reutilizada en reintentos o segundo clic.

**Información disponible para idempotencia:** En el front se puede generar un token único por intento (antes de llamar a `Sale.create`) y enviarlo en `saleData`. No se usa hash del contenido para no colisionar dos ventas legítimas iguales (mismo carrito en dos momentos distintos).

---

## 3. Estrategia de idempotencia elegida

**Clave idempotente por intento (idempotency key):**

- Se genera **una sola clave** por “intento de completar venta” en el controller y se reutiliza mientras ese intento siga vigente (mismo carrito, posible doble clic o reintento).
- La clave se envía en `saleData.idempotencyKey`.
- **Antes** de crear la venta, si existe `idempotencyKey`, se busca si ya hay una venta con esa clave.
  - Si **existe** → se devuelve el ID de esa venta y un indicador `fromIdempotency: true`; **no** se crea otra venta ni se descuenta stock de nuevo.
  - Si **no existe** → se crea la venta como hasta ahora y se guarda la clave en el registro de la venta.
- No se añaden tablas; la clave es un **campo opcional** en el objeto venta (`sale.idempotencyKey`). Las ventas antiguas sin clave no se modifican y siguen siendo válidas.

Opciones descartadas brevemente:

- **Hash del contenido (ítems + total + cliente + fecha):** riesgo de colisión y de tratar como duplicado una segunda venta legítima con mismo contenido.
- **Solo token de frontend sin persistir:** no permitiría detectar duplicados tras recarga o segundo request.
- **Fingerprint del carrito + timestamp:** mismo problema que el hash si dos ventas iguales se hacen en ventanas de tiempo cercanas.

---

## 4. Generación y uso de la clave

### 4.1 Generación (frontend – POSController)

- Al preparar la venta en `completeSale()`, **antes** de `Sale.create(saleData)`:
  - Si aún no hay clave para este “intento”, se asigna una nueva:
    - `this._idempotencyKeyForCurrentSale = 'idem_' + Date.now() + '_' + Math.random().toString(36).slice(2, 14);`
  - Se hace `saleData.idempotencyKey = this._idempotencyKeyForCurrentSale`.
- Así, un **doble clic** o un **reintento** usan la misma clave (porque no se ha limpiado aún).
- La clave se **borra** cuando:
  - La venta se completa con éxito (al final de `completeSale`).
  - Se llama a `clearCart()` (nueva venta o limpieza manual).

No se usan dependencias externas; solo `Date.now()` y `Math.random()`.

### 4.2 Uso en SaleService.createSale

1. **Al inicio:** Si `saleData.idempotencyKey` está presente y no está vacío:
   - Se llama a `Sale.findByIdempotencyKey(idempotencyKey)`.
   - Si se encuentra una venta → se retorna `{ saleId: existing.id, fromIdempotency: true }` y **no** se ejecuta validación de stock ni transacción de creación.
2. Si no hay clave o no hay venta previa con esa clave:
   - Se sigue el flujo habitual (validar, generar número, armar objeto venta).
   - Se asigna `sale.idempotencyKey = idempotencyKey` al objeto venta (si había clave).
   - Se ejecuta la transacción (alta de venta + productos + movimientos).
   - Se retorna el **saleId** (número) del nuevo registro.

### 4.3 Búsqueda por clave (Sale / SaleRepository)

- **SaleRepository.findByIdempotencyKey(key):** Obtiene todas las ventas (`findAll()`) y devuelve la primera cuyo `idempotencyKey === key`, o `null`. No se añade índice en IndexedDB (sin cambio de esquema).
- **Sale.findByIdempotencyKey(key):** Delega en el repositorio.

### 4.4 Comportamiento en el controller cuando la venta es idempotente

- Si `Sale.create` devuelve un objeto con `fromIdempotency: true`:
  - Se obtiene la venta con `Sale.getById(saleId)`.
  - Se llama a `clearCart(false)` (y con ello se limpia la clave).
  - Se muestra notificación: “Venta ya registrada (evitado duplicado).”
  - Se retorna esa venta **sin** volver a descontar dinero a favor ni crear `CustomerCreditUse` (ya se hizo en la primera ejecución).

---

## 5. Casos de prueba teóricos

*No ejecutados contra datos reales.*

### 5.1 Dos llamadas consecutivas con la misma clave

- **Escenario:** Primera llamada a `createSale(saleData)` con `idempotencyKey = 'idem_123_abc'`. La venta se crea y se guarda con esa clave. Segunda llamada con la misma clave (reintento o doble clic).
- **Resultado esperado:** En la segunda, `findByIdempotencyKey` devuelve la venta ya creada. Se retorna `{ saleId: id, fromIdempotency: true }` sin crear otra venta ni descontar stock. El controller muestra “Venta ya registrada (evitado duplicado).” y limpia el carrito.

### 5.2 Dos llamadas con claves distintas

- **Escenario:** Primera con clave K1 (venta nueva). Segunda con clave K2 (otra venta nueva, otro intento o otro carrito).
- **Resultado esperado:** Se crean dos ventas; cada una con su clave; el stock se descuenta una vez por cada venta. Comportamiento normal.

### 5.3 Reintento tras error de UI

- **Escenario:** Primera llamada crea la venta correctamente pero falla algo después en el controller (por ejemplo antes de clearCart o de mostrar éxito). El usuario reintenta “Completar venta” con el mismo carrito; el controller reutiliza la misma clave.
- **Resultado esperado:** Segunda llamada a `createSale` encuentra la venta por clave y retorna `fromIdempotency: true`. No se duplica venta ni stock; el usuario ve “Venta ya registrada (evitado duplicado).”.

### 5.4 Dos ejecuciones casi simultáneas (misma clave)

- **Escenario:** Dos clics muy seguidos; ambas ejecuciones usan la misma clave (porque la primera aún no ha limpiado `_idempotencyKeyForCurrentSale`).
- **Resultado esperado:** Una de las dos crea la venta; la otra, al buscar por clave, la encuentra y retorna idempotente. En total: una venta y un descuento de stock. (En condiciones de mucha concurrencia podría haber una ventana donde ambas lean “no existe” antes de que una escriba; en ese caso podría crearse más de una venta; se considera limitación conocida.)

### 5.5 Venta sin clave (compatibilidad)

- **Escenario:** Se llama a `createSale(saleData)` sin `idempotencyKey` (código legacy o flujo que no la envía).
- **Resultado esperado:** No se busca por clave; se crea siempre una venta nueva. Las ventas antiguas sin campo `idempotencyKey` siguen siendo válidas; no se exige clave.

---

## 6. Riesgos y limitaciones

### 6.1 Riesgos

- **Concurrencia extrema:** Dos requests con la misma clave que llegan casi a la vez podrían ambos pasar el “no existe” antes de que uno persista la venta; en ese caso podrían crearse dos ventas. Mitigación: la clave se genera en el front y se reutiliza en el mismo “intento”; en la práctica reduce mucho doble clic y reintentos. No se implementó bloqueo pesimista ni transacción de “insert if not exists” en este paso.
- **Rendimiento de findByIdempotencyKey:** Se hace `findAll()` y filtro en memoria. Con muchas ventas puede ser más lento; no se añade índice para no tocar el esquema. Aceptable para un POS típico.

### 6.2 Limitaciones

- **Solo creación de ventas:** No se aplica idempotencia a edición de ventas, pagos, compras ni otros flujos.
- **Clave por intento, no por contenido:** Dos ventas con el mismo contenido pero en intentos distintos (claves distintas) siguen siendo dos ventas. Es lo deseado para no colisionar ventas legítimas.
- **Ventas antiguas:** No tienen `idempotencyKey`; no se modifican ni se recalculan.

---

## 7. Qué se garantiza a partir de este paso

- **Mismo intento, misma clave:** Si el usuario hace doble clic o reintenta con el mismo carrito e intención, el controller reutiliza la misma `idempotencyKey`. La segunda (o posteriores) llamadas a `createSale` con esa clave devuelven la venta ya creada y **no** crean otra ni descuentan stock de nuevo.
- **Reintentos seguros:** Un reintento tras un error de red o de UI que reenvía la misma clave no duplica venta ni stock.
- **Compatibilidad:** Las ventas sin clave siguen creándose como antes; no se exige `idempotencyKey`.
- **Sin nuevas tablas ni cambio de esquema:** La clave es un campo opcional en el objeto venta; la búsqueda es por filtro en memoria en el repositorio.
- **Punto único:** Toda la lógica de idempotencia en creación pasa por `SaleService.createSale`; el controller solo genera la clave y reacciona al retorno `fromIdempotency`.

Este documento es para revisión por un auditor externo. No se han tocado otros flujos ni mejoras ajenas a la creación de ventas.
