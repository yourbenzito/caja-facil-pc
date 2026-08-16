# FASE C2 — AUDIT LOG CENTRALIZADO

**Sistema:** POS Minimarket Chile  
**Motor:** IndexedDB (Electron / Browser)  
**Versión BD:** 17 → 18  
**Fecha de ejecución:** 2026-02-09  
**Fases previas:**  
- `FASE_A_ERRORES_CRITICOS_BD.md` (cerrada)  
- `FASE_B_PROBLEMAS_IMPORTANTES_BD.md` (cerrada)  
- `FASE_C1_SOFT_DELETE.md` (cerrada)  

---

## OBJETIVO

Implementar un sistema de audit log centralizado que registre las acciones críticas de escritura del sistema (creación, edición, desactivación, restauración) sin modificar el comportamiento funcional existente.

El audit log responde a las preguntas:
- **Quién** realizó la acción (usuario autenticado)
- **Qué** se hizo (acción y resumen)
- **Cuándo** ocurrió (timestamp ISO 8601)
- **Sobre qué** entidad e ID específico
- **Con qué datos** relevantes (metadata liviana)

---

## DISEÑO DEL AUDIT LOG

### Object Store: `auditLogs`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `number` (auto) | ID del registro de auditoría |
| `entity` | `string` | Tipo de entidad: `product`, `customer`, `supplier`, `sale` |
| `entityId` | `number\|null` | ID del registro afectado |
| `action` | `string` | Acción: `create`, `update`, `softDelete`, `restore` |
| `summary` | `string` | Descripción legible de la acción |
| `metadata` | `object` | Datos relevantes (liviano, no el objeto completo) |
| `userId` | `number\|null` | ID del usuario que realizó la acción |
| `username` | `string` | Nombre del usuario (fallback: `'sistema'`) |
| `timestamp` | `string` | Fecha ISO 8601 |

### Índices

| Índice | Campo | Propósito |
|--------|-------|-----------|
| `entity` | `entity` | Filtrar por tipo de entidad |
| `entityId` | `entityId` | Historial de un registro específico |
| `timestamp` | `timestamp` | Ordenar cronológicamente |
| `userId` | `userId` | Filtrar por usuario |
| `action` | `action` | Filtrar por tipo de acción |

### Principio de seguridad fundamental

```
AuditLogService.log() NUNCA lanza error.
Todo se captura en try/catch interno.
La operación principal SIEMPRE continúa.
```

Esto garantiza que un fallo en el audit log (por ejemplo, disco lleno, error de IndexedDB) no bloquea una venta, edición o cualquier operación del negocio.

### Detección automática de usuario

```javascript
// El servicio detecta el usuario autenticado automáticamente
try {
    const user = AuthManager.getCurrentUser(); // { id, username, role }
    resolvedUserId = user.id;
    resolvedUsername = user.username;
} catch (_) {
    // Fallback: userId = null, username = 'sistema'
}
```

Si `AuthManager` no está disponible (por ejemplo, durante la inicialización), se usa el fallback `'sistema'`.

---

## ENTIDADES Y ACCIONES CUBIERTAS

### Product

| Acción | Momento del log | Metadata |
|--------|----------------|----------|
| `create` | Después de `repository.create()` | `name`, `barcode`, `price`, `cost`, `stock` |
| `update` | Después de `repository.update()` | `changedFields`, `id` |
| `softDelete` | Después de `repository.replace()` | `name`, `stock`, `previousState: 'active'` |
| `restore` | Después de `repository.replace()` | `name`, `previousState: 'inactive'`, `deletedAt` |

**NO se loguea:** Cambios de stock por flujo interno (`updateStock`, `updateCostWithAverage`), importación masiva individual.

### Customer

| Acción | Momento del log | Metadata |
|--------|----------------|----------|
| `create` | Después de `repository.create()` | `name`, `phone`, `creditLimit` |
| `update` | Después de `repository.update()` | `changedFields`, `id` |
| `softDelete` | Después de `repository.replace()` | `name`, `previousState: 'active'` |
| `restore` | Después de `repository.replace()` | `name`, `previousState: 'inactive'`, `deletedAt` |

