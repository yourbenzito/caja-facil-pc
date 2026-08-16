# 🔐 DOCUMENTACIÓN PRIVADA - DESARROLLADOR/VENDEDOR

**⚠️ CONFIDENCIAL - SOLO PARA DESARROLLADOR/VENDEDOR**

Este documento contiene información estratégica sobre cómo vender, qué compartir con clientes, y detalles técnicos básicos del sistema.

---

## 📋 ÍNDICE

1. [Información Estratégica de Ventas](#información-estratégica-de-ventas)
2. [Qué Compartir con el Cliente](#qué-compartir-con-el-cliente)
3. [Qué NO Compartir](#qué-no-compartir)
4. [Explicación Básica del Código](#explicación-básica-del-código)
5. [Cómo Funciona el Sistema](#cómo-funciona-el-sistema)
6. [Puntos de Venta del Producto](#puntos-de-venta-del-producto)
7. [Precios Sugeridos](#precios-sugeridos)
8. [Mantenimiento y Soporte](#mantenimiento-y-soporte)

---

## 💼 INFORMACIÓN ESTRATÉGICA DE VENTAS

### Propuesta de Valor Principal

**"Sistema de gestión completo para minimarkets que funciona 100% offline"**

**Beneficios Clave:**
- ✅ No requiere internet (funciona completamente offline)
- ✅ Control total de inventario en tiempo real
- ✅ Gestión de clientes y fiados (crítico para negocios de barrio)
- ✅ Reportes de rentabilidad automáticos
- ✅ Control de caja con conciliación
- ✅ Gestión de proveedores y compras
- ✅ Registro de gastos operacionales
- ✅ Backup y restauración de datos
- ✅ Interfaz simple e intuitiva

### Mercado Objetivo

**Clientes Ideales:**
- Minimarkets y almacenes pequeños
- Negocios de barrio con ventas a crédito (fiados)
- Negocios que necesitan control de inventario
- Negocios sin conexión estable a internet
- Negocios que quieren digitalizar sin complejidad

**Tamaño del Negocio:**
- 1-5 empleados
- Ventas diarias: $50.000 - $2.000.000 CLP
- 50-500 productos en inventario
- 10-200 clientes frecuentes

---

## 📤 QUÉ COMPARTIR CON EL CLIENTE

### ✅ Documentos a Compartir

1. **../cliente/manual_usuario.md** - Manual de usuario completo
2. **Ejecutable instalable** - El .exe listo para instalar
3. **Guía rápida de instalación** - Pasos básicos
4. **Ejemplos de uso** - Casos de uso comunes
5. **Soporte técnico básico** - Cómo contactarte

### ✅ Información Técnica Básica

**Puedes mencionar:**
- Sistema desarrollado en Electron (tecnología moderna)
- Base de datos local (IndexedDB) - datos seguros en su computadora
- Funciona offline - no necesita internet
- Interfaz simple - fácil de usar
- Actualizaciones disponibles cuando las necesite

**NO menciones:**
- Detalles de implementación interna
- Estructura de carpetas
- Código fuente
- Vulnerabilidades o problemas técnicos
- Costos de desarrollo

---

## 🚫 QUÉ NO COMPARTIR

### ❌ Información Confidencial

1. **Código fuente completo** - Solo si vende el proyecto completo
2. **guia_tecnica.md** - Documentación técnica detallada
3. **Estructura interna del código** - Carpetas, archivos, organización
4. **Problemas conocidos o bugs** - A menos que afecten al cliente
5. **Costos de desarrollo** - Mantener confidencial
6. **Roadmap futuro** - A menos que sea parte de la venta
7. **Credenciales de acceso** - Usuario admin por defecto

### ⚠️ Si el Cliente Pide Código Fuente

**Opciones:**
1. **Vender licencia de código fuente** - Precio premium (3-5x precio normal)
2. **Explicar que es propiedad intelectual** - Similar a Microsoft Office
3. **Ofrecer soporte técnico extendido** - En lugar de código fuente
4. **Negociar mantenimiento anual** - Con acceso limitado

---

## 💻 EXPLICACIÓN BÁSICA DEL CÓDIGO

### Arquitectura Simple (Para Explicar al Cliente)

**"El sistema está organizado en módulos independientes:"**

```
┌─────────────────┐
│  Interfaz       │  ← Lo que el usuario ve y toca
│  (Pantallas)     │
└────────┬─────────┘
         │
         ↓
┌─────────────────┐
│  Lógica         │  ← Reglas de negocio (ventas, pagos, etc.)
│  de Negocio     │
└────────┬─────────┘
         │
         ↓
┌─────────────────┐
│  Base de Datos  │  ← Almacenamiento seguro local
└─────────────────┘
```

### Tecnologías Usadas (Explicación Simple)

**Para el Cliente:**
- "Sistema moderno desarrollado con tecnologías web estándar"
- "Base de datos local segura - sus datos están en su computadora"
- "No requiere servidor ni internet - funciona completamente offline"
- "Interfaz intuitiva - fácil de aprender"

**Para Ti (Técnico):**
- Electron (aplicación desktop)
- JavaScript Vanilla (sin frameworks pesados)
- IndexedDB (base de datos del navegador)
- Arquitectura MVC (Model-View-Controller)

---

## ⚙️ CÓMO FUNCIONA EL SISTEMA

### Flujo General

1. **Inicio de Sesión**
   - Usuario: `admin`
   - Contraseña: `admin123` (cambiar en producción)
   - Sesión guardada localmente

2. **Apertura de Caja**
   - Registrar monto inicial
   - Sistema asocia todas las ventas a esta caja
   - Puede estar abierta varios días

3. **Punto de Venta**
   - Buscar productos (código de barras o nombre)
   - Agregar al carrito
   - Seleccionar método de pago
   - Completar venta
   - Stock se actualiza automáticamente

4. **Gestión de Clientes**
   - Crear clientes
   - Ventas a crédito (fiados)
   - Registrar pagos de deudas
   - Ver historial

5. **Control de Caja**
   - Agregar/retirar dinero
   - Ver resumen en tiempo real
   - Cerrar caja con conciliación

6. **Reportes**
   - Ventas diarias/semanales/mensuales
   - Rentabilidad (ingresos - costos - gastos)
   - Productos más vendidos
   - Stock bajo

---

## 💰 PUNTOS DE VENTA DEL PRODUCTO

### 1. Funcionalidad Completa

**Mensaje:**
"Todo lo que necesita un minimarket en un solo sistema"

**Características:**
- ✅ Punto de venta completo
- ✅ Control de inventario
- ✅ Gestión de clientes y fiados
- ✅ Control de caja
- ✅ Reportes de rentabilidad
- ✅ Gestión de proveedores
- ✅ Registro de gastos

### 2. Funciona Offline

**Mensaje:**
"No necesita internet - funciona siempre"

**Beneficios:**
- No depende de conexión
- Datos seguros localmente
- No hay costos mensuales de servidor
- Funciona en cualquier lugar

### 3. Fácil de Usar

**Mensaje:**
"Interfaz simple - cualquier persona puede usarlo"

**Beneficios:**
- No requiere capacitación extensa
- Interfaz intuitiva
- Atajos de teclado para velocidad
- Diseño limpio y moderno

### 4. Control Total

**Mensaje:**
"Usted controla sus datos - no dependemos de terceros"

**Beneficios:**
- Datos en su computadora
- Backup cuando quiera
- Sin suscripciones mensuales
- Privacidad total

### 5. Rentabilidad

**Mensaje:**
"Sepa exactamente cuánto gana con reportes automáticos"

**Beneficios:**
- Reportes de rentabilidad automáticos
- Análisis de productos más rentables
- Control de gastos operacionales
- Toma de decisiones informada

---

## 💵 PRECIOS SUGERIDOS

### Opción 1: Venta Única (Recomendado)

**Precio Base:** $300.000 - $500.000 CLP

**Incluye:**
- Instalación del sistema
- Configuración inicial
- Capacitación básica (2 horas)
- 1 mes de soporte por email/WhatsApp

**Precio Premium:** $500.000 - $800.000 CLP

**Incluye:**
- Todo lo anterior +
- Migración de datos existentes (si aplica)
- Capacitación extendida (4 horas)
- 3 meses de soporte
- 2 actualizaciones menores

### Opción 2: Licencia + Mantenimiento

**Licencia Inicial:** $200.000 - $300.000 CLP

**Mantenimiento Anual:** $100.000 - $150.000 CLP/año

**Incluye:**
- Soporte técnico
- Actualizaciones
- Corrección de bugs
- Mejoras menores

### Opción 3: Código Fuente (Solo si Negocian)

**Precio:** $1.500.000 - $2.500.000 CLP

**Incluye:**
- Código fuente completo
- Documentación técnica
- 6 meses de soporte
- Derechos de modificación

---

## 🛠️ MANTENIMIENTO Y SOPORTE

### Niveles de Soporte

#### **Básico (Incluido en Venta)**
- Respuesta en 48 horas
- Soporte por email/WhatsApp
- Solución de problemas básicos
- 1 mes de duración

#### **Estándar ($50.000/mes)**
- Respuesta en 24 horas
- Soporte prioritario
- Solución de problemas avanzados
- Actualizaciones menores
- 1 consultoría mensual (30 min)

#### **Premium ($100.000/mes)**
- Respuesta en 4 horas
- Soporte prioritario 24/7
- Solución de todos los problemas
- Actualizaciones y mejoras
- Consultoría ilimitada
- Acceso remoto (si es necesario)

---

## 📋 CHECKLIST DE VENTA

### Antes de la Venta

- [ ] Demostración funcional del sistema
- [ ] Manual de usuario preparado (../cliente/manual_usuario.md)
- [ ] Ejecutable listo para instalar
- [ ] Casos de uso preparados
- [ ] Precio definido

### Durante la Venta

- [ ] Explicar beneficios principales
- [ ] Demostrar funcionalidades clave
- [ ] Responder preguntas técnicas básicas
- [ ] NO compartir código fuente
- [ ] NO mencionar problemas técnicos

### Después de la Venta

- [ ] Instalación del sistema
- [ ] Configuración inicial
- [ ] Capacitación básica
- [ ] Entrega de documentación (Manual de Usuario)
- [ ] Establecer canal de soporte

---

## 🎯 ARGUMENTOS DE VENTA

### Para Minimarkets Pequeños

**"Sistema completo por menos del costo de un mes de otro sistema con suscripción"**

**Comparación:**
- Sistema con suscripción: $50.000/mes = $600.000/año
- Este sistema: $300.000 una vez
- **Ahorro:** $300.000 en el primer año

### Para Negocios con Fiados

**"El único sistema que maneja fiados correctamente"**

**Características:**
- Ventas a crédito con abonos
- Cálculo automático de deudas
- Historial completo de pagos
- Reportes de cuentas por cobrar

### Para Negocios sin Internet

**"Funciona perfectamente sin internet"**

**Beneficios:**
- No depende de conexión
- Datos seguros localmente
- Sin costos mensuales de datos
- Funciona en cualquier lugar

---

## 🔧 EXPLICACIÓN TÉCNICA BÁSICA (Para Ti)

### Estructura del Código

**Módulos Principales:**
1. **Models** - Definición de datos (Producto, Venta, Cliente, etc.)
2. **Services** - Lógica de negocio (crear venta, procesar pago, etc.)
3. **Controllers** - Coordinación entre vista y servicio
4. **Views** - Interfaz de usuario (pantallas)
5. **Repositories** - Acceso a base de datos

### Base de Datos

- **Tipo:** IndexedDB (base de datos del navegador)
- **Ubicación:** Local en la computadora del cliente
- **Ventajas:** Rápida, offline, sin servidor
- **Desventajas:** Limitada a una computadora (no multi-usuario)

### Flujo de Datos

```
Usuario → Vista → Controller → Service → Model → Repository → IndexedDB
```

### Tecnologías Clave

- **Electron:** Convierte web app en aplicación desktop
- **IndexedDB:** Base de datos local del navegador
- **JavaScript Vanilla:** Sin frameworks (más ligero)
- **PWA:** Funciona como aplicación web instalable

---

## 📊 MÉTRICAS DE ÉXITO DEL PRODUCTO

### Indicadores Positivos

- ✅ Sistema usado diariamente
- ✅ Cliente genera reportes regularmente
- ✅ Control de inventario activo
- ✅ Gestión de fiados funcionando
- ✅ Cliente recomienda el sistema

### Señales de Problemas

- ⚠️ Cliente no usa el sistema regularmente
- ⚠️ Pide muchas modificaciones
- ⚠️ No entiende funcionalidades básicas
- ⚠️ Compara constantemente con otros sistemas

---

## 🎓 CAPACITACIÓN SUGERIDA

### Sesión 1: Básico (1 hora)
- Login y navegación
- Crear productos
- Realizar una venta
- Abrir/cerrar caja

### Sesión 2: Intermedio (1 hora)
- Gestión de clientes
- Ventas a crédito
- Registrar pagos
- Ver reportes básicos

### Sesión 3: Avanzado (1 hora)
- Gestión de proveedores
- Registrar compras
- Gastos operacionales
- Reportes de rentabilidad
- Backup y restauración

---

## 💡 CONSEJOS DE VENTA

### 1. Enfócate en Beneficios, No en Características

**❌ Mal:**
"El sistema tiene 11 módulos y usa IndexedDB"

**✅ Bien:**
"El sistema le permite controlar todo su negocio desde un solo lugar"

### 2. Usa Casos de Uso Reales

**Ejemplo:**
"Imagínese que un cliente viene a pagar una deuda. Con este sistema, en 3 clics tiene el pago registrado y la deuda actualizada automáticamente."

### 3. Demuestra, No Solo Expliques

- Muestra el sistema funcionando
- Realiza una venta de ejemplo
- Genera un reporte en vivo
- Muestra cómo funciona offline

### 4. Responde Objeciones Comunes

**"Es muy caro"**
→ "Comparado con sistemas con suscripción mensual, se paga solo en 6 meses"

**"No sé usarlo"**
→ "Incluye capacitación completa y soporte inicial"

**"Ya tengo un sistema"**
→ "Este sistema funciona offline y no tiene costos mensuales"

---

## 🔒 SEGURIDAD Y CONFIDENCIALIDAD

### Información que DEBES Proteger

1. **Código fuente** - Solo compartir si se vende licencia completa
2. **Credenciales por defecto** - Cambiar antes de entregar
3. **Problemas conocidos** - Resolver antes de mencionar
4. **Costos de desarrollo** - Mantener confidencial
5. **Estrategia de precios** - No revelar márgenes

### Información que PUEDES Compartir

1. **Funcionalidades** - Todas las características visibles
2. **Manual de usuario** - manual_usuario.md completo
3. **Casos de uso** - Ejemplos de cómo se usa
4. **Beneficios** - Todos los beneficios del sistema
5. **Soporte** - Información de contacto y niveles

---

## 📞 CONTACTO Y SOPORTE

### Información para el Cliente

**Email de Soporte:** [Tu email]  
**WhatsApp:** [Tu número]  
**Horario:** [Tu horario de atención]

### Respuestas Estándar

**"¿Puedo ver el código?"**
→ "El código fuente es propiedad intelectual. Si necesita modificaciones específicas, podemos cotizarlas por separado."

**"¿Funciona en varias computadoras?"**
→ "Actualmente funciona en una computadora. Para múltiples usuarios, podemos desarrollar una versión con servidor (costo adicional)."

**"¿Hay actualizaciones?"**
→ "Sí, ofrecemos actualizaciones y mejoras. Incluidas en el plan de mantenimiento."

---

## ✅ CHECKLIST FINAL

### Antes de Entregar al Cliente

- [ ] Cambiar contraseña de admin
- [ ] Configurar usuario inicial
- [ ] Probar todas las funcionalidades
- [ ] Preparar Manual de Usuario (../cliente/manual_usuario.md)
- [ ] Crear backup inicial
- [ ] Documentar configuración específica del cliente
- [ ] Establecer canal de soporte

---

**⚠️ RECORDATORIO:** Este documento es CONFIDENCIAL. No compartir con clientes.

---

## 🆕 ACTUALIZACIONES RECIENTES (DESARROLLO) – v1.1.0

Resumen de mejoras implementadas que puedes destacar en ventas y soporte.

### Caja (cuadratura y UX)
- **Cuadratura corregida:** Al cerrar caja se compara solo el efectivo contado con el efectivo esperado; los pagos de deuda no se cuentan dos veces.
- **Historial de caja:** Botón «Historial de esta caja» corregido; modal con mejor contraste (fondo oscuro, texto claro).

### Stock e inventario
- **Validación de stock:** Incluye productos por peso (kg); no se permite vender sin stock suficiente ni dejar stock negativo.
- **Editar/eliminar ventas:** Al editar una venta (cantidades o ítems), el stock se reconcilia; al eliminar venta se restaura stock; al eliminar compra se revierte el stock de esa compra.
- **Rollback en ventas:** Si falla el descuento de stock al crear una venta, la venta se elimina automáticamente.
- **Inventario:** Dos tarjetas de valor (precio costo y precio venta); se recalculan con movimientos de stock.

### Argumentos de venta actualizados
- «La caja cuadra correctamente: solo se compara el efectivo contado con el efectivo esperado.»
- «El stock nunca queda negativo: validación en ventas, ajustes y pérdidas.»
- «Puedes editar ventas ya hechas: el inventario se ajusta solo.»
- «Valor del inventario en costo y en precio de venta, siempre actualizado.»

---

**Última Actualización:** Febrero 2026
