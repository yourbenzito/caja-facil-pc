# FASE C8 — Roles y Permisos

**Fecha:** 2026-02-08  
**Fase:** C8  
**Objetivo:** Implementar control de acceso basado en roles fijos sin modificar la lógica de negocio.

---

## 📌 Resumen Ejecutivo

Se implementó un sistema de **roles fijos** (owner, admin, cashier) con una **matriz de permisos centralizada** en `PermissionService`. El sistema controla:

1. **Navegación**: Secciones visibles del sidebar según el rol.
2. **Acciones**: Botones de crear, editar, eliminar y operar se muestran/ocultan según permisos.
3. **Guards en controllers**: Validaciones de permiso a nivel de controller que lanzan error si el usuario no tiene acceso.
4. **Gestión de usuarios**: Sección en Configuración para que el propietario asigne roles.
5. **Sesión**: El rol se almacena en la sesión y se muestra en la UI.

**NINGUNA lógica de negocio fue modificada.** Los permisos actúan como una capa de control sobre los flujos existentes.

---

## 🔐 Definición de Roles

| Rol | Etiqueta | Descripción |
|---|---|---|
| `owner` | Propietario | Acceso total: configuración, backup, gestión de usuarios, todas las operaciones |
| `admin` | Administrador | Gestión operativa completa: productos, clientes, proveedores, compras, ventas, reportes, caja |
| `cashier` | Cajero | Solo POS (vender), ver productos/clientes, caja. Sin acceso a edición, configuración ni reportes |

---

## 🧠 Diseño de la Matriz de Permisos

### Navegación (sidebar)

| Vista | owner | admin | cashier |
|---|---|---|---|
| POS | ✅ | ✅ | ✅ |
| Productos | ✅ | ✅ | ✅ |
| Clientes | ✅ | ✅ | ✅ |
| Proveedores | ✅ | ✅ | ❌ |
| Compras | ✅ | ✅ | ❌ |
| Gastos | ✅ | ✅ | ❌ |
| Caja | ✅ | ✅ | ✅ |
| Inventario | ✅ | ✅ | ❌ |
| Reportes | ✅ | ✅ | ❌ |
| Historial Ventas | ✅ | ✅ | ✅ |
| Configuración | ✅ | ✅ | ❌ |

### Acciones

| Acción | owner | admin | cashier |
|---|---|---|---|
| Productos: crear | ✅ | ✅ | ❌ |
| Productos: editar | ✅ | ✅ | ❌ |
| Productos: desactivar | ✅ | ✅ | ❌ |
| Productos: importar/exportar | ✅ | ✅ | ❌ |
| Clientes: crear | ✅ | ✅ | ✅ |
| Clientes: editar | ✅ | ✅ | ❌ |
| Clientes: desactivar | ✅ | ✅ | ❌ |
| Proveedores: CRUD | ✅ | ✅ | ❌ |
| Compras: crear/editar/pagar | ✅ | ✅ | ❌ |
| Ventas: editar | ✅ | ✅ | ❌ |
| Ventas: devolver | ✅ | ✅ | ❌ |
| Inventario: ajustar stock | ✅ | ✅ | ❌ |
| Caja: abrir/cerrar | ✅ | ✅ | ✅ |
| Gastos: CRUD | ✅ | ✅ | ❌ |
| Settings: backup/restore | ✅ | ❌ | ❌ |
| Settings: gestión de usuarios | ✅ | ❌ | ❌ |
| Settings: seguridad | ✅ | ✅ | ❌ |

---

## 📂 Archivos Modificados

### Nuevo archivo
- `js/services/PermissionService.js` — Servicio centralizado con roles, permisos, y métodos de validación.

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `js/models/User.js` | Agregado campo `role` en `create()`, primer usuario = `owner`, nuevos usuarios = `cashier`. Métodos `updateRole()` y `getEffectiveRole()`. |
| `js/auth.js` | `login()` incluye `role` en sesión. `addLogoutButton()` muestra etiqueta del rol. |
| `js/app.js` | `applyPermissionsToSidebar()` oculta ítems del sidebar. Guard en `navigate()`. `updateSidebarUser()` muestra rol. |
| `js/controllers/ProductController.js` | Guards con `PermissionService.require()` en `saveProduct`, `deleteProduct`, `restoreProduct`. |
| `js/controllers/CustomerController.js` | Guards en `saveCustomer`, `deleteCustomer`, `restoreCustomer`. |
| `js/controllers/SupplierController.js` | Guards en `saveSupplier`, `deleteSupplier`, `restoreSupplier`, `savePurchase`, `registerPayment`. |
| `js/views/products.js` | Botones Editar/Desactivar/Exportar/Importar/Nuevo condicionados a permisos. |
| `js/views/customers.js` | Botones Editar/Desactivar/Nuevo condicionados. |
| `js/views/suppliers.js` | Botones Editar/Desactivar/Nuevo condicionados. |
| `js/views/purchases.js` | Botones Nueva Compra/Editar/Pagar condicionados. |
| `js/views/sales.js` | Botones Editar Venta/Devolver condicionados (en lista y en modal detalle). |
| `js/views/inventory.js` | Botones de ajuste de stock condicionados. |
| `js/views/settings.js` | Sección de gestión de usuarios (solo owner). Sección backup condicionada. |
| `index.html` | Badge de rol en sidebar. Script de PermissionService en orden correcto. |

