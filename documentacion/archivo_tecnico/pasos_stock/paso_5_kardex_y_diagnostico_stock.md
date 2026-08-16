# Paso 5: Kardex de stock y herramientas de diagnóstico

**Alcance:** Solo lectura, análisis y visualización. No se modifican ventas, compras, ajustes ni stock. No se cambia esquema IndexedDB ni se crean tablas nuevas.  
**Objetivo:** Ofrecer un kardex por producto y diagnósticos que permitan auditar movimientos, reconstruir el saldo teórico, detectar inconsistencias y visualizar el historial.

---

## 1. Objetivo del kardex

- **Auditar movimientos:** Ver todos los movimientos de un producto en orden cronológico con tipo, referencia, cantidad y saldo acumulado.
- **Reconstruir el saldo teórico:** Calcular qué stock “debería” haber si solo se consideraran los movimientos registrados (suma de cantidades con signo).
- **Detectar inconsistencias:** Comparar el último saldo teórico con `Product.stock`; si no coinciden, marcar como inconsistencia (sin corregir nada).
- **Visualizar historial:** Responder preguntas como “¿por qué este producto dice stock 0 si físicamente hay?”, “¿dónde se perdió stock?”, “¿qué movimiento generó el desfase?”, “¿cuándo empezó el problema?”.

---

## 2. Análisis de StockMovement actual

### 2.1 Información que contiene cada movimiento

| Campo        | Tipo     | Descripción |
|-------------|----------|-------------|
| `id`        | number   | ID auto-increment (IndexedDB). |
| `productId` | number   | Producto al que aplica el movimiento. |
| `type`      | string   | Tipo: `sale`, `purchase`, `adjustment`, `loss`, `consumption`. |
| `quantity`  | number   | Cantidad con signo: positivo = entrada, negativo = salida. |
| `reference` | number/null | ID de venta (sale), compra (purchase) o referencia para ajustes; puede ser null. |
| `date`      | string   | Fecha/hora ISO del movimiento. |
| `reason`    | string   | Motivo (opcional); en rollbacks suele contener "Rollback". |
| `cost_value`| number   | Valor en costo (opcional). |
| `sale_value`| number   | Valor en precio venta (opcional). |

### 2.2 Tipos de movimiento y signo

- **sale:** `quantity` &lt; 0 → resta stock.
- **purchase:** `quantity` &gt; 0 → suma stock.
- **adjustment:** `quantity` puede ser &gt; 0 (suma) o &lt; 0 (resta).
- **loss:** `quantity` &lt; 0 → resta stock.
- **consumption:** `quantity` &lt; 0 → resta stock.
- **Rollback:** No es un tipo; son movimientos tipo `adjustment` cuyo `reason` contiene “Rollback” (compensación de un ajuste masivo fallido).

No se crean nuevos tipos; el kardex usa solo los existentes.

### 2.3 Qué falta para un kardex ideal (y no se implementa)

- **Usuario responsable:** No existe `userId` en StockMovement; no se puede auditar “quién” hizo el movimiento.
- **Saldo previo explícito:** No se guarda “saldo antes”; se reconstruye con el acumulado teórico desde el primer movimiento.
- **Stock inicial al alta del producto:** Si el producto se dio de alta con stock inicial y no hubo movimiento de “entrada” equivalente, el saldo teórico desde movimientos no incluye ese inicial; la comparación con `Product.stock` puede marcar inconsistencia o “falta” de stock inicial en el kardex.

---

## 3. Lógica de cálculo del saldo

- **Orden:** Movimientos ordenados por `date` ascendente y, ante empates de fecha, por `id` ascendente.
- **Saldo acumulado teórico:** Se parte de un saldo inicial **0** (no se asume stock inicial previo a movimientos). Para cada fila:
  - `balanceAfter = balanceAfter_anterior + quantity` (la primera fila: `balanceAfter = quantity`).
- **Signo en visualización:** Se muestra la misma `quantity` con signo “+” o “−” según sea entrada o salida.
- **Comparación con stock actual:**
  - `theoreticalBalance` = último `balanceAfter` del kardex (o 0 si no hay movimientos).
  - `currentStock` = `Product.stock`.
  - **Inconsistencia:** si hay al menos un movimiento y `|theoreticalBalance - currentStock| > 0.001`, se marca `inconsistency: true`. No se corrige ni se escribe nada en BD.

---

## 4. Estructura del kardex

### 4.1 Método del servicio

`StockService.getKardexByProduct(productId)` — **solo lectura**, no escribe en BD.

### 4.2 Objeto devuelto

```js
{
  product: Object | null,        // Producto (para nombre, tipo, etc.)
  rows: [
    {
      id,
      date,
      type,
      reference,
      reason,
      quantity,
      sign: '+' | '-',
      balanceAfter,
      noReference: boolean,
      isRollback: boolean,
      negativeBalance: boolean
    }
  ],
  theoreticalBalance: number,
  currentStock: number,
  inconsistency: boolean,
  diagnostics: {
    hasNegativeBalance: boolean,
    hasNoReference: boolean,
    hasRollback: boolean,
    movementCount: number
  }
}
```

