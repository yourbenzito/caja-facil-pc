# FASE C7 — HISTORIAL DE PRECIOS DE PRODUCTOS

**Estado:** COMPLETADA  
**Fecha:** 2026-02-08  
**Autor:** Desarrollador Senior (asistido por IA)

---

## 📌 Objetivo

Implementar un **historial de precios de venta** para productos, registrando cada cambio como un **evento inmutable** y auditable, sin modificar ventas existentes ni recalcular rentabilidad histórica.

---

## 🔍 Problema Original

### Antes de C7

El sistema no registraba cuándo, por qué ni quién cambió el precio de un producto. El precio simplemente se sobreescribía:

```javascript
// Product.update() — ANTES
await this._repository.update(id, data); // data.price sobreescribe sin trazabilidad
```

**Problemas:**

1. **Sin trazabilidad**: Imposible saber cuándo cambió un precio.
2. **Sin historial**: No se podía comparar el precio actual con precios anteriores.
3. **Sin auditoría**: No había registro de quién cambió el precio ni por qué.
4. **Sin variación**: No se calculaba el porcentaje de cambio.

---

## 🧠 Diseño Implementado

### Nueva Entidad: `ProductPriceHistory`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | number (auto) | ID único del registro |
| `productId` | number | ID del producto |
| `oldPrice` | number | Precio anterior |
| `newPrice` | number | Precio nuevo |
| `changePercent` | number \| null | Porcentaje de variación |
| `date` | ISO string | Fecha/hora del cambio |
| `reason` | string | Motivo del cambio |
| `createdAt` | ISO string | Timestamp de creación |
| `createdBy` | number \| null | ID del usuario (C3) |

### Reglas de Inmutabilidad

- Los registros **NO se editan** ni **eliminan**.
- Cada cambio de precio es un evento independiente.
- El campo `changePercent` se calcula automáticamente: `((newPrice - oldPrice) / oldPrice) * 100`.

### Método Clave: `recordIfChanged()`

```javascript
// Solo registra si el precio realmente cambió (tolerancia de $0.01)
static async recordIfChanged(productId, oldPrice, newPrice, reason) {
    if (Math.abs(old - nw) < 0.01) return null;
    return await this.create({ productId, oldPrice, newPrice, reason });
}
```

Este método se usa desde todos los hooks para evitar registros de ruido.

---

## 📁 Archivos Creados

| Archivo | Descripción |
|---------|-------------|
| `js/repositories/ProductPriceHistoryRepository.js` | Repository con métodos por índice: `findByProductId`, `findByDateRange` |
| `js/models/ProductPriceHistory.js` | Modelo inmutable con `create`, `recordIfChanged`, `getByProduct`, `getByDateRange`, `getLatestByProduct` |

## 📁 Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `js/db.js` | Versión 20→21, nuevo store `productPriceHistory` con indexes (`productId`, `date`) |
| `js/models/Product.js` | Hooks en `create()`, `update()`, `adjustPrice()` para registrar cambios de precio |
| `js/models/Purchase.js` | Hook post-transacción en `create()` para registrar precios que cambien por compra |
| `js/views/products.js` | Botón "Precios" en tabla, modal de historial de precios con variación visual |
| `index.html` | Registrar scripts de Repository y Model en orden correcto |

---

## 🔗 Puntos de Integración (Hooks)

### 1. `Product.create()` — Precio inicial
- Registra el precio de venta inicial como primer evento del historial.
- `reason`: "Precio inicial (creación de producto)"
- `oldPrice`: 0, `newPrice`: precio definido.

### 2. `Product.update()` — Edición de producto
- Captura `product.price` ANTES de actualizar.
- Compara con el nuevo `data.price` después de actualizar.
- Solo registra si hay cambio real (>= $0.01).
- `reason`: "Edición de producto"

### 3. `Product.adjustPrice()` — Ajuste directo
- Captura `product.price` antes del ajuste.
- Registra el cambio después de `repository.replace()`.
- `reason`: "Ajuste de precio"

### 4. `Purchase.create()` — Compra atómica
- Captura precios ANTES de la transacción atómica.
- Compara con los nuevos precios (si `item.price` difiere).
- Registra los cambios DESPUÉS de la transacción exitosa (no bloquea la compra).
- `reason`: "Compra #<purchaseId>"

