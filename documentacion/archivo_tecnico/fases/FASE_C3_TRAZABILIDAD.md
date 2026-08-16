# FASE C3 — TRAZABILIDAD DIRECTA (`createdBy` / `updatedBy`)

**Fecha:** 2026-02-08  
**Autor:** Desarrollo Senior — Auditoría y Trazabilidad  
**Estado:** ✅ IMPLEMENTADA  
**Fases previas cerradas:** A (errores críticos), B (problemas importantes), C1 (soft delete), C2 (audit log)

---

## 📌 Objetivo

Agregar campos de trazabilidad directa (`createdBy`, `updatedBy`) en las entidades clave del sistema, permitiendo saber **qué usuario** creó o modificó por última vez un registro, sin romper compatibilidad con datos existentes.

---

## 🧠 Diseño

### Helper centralizado

Se agregó un método estático `getCurrentUserId()` en `AuditLogService` que:

- Devuelve `user.id` (número) si hay un usuario autenticado via `AuthManager.getCurrentUser()`
- Devuelve `null` si no hay sesión activa (bootstrap, scripts, migración)
- **NUNCA** lanza error — cualquier excepción interna es atrapada silenciosamente

```javascript
// AuditLogService.getCurrentUserId()
static getCurrentUserId() {
    try {
        if (typeof AuthManager !== 'undefined' && AuthManager.getCurrentUser) {
            const user = AuthManager.getCurrentUser();
            return user ? (user.id || null) : null;
        }
    } catch (_) { /* fallback silencioso */ }
    return null;
}
```

**Justificación:** Se eligió `AuditLogService` como ubicación porque:
1. Ya tiene lógica de resolución de usuario (C2)
2. Se carga antes que los modelos en `index.html`
3. Centraliza la dependencia en un solo punto
4. Es coherente con el patrón de trazabilidad establecido

### Campos agregados

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `createdBy` | `number \| null` | `null` | ID del usuario que creó el registro |
| `updatedBy` | `number \| null` | `null` | ID del último usuario que modificó el registro |

### Reglas de asignación

| Operación | `createdBy` | `updatedBy` |
|-----------|-------------|-------------|
| **create** | `getCurrentUserId()` | `getCurrentUserId()` |
| **update** | — (no se toca) | `getCurrentUserId()` |
| **softDelete** | — (no se toca) | `getCurrentUserId()` |
| **restore** | — (no se toca) | `getCurrentUserId()` |
| **updateStock** | — (no se toca) | `getCurrentUserId()` |
| **adjustPrice** | — (no se toca) | `getCurrentUserId()` |
| **updateCostWithAverage** | — (no se toca) | `getCurrentUserId()` |

---

## 🔍 Entidades y métodos afectados

### Product (`js/models/Product.js`)

| Método | `createdBy` | `updatedBy` | Notas |
|--------|-------------|-------------|-------|
| `create()` | ✅ | ✅ | Ambos al momento de creación |
| `update()` | — | ✅ | Inyectado en `data` antes de `_repository.update()` |
| `softDelete()` | — | ✅ | En el objeto `updated` antes de `_repository.replace()` |
| `restore()` | — | ✅ | En el objeto `updated` antes de `_repository.replace()` |
| `updateStock()` | — | ✅ | Registra quién cambió stock (venta, compra, ajuste) |
| `adjustPrice()` | — | ✅ | Registra quién ajustó precio |
| `updateCostWithAverage()` | — | ✅ | Registra quién actualizó costo promedio (compra) |

### Customer (`js/models/Customer.js`)

| Método | `createdBy` | `updatedBy` | Notas |
|--------|-------------|-------------|-------|
| `create()` | ✅ | ✅ | También se agregó `updatedAt` en create (faltaba) |
| `update()` | — | ✅ | Inyectado en `updateData` antes de `_repository.update()` |
| `softDelete()` | — | ✅ | También se agregó `updatedAt` (faltaba en C1) |
| `restore()` | — | ✅ | También se agregó `updatedAt` (faltaba en C1) |

### Supplier (`js/models/Supplier.js`)

