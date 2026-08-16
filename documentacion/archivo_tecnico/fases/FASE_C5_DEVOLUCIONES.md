# FASE C5 — DEVOLUCIONES DE VENTAS (RETURNS)

**Fecha:** 2026-02-08  
**Autor:** Desarrollo Senior — Contabilidad de Ventas e Inventarios  
**Estado:** IMPLEMENTADA  
**Fases previas cerradas:** A, B, C1, C2, C3, C4

---

## Objetivo

Implementar devoluciones de ventas de forma **contablemente correcta** y **auditable**, sin modificar ventas existentes ni datos históricos.

---

## Diseño Contable

### Principio fundamental

> Una devolución es un **EVENTO NUEVO E INMUTABLE**. La venta original NUNCA se modifica.

| Concepto | Tratamiento |
|----------|------------|
| Venta original | NO se modifica ni elimina |
| Ítems históricos | NO se editan |
| Stock histórico | NO se recalcula retroactivamente |
| Stock actual | SE restaura al momento de la devolución |
| Revenue en reportes | SE descuenta la devolución del período |
| Costo de ventas en reportes | SE descuenta el costo de lo devuelto |
| Kardex (movimientos de stock) | SE registra movimiento tipo `return` |
| Audit log | SE registra la devolución como acción auditable |

### Flujo contable

```
Venta original (#42)
├── Items: Prod A x3 ($300), Prod B x2 ($500)
├── Total: $800
├── Estado: completed
└── (INMUTABLE — no se toca)

Devolución #1 (de Venta #42)
├── Items: Prod A x1 ($100)
├── Total devuelto: $100
├── Stock Prod A: +1 (restaurado)
├── StockMovement: tipo 'return', qty +1, ref=42
├── AuditLog: saleReturn, action='create'
└── (INMUTABLE — no se toca)

Reporte de Rentabilidad (período)
├── Revenue: ventas - devoluciones = $800 - $100 = $700
├── Costo: costo_ventas - costo_devuelto
└── Ganancia: revenue - costo - gastos
```

---

## Modelo de datos

### Store: `saleReturns` (IndexedDB)

```javascript
{
    id: autoIncrement,        // ID único
    saleId: number,           // Referencia a la venta original
    saleNumber: number|null,  // Número de venta (informativo)
    date: ISO string,         // Fecha de la devolución
    items: [
        {
            productId: number,
            quantity: number,     // Cantidad devuelta
            unitPrice: number,    // Precio unitario al momento de la venta
            costAtSale: number|null, // Costo al momento de la venta (para rentabilidad)
            name: string,
            total: number         // quantity * unitPrice (redondeado)
        }
    ],
    totalReturned: number,    // Suma de item.total
    reason: string,           // Motivo de la devolución
    createdAt: ISO string,
    createdBy: number|null    // ID del usuario (C3)
}
```

**Índices:** `saleId`, `date`  
**Versión BD:** 18 → 19

---

## Archivos creados

| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `js/repositories/SaleReturnRepository.js` | Repository | CRUD + queries por `saleId` y `date` range |
| `js/models/SaleReturn.js` | Model | Crear devoluciones, obtener por venta/rango, calcular cantidades devueltas |
| `js/services/SaleReturnService.js` | Service | Lógica de negocio: validación, stock, rollback, audit |

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `js/db.js` | Versión 18→19, nuevo store `saleReturns` con índices `saleId`, `date` |
| `js/views/sales.js` | Botón "Devolver" en tabla y detalle, modal de devolución, lógica UI |
| `js/controllers/ReportController.js` | `getProfitability()` descuenta devoluciones de revenue y costo |
| `index.html` | Scripts: `SaleReturnRepository.js`, `SaleReturnService.js`, `SaleReturn.js` |

---

## Validaciones implementadas

### En SaleReturnService.processReturn()

| Validación | Error lanzado |
|-----------|---------------|
| Venta no existe | "Venta no encontrada" |
| Sin ítems | "Debe seleccionar al menos un producto para devolver" |
| Producto no pertenece a la venta | "El producto #X no pertenece a la Venta #Y" |
| Cantidad excede lo devolvible | "No se puede devolver N de 'Producto'. Máximo: M" |
| Cantidades todas cero | "No hay ítems válidos para devolver" |

### Control de cantidades máximas

```
maxReturnable = vendidas_originalmente - ya_devueltas_en_devoluciones_previas
```

Ejemplo:
- Venta #42: Producto A x5
- Devolución #1: Producto A x2
- Devolución #2: Producto A máx devolvible = 5 - 2 = 3

---

## Integración con StockService

### Restauración de stock

Para cada ítem devuelto:
1. `Product.updateStock(productId, qty, 'add')` — restaura stock
2. `StockMovement.create({ type: 'return', quantity: +qty, reference: saleId })` — registra en kardex

### Rollback en caso de error

Si falla la restauración de stock del producto N:
- Se revierte la restauración de los productos 1..N-1
- Se lanza error con mensaje descriptivo
- La devolución NO se crea

---

## Integración con rentabilidad

### ReportController.getProfitability()

```javascript
// C5: Descontar devoluciones del período
const returns = await SaleReturn.getByDateRange(startDate, endDate);
for (const ret of returns) {
    for (const item of ret.items) {
        totalReturnedRevenue += item.total;
        totalReturnedCost += costAtSale * quantity;
        // También se descuenta de productStats y categoryStats
    }
}
totalRevenue -= totalReturnedRevenue;
totalCostOfSales -= totalReturnedCost;
```

