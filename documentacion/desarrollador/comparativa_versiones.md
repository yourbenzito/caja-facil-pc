# Guía Completa: Implementación de Versión Gratuita y Versión de Pago
**Sistema de Ventas Desktop - Plan de Implementación**

---

## 📋 Tabla de Contenidos

1. [Visión General](#visión-general)
2. [Estrategias de Implementación](#estrategias-de-implementación)
3. [Definición de Funcionalidades por Versión](#definición-de-funcionalidades-por-versión)
4. [Arquitectura del Sistema de Licencias](#arquitectura-del-sistema-de-licencias)
5. [Paso a Paso de Implementación](#paso-a-paso-de-implementación)
6. [Consideraciones de Seguridad](#consideraciones-de-seguridad)
7. [Monetización y Precios](#monetización-y-precios)
8. [Checklist de Implementación](#checklist-de-implementación)

---

## 🎯 Visión General

### Objetivo
Implementar un sistema de licencias que permita:
- **Versión Gratuita (Free)**: Funcionalidades básicas limitadas
- **Versión de Pago (Pro/Premium)**: Acceso completo a todas las funcionalidades

### Características del Sistema Actual
Tu aplicación tiene las siguientes funcionalidades principales:
- ✅ Punto de Venta (POS)
- ✅ Gestión de Productos
- ✅ Gestión de Clientes
- ✅ Gestión de Proveedores
- ✅ Control de Compras
- ✅ Control de Gastos
- ✅ Control de Caja
- ✅ Control de Inventario
- ✅ Reportes y Análisis
- ✅ Historial de Ventas
- ✅ Configuración y Backups

---

## 🔄 Estrategias de Implementación

### Opción 1: Licencia Local (Recomendada para inicio)
**Ventajas:**
- ✅ Funciona 100% offline
- ✅ Implementación más simple
- ✅ No requiere servidor
- ✅ Menor costo de infraestructura

**Desventajas:**
- ⚠️ Más fácil de piratear
- ⚠️ No permite control remoto
- ⚠️ Difícil revocar licencias

**Cómo funciona:**
- Licencia almacenada en IndexedDB local
- Clave de licencia generada con información del sistema
- Verificación local en cada inicio

### Opción 2: Servidor de Licencias (Más segura)
**Ventajas:**
- ✅ Control total sobre licencias
- ✅ Puede revocar licencias
- ✅ Estadísticas de uso
- ✅ Más difícil de piratear

**Desventajas:**
- ⚠️ Requiere servidor y base de datos
- ⚠️ Necesita conexión a internet (al menos periódicamente)
- ⚠️ Mayor costo de infraestructura

**Cómo funciona:**
- Clave de licencia se valida contra servidor
- Verificación periódica (cada X días)
- Modo offline con cache de verificación

### Opción 3: Híbrida (Recomendada para producción)
**Ventajas:**
- ✅ Funciona offline con cache
- ✅ Verificación online cuando hay conexión
- ✅ Balance entre seguridad y usabilidad

**Desventajas:**
- ⚠️ Implementación más compleja
- ⚠️ Requiere servidor (pero no crítico)

**Cómo funciona:**
- Verificación local como primaria
- Verificación online cuando hay conexión
- Cache de verificación válida por X días

---

## 📊 Definición de Funcionalidades por Versión

### Versión GRATUITA (Free) - Limitaciones Propuestas

#### ✅ Funcionalidades Disponibles:
1. **Punto de Venta (POS)**
   - ✅ Ventas básicas (hasta 50 productos en el sistema)
   - ✅ 2 métodos de pago: Efectivo y Tarjeta
   - ✅ Máximo 10 items por venta
   - ✅ Sin selección de cliente

2. **Productos**
   - ✅ Máximo 50 productos
   - ✅ CRUD básico
   - ✅ Sin importación masiva
   - ✅ Sin código de barras avanzado

3. **Clientes**
   - ✅ Máximo 20 clientes
   - ✅ CRUD básico
   - ✅ Sin historial completo

4. **Proveedores**
   - ✅ Máximo 5 proveedores
   - ✅ CRUD básico

5. **Compras**
   - ✅ Registro básico (máximo 10 items por compra)
   - ✅ Sin pagos parciales

6. **Gastos**
   - ✅ Registro básico
   - ✅ Máximo 20 gastos por mes

7. **Caja**
   - ✅ Apertura y cierre básico
   - ✅ Sin historial completo

8. **Inventario**
   - ✅ Visualización básica
   - ✅ Sin ajustes masivos
   - ✅ Sin movimientos históricos completos

9. **Reportes**
   - ✅ Reportes básicos (últimos 7 días)
   - ✅ Sin análisis avanzado
   - ✅ Sin exportación

10. **Ventas**
    - ✅ Historial básico (últimas 100 ventas)
    - ✅ Sin edición avanzada

11. **Configuración**
    - ✅ Configuración básica
    - ✅ Sin backups completos
    - ✅ Sin exportación masiva

#### ❌ Funcionalidades NO Disponibles (Solo Pro):
- ❌ Más de 50 productos
- ❌ Más de 20 clientes
- ❌ Más de 5 proveedores
- ❌ Métodos de pago QR y Otro
- ❌ Ventas a crédito (anotadas)
- ❌ Pagos de deudas de clientes
- ❌ Pagos parciales de compras
- ❌ Más de 20 gastos por mes
- ❌ Historial completo de cajas
- ❌ Ajustes masivos de inventario
- ❌ Reportes avanzados (más de 7 días)
- ❌ Exportación de datos (CSV, JSON)
- ❌ Backups completos
- ❌ Importación masiva de productos
- ❌ Análisis de rentabilidad avanzado
- ❌ Múltiples usuarios/cajeros

### Versión PRO/PREMIUM - Sin Limitaciones

#### ✅ Todas las Funcionalidades:
- ✅ Productos ilimitados
- ✅ Clientes ilimitados
- ✅ Proveedores ilimitados
- ✅ Todos los métodos de pago
- ✅ Ventas a crédito completas
- ✅ Pagos parciales
- ✅ Gastos ilimitados
- ✅ Historial completo
- ✅ Reportes avanzados (sin límite de tiempo)
- ✅ Exportación completa
- ✅ Backups completos
- ✅ Importación masiva
- ✅ Análisis avanzado
- ✅ Múltiples usuarios (futuro)

---

## 🏗️ Arquitectura del Sistema de Licencias

### Estructura de Datos Propuesta

#### 1. Tabla `licenses` en IndexedDB
```javascript
{
  id: 1,
  licenseKey: "XXXX-XXXX-XXXX-XXXX",
  licenseType: "free" | "pro" | "trial",
  status: "active" | "expired" | "revoked",
  activatedAt: "2026-01-23T10:00:00Z",
  expiresAt: null | "2026-12-31T23:59:59Z", // null = lifetime
  hardwareId: "unique-machine-id",
  maxProducts: 50 | null, // null = unlimited
  maxCustomers: 20 | null,
  maxSuppliers: 5 | null,
  features: {
    creditSales: false,
    advancedReports: false,
    exports: false,
    backups: false,
    // ... más features
  },
  createdAt: "2026-01-23T10:00:00Z",
  lastVerified: "2026-01-23T10:00:00Z"
}
```

#### 2. Modelo `License` (js/models/License.js)
```javascript
class License {
  static async getCurrent()
  static async activate(licenseKey)
  static async verify()
  static async checkFeature(featureName)
  static async getLimits()
  static async isPro()
  static async isTrial()
}
```

#### 3. Servicio `LicenseService` (js/services/LicenseService.js)
```javascript
class LicenseService {
  static async validateLicenseKey(key)
  static async generateHardwareId()
  static async checkLimits(entityType, currentCount)
  static async enforceLimits()
  static async showUpgradePrompt(feature)
}
```

#### 4. Middleware de Verificación
- Interceptar operaciones CRUD
- Verificar límites antes de crear
- Mostrar mensajes de upgrade cuando se alcance el límite

---

## 📝 Paso a Paso de Implementación

### FASE 1: Preparación y Estructura Base

#### Paso 1.1: Crear Modelo de Licencia
**Archivo:** `js/models/License.js`

**Tareas:**
1. Crear clase `License` con métodos básicos
2. Crear tabla `licenses` en `js/db.js`
3. Implementar métodos:
   - `getCurrent()` - Obtener licencia actual
   - `activate(key)` - Activar licencia
   - `verify()` - Verificar validez
   - `isPro()` - Verificar si es Pro
   - `getLimits()` - Obtener límites

**Estructura inicial:**
```javascript
class License {
  static _repository = new LicenseRepository();
  
  static async getCurrent() {
    // Obtener licencia activa de la BD
  }
  
  static async activate(licenseKey) {
    // Validar y activar licencia
    // Generar hardwareId único
    // Guardar en BD
  }
  
  static async verify() {
    // Verificar que la licencia sigue siendo válida
    // Verificar hardwareId (opcional)
    // Verificar fecha de expiración
  }
  
  static async checkFeature(featureName) {
    // Verificar si una feature está disponible
  }
  
  static async getLimits() {
    // Retornar límites actuales según tipo de licencia
  }
  
  static async isPro() {
    // Retornar true si es Pro/Premium
  }
}
```

#### Paso 1.2: Crear Repository de Licencias
**Archivo:** `js/repositories/LicenseRepository.js`

**Tareas:**
1. Extender `BaseRepository`
2. Implementar métodos específicos para licencias
3. Agregar índices necesarios en `js/db.js`

#### Paso 1.3: Crear Servicio de Licencias
**Archivo:** `js/services/LicenseService.js`

**Tareas:**
1. Crear servicio centralizado para lógica de licencias
2. Implementar generación de `hardwareId` único
3. Implementar validación de clave de licencia
4. Implementar verificación de límites

**Métodos clave:**
```javascript
class LicenseService {
  static async generateHardwareId() {
    // Generar ID único basado en hardware/máquina
    // Usar: MAC address, CPU ID, disco serial, etc.
  }
  
  static async validateLicenseKey(key) {
    // Validar formato de clave
    // Verificar checksum
    // Decodificar información
  }
  
  static async checkLimit(entityType, currentCount) {
    // Verificar si se puede crear más entidades
    // entityType: 'products', 'customers', 'suppliers'
  }
  
  static async enforceLimit(entityType, action) {
    // Interceptar creación y verificar límite
    // Lanzar error si se excede
  }
  
  static showUpgradePrompt(feature, limit) {
    // Mostrar modal de upgrade
  }
}
```

#### Paso 1.4: Actualizar Base de Datos
**Archivo:** `js/db.js`

**Tareas:**
1. Agregar object store `licenses`
2. Agregar índices:
   - `status` (para buscar licencias activas)
   - `licenseType` (para filtrar por tipo)
3. Incrementar versión de BD
4. Crear migración para inicializar licencia gratuita por defecto

**Código a agregar:**
```javascript
// En onupgradeneeded, agregar:
const licenseStore = db.createObjectStore('licenses', { keyPath: 'id', autoIncrement: true });
licenseStore.createIndex('status', 'status', { unique: false });
licenseStore.createIndex('licenseType', 'licenseType', { unique: false });
licenseStore.createIndex('licenseKey', 'licenseKey', { unique: true });
```

---

### FASE 2: Sistema de Activación de Licencias

#### Paso 2.1: Crear Vista de Activación
**Archivo:** `js/views/license.js`

**Tareas:**
1. Crear vista para activar licencia
2. Formulario de entrada de clave
3. Validación de formato
4. Mensajes de éxito/error
5. Integrar en `js/app.js` y `index.html`

**Funcionalidades:**
- Input para clave de licencia
- Botón "Activar"
- Validación de formato
- Mensaje de éxito/error
- Link a comprar licencia (si no tiene)

#### Paso 2.2: Generador de Claves de Licencia
**Archivo:** `js/utils/licenseGenerator.js` (solo para desarrollo/admin)

**Tareas:**
1. Crear utilidad para generar claves válidas
2. Formato: `XXXX-XXXX-XXXX-XXXX` (16 caracteres alfanuméricos)
3. Incluir checksum para validación
4. Codificar información: tipo, fecha, etc.

**Formato propuesto:**
```
PROD-XXXX-XXXX-XXXX (Pro, lifetime)
FREE-XXXX-XXXX-XXXX (Free, siempre activa)
TRIA-XXXX-XXXX-XXXX (Trial, 30 días)
```

#### Paso 2.3: Integrar en Configuración
**Archivo:** `js/views/settings.js`

**Tareas:**
1. Agregar sección "Licencia" en configuración
2. Mostrar:
   - Tipo de licencia actual
   - Estado (activa/expirada)
   - Fecha de activación
   - Fecha de expiración (si aplica)
   - Botón "Activar nueva licencia"
   - Botón "Comprar licencia Pro" (si es free)

---

### FASE 3: Implementación de Límites

#### Paso 3.1: Middleware de Verificación en Productos
**Archivo:** `js/models/Product.js`

**Tareas:**
1. Modificar método `create()` para verificar límite
2. Antes de crear, verificar cantidad actual
3. Si excede límite, lanzar error con mensaje de upgrade
4. Mostrar modal de upgrade

**Código a agregar:**
```javascript
static async create(data) {
  // Verificar límite antes de crear
  const currentLicense = await License.getCurrent();
  const currentProducts = await this.getAll();
  
  if (currentLicense && currentLicense.maxProducts !== null) {
    if (currentProducts.length >= currentLicense.maxProducts) {
      LicenseService.showUpgradePrompt('products', currentLicense.maxProducts);
      throw new Error(
        `Límite alcanzado: Máximo ${currentLicense.maxProducts} productos en versión gratuita. ` +
        `Actualiza a Pro para productos ilimitados.`
      );
    }
  }
  
  // Continuar con creación normal...
}
```

#### Paso 3.2: Middleware en Clientes
**Archivo:** `js/models/Customer.js`

**Tareas:**
- Similar a Productos
- Límite: 20 clientes (free)

#### Paso 3.3: Middleware en Proveedores
**Archivo:** `js/models/Supplier.js`

**Tareas:**
- Similar a Productos
- Límite: 5 proveedores (free)

#### Paso 3.4: Límites en Ventas
**Archivo:** `js/controllers/POSController.js`

**Tareas:**
1. Limitar métodos de pago (solo efectivo y tarjeta en free)
2. Limitar items por venta (máximo 10 en free)
3. Deshabilitar ventas a crédito en free
4. Mostrar mensajes informativos

#### Paso 3.5: Límites en Reportes
**Archivo:** `js/controllers/ReportController.js`

**Tareas:**
1. Limitar rango de fechas (máximo 7 días en free)
2. Deshabilitar exportación en free
3. Mostrar mensaje de upgrade

#### Paso 3.6: Límites en Gastos
**Archivo:** `js/models/Expense.js`

**Tareas:**
1. Verificar límite mensual (20 gastos en free)
2. Contar gastos del mes actual
3. Bloquear creación si excede

---

### FASE 4: UI/UX de Upgrade

#### Paso 4.1: Crear Componente de Upgrade Modal
**Archivo:** `js/views/upgrade.js`

**Tareas:**
1. Crear modal atractivo de upgrade
2. Mostrar comparación Free vs Pro
3. Lista de beneficios de Pro
4. Botón "Comprar ahora" / "Activar licencia"
5. Precio y opciones de pago

**Diseño sugerido:**
- Comparación lado a lado (Free vs Pro)
- Lista de features con checkmarks
- Precio destacado
- Call-to-action claro

#### Paso 4.2: Integrar Mensajes de Límite
**Tareas:**
1. Crear función helper `showLimitReached(entityType)`
2. Usar en todos los lugares donde se alcance límite
3. Mensaje consistente y claro

#### Paso 4.3: Badge de Versión en UI
**Archivo:** `index.html` y `js/app.js`

**Tareas:**
1. Mostrar badge "FREE" o "PRO" en sidebar
2. Actualizar dinámicamente según licencia
3. Link a configuración de licencia

---

### FASE 5: Verificación y Seguridad

#### Paso 5.1: Verificación al Inicio
**Archivo:** `js/app.js`

**Tareas:**
1. Verificar licencia en `init()`
2. Si no hay licencia, crear una gratuita por defecto
3. Si licencia expirada, mostrar mensaje
4. Si licencia revocada, bloquear acceso

**Código a agregar:**
```javascript
async init() {
  try {
    await db.init();
    
    // Verificar licencia
    const license = await License.getCurrent();
    if (!license) {
      // Crear licencia gratuita por defecto
      await License.activate('FREE-DEFAULT-0000-0000');
    } else {
      // Verificar validez
      const isValid = await License.verify();
      if (!isValid) {
        // Mostrar mensaje de licencia expirada
        this.showLicenseExpired();
        return;
      }
    }
    
    // Continuar inicialización normal...
  } catch (error) {
    // ...
  }
}
```

#### Paso 5.2: Verificación Periódica
**Archivo:** `js/services/LicenseService.js`

**Tareas:**
1. Implementar verificación cada X días
2. Si hay conexión, verificar contra servidor (opcional)
3. Actualizar `lastVerified` en BD

#### Paso 5.3: Protección contra Manipulación
**Tareas:**
1. Validar checksum de clave de licencia
2. Verificar hardwareId (opcional, puede ser molesto)
3. Ofuscar código crítico (usar herramientas como `javascript-obfuscator`)
4. Validar integridad de datos de licencia

---

### FASE 6: Sistema de Pago (Opcional - Futuro)

#### Paso 6.1: Integración con Pasarela de Pago
**Opciones:**
- Stripe
- PayPal
- Mercado Pago (Chile)
- Transferencia bancaria + activación manual

#### Paso 6.2: Generación Automática de Licencias
**Tareas:**
1. Servidor que genera claves después de pago
2. Envío por email
3. Activación automática

---

## 🔒 Consideraciones de Seguridad

### Nivel 1: Básico (Para empezar)
- ✅ Validación de formato de clave
- ✅ Checksum simple
- ✅ Almacenamiento en IndexedDB
- ✅ Verificación al inicio

### Nivel 2: Intermedio
- ✅ Verificación periódica
- ✅ HardwareId único
- ✅ Encriptación de datos de licencia
- ✅ Validación de integridad

### Nivel 3: Avanzado
- ✅ Servidor de verificación
- ✅ Revocación remota
- ✅ Ofuscación de código
- ✅ Validación criptográfica fuerte

---

## 💰 Monetización y Precios

### Estrategias de Precio Sugeridas

#### Opción A: Pago Único
- **Free**: $0 (limitado)
- **Pro**: $49.99 - $99.99 USD (pago único, lifetime)

#### Opción B: Suscripción Mensual
- **Free**: $0 (limitado)
- **Pro**: $9.99 - $19.99 USD/mes

#### Opción C: Suscripción Anual
- **Free**: $0 (limitado)
- **Pro**: $79.99 - $149.99 USD/año (ahorro vs mensual)

#### Opción D: Freemium con Trial
- **Free**: $0 (limitado)
- **Trial Pro**: 30 días gratis
- **Pro**: $49.99 USD (después del trial)

### Recomendación
**Empezar con Opción A (Pago Único)** porque:
- Más simple de implementar
- Menos fricción para usuarios
- No requiere sistema de facturación recurrente
- Puedes migrar a suscripción después

---

## ✅ Checklist de Implementación

### Fase 1: Estructura Base
- [ ] Crear `js/models/License.js`
- [ ] Crear `js/repositories/LicenseRepository.js`
- [ ] Crear `js/services/LicenseService.js`
- [ ] Actualizar `js/db.js` con tabla `licenses`
- [ ] Crear migración para inicializar licencia free

### Fase 2: Activación
- [ ] Crear `js/views/license.js`
- [ ] Crear `js/utils/licenseGenerator.js` (dev)
- [ ] Integrar vista en `js/app.js`
- [ ] Agregar sección en `js/views/settings.js`

### Fase 3: Límites
- [ ] Implementar límite en `Product.create()`
- [ ] Implementar límite en `Customer.create()`
- [ ] Implementar límite en `Supplier.create()`
- [ ] Limitar métodos de pago en POS
- [ ] Limitar items por venta
- [ ] Deshabilitar ventas a crédito (free)
- [ ] Limitar rango de reportes
- [ ] Deshabilitar exportación (free)
- [ ] Limitar gastos mensuales

### Fase 4: UI/UX
- [ ] Crear `js/views/upgrade.js`
- [ ] Crear función `showLimitReached()`
- [ ] Agregar badge de versión en sidebar
- [ ] Crear comparación Free vs Pro

### Fase 5: Verificación
- [ ] Verificación al inicio en `app.init()`
- [ ] Verificación periódica
- [ ] Manejo de licencias expiradas
- [ ] Validación de checksum

### Fase 6: Testing
- [ ] Probar creación con límites
- [ ] Probar activación de licencia
- [ ] Probar upgrade de free a pro
- [ ] Probar expiración de trial
- [ ] Probar mensajes de límite

### Fase 7: Documentación
- [ ] Actualizar README con info de licencias
- [ ] Crear guía de activación para usuarios
- [ ] Documentar límites de cada versión
- [ ] Crear página de precios (si hay sitio web)

---

## 🚀 Orden Recomendado de Implementación

### Semana 1: Fundación
1. Día 1-2: Crear estructura base (License, Repository, Service)
2. Día 3: Actualizar BD y crear migración
3. Día 4: Crear vista de activación básica
4. Día 5: Testing básico

### Semana 2: Límites Core
1. Día 1: Límites en Productos
2. Día 2: Límites en Clientes y Proveedores
3. Día 3: Límites en POS (métodos de pago, items)
4. Día 4: Deshabilitar ventas a crédito
5. Día 5: Testing de límites

### Semana 3: Límites Avanzados y UI
1. Día 1: Límites en Reportes
2. Día 2: Límites en Gastos
3. Día 3: Crear modal de upgrade
4. Día 4: Integrar mensajes de límite
5. Día 5: Badge de versión y UI polish

### Semana 4: Seguridad y Pulido
1. Día 1-2: Verificación y seguridad
2. Día 3: Testing completo
3. Día 4: Documentación
4. Día 5: Preparación para lanzamiento

---

## 📌 Notas Importantes

### Para Empezar Rápido
1. **Empieza con licencia local simple** (Opción 1)
2. **Implementa límites básicos primero** (productos, clientes, proveedores)
3. **Crea UI de upgrade después**
4. **Mejora seguridad gradualmente**

### Consideraciones Técnicas
- IndexedDB es suficiente para almacenar licencias localmente
- No necesitas servidor para empezar
- Puedes migrar a servidor después si creces
- Ofusca código solo si es crítico (aumenta complejidad)

### Consideraciones de Negocio
- **Free debe ser útil** pero limitado para incentivar upgrade
- **Pro debe valer la pena** - diferencias claras y valiosas
- **Precio competitivo** - investiga competencia
- **Soporte claro** - cómo comprar, activar, problemas

---

## 🎯 Próximos Pasos

1. **Revisa este documento** y decide qué estrategia prefieres
2. **Define límites exactos** para versión gratuita
3. **Decide precio** de versión Pro
4. **Empezamos con Fase 1** cuando estés listo

---

## 📞 Preguntas Frecuentes

**P: ¿Necesito servidor para empezar?**
R: No, puedes empezar con licencia local. Servidor es opcional y puedes agregarlo después.

**P: ¿Cómo genero claves de licencia?**
R: Crearemos un generador simple. Para producción, deberías tener un servidor que las genere después del pago.

**P: ¿Puedo cambiar límites después?**
R: Sí, pero es mejor definirlos bien desde el inicio para no confundir usuarios.

**P: ¿Qué pasa si alguien piratea la licencia?**
R: Con licencia local, es posible. Con servidor, puedes revocar. Para empezar, acepta que habrá algo de piratería, pero la mayoría pagará si el precio es justo.

**P: ¿Puedo tener versión de prueba?**
R: Sí, puedes agregar tipo "trial" que expira en 30 días.

---

**Documento creado:** 23 de Enero, 2026
**Versión:** 1.0
**Estado:** Listo para implementación paso a paso