| Método | `createdBy` | `updatedBy` | Notas |
|--------|-------------|-------------|-------|
| `create()` | ✅ | ✅ | También se agregó `updatedAt` en create (faltaba) |
| `update()` | — | ✅ | Inyectado en `data` antes de `_repository.update()` |
| `softDelete()` | — | ✅ | También se agregó `updatedAt` (faltaba en C1) |
| `restore()` | — | ✅ | También se agregó `updatedAt` (faltaba en C1) |

### Sale (`js/services/SaleService.js` + `js/models/Sale.js`)

| Método | `createdBy` | `updatedBy` | Notas |
|--------|-------------|-------------|-------|
| `SaleService.createSale()` | ✅ | ✅ | En el objeto sale antes de la transacción atómica |
| `Sale.updateSale()` | — | ✅ | En el objeto `updated` antes de `_repository.replace()` |

---

## 🔄 Compatibilidad con datos existentes

### Garantía: CERO migración necesaria

Los registros existentes **NO tienen** campos `createdBy` / `updatedBy`. Esto es **100% compatible** porque:

1. **JavaScript trata `undefined` y `null` como equivalentes** en comparaciones loose
2. Al leer un registro existente, `record.createdBy` será `undefined` → se interpreta como "dato anterior a C3"
3. Al editar un registro existente, `updatedBy` se asignará con el usuario actual → comienza la trazabilidad desde ese momento
4. `createdBy` de registros existentes **NUNCA** se modifica retroactivamente
5. No se requieren cambios en `db.js` (no se necesitan índices nuevos para estos campos)

### Flujos NO afectados

| Flujo | Impacto |
|-------|---------|
| Ventas (creación, edición, eliminación) | ✅ Ninguno — campos son aditivos |
| Compras (creación, edición) | ✅ Ninguno — no se modificó Purchase |
| Reportes (rentabilidad, stock, ventas) | ✅ Ninguno — campos no participan en cálculos |
| Pagos (registro, recálculo) | ✅ Ninguno — no se modificó Payment |
| Movimientos de stock | ✅ Ninguno — no se modificó StockMovement |
| Crédito de clientes | ✅ Ninguno — no se modificó CustomerCreditDeposit/Use |
| Backup/Restore | ✅ Ninguno — campos se serializan como cualquier otro |
| UI (listados, formularios, modales) | ✅ Ninguno — campos no se renderizan |

---

## 🧪 Casos de prueba teóricos

### CP-C3-01: Crear producto con sesión activa
- **Pre:** Usuario "admin" (id: 1) autenticado
- **Acción:** Crear producto "Test"
- **Esperado:** `createdBy: 1`, `updatedBy: 1`

### CP-C3-02: Editar producto con sesión activa
- **Pre:** Producto existente (createdBy: 1), usuario "cajero" (id: 2) autenticado
- **Acción:** Editar nombre del producto
- **Esperado:** `createdBy: 1` (no cambió), `updatedBy: 2`

### CP-C3-03: Crear producto sin sesión (bootstrap)
- **Pre:** No hay usuario autenticado
- **Acción:** Crear producto (import, script)
- **Esperado:** `createdBy: null`, `updatedBy: null`

### CP-C3-04: Soft delete con sesión
- **Pre:** Producto activo, usuario "admin" (id: 1) autenticado
- **Acción:** Desactivar producto
- **Esperado:** `updatedBy: 1`

### CP-C3-05: Restaurar con sesión
- **Pre:** Producto inactivo, usuario "admin" (id: 1) autenticado
- **Acción:** Restaurar producto
- **Esperado:** `updatedBy: 1`

### CP-C3-06: Dato existente sin campos C3
- **Pre:** Producto creado antes de C3 (sin `createdBy`/`updatedBy`)
- **Acción:** Leer producto
- **Esperado:** `createdBy: undefined`, `updatedBy: undefined` — sin error

### CP-C3-07: Editar dato existente sin campos C3
- **Pre:** Producto creado antes de C3, usuario "admin" (id: 1) autenticado
- **Acción:** Editar producto
- **Esperado:** `createdBy: undefined` (no se modifica), `updatedBy: 1` (comienza trazabilidad)

