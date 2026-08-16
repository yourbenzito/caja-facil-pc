# FASE C1 — IMPLEMENTACIÓN DE SOFT DELETE (Borrado Lógico)

**Sistema:** POS Minimarket Chile  
**Motor:** IndexedDB (Electron / Browser)  
**Fecha de ejecución:** 2026-02-09  
**Fases previas:**  
- `FASE_A_ERRORES_CRITICOS_BD.md` (cerrada)  
- `FASE_B_PROBLEMAS_IMPORTANTES_BD.md` (cerrada)  

---

## OBJETIVO

Implementar borrado lógico (soft delete) para las entidades **Product**, **Customer** y **Supplier**, de forma que:

- Los registros **nunca se eliminen físicamente** de la base de datos
- Se preserven para auditoría, reportes y consultas históricas
- Dejen de aparecer en listados normales y flujos operativos (ventas, compras, POS)
- Se puedan restaurar en cualquier momento

---

## ENTIDADES AFECTADAS

| Entidad | Modelo | Repositorio | Vista | Controlador |
|---------|--------|-------------|-------|-------------|
| Producto | `js/models/Product.js` | `js/repositories/productRepository.js` | `js/views/products.js` | `js/controllers/ProductController.js` |
| Cliente | `js/models/Customer.js` | `js/repositories/CustomerRepository.js` | `js/views/customers.js` | `js/controllers/CustomerController.js` |
| Proveedor | `js/models/Supplier.js` | `js/repositories/SupplierRepository.js` | `js/views/suppliers.js` | `js/controllers/SupplierController.js` |

---

## DISEÑO DE SOFT DELETE

### Campos agregados a cada registro

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `isActive` | `boolean` | `true` (implícito) | `false` = desactivado |
| `deletedAt` | `string (ISO)` \| `null` | `null` | Fecha de desactivación |

### Compatibilidad con datos existentes

Los registros existentes **NO tienen** `isActive` ni `deletedAt`. El filtro usa `isActive !== false` (no `isActive === true`), lo que significa:

- Registros existentes sin campo `isActive` → se consideran **activos** (undefined !== false → true)
- Registros con `isActive: true` → activos
- Registros con `isActive: false` → inactivos

**NO se migran datos existentes.** No se recorren todos los registros para agregarles `isActive: true`. Esto es seguro e intencional.

### Flujo de desactivación

```
Usuario presiona "Desactivar"
    → Vista muestra confirm con advertencia clara
    → Modelo ejecuta softDelete(id):
        1. Leer registro actual
        2. Validar integridad (deuda, compras pendientes, etc.)
        3. Marcar: isActive = false, deletedAt = ISO date
        4. repository.replace(updated)
    → Controller muestra notificación: "Desactivado"
    → Vista se refresca (registro desaparece del listado)
```

### Flujo de restauración

```
Usuario abre modal "Desactivados"
    → Vista llama getDeleted() para listar inactivos
    → Usuario presiona "Restaurar"
    → Modelo ejecuta restore(id):
        1. Leer registro por ID (findById, sin filtro)
        2. Verificar que isActive === false
        3. Marcar: isActive = true, deletedAt = null
        4. repository.replace(updated)
    → Controller muestra notificación: "Restaurado"
    → Lista se actualiza
```

---

## CAPA DE REPOSITORIO

### Cambios en cada repositorio (Product, Customer, Supplier)

| Método | Comportamiento |
|--------|---------------|
| `findAll()` | **Override:** `super.findAll().filter(r => r.isActive !== false)` — excluye inactivos |
| `findAllIncludingDeleted()` | **Nuevo:** `super.findAll()` — todos los registros (para reportes, backup) |
| `findDeleted()` | **Nuevo:** `super.findAll().filter(r => r.isActive === false)` — solo inactivos |
| `findById(id)` | **Sin cambio.** Hereda de `BaseRepository` — acceso directo por ID, NO filtra soft delete |
| `search(term)` | **Sin cambio explícito.** Llama a `this.findAll()` que ya filtra |
| `findByBarcode(barcode)` | **Sin cambio.** Accede por índice, puede encontrar inactivos (necesario para importación) |

