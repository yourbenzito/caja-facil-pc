# FASE C6 — PAGOS A PROVEEDORES

**Estado:** COMPLETADA  
**Fecha:** 2026-02-08  
**Autor:** Desarrollador Senior (asistido por IA)

---

## 📌 Objetivo

Implementar un sistema de **pagos a proveedores** contablemente correcto, separando claramente:

- **Compra** = obligación (deuda/cuentas por pagar)
- **Pago** = evento de caja (reduce deuda)
- **Deuda** = total compras − total pagos

Los pagos se registran como **eventos inmutables** (nunca se editan ni eliminan), siguiendo el mismo patrón de diseño que `SaleReturn` (Fase C5) y `Payment` (pagos de clientes).

---

## 🔍 Problema Original

### Antes de C6

El sistema solo tenía un campo `paidAmount` en cada `Purchase` que se mutaba cada vez que se registraba un pago:

```javascript
// Purchase.registerPayment() — ANTES
const newPaidAmount = (parseFloat(purchase.paidAmount) || 0) + paymentAmount;
await this._repository.replace({ ...purchase, paidAmount: newPaidAmount });
```

**Problemas:**

1. **Sin trazabilidad**: No había registro de cuándo, cuánto, ni con qué método se pagó.
2. **Sin auditoría**: Imposible saber quién registró cada pago.
3. **Dato mutable**: `paidAmount` se sobreescribía, perdiendo el historial.
4. **Sin separación contable**: Compra y pago eran el mismo registro.
5. **Sin método de pago**: No se registraba si fue efectivo, transferencia, etc.

---

## 🧠 Diseño Implementado

### Nueva Entidad: `SupplierPayment`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | number (auto) | ID único del pago |
| `supplierId` | number | ID del proveedor |
| `purchaseId` | number \| null | ID de compra asociada (nullable para pagos generales) |
| `date` | ISO string | Fecha/hora del pago |
| `amount` | number | Monto pagado |
| `method` | string | `cash` \| `transfer` \| `other` |
| `reference` | string | Referencia/comprobante |
| `notes` | string | Notas adicionales |
| `createdAt` | ISO string | Timestamp de creación |
| `createdBy` | number \| null | ID del usuario que registró (C3) |

### Reglas de Inmutabilidad

- Los pagos **NO se editan** ni **eliminan**.
- Cada pago es un evento independiente.
- Un pago puede ir vinculado a una compra específica (`purchaseId`) o ser un pago general al proveedor (`purchaseId = null`).

### Cálculo de Deuda

```
Deuda proveedor = Σ total_compras − Σ pagos_registrados
```

**Compatibilidad con datos antiguos:** Para compras que ya tienen `paidAmount` mutado (pre-C6), se usa `Math.max(paidAmount_legacy, pagos_registrados)` para evitar doble conteo.

---

## 📁 Archivos Creados

| Archivo | Descripción |
|---------|-------------|
| `js/repositories/SupplierPaymentRepository.js` | Repository con métodos por índice: `findBySupplierId`, `findByPurchaseId`, `findByDateRange` |
| `js/models/SupplierPayment.js` | Modelo inmutable con `create`, `getBySupplier`, `getByPurchase`, `getTotalPaidToSupplier`, `getTotalPaidForPurchase` |
| `js/services/SupplierPaymentService.js` | Servicio de negocio: `registerPayment`, `getSupplierDebt`, `getDebtDetail`, `getAccountsPayableSummary` |

## 📁 Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `js/db.js` | Versión 19→20, nuevo store `supplierPayments` con indexes (`supplierId`, `purchaseId`, `date`) |
| `index.html` | Registrar scripts de Repository, Service y Model |
| `js/views/purchases.js` | Formulario de pago mejorado (método, referencia, notas, historial de pagos), cálculo de cuentas por pagar usando deuda real |
| `js/views/suppliers.js` | Columna "Deuda" en tabla, botones "Pagar" y "Pagos", modales de pago y historial |

---

## 🔗 Integraciones