### CP-C3-08: Crear venta con sesión
- **Pre:** Usuario "cajero" (id: 2) autenticado
- **Acción:** Crear venta
- **Esperado:** `createdBy: 2`, `updatedBy: 2`

### CP-C3-09: Editar venta con sesión
- **Pre:** Venta existente (createdBy: 2), usuario "admin" (id: 1)
- **Acción:** Editar venta
- **Esperado:** `createdBy: 2` (no cambia), `updatedBy: 1`

---

## ⚠️ Riesgos y limitaciones

### Riesgos mitigados

| Riesgo | Mitigación |
|--------|------------|
| Sin sesión activa → campo null | `getCurrentUserId()` devuelve `null` — campo queda como "no determinado" |
| Error en AuthManager | `try/catch` silencioso — operación principal NO afectada |
| Datos existentes sin campos | JavaScript trata `undefined` como ausente — no causa errores |
| BaseRepository.update() sobreescribe | `updatedBy` se inyecta en `data` ANTES de llamar al repositorio |

### Limitaciones conocidas (NO corregidas en esta fase)

| Limitación | Razón |
|------------|-------|
| `Purchase` no tiene `createdBy`/`updatedBy` | Fuera del alcance de C3 — no se pidió explícitamente |
| `Payment` no tiene `createdBy`/`updatedBy` | Fuera del alcance de C3 |
| `StockMovement` no tiene `createdBy` | Ya tiene contexto via tipo y referencia |
| No hay índice por `createdBy`/`updatedBy` | No se necesitan queries por estos campos aún |
| No se puede consultar "todo lo que creó usuario X" eficientemente | Requeriría índices — fase futura |
| El campo `updatedBy` refleja el último editor, no un historial | El historial completo está en `auditLogs` (C2) |
| No se valida que el `userId` exista en la tabla `users` | Innecesario — es solo referencia informativa |

---

## ✅ Qué queda protegido a partir de ahora

### Trazabilidad directa

A partir de esta implementación:

1. **Cada nuevo producto, cliente, proveedor y venta** tiene registrado quién lo creó (`createdBy`)
2. **Cada modificación, desactivación y restauración** tiene registrado quién la hizo (`updatedBy`)
3. **El campo `createdBy` es inmutable** — una vez asignado al crear, nunca se sobrescribe
4. **La resolución de usuario es segura** — si falla o no hay sesión, el campo es `null` (no bloquea)

### Complemento con C2 (Audit Log)

| Pregunta | Respuesta |
|----------|-----------|
| ¿Quién creó este producto? | `product.createdBy` → rápido, directo |
| ¿Quién fue el último que lo editó? | `product.updatedBy` → rápido, directo |
| ¿Qué cambios se hicieron y cuándo? | `AuditLogService.getByEntityId('product', id)` → historial completo |

---

## 📂 Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `js/services/AuditLogService.js` | `+getCurrentUserId()` — helper centralizado |
| `js/models/Product.js` | `+createdBy/updatedBy` en create, update, softDelete, restore, updateStock, adjustPrice, updateCostWithAverage |
| `js/models/Customer.js` | `+createdBy/updatedBy` en create, update, softDelete, restore. `+updatedAt` en create, softDelete, restore |
| `js/models/Supplier.js` | `+createdBy/updatedBy` en create, update, softDelete, restore. `+updatedAt` en create, softDelete, restore |
| `js/services/SaleService.js` | `+createdBy/updatedBy` en createSale |
| `js/models/Sale.js` | `+updatedBy` en updateSale |

### Verificación de linter

Todos los archivos modificados pasaron la verificación de linter sin errores.

---

## 🔒 Condición final

- ✅ NO se migraron datos existentes
- ✅ NO se recalculó información histórica
- ✅ NO se implementaron permisos
- ✅ NO se cambió lógica de negocio
- ✅ NO se rompieron reportes ni UI
- ✅ Fallback seguro si no hay usuario autenticado
- ✅ Los campos pueden ser `null`
- ✅ Documentación generada para auditor externo