**NO se loguea:** Updates internos de `balanceCredit` (flujo de crédito/pagos — son cambios de alta frecuencia que saturarían el log).

### Supplier

| Acción | Momento del log | Metadata |
|--------|----------------|----------|
| `create` | Después de `repository.create()` | `name`, `contact`, `phone` |
| `update` | Después de `repository.update()` | `changedFields`, `id` |
| `softDelete` | Después de `repository.replace()` | `name`, `previousState: 'active'` |
| `restore` | Después de `repository.replace()` | `name`, `previousState: 'inactive'`, `deletedAt` |

### Sale

| Acción | Momento del log | Metadata |
|--------|----------------|----------|
| `create` | Después de la transacción atómica | `saleNumber`, `total`, `status`, `paymentMethod`, `customerId`, `itemCount` |
| `update` | Después de `repository.replace()` | `saleNumber`, `changedFields`, `newTotal`, `newStatus`, `newPaidAmount` |

**NO se loguea:** `registerPayment` (los pagos tienen su propia tabla `payments`), `updateStatus`/`updateCustomerId`/`updatePaymentMethod` (helper methods internos de bajo nivel).

---

## AuditLogService — API

### Métodos disponibles

```javascript
// Registrar (NUNCA falla, NUNCA bloquea)
AuditLogService.log({ entity, entityId, action, summary, metadata, userId });

// Consulta (para futuras vistas de administración)
AuditLogService.getAll();              // Todos, ordenados por fecha desc
AuditLogService.getByEntity('product');    // Filtrar por tipo
AuditLogService.getByEntityId(42);     // Historial de un registro
AuditLogService.getByUser(1);          // Acciones de un usuario
AuditLogService.count();               // Total de logs
```

### Ubicación del archivo

`js/services/AuditLogService.js` — se carga **antes** de los demás servicios y modelos en `index.html`.

---

## CASOS DE USO (Pruebas Teóricas)

### Caso 1: Crear producto
- **Acción:** Crear producto "Coca Cola 1.5L"
- **Log esperado:**
  ```json
  {
    "entity": "product",
    "entityId": 123,
    "action": "create",
    "summary": "Producto creado: \"Coca Cola 1.5L\"",
    "metadata": { "name": "Coca Cola 1.5L", "barcode": "7790001", "price": 1500, "cost": 1000, "stock": 50 },
    "userId": 1,
    "username": "admin",
    "timestamp": "2026-02-09T..."
  }
  ```

### Caso 2: Desactivar producto
- **Log esperado:**
  ```json
  {
    "entity": "product",
    "action": "softDelete",
    "summary": "Producto desactivado: \"Coca Cola 1.5L\"",
    "metadata": { "name": "Coca Cola 1.5L", "stock": 0, "previousState": "active" }
  }
  ```

### Caso 3: Restaurar producto
- **Log esperado:**
  ```json
  {
    "entity": "product",
    "action": "restore",
    "summary": "Producto restaurado: \"Coca Cola 1.5L\"",
    "metadata": { "name": "Coca Cola 1.5L", "previousState": "inactive", "deletedAt": "2026-02-09T..." }
  }
  ```

### Caso 4: Editar cliente
- **Log esperado:**
  ```json
  {
    "entity": "customer",
    "action": "update",
    "summary": "Cliente #5 actualizado (name, phone)",
    "metadata": { "changedFields": ["name", "phone"], "id": 5 }
  }
  ```

### Caso 5: Crear venta
- **Log esperado:**
  ```json
  {
    "entity": "sale",
    "action": "create",
    "summary": "Venta #142 creada — Total: 15000, Estado: completed",
    "metadata": { "saleNumber": 142, "total": 15000, "status": "completed", "paymentMethod": "cash", "customerId": null, "itemCount": 3 }
  }
  ```

### Caso 6: Error interno en audit log
- **Acción:** `db.add('auditLogs', ...)` falla por cualquier razón
- **Resultado:** Error capturado por `console.error`. La operación principal (crear producto, venta, etc.) **continúa sin interrupción.**
- **Verificación:** El producto/venta se crea correctamente aunque el log no se haya guardado.

---

## RIESGOS Y LIMITACIONES

### Riesgos bajos