### Consecuencias automáticas

Todas las llamadas existentes a `Model.getAll()` → `repository.findAll()` automáticamente filtran inactivos:
- Vista de Productos: `Product.getAll()` — solo activos
- Vista de Clientes: `Customer.getAll()` — solo activos
- Vista de Proveedores: `Supplier.getAll()` — solo activos
- POS (selección de cliente): `Customer.getAll()` — solo activos
- Compras (selección de proveedor): `Supplier.getAll()` — solo activos
- Inventario: `Product.getAll()` — solo activos
- Ajuste de stock: `Product.getAll()` — solo activos

### Lo que NO se filtra (correcto)

- `Product.getById(id)` → acceso directo, devuelve producto aunque esté inactivo
  - Necesario para reportes de rentabilidad (`ReportController.getProfitability`)
  - Necesario para ventas históricas que referencian productos por ID
  - Necesario para movimientos de stock que referencian productos por ID
- `Product.getByBarcode(barcode)` → acceso por índice, puede devolver inactivos
  - Necesario para validación de duplicados en importación
- Backup (`db.getAll('products')`) → accede directamente a IndexedDB, incluye todo

---

## CAPA DE MODELO

### Product.js

| Método | Antes | Ahora |
|--------|-------|-------|
| `delete(id)` | Eliminación física con validaciones A4 | Redirige a `softDelete(id)` |
| `softDelete(id)` | No existía | Marca `isActive: false, deletedAt: ISO` |
| `restore(id)` | No existía | Marca `isActive: true, deletedAt: null` |
| `getAllIncludingDeleted()` | No existía | `repository.findAllIncludingDeleted()` |
| `getDeleted()` | No existía | `repository.findDeleted()` |

**Nota:** Las validaciones de integridad de Fase A4 (stock > 0, ventas asociadas, movimientos) ya NO se aplican en soft delete porque el registro no se elimina. El producto simplemente se desactiva.

### Customer.js

| Método | Antes | Ahora |
|--------|-------|-------|
| `delete(id)` | Eliminación física con validaciones de deuda | Redirige a `softDelete(id)` |
| `softDelete(id)` | No existía | Valida deuda/saldo → marca inactivo |
| `restore(id)` | No existía | Restaura a activo |

**Validaciones preservadas en softDelete:**
- Saldo pendiente > 0 → bloquea (debe liquidar deuda primero)
- Saldo a favor < 0 → bloquea (debe cancelar crédito primero)
- Ventas pendientes/parciales → bloquea

### Supplier.js

| Método | Antes | Ahora |
|--------|-------|-------|
| `delete(id)` | Eliminación física con validación B4 | Redirige a `softDelete(id)` |
| `softDelete(id)` | No existía | Valida compras pendientes → marca inactivo |
| `restore(id)` | No existía | Restaura a activo |

**Validaciones preservadas en softDelete:**
- Compras con saldo pendiente → bloquea (debe pagar primero)
- Compras históricas pagadas → **permite desactivar** (a diferencia de antes que bloqueaba eliminación)

---

## CAPA DE UI

### Cambios en botones

| Entidad | Antes | Ahora |
|---------|-------|-------|
| Producto (individual) | `Eliminar` (btn-danger) | `Desactivar` (btn-danger, tooltip explicativo) |
| Producto (masivo) | `Eliminar Seleccionados` | `Desactivar Seleccionados` |
| Cliente | `Eliminar` | `Desactivar` (tooltip explicativo) |
| Proveedor | `Eliminar` | `Desactivar` (tooltip explicativo) |

### Confirmaciones

Cada desactivación muestra un `confirm()` con mensaje claro:

```
¿Desactivar "Coca Cola 1.5L"?
El producto dejará de aparecer en ventas y listados, pero se preserva
para reportes históricos. Podrás restaurarlo luego desde "Desactivados".
```

### Botón "Desactivados"

Se agregó un botón `📋 Desactivados` en el encabezado de cada vista (Productos, Clientes, Proveedores) que abre un modal con:
- Lista de registros inactivos
- Fecha de desactivación
- Botón "Restaurar" por cada registro

### Notificaciones

| Acción | Mensaje |
|--------|---------|
| Desactivar producto | "Producto desactivado. Ya no aparecerá en listados ni ventas." |
| Restaurar producto | "Producto restaurado y activo nuevamente." |
| Desactivar cliente | "Cliente desactivado. Ya no aparecerá en listados ni ventas nuevas." |
| Restaurar cliente | "Cliente restaurado y activo nuevamente." |
| Desactivar proveedor | "Proveedor desactivado. Ya no aparecerá en listados ni compras nuevas." |
| Restaurar proveedor | "Proveedor restaurado y activo nuevamente." |

---

## CASOS DE USO (Pruebas Teóricas)

### Caso 1: Desactivar producto con ventas históricas
- **Acción:** Desactivar "Coca Cola 1.5L" que tiene 15 ventas y 20 movimientos de stock
- **Resultado:** Producto marcado como inactivo. Desaparece de listados y POS. Los reportes de rentabilidad siguen mostrándolo porque usan `getById()` que no filtra soft delete.
- **Verificación:** Reporte de rentabilidad → producto aparece con su nombre y datos correctos.

### Caso 2: Producto inactivo no aparece en venta nueva
- **Acción:** Abrir POS después de desactivar "Coca Cola 1.5L"
- **Resultado:** El producto NO aparece en la búsqueda del POS (usa `Product.getAll()` → filtra inactivos).
- **Verificación:** Buscar "Coca Cola" en POS → 0 resultados (si no hay otro producto con ese nombre).

### Caso 3: Restaurar producto
- **Acción:** Ir a Productos → "Desactivados" → "Restaurar" en "Coca Cola 1.5L"
- **Resultado:** Producto vuelve a aparecer en listados y POS con todos sus datos intactos (stock, precio, historial).

### Caso 4: Desactivar cliente con deuda pendiente
- **Acción:** Intentar desactivar cliente con saldo > 0
- **Resultado:** Error bloqueante: "No se puede desactivar porque tiene saldo pendiente de $X"
- **Verificación:** El cliente sigue activo.

### Caso 5: Inventario solo muestra activos
- **Acción:** Abrir vista de Inventario con 3 productos desactivados
- **Resultado:** Los 3 productos NO aparecen en el inventario. El valor total de inventario solo refleja productos activos.

### Caso 6: Backup incluye todo
- **Acción:** Exportar backup JSON
- **Resultado:** El backup incluye TODOS los productos (activos e inactivos) porque usa `db.getAll('products')` directamente.

### Caso 7: Producto desactivado aparece en kardex
- **Acción:** Consultar movimientos de stock de un producto desactivado (desde reportes o acceso directo por ID)
- **Resultado:** El producto se resuelve correctamente porque `getById()` no filtra soft delete.

---

## RIESGOS Y LIMITACIONES

### Riesgos bajos
1. **findByBarcode puede devolver inactivo:** Si se busca por código de barras un producto inactivo, se encontrará. Esto es útil para importación (evitar duplicados) pero podría confundir en otros contextos. Riesgo aceptado.
2. **Categorías muestran todas:** `getAllCategories()` en productos usa `Product.getAll()` que filtra, así que categorías sin productos activos podrían desaparecer del filtro.