### C2 — Audit Log
Cada pago registrado genera un evento de auditoría:
```javascript
AuditLogService.log({
    entity: 'supplierPayment', entityId: id, action: 'create',
    summary: `Pago a proveedor #${supplierId} registrado — ${amount} (${method})`,
    metadata: { supplierId, purchaseId, amount, method, reference }
});
```

### C3 — Trazabilidad
Cada pago incluye `createdBy: AuditLogService.getCurrentUserId()`.

### Compatibilidad con Purchase.paidAmount
Para mantener la UI existente funcionando, al registrar un pago vinculado a una compra, se actualiza `Purchase.paidAmount` y `Purchase.status` como antes. Esto es una medida de compatibilidad que no bloquea si falla.

---

## 🧪 Casos de Uso

### 1. Pago vinculado a compra específica
- Usuario selecciona compra pendiente
- Se valida que el monto no exceda el saldo de ESA compra
- Se crea registro de pago inmutable
- Se actualiza `Purchase.paidAmount` (compatibilidad)
- Se registra audit log

### 2. Pago general al proveedor
- Usuario NO selecciona compra
- Se registra como pago general (`purchaseId = null`)
- El monto se descuenta de la deuda total del proveedor
- Si excede la deuda, se permite (anticipo) con advertencia en consola

### 3. Consultar deuda de proveedor
- Se calcula dinámicamente: `total_compras − max(legacy_paid, registered_paid) − pagos_generales`
- Se muestra en la tabla de proveedores y en modales

### 4. Ver historial de pagos
- Modal con tabla detallada: fecha, monto, método, compra asociada, referencia, notas
- Totales de pagado y deuda pendiente

### 5. Pago desde vista de compra
- Botón "Pagar" en cada compra pendiente
- Formulario completo con método, referencia, notas
- Muestra historial de pagos previos de esa compra

---

## ⚠️ Riesgos y Limitaciones

### Riesgo 1: Datos legacy
**Problema:** Las compras anteriores a C6 tienen `paidAmount` mutado sin registro de pagos.
**Mitigación:** El cálculo de deuda usa `Math.max(legacyPaid, registeredPaid)` para compatibilidad.

### Riesgo 2: Pagos inmutables
**Problema:** Si se registra un pago erróneo, no se puede editar ni eliminar.
**Decisión:** Esto es por diseño contable. En el futuro se podría agregar un "pago de ajuste" negativo.

### Riesgo 3: Pagos generales
**Problema:** Un pago general no se puede vincular retrospectivamente a una compra.
**Mitigación:** Se recomienda siempre vincular a compra cuando sea posible.

---

## ✅ Qué queda protegido

1. **Trazabilidad completa** de cada pago: quién, cuándo, cuánto, cómo, a qué compra.
2. **Deuda calculada dinámicamente** en lugar de depender de un campo mutable.
3. **Compatibilidad** total con compras existentes (no se modifica ni elimina ninguna compra).
4. **Auditoría** de cada pago registrado (C2 audit log).
5. **Separación contable** entre obligación (compra) y evento de pago.

---

## ❌ Qué NO se implementó (fuera de alcance)

1. Eliminación/edición de pagos (inmutables por diseño).
2. Anticipo con saldo a favor del proveedor (solo advertencia).
3. Integración con caja registradora (flujo de egresos).
4. Notas de crédito por devolución a proveedores.
5. Reporte de cuentas por pagar en `ReportController` (se puede agregar en futuras fases).

---

## 📊 Resumen de Impacto

| Aspecto | Antes | Después |
|---------|-------|---------|
| Registro de pago | Mutación de `paidAmount` | Evento inmutable `SupplierPayment` |
| Trazabilidad | Ninguna | Fecha, monto, método, referencia, usuario |
| Deuda | Campo estático | Cálculo dinámico con compatibilidad legacy |
| Auditoría | No | Sí (C2 audit log) |
| UI proveedores | Solo nombre/contacto | + Deuda, pagos, historial |
| UI compras | Pago simple (monto) | + Método, referencia, notas, historial |

---

*Documento generado para revisión por auditor externo.*