- **rows:** Una fila por movimiento, ordenada por fecha (y id) ascendente.
- **balanceAfter:** Saldo acumulado teórico después de ese movimiento.
- **noReference:** `true` si el tipo suele llevar referencia (sale/purchase) y `reference` es null o vacío.
- **isRollback:** `true` si `reason` contiene la palabra “Rollback”.
- **negativeBalance:** `true` si `balanceAfter` &lt; 0 en esa fila.
- **inconsistency:** Salto entre saldo teórico y `Product.stock` (solo se marca, no se corrige).

---

## 5. Casos de diagnóstico

### 5.1 Movimientos sin referencia

- **Qué es:** Tipos `sale` o `purchase` con `reference` null o vacío.
- **Marcado:** `noReference: true` en la fila; en la UI se muestra “Sin ref.” en la columna Tipo.
- **Ayuda:** Permite localizar ventas/compras que no quedaron bien vinculadas a su documento.

### 5.2 Saltos bruscos / saldo teórico negativo

- **Qué es:** En algún punto del kardex el saldo acumulado pasa a ser negativo.
- **Marcado:** `negativeBalance: true` en esa fila; `diagnostics.hasNegativeBalance: true`.
- **Ayuda:** Indica que en ese momento el sistema permitió una salida mayor al saldo teórico (o que faltan movimientos de entrada previos).

### 5.3 Rollback

- **Qué es:** Movimientos de compensación por fallo en ajuste masivo (reason contiene “Rollback”).
- **Marcado:** `isRollback: true` en la fila; `diagnostics.hasRollback: true`.
- **Ayuda:** Permite distinguir correcciones automáticas en el historial.

### 5.4 Inconsistencia: saldo teórico vs Product.stock

- **Qué es:** El último `balanceAfter` no coincide con el stock actual del producto.
- **Marcado:** `inconsistency: true`; en la UI se muestra alerta “INCONSISTENCIA DETECTADA” y se aclara que no se ha modificado ningún dato.
- **Ayuda:** Responde a “¿por qué el sistema dice X y físicamente hay Y?” o “¿dónde se perdió/ganó stock?”. Posibles causas: escritura directa de stock (ya restringida en pasos anteriores), movimientos faltantes, o stock inicial no registrado como movimiento.

### 5.5 Orden temporal

- Los movimientos se ordenan por `date` y `id`; no se marca “fuera de orden” porque se fuerza un orden consistente para el cálculo. Si en BD hubiera fechas desordenadas, el kardex las muestra ya ordenadas para el saldo.

---

## 6. Visualización en la vista de inventario

- En la sección **Inventario** (productos con stock bajo / sin stock / próx. a vencer), en cada fila de producto se añadió el botón **“Kardex”** junto a “Ajustar”.
- Al hacer clic en **“Kardex”** se abre un modal que:
  - Muestra nombre del producto, stock actual (`Product.stock`) y saldo teórico (suma de movimientos).
  - Si hay **inconsistencia**, muestra una alerta en rojo: “INCONSISTENCIA DETECTADA: El saldo teórico por movimientos (X) no coincide con el stock actual del producto (Y). No se ha modificado ningún dato.”
  - Muestra una tabla: **Fecha | Tipo | Referencia | Cantidad | Saldo**.
  - En Tipo se muestran badges por tipo y, si aplica, “Sin ref.”, “Rollback” o “Saldo &lt; 0” como diagnóstico en la fila.

No se añaden nuevas rutas ni pantallas; solo el botón y el modal en la vista de inventario existente.

---

## 7. Limitaciones

- **Solo lectura:** El kardex y los diagnósticos no corrigen stock ni crean ajustes; solo consultan y muestran.
- **Saldo inicial 0:** El acumulado se calcula suponiendo saldo 0 antes del primer movimiento; si el producto tuvo stock inicial sin movimiento, el teórico y el actual pueden diferir y marcarse como inconsistencia.
- **Sin usuario:** No se puede ver quién realizó cada movimiento.
- **Rendimiento:** Con muchos movimientos por producto, `getByProduct` + ordenación y bucle es en memoria; no hay paginación en este paso.
- **Referencia y tipos:** “Sin referencia” solo se marca para `sale` y `purchase`; otros tipos pueden tener referencia opcional.

---

## 8. Qué permite detectar desde ahora

- **Inconsistencia entre movimientos y stock actual:** Permite ver si el número que muestra el sistema (`Product.stock`) coincide o no con la suma de movimientos.
- **Puntos donde el saldo se volvió negativo:** Ayuda a localizar en qué movimiento se “pasó” de stock.
- **Ventas/compras sin referencia:** Facilita auditar documentos mal vinculados.
- **Presencia de rollbacks:** Permite ver compensaciones por fallos en ajustes masivos.
- **Historial ordenado:** Respuesta a “¿qué pasó con este producto?” en el tiempo.

Este documento es para revisión por un auditor externo. No se corrige stock ni se tocan otros flujos.