### Limitaciones conocidas
1. **No hay índice de `isActive` en IndexedDB.** El filtrado se hace en JS después de cargar todos los registros. Con miles de registros el impacto es insignificante (los registros ya están en memoria).
2. **No se migran datos existentes.** Los registros antiguos no tienen `isActive: true` explícito, pero el filtro `isActive !== false` los trata correctamente como activos.
3. **No hay audit log centralizado.** Solo se registra `deletedAt` en el propio registro. Un log de auditoría completo queda para fase posterior.

---

## QUÉ QUEDA PROTEGIDO A PARTIR DE AHORA

| Situación | Antes | Ahora |
|-----------|-------|-------|
| Eliminar producto con ventas | Error A4 bloqueaba | Soft delete: se desactiva sin perder datos |
| Eliminar producto con stock | Error A4 bloqueaba | Soft delete: se desactiva sin perder datos |
| Eliminar producto con movimientos | Error A4 bloqueaba | Soft delete: se desactiva sin perder datos |
| Eliminar cliente con historial | Se perdía referencia | Soft delete: cliente se preserva |
| Eliminar proveedor con compras pagadas | B4 bloqueaba | Soft delete: se desactiva (compras pagadas OK) |
| Reportes de rentabilidad | Productos podían no encontrarse | `getById()` siempre los encuentra |
| Backup | N/A | Incluye activos e inactivos |
| Restauración | Imposible | Posible desde modal "Desactivados" |

---

## ARCHIVOS MODIFICADOS

| Archivo | Cambios |
|---------|---------|
| `js/repositories/productRepository.js` | `findAll()` filtra, +`findAllIncludingDeleted()`, +`findDeleted()` |
| `js/repositories/CustomerRepository.js` | `findAll()` filtra, +`findAllIncludingDeleted()`, +`findDeleted()` |
| `js/repositories/SupplierRepository.js` | `findAll()` filtra, +`findAllIncludingDeleted()`, +`findDeleted()` |
| `js/models/Product.js` | `delete()` → `softDelete()`, +`restore()`, +`getAllIncludingDeleted()`, +`getDeleted()` |
| `js/models/Customer.js` | `delete()` → `softDelete()`, +`restore()`, +`getAllIncludingDeleted()`, +`getDeleted()` |
| `js/models/Supplier.js` | `delete()` → `softDelete()`, +`restore()`, +`getAllIncludingDeleted()`, +`getDeleted()` |
| `js/controllers/ProductController.js` | Mensaje "desactivado", +`restoreProduct()` |
| `js/controllers/CustomerController.js` | Mensaje "desactivado", +`restoreCustomer()` |
| `js/controllers/SupplierController.js` | Mensaje "desactivado", +`restoreSupplier()` |
| `js/views/products.js` | Botón "Desactivar", modal "Desactivados", `restoreProduct()` |
| `js/views/customers.js` | Botón "Desactivar", modal "Desactivados", `restoreCustomer()` |
| `js/views/suppliers.js` | Botón "Desactivar", modal "Desactivados", `restoreSupplier()` |

## VERIFICACIONES POST-IMPLEMENTACIÓN

- [x] Linter: 0 errores en todos los archivos modificados
- [ ] Desactivar producto → desaparece de listados y POS
- [ ] Restaurar producto → vuelve a aparecer
- [ ] Desactivar cliente con deuda → bloqueado
- [ ] Desactivar cliente sin deuda → OK
- [ ] Desactivar proveedor con compras pendientes → bloqueado
- [ ] Desactivar proveedor con compras pagadas → OK
- [ ] Reportes históricos siguen mostrando datos de productos desactivados
- [ ] Backup incluye registros activos e inactivos
- [ ] Registros existentes (sin isActive) se muestran como activos

## LO QUE NO SE TOCÓ EN ESTA FASE

- Soft delete en otras entidades (Sale, Purchase, Payment, etc.)
- Audit log centralizado
- Índice de `isActive` en IndexedDB
- Migración de datos existentes para agregar `isActive: true`
- Interfaz de administración avanzada de registros inactivos
- Eliminación física permanente de registros (purge)

---

*Documento generado para revisión de auditor externo.*