1. **Crecimiento del store:** El `auditLogs` crecerá indefinidamente. Con uso normal (~100 logs/día) esto no es problema en IndexedDB, pero en sistemas muy activos se debería considerar una política de retención futura.

2. **No hay UI de consulta aún.** Los logs se pueden consultar programáticamente (`AuditLogService.getAll()`) pero no hay vista de administración. Queda para una fase posterior.

3. **Metadata no incluye valores anteriores para update.** Solo se registran los `changedFields` (nombres de campos), no sus valores anteriores/nuevos. Esto se decidió para mantener el log liviano y porque leer el registro previo añadiría una query extra por cada update.

### Limitaciones conocidas

1. **No se loguean operaciones internas de stock.** Los cambios de stock por ventas, compras, ajustes tienen su propia trazabilidad en `stockMovements`. El audit log se centra en acciones explícitas del usuario.

2. **No se loguean pagos.** Los pagos tienen su propia tabla `payments` con trazabilidad completa. Loguearlos en audit sería redundante.

3. **No hay permisos ni roles.** Todos los usuarios pueden generar cualquier acción. El control de permisos queda para una fase futura.

4. **No es inmutable a nivel de IndexedDB.** Técnicamente alguien con acceso directo a la BD podría modificar los logs. La verdadera inmutabilidad requeriría firma criptográfica o almacenamiento externo, fuera de alcance.

---

## QUÉ SE PUEDE AUDITAR DESDE AHORA

| Pregunta | Cómo responderla |
|----------|-----------------|
| ¿Quién creó este producto? | `AuditLogService.getByEntityId(productId)` → buscar `action: 'create'` |
| ¿Cuándo se desactivó este cliente? | `AuditLogService.getByEntityId(clientId)` → buscar `action: 'softDelete'` |
| ¿Qué hizo el usuario "admin" hoy? | `AuditLogService.getByUser(userId)` → filtrar por fecha |
| ¿Cuántas ventas se crearon esta semana? | `AuditLogService.getByEntity('sale')` → filtrar por timestamp |
| ¿Se editó esta venta después de crearla? | `AuditLogService.getByEntityId(saleId)` → buscar `action: 'update'` |
| ¿Quién restauró este proveedor? | `AuditLogService.getByEntityId(supplierId)` → buscar `action: 'restore'` |

---

## ARCHIVOS MODIFICADOS / CREADOS

| Archivo | Cambios |
|---------|---------|
| `js/db.js` | Versión 17→18, +store `auditLogs` con 5 índices |
| `js/services/AuditLogService.js` | **NUEVO** — Servicio de audit log |
| `index.html` | +script `AuditLogService.js` |
| `js/models/Product.js` | +`AuditLogService.log()` en create, update, softDelete, restore |
| `js/models/Customer.js` | +`AuditLogService.log()` en create, update, softDelete, restore |
| `js/models/Supplier.js` | +`AuditLogService.log()` en create, update, softDelete, restore |
| `js/services/SaleService.js` | +`AuditLogService.log()` en createSale |
| `js/models/Sale.js` | +`AuditLogService.log()` en updateSale |

## VERIFICACIONES POST-IMPLEMENTACIÓN

- [x] Linter: 0 errores en todos los archivos modificados
- [ ] La app arranca correctamente (migración BD 17→18)
- [ ] Crear producto → audit log creado con datos correctos
- [ ] Editar producto → audit log con changedFields
- [ ] Desactivar producto → audit log con previousState
- [ ] Restaurar producto → audit log con previousState + deletedAt
- [ ] Crear/editar cliente → audit logs correspondientes
- [ ] Crear/editar proveedor → audit logs correspondientes
- [ ] Crear venta → audit log con saleNumber, total, status
- [ ] Editar venta → audit log con changedFields
- [ ] Error en AuditLogService → operación principal no se interrumpe

## LO QUE NO SE TOCÓ EN ESTA FASE

- Vista de administración de audit logs (UI)
- Permisos y roles
- Logueo de pagos, compras, movimientos de stock, gastos
- Política de retención / limpieza de logs antiguos
- Inmutabilidad criptográfica
- Export de audit logs

---

*Documento generado para revisión de auditor externo.*