**Resultado:**
- `revenue` = ventas - devoluciones (neto)
- `costOfSales` = costo_ventas - costo_devuelto (neto)
- `grossProfit` = revenue - costOfSales (correcto)
- `totalReturns` = campo informativo nuevo en el objeto de retorno

### Fallback seguro

Si falla la consulta de devoluciones (store no existe en BD vieja), se continúa sin descontar. Error logueado a console.

---

## Interfaz de usuario

### Botón "Devolver" (↩️)

- Visible en cada fila de la tabla de ventas
- Visible en el footer del modal de detalle de venta

### Modal de devolución

| Elemento | Descripción |
|----------|-------------|
| Lista de productos | Solo productos con cantidad devolvible > 0 |
| Input de cantidad | Numérico, máximo = vendido - ya devuelto |
| Botón "Todo" | Rellena la cantidad máxima |
| Motivo | Campo de texto libre (máx 200 chars) |
| Total a devolver | Se actualiza en tiempo real |
| Confirmación | Dialog de confirmación antes de procesar |

### Vista de detalle con devoluciones

Cuando una venta tiene devoluciones registradas:
- Se muestra sección amarilla "Devoluciones Registradas"
- Lista cada devolución con: ID, fecha, ítems, total
- Muestra total acumulado de devoluciones

---

## Casos de prueba teóricos (NO EJECUTAR)

### CP-C5-01: Devolución parcial
- **Pre:** Venta #42 con Prod A x5
- **Acción:** Devolver Prod A x2, motivo "Defectuoso"
- **Esperado:** SaleReturn creado, stock Prod A +2, StockMovement tipo 'return' +2, AuditLog registrado
- **Venta original:** Sin cambios

### CP-C5-02: Devolución total
- **Pre:** Venta #42 con Prod A x5
- **Acción:** Devolver Prod A x5
- **Esperado:** SaleReturn creado con total = 5 * unitPrice, stock +5

### CP-C5-03: Devolución múltiple (acumulativa)
- **Pre:** Venta #42 con Prod A x5
- **Acción 1:** Devolver x2 → OK, max restante = 3
- **Acción 2:** Devolver x4 → ERROR "Máximo devolvible: 3"
- **Acción 3:** Devolver x3 → OK

### CP-C5-04: Todo devuelto → modal dice "ya devueltos"
- **Pre:** Venta #42 con Prod A x5, Devolución previa x5
- **Acción:** Abrir modal devolución
- **Esperado:** Notificación "Todos los productos ya han sido devueltos"

### CP-C5-05: Producto no de la venta
- **Pre:** Venta #42 con Prod A
- **Acción:** Intentar devolver Prod B (por API directa)
- **Esperado:** Error "El producto #B no pertenece a la Venta #42"

### CP-C5-06: Rentabilidad con devolución
- **Pre:** 1 venta de $10,000 (costo $5,000), 1 devolución de $2,000 (costo $1,000)
- **Esperado:** Revenue = $8,000, CostOfSales = $4,000, GrossProfit = $4,000

### CP-C5-07: Error en stock → rollback
- **Pre:** Venta con Prod A y Prod B
- **Acción:** Devolver ambos, pero Prod B falla (simulado)
- **Esperado:** Stock de Prod A revertido, SaleReturn NO creado

### CP-C5-08: Audit log
- **Pre:** Procesar devolución
- **Esperado:** AuditLog con entity='saleReturn', action='create', metadata con saleId, totalReturned, reason

### CP-C5-09: Kardex (movimientos de stock)
- **Pre:** Venta #42 vende Prod A x3, luego Devolución x1
- **Esperado en kardex:** Movimiento tipo 'return', qty +1, reference=42, reason contiene "Devolución Venta #42"

---

## Riesgos y limitaciones

### Riesgos mitigados

| Riesgo | Mitigación |
|--------|------------|
| Stock inconsistente por error parcial | Rollback implementado: revierte productos ya restaurados |
| Devolver más de lo vendido | Validación: maxReturnable = vendido - ya_devuelto |
| Devolución duplicada accidental | Dialog de confirmación + botón se desactiva durante procesamiento |
| BD antigua sin store saleReturns | Migración automática en versión 19 + fallback en reportes |
| Reporte sin considerar devoluciones | getProfitability() descuenta automáticamente |

### Limitaciones (NO corregidas en esta fase)

| Limitación | Razón |
|------------|-------|
| No hay reembolso monetario registrado | Fuera del alcance — requeriría integración con pagos/caja |
| La venta original no cambia de estado | Diseño intencional — la devolución es un evento separado |
| No se puede devolver una venta eliminada | Diseño intencional — Sale.delete() es destructivo |
| No hay devoluciones de compras | Fuera del alcance de C5 |
| El reporte de ventas diarias no descuenta devoluciones | Solo getProfitability() las descuenta — otros reportes son de facturación |
| No hay interfaz para ver todas las devoluciones | Se puede agregar en fase futura — ahora se ven por venta |

---

## Condición final

- NO se modifican ventas existentes
- NO se borran ventas
- NO se editan ítems históricos
- NO se recalcula stock histórico
- NO se rompen reportes (se integra correctamente)
- NO se introducen notas de crédito externas
- Las devoluciones son eventos nuevos e inmutables
- Se usa StockService para devolver stock
- Se registran movimientos en kardex (tipo 'return')
- Se registra audit log
- Se integra con rentabilidad correctamente
- 0 errores de linter
- Documentación generada para auditor externo