---

## 🔄 Compatibilidad con Datos Existentes

| Aspecto | Solución |
|---|---|
| Usuarios sin campo `role` | `getEffectiveRole()` retorna `'owner'` como fallback. Ningún usuario existente pierde acceso. |
| Sesiones activas sin `role` | `PermissionService.getCurrentRole()` retorna `'owner'` si no hay rol en sesión. |
| Primer usuario del sistema | Siempre recibe rol `'owner'`, independientemente de lo que se pase como parámetro. |
| Nuevos usuarios (registro) | Reciben `'cashier'` por defecto. El owner puede cambiar el rol después. |
| Permisos no definidos | Si un permiso no existe en la matriz, `PermissionService.can()` retorna `true` (no rompe flujos nuevos). |

**NO se requiere migración de datos.** NO se modifica la base de datos. NO se agrega ningún store ni índice nuevo.

---

## 🧪 Casos de Uso (Pruebas Teóricas)

### 1. Usuario existente sin rol
- **Acción:** Login con usuario creado antes de C8.
- **Resultado esperado:** `getEffectiveRole()` → `'owner'`. Acceso total. Sin cambios.

### 2. Nuevo usuario creado por registro
- **Acción:** Registrar nuevo usuario desde pantalla de login.
- **Resultado esperado:** Rol = `'cashier'`. Solo ve POS, Productos (sin editar), Clientes (puede crear), Caja, Historial Ventas.

### 3. Owner cambia rol de usuario
- **Acción:** En Configuración > Gestión de Usuarios, cambiar rol de "cashier" a "admin".
- **Resultado esperado:** Audit log creado. Al re-loguearse, el usuario tendrá permisos de admin.

### 4. Cashier intenta editar producto
- **Acción:** Si un cajero intenta llamar a `ProductController.saveProduct(data)` (ej. por consola).
- **Resultado esperado:** `PermissionService.require('products.edit')` lanza `Error: Acceso denegado`.

### 5. Cashier ve sidebar reducido
- **Acción:** Cajero inicia sesión.
- **Resultado esperado:** Solo ve POS, Productos, Clientes, Caja, Historial Ventas. No ve Proveedores, Compras, Gastos, Inventario, Reportes, Configuración.

### 6. Owner no puede cambiarse su propio rol
- **Acción:** En gestión de usuarios, el select de su propio usuario está deshabilitado.
- **Resultado esperado:** Se previene el auto-bloqueo accidental.

### 7. Error de permiso no rompe operación principal
- **Acción:** Cualquier error en PermissionService.
- **Resultado esperado:** Guards en controllers lanzan error ANTES de ejecutar la operación de negocio, preservando la integridad.

---

## ⚠️ Riesgos y Limitaciones

| Riesgo | Mitigación |
|---|---|
| Si PermissionService no carga | Fallback en `getCurrentRole()` retorna `'owner'` → no bloquea a nadie. |
| El cajero puede manipular la consola | Los guards están en los controllers (server-side lógico), no solo en UI. Un cajero avanzado podría saltarlos llamando directamente al modelo, pero eso requiere conocimiento técnico. |
| Cambio de rol no es inmediato | El rol se almacena en sessionStorage. El usuario debe re-loguearse para que el nuevo rol tome efecto. |
| No hay permisos dinámicos | Por diseño. Los permisos son estáticos por rol. Para cambiar la matriz, se modifica `PermissionService.PERMISSIONS`. |
| No hay registro de intentos de acceso denegado | Se puede agregar en futuras fases. Los audit logs de C2 registran acciones exitosas. |

---

## ✅ Qué se puede controlar desde ahora

1. **Qué secciones ve cada usuario** en el sidebar.
2. **Qué acciones puede realizar**: crear, editar, eliminar, importar, exportar.
3. **Quién gestiona usuarios y backups**: solo el propietario.
4. **El rol se muestra en la UI**: badge en sidebar y en sección de usuario.
5. **Los guards se integran con audit log**: cambios de rol se registran.
6. **Compatibilidad total** con usuarios y sesiones pre-C8.

---

## 📋 Arquitectura del Permiso

```
[UI Layer]  →  PermissionService.can('permiso')  →  Ocultar/mostrar botones
     ↓
[Controller Layer]  →  PermissionService.require('permiso')  →  Lanzar error si no tiene acceso
     ↓
[Model/Service Layer]  →  Sin cambios — la lógica de negocio NO fue modificada
```

**Principio:** Los permisos son una **capa de control**, no una modificación de la lógica de negocio.

---

## 📊 Resumen de Impacto

- **Archivos nuevos:** 1 (`PermissionService.js`)
- **Archivos modificados:** 14
- **Stores de IndexedDB:** 0 nuevos (ningún cambio de BD)
- **Migración requerida:** Ninguna
- **Lógica de negocio modificada:** Ninguna
- **Linter errors:** 0