### Protección contra errores
Todos los hooks están envueltos en `try/catch` — un error en el historial de precios **NUNCA** bloquea la operación principal (crear producto, actualizar, comprar).

---

## 🖥️ UI Implementada

### Botón "Precios" en tabla de productos
Cada producto tiene un botón `💲 Precios` que abre un modal con:

1. **Resumen actual**: Precio, costo y margen del producto.
2. **Tabla de historial**: Fecha, precio anterior, precio nuevo, variación (absoluta y porcentual), motivo.
3. **Indicadores visuales**: Flechas verdes (▲) para subidas, rojas (▼) para bajadas.
4. **Botón cruzado**: Desde el modal de precios se puede ir al historial de stock.

---

## 🧪 Casos de Uso

### 1. Crear producto con precio
- Se registra como "Precio inicial (creación de producto)"
- `oldPrice: 0`, `newPrice: <precio definido>`

### 2. Editar producto y cambiar precio
- Desde formulario de edición de producto
- Se registra con `reason: "Edición de producto"`
- Si el precio no cambió, NO se registra

### 3. Precio cambia por compra
- Al crear una compra con `item.price` diferente al precio actual
- Se registra con `reason: "Compra #<id>"`
- Registro ocurre DESPUÉS de la transacción exitosa

### 4. Ajuste directo de precio
- Vía `Product.adjustPrice()`
- Se registra con `reason: "Ajuste de precio"`

### 5. Consultar historial
- Desde el botón "Precios" en la tabla de productos
- Modal con tabla completa, ordenada por fecha (más reciente primero)

### 6. Error en historial no bloquea operación
- Si falla el registro del historial (BD llena, error de schema, etc.)
- La operación principal (crear/editar/comprar) sigue funcionando

---

## ⚠️ Riesgos y Limitaciones

### Riesgo 1: Datos históricos
**Problema:** Los cambios de precio anteriores a C7 no tienen historial.
**Mitigación:** El sistema registra a partir de ahora. No se recalcula ni imputa datos anteriores.

### Riesgo 2: Importación masiva de productos
**Problema:** Si se importan muchos productos con `ProductService.updateProduct()` y precio diferente, se generarán muchos registros.
**Mitigación:** Cada registro ocupa < 100 bytes. 10,000 cambios < 1MB en IndexedDB.

### Riesgo 3: Compras con precio igual
**Problema:** Si una compra no cambia el precio (`item.price === product.price`), no se registra nada.
**Mitigación:** Esto es correcto por diseño — solo se registran cambios reales.

---

## ✅ Qué queda protegido

1. **Trazabilidad completa** de cada cambio de precio: cuándo, cuánto, por qué, quién.
2. **Variación porcentual** calculada automáticamente para análisis de tendencias.
3. **Inmutabilidad**: Los registros no se pueden editar ni eliminar.
4. **Audit log** (C2) y trazabilidad de usuario (C3) integrados.
5. **Cero impacto** en ventas históricas, rentabilidad o reportes existentes.
6. **UI clara** con indicadores visuales de subida/bajada de precios.

---

## ❌ Qué NO se implementó (fuera de alcance)

1. Historial de cambios de **costo** (solo precio de venta).
2. Alertas automáticas por cambios significativos de precio.
3. Gráfico de tendencia de precios en el tiempo.
4. Comparación de precios entre productos/categorías.
5. Exportación del historial de precios a Excel.

---

## 📊 Resumen de Impacto

| Aspecto | Antes | Después |
|---------|-------|---------|
| Registro de cambio de precio | Ninguno | Evento inmutable `ProductPriceHistory` |
| Trazabilidad | Ninguna | Fecha, precio anterior/nuevo, variación, motivo, usuario |
| Puntos de captura | 0 | 4 (create, update, adjustPrice, purchase) |
| Auditoría | No | Sí (C2 audit log) |
| UI | Solo precio actual | + Botón "Precios" con historial completo |
| Impacto en ventas | - | Cero (no se modifican ventas históricas) |

---

*Documento generado para revisión por auditor externo.*
