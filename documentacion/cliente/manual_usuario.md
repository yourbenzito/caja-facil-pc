# 🛒 MANUAL DE USUARIO - SISTEMA DE VENTAS LA KURVA

**Versión:** 1.4.0  
**Bienvenido al Sistema de Gestión para Minimarkets**

---

## 🆕 NOVEDADES DE LA VERSIÓN 1.4.0

### Novedades y Módulos Incorporados

- ✅ **Copiloto de Inteligencia Artificial (`ai-copilot.js`)** - Asistente inteligente integrado para consultar ventas, productos con stock crítico, proyecciones de reposición e insumos de negocio mediante lenguaje natural.
- ✅ **Notas de Crédito y Devoluciones (`creditNotes.js`)** - Gestión oficial de devoluciones de productos por parte de los clientes, restituyendo el dinero o saldo a favor y ajustando el stock automáticamente en inventario.
- ✅ **Gastos Operacionales Avanzados (`expenses.js`)** - Control total de arriendos, servicios públicos, sueldos y mantenimientos con presupuestos mensuales y gráficos comparativos por categoría.
- ✅ **Visor de Auditoría e Historial del Sistema (`auditLogs.js`)** - Registro inmutable de seguridad que guarda cada inicio de sesión, edición de precios, aperturas/cierres de caja y eliminaciones.
- ✅ **Calculadora de Compras por Cajas y Bultos (`COMPRA_con_cajas.md`)** - Desglose automático de facturas de proveedores expresadas en formato de cajas/display a unidades netas y brutas individuales con cálculo automático de costo unitario promedio.
- ✅ **Control de Caja y Cuadratura Precisa** - Registro en tiempo real de todos los movimientos de efectivo sin doble contabilización en abonos a crédito.
- ✅ **Alertas de Vencimiento de Productos** - Control automático de fechas de caducidad en el módulo de Inventario y Productos.

---

---

## 📋 ÍNDICE

1. [Introducción](#introducción)
2. [Primeros Pasos](#primeros-pasos)
3. [Inicio de Sesión](#inicio-de-sesión)
4. [Módulos del Sistema](#módulos-del-sistema)
5. [Proceso Completo de Venta](#proceso-completo-de-venta)
6. [Guías por Módulo](#guías-por-módulo)
7. [Reportes y Análisis](#reportes-y-análisis)
8. [Backup y Seguridad](#backup-y-seguridad)
9. [Solución de Problemas](#solución-de-problemas)
10. [Preguntas Frecuentes](#preguntas-frecuentes)

---

## 👋 INTRODUCCIÓN

### ¿Qué es el Sistema La Kurva?

El Sistema La Kurva es una solución completa de gestión para minimarkets que funciona **100% offline**. Le permite controlar:

- ✅ Ventas y punto de venta
- ✅ Inventario y productos
- ✅ Clientes y fiados (ventas a crédito)
- ✅ Proveedores y compras
- ✅ Control de caja
- ✅ Gastos operacionales
- ✅ Reportes de rentabilidad

### Características Principales

- 🚀 **Funciona sin internet** - Todo se guarda localmente en su computadora
- 💾 **Datos seguros** - Sus datos están en su computadora, no en la nube
- 📊 **Reportes automáticos** - Sepa cuánto gana con reportes detallados
- 🎯 **Fácil de usar** - Interfaz simple e intuitiva
- 💰 **Sin costos mensuales** - Pago único, sin suscripciones

---

## 🚀 PRIMEROS PASOS

### Requisitos del Sistema

- Windows 10 o superior
- 500 MB de espacio en disco
- No requiere internet (funciona completamente offline)

### Instalación

1. Ejecute el archivo `Sistema de Ventas Setup 1.0.0.exe`
2. Siga las instrucciones del instalador
3. Complete la instalación
4. El sistema se abrirá automáticamente

### Primera Configuración

Al abrir el sistema por primera vez:

1. **Usuario:** `admin`
2. **Contraseña:** `admin123`
3. **⚠️ IMPORTANTE:** Cambie la contraseña inmediatamente en Configuración

---

## 🔐 INICIO DE SESIÓN

### Pantalla de Login

Al abrir el sistema, verá la pantalla de inicio de sesión:

1. Ingrese su **usuario**
2. Ingrese su **contraseña**
3. Haga clic en **"Iniciar Sesión"**

### Cambiar Contraseña

1. Vaya a **Configuración** (⚙️ en el menú)
2. Busque la sección **"Seguridad"**
3. Haga clic en **"Cambiar Contraseña"**
4. Ingrese contraseña actual y nueva
5. Confirme el cambio

### Recuperar Contraseña

Si olvidó su contraseña:

1. En la pantalla de login, haga clic en **"¿Olvidaste tu contraseña?"**
2. Ingrese su código de recuperación (si lo tiene)
3. O contacte al soporte técnico

---

## 📦 MÓDULOS DEL SISTEMA

El sistema tiene **15 módulos principales**:

### 1. 🛒 Punto de Venta (POS)
**Función:** Realizar ventas rápidas y eficientes
**Qué hace:**
- Buscar productos por código de barras o nombre.
- Agregar productos al carrito con cantidades por unidad o peso (kg).
- Seleccionar método de pago (efectivo, tarjeta, QR, fiado).
- Aplicar Ley de Redondeo (20.956) en efectivo y calcular vuelto.
- Emitir ticket/comprobante de venta y descontar stock automáticamente.

---

### 2. 📦 Productos
**Función:** Gestionar el catálogo de productos
**Qué hace:**
- Crear, editar y desactivar productos.
- Asignar códigos de barras, precios de costo, precios de venta y categorías.
- Configurar stock mínimo, stock deseado y fecha de vencimiento.
- Importar y exportar productos en lote (JSON / CSV).

---

### 3. 👥 Clientes y Cuentas Corrientes
**Función:** Gestionar clientes y ventas a crédito (fiados)
**Qué hace:**
- Crear fichas de clientes con límite de crédito configurado.
- Registrar ventas a crédito ("Anotar").
- Registrar abonos parciales o totales a deudas pendientes.
- Consultar historial completo de compras y estado de cuenta corriente.

---

### 4. 🚚 Proveedores
**Función:** Gestionar proveedores y directorio comercial
**Qué hace:**
- Mantener registro de contactos, teléfonos y direcciones de proveedores.
- Consultar historial de compras realizadas a cada proveedor.
- Ver deudas y facturas pendientes de pago a proveedores.

---

### 5. 📋 Compras y Recepción (con Calculadora de Cajas/Empaques)
**Función:** Registrar compras e ingresos de mercadería
**Qué hace:**
- Registrar facturas o guías de despacho de compras a proveedores.
- **Calculadora de Cajas/Bultos:** Desglosar automáticamente productos comprados en display o caja de N unidades, calculando el costo unitario exacto (neto o bruto con IVA 19%).
- Actualización automática del costo promedio de inventario y del stock físico.

---

### 6. 💸 Gastos Operacionales
**Función:** Control de egresos del negocio
**Qué hace:**
- Registrar gastos operativos (arriendo, servicios básicos, sueldos, transporte).
- Categorización visual y presupuestos mensuales.
- Impacto directo en el cálculo de la ganancia neta real en Reportes.
- Descuento automático de efectivo en caja si el gasto se pagó en efectivo.

---

### 7. ↩️ Notas de Crédito y Devoluciones
**Función:** Registrar devoluciones de clientes y notas de crédito
**Qué hace:**
- Procesar la devolución parcial o total de ítems de una venta previa.
- Reingresar los productos devueltos al stock del inventario.
- Emitir reembolso en efectivo o crédito a favor en la cuenta del cliente.
- Historial transparente y oficial de notas de crédito emitidas.

---

### 8. 🤖 Copiloto IA (Asistente Inteligente)
**Función:** Asistente conversacional de inteligencia artificial
**Qué hace:**
- Responder preguntas sobre el estado del negocio mediante lenguaje natural.
- Consultar productos con stock crítico o próximos a vencer.
- Obtener sugerencias sobre qué productos comprar a los proveedores.
- Resumir ventas del día, semana o mes al instante.

---

### 9. 🕵️ Registro del Sistema y Auditoría
**Función:** Historial inalterable de seguridad
**Qué hace:**
- Registrar automáticamente cada acción realizada por los usuarios (login, cambios de precios, eliminaciones).
- Filtros avanzados por fecha, usuario o tipo de acción (críticas vs ediciones).
- Garantizar la trazabilidad y la prevención de fraudes o errores internos.

---

### 10. 💰 Caja Registradora y Arqueo
**Función:** Control diario de flujo de dinero
**Qué hace:**
- Apertura con declaración de saldo inicial.
- Registrar ingresos o retiros manuales de efectivo.
- Arqueo final comparando el efectivo real contado contra el efectivo esperado en sistema.
- Generar reporte de cierre de turno y cuadratura de caja.

---

### 11. 📊 Inventario, Kardex y Mermas
**Función:** Control físico y financiero del stock
**Qué hace:**
- Registro de Kardex (historial de movimientos por producto).
- Realizar ajustes manuales de stock, pérdidas/mermas o consumo interno.
- Tarjetas de valorización total del inventario a precio costo y precio venta.
- Alertas visuales de stock bajo y productos vencidos/próximos a caducar.

---

### 12. 📈 Reportes y Rentabilidad
**Función:** Análisis estadístico y ganancias del negocio
**Qué hace:**
- Reportes de ventas por período, por producto y por vendedor.
- **Reporte de Rentabilidad Neta Real:** Muestra ventas brutas, costo de ventas (al costo histórico), ganancia bruta y ganancia neta (deduciendo gastos).
- Gráficos interactivos y opción de exportación en Excel/PDF.

---

### 13. 📋 Historial de Ventas y Comprobantes
**Función:** Consulta y reemisión de ventas
**Qué hace:**
- Listado navegable de todas las transacciones realizadas.
- Ver detalle de productos, cliente y forma de pago.
- Reimprimir comprobantes o tickets de venta.
- Iniciar procesos de edición o devolución/anulación.

---

### 14. 🎯 Dashboard (Visor General)
**Función:** Panel central con métricas clave del día
**Qué hace:**
- Indicadores rápidos del total vendido en el día.
- Gráficos de tendencias de ventas por hora.
- Accesos directos a la apertura de caja y emisión rápida de comprobantes.

---

### 15. ⚙️ Configuración, Usuarios y Respaldos
**Función:** Administración general y seguridad del programa
**Qué hace:**
- Gestión de usuarios y asignación de permisos (Administrador / Cajero).
- Configuración de datos del negocio para los tickets de venta.
- Generación de respaldos (Backups en JSON) e importación de copias de seguridad.
- Cambio de claves de acceso y PIN de administrador.

---

## 🛒 PROCESO COMPLETO DE VENTA

### Flujo Paso a Paso

#### **1. Abrir Caja (Primera vez del día)**

1. Ir a **Caja**
2. Ingresar monto inicial
3. Clic en **"Abrir Caja"**
4. ✅ Caja abierta - puede comenzar a vender

---

#### **2. Realizar una Venta al Contado**

1. Ir a **Punto de Venta**
2. Buscar producto (escanear código de barras o escribir nombre)
3. Producto se agrega al carrito automáticamente
4. Repetir para más productos
5. Ver total en carrito
6. Seleccionar método de pago:
   - 💵 **Efectivo** - Para pagos en efectivo
   - 💳 **Tarjeta** - Para pagos con tarjeta
   - 📱 **QR** - Para pagos con código QR
   - ➕ **Otro** - Otros métodos
7. Clic en método de pago
8. ✅ Venta completada - Stock actualizado automáticamente

---

#### **3. Realizar una Venta a Crédito (Fiado)**

1. Ir a **Punto de Venta**
2. Clic en **"Seleccionar Cliente"**
3. Buscar o crear cliente
4. Agregar productos al carrito
5. Clic en **"Anotar"** (venta a crédito)
6. Opcional: Ingresar abono inicial
7. ✅ Venta anotada - Cliente debe pagar después

**Para Registrar Pago de Deuda:**
1. Ir a **Clientes**
2. Buscar cliente
3. Ver deuda pendiente
4. Clic en **"Registrar Pago"**
5. Ingresar monto y método de pago
6. ✅ Pago registrado - Deuda actualizada

---

#### **4. Cerrar Caja (Fin del día)**

1. Ir a **Caja**
2. Ver resumen:
   - Efectivo esperado
   - Total en tarjeta
   - Total de ventas
3. Contar efectivo físico real
4. Clic en **"Cerrar Caja"**
5. Ingresar monto real contado
6. Sistema mostrará diferencia:
   - **Sobrante:** Hay más dinero del esperado
   - **Faltante:** Hay menos dinero del esperado
   - **Cuadra:** Coincide perfectamente
7. Confirmar cierre
8. ✅ Caja cerrada - Puede generar reportes

---

## 📚 GUÍAS DETALLADAS POR MÓDULO

### 🛒 Punto de Venta - Guía Completa

#### Búsqueda de Productos

**Método 1: Código de Barras**
1. Hacer clic en campo de búsqueda
2. Escanear código de barras
3. Producto se agrega automáticamente

**Método 2: Nombre**
1. Escribir nombre del producto
2. Sistema muestra sugerencias
3. Seleccionar producto de la lista

**Método 3: Atajo de Teclado**
- Presionar `Ctrl + K` para buscar rápidamente

#### Gestión del Carrito

- **Agregar producto:** Buscar y seleccionar
- **Modificar cantidad:** Clic en cantidad y escribir nueva
- **Eliminar producto:** Clic en botón eliminar (🗑️)
- **Limpiar carrito:** Clic en "Limpiar"

#### Métodos de Pago

**Efectivo:**
- Para pagos en efectivo
- Se suma al efectivo esperado de la caja

**Tarjeta:**
- Para pagos con tarjeta de débito/crédito
- No afecta el efectivo físico

**QR:**
- Para pagos con código QR (transferencias)
- No afecta el efectivo físico

**Otro:**
- Para otros métodos de pago
- Puede especificar en notas

**Pago Mixto:**
- Puede dividir el pago entre varios métodos
- Ejemplo: $5.000 efectivo + $3.000 tarjeta

#### Ventas a Crédito

1. Seleccionar cliente antes de agregar productos
2. Agregar productos al carrito
3. Clic en **"Anotar"** en lugar de método de pago
4. Opcional: Ingresar abono inicial
5. Venta se registra como pendiente
6. Cliente puede pagar después en módulo Clientes

---

### 📦 Productos - Guía Completa

#### Crear Producto

1. Ir a **Productos**
2. Clic en **"Nuevo Producto"**
3. Completar campos:
   - **Nombre:** Nombre del producto (requerido)
   - **Código de Barras:** Opcional, puede escanear después
   - **Precio:** Precio de venta (requerido)
   - **Costo:** Costo de compra (requerido)
   - **Stock:** Cantidad inicial (requerido)
   - **Stock Mínimo:** Alerta cuando baja a este nivel
   - **Categoría:** Organizar productos
   - **Tipo:** Unidad (por pieza) o Peso (por kilo)
4. Guardar

#### Editar Producto

1. Buscar producto en lista
2. Clic en producto
3. Modificar campos necesarios
4. Guardar cambios

#### Importar Productos

1. Ir a **Productos**
2. Clic en **"Importar"**
3. Pegar JSON con productos (formato específico)
4. Clic en **"Importar"**
5. Sistema mostrará resultados

---

### 👥 Clientes - Guía Completa

#### Crear Cliente

1. Ir a **Clientes**
2. Clic en **"Nuevo Cliente"**
3. Completar:
   - **Nombre:** Nombre completo (requerido)
   - **Teléfono:** Opcional pero recomendado
   - **Email:** Opcional
4. Guardar

#### Ver Cuenta Corriente

1. Buscar cliente
2. Clic en cliente
3. Ver:
   - Deuda total pendiente
   - Ventas pendientes de pago
   - Historial de pagos
   - Historial de compras

#### Registrar Pago de Deuda

**Opción 1: Pago Total**
1. En cuenta corriente del cliente
2. Clic en **"Pagar Total"**
3. Seleccionar método de pago
4. Confirmar

**Opción 2: Pago Parcial**
1. En cuenta corriente del cliente
2. Clic en **"Registrar Pago"**
3. Ingresar monto a pagar
4. Seleccionar método de pago
5. Confirmar

**Opción 3: Pago de Venta Específica**
1. Ver lista de ventas pendientes
2. Clic en venta específica
3. Clic en **"Pagar"**
4. Ingresar monto (puede ser parcial)
5. Confirmar

---

### 🚚 Proveedores - Guía Completa

#### Crear Proveedor

1. Ir a **Proveedores**
2. Clic en **"Nuevo Proveedor"**
3. Completar:
   - **Nombre:** Nombre del proveedor
   - **Contacto:** Persona de contacto
   - **Teléfono:** Teléfono
   - **Email:** Email (opcional)
4. Guardar

#### Ver Historial de Compras

1. Buscar proveedor
2. Clic en proveedor
3. Ver todas las compras realizadas
4. Ver cuentas por pagar

---

### 📋 Compras - Guía Completa

#### Registrar Compra

1. Ir a **Compras**
2. Clic en **"Nueva Compra"**
3. Seleccionar proveedor
4. Agregar productos:
   - Buscar producto
   - Ingresar cantidad comprada
   - Ingresar costo unitario
   - Opcional: Actualizar precio de venta
5. Repetir para cada producto
6. Ver total de compra
7. Opcional: Registrar pago inicial
8. Guardar compra

**Resultado:**
- ✅ Stock se actualiza automáticamente
- ✅ Costo promedio se recalcula automáticamente
- ✅ Movimiento de inventario registrado

#### Pagar Compra a Proveedor

1. Ver compras pendientes
2. Seleccionar compra
3. Clic en **"Registrar Pago"**
4. Ingresar monto pagado
5. Confirmar

---

### 💸 Gastos - Guía Completa

#### Registrar Gasto

1. Ir a **Gastos**
2. Clic en **"Nuevo Gasto"**
3. Completar:
   - **Descripción:** Qué es el gasto
   - **Monto:** Cuánto costó
   - **Categoría:** Tipo de gasto
   - **Método de Pago:** Cómo se pagó
   - **Notas:** Información adicional
4. Guardar

**Importante:**
- Si paga en efectivo, el gasto afecta el efectivo esperado de la caja
- Los gastos se incluyen en reportes de rentabilidad

---

### 💰 Caja - Guía Completa

#### Abrir Caja

**Opción 1: Contar por Denominaciones**
1. Seleccionar **"Contar por denominaciones"**
2. Ingresar cantidad de cada billete/moneda:
   - $20.000, $10.000, $5.000, $2.000, $1.000
   - $500, $100, $50, $10
3. Sistema calcula total automáticamente
4. Clic en **"Abrir Caja"**

**Opción 2: Ingreso Rápido**
1. Seleccionar **"Ingreso rápido"**
2. Ingresar monto total
3. Clic en **"Abrir Caja"**

#### Agregar Dinero a la Caja

**Cuándo usar:**
- Reposición de efectivo
- Cambio para ventas
- Cualquier ingreso de dinero que no sea venta

**Proceso:**
1. Con caja abierta, clic en **"➕ Agregar Dinero"**
2. Ingresar monto
3. Opcional: Ingresar motivo
4. Confirmar
5. ✅ Dinero agregado - Afecta efectivo esperado

#### Retirar Dinero de la Caja

**Cuándo usar:**
- Retiro para compras
- Pago a proveedor en efectivo
- Cualquier salida de dinero que no sea gasto

**Proceso:**
1. Con caja abierta, clic en **"➖ Retirar Dinero"**
2. Ingresar monto (no puede exceder efectivo disponible)
3. Opcional: Ingresar motivo
4. Confirmar
5. ✅ Dinero retirado - Afecta efectivo esperado

#### Ver Resumen de Caja

El resumen muestra:
- **Monto Inicial:** Dinero con que se abrió la caja
- **Total Ventas:** Número de ventas realizadas
- **Pagos de Deuda:** Pagos de clientes registrados
- **Efectivo Esperado:** Dinero que debería haber en caja
- **Resumen por Método de Pago:** Desglose de ingresos
- **Registro de Movimientos:** Historial de agregar/retirar dinero

#### Cerrar Caja

1. Contar el **efectivo físico** real en caja (solo billetes y monedas).
2. Clic en **"Cerrar Caja"**.
3. En la cuadratura por medios (Efectivo, Tarjeta, QR, Otro), ingrese lo que contó en cada uno. El valor que se usa para comparar con lo esperado es **solo el efectivo contado** (no la suma de todos los medios).
4. El sistema mostrará:
   - **Sobrante:** Hay más efectivo del esperado (verde)
   - **Faltante:** Hay menos efectivo del esperado (rojo)
   - **Cuadra:** Coincide perfectamente
5. Confirmar cierre.
6. ✅ Caja cerrada - Puede generar reportes

---

### 📊 Inventario - Guía Completa

#### Ver Estado del Inventario

El módulo muestra:
- **Todos los productos** con su stock actual
- **Productos con stock bajo** (alerta)
- **Productos sin stock** (urgente)
- **Valor inventario precio costo** – Total del inventario calculado con el costo de cada producto (stock × costo)
- **Valor inventario precio venta** – Total del inventario calculado con el precio de venta de cada producto (stock × precio). Ambos valores se actualizan con los movimientos de stock (ventas, compras, ajustes, etc.)

#### Ajustar Stock

**Tipos de ajuste:**
1. **Ajuste Manual:** Corrección de inventario
2. **Pérdida/Merma:** Productos dañados, vencidos, etc.
3. **Consumo Interno:** Uso propio del negocio

**Proceso:**
1. Buscar producto
2. Clic en **"Ajuste de Stock"**
3. Seleccionar tipo
4. Ingresar cantidad
5. Ingresar motivo
6. Guardar

---

### 📈 Reportes - Guía Completa

#### Tipos de Reportes

**1. Ventas Diarias**
- Número de ventas del día
- Total vendido
- Promedio por venta
- Desglose por método de pago

**2. Ventas Semanales**
- Resumen de la semana
- Comparativa día a día

**3. Ventas Mensuales**
- Resumen del mes
- Total de ventas
- Promedios

**4. Por Producto**
- Productos más vendidos
- Cantidad vendida
- Total por producto

**5. Rentabilidad** ⭐ **MÁS IMPORTANTE**
- **Ingresos:** Total de ventas + pagos
- **Costo de Ventas:** Costo de productos vendidos
- **Ganancia Bruta:** Ingresos - Costo de Ventas
- **Gastos Operacionales:** Total de gastos
- **Ganancia Neta:** Ganancia Bruta - Gastos
- **Margen:** Porcentaje de ganancia
- Desglose por producto y categoría

**6. Stock**
- Productos con stock bajo
- Productos sin stock
- Valor total del inventario

#### Cómo Interpretar el Reporte de Rentabilidad

**Ejemplo:**
- Ingresos: $1.000.000
- Costo de Ventas: $600.000
- Ganancia Bruta: $400.000 (40% margen bruto)
- Gastos Operacionales: $150.000
- **Ganancia Neta: $250.000 (25% margen neto)**

**Interpretación:**
- Por cada $100 vendidos, gana $25 después de todos los costos
- Los gastos representan el 15% de los ingresos
- La ganancia bruta es del 40%

---

## 💾 BACKUP Y SEGURIDAD

### ¿Por qué hacer Backup?

- Protege sus datos ante fallos del computador
- Permite restaurar información si algo sale mal
- Puede transferir datos a otra computadora

### Hacer Backup

1. Ir a **Configuración**
2. Sección **"Backup y Restauración"**
3. Clic en **"Exportar Todo (JSON)"**
4. Guardar archivo en lugar seguro (USB, email, nube)
5. **Recomendación:** Hacer backup semanal

### Restaurar Backup

1. Ir a **Configuración**
2. Clic en **"Importar Datos (JSON)"**
3. Seleccionar archivo de backup
4. Confirmar importación
5. ⚠️ **Advertencia:** Esto puede sobrescribir datos existentes

### Exportar a CSV

Para usar en Excel u otros programas:

1. Ir a **Configuración**
2. Clic en **"Exportar Ventas (CSV)"** o **"Exportar Productos (CSV)"**
3. Abrir archivo en Excel

---

## 🔧 SOLUCIÓN DE PROBLEMAS

### Problema: No puedo iniciar sesión

**Solución:**
1. Verificar usuario y contraseña
2. Si olvidó contraseña, usar código de recuperación
3. Contactar soporte técnico

### Problema: El stock no se actualiza

**Solución:**
1. Verificar que la venta se completó correctamente
2. Revisar en **Inventario** si el producto existe
3. Si persiste, contactar soporte

### Problema: La caja no cuadra

**Solución:**
1. Verificar que todas las ventas están registradas
2. Verificar movimientos de caja (agregar/retirar)
3. Verificar gastos pagados en efectivo
4. Revisar registro de movimientos en **Caja**

### Problema: No puedo eliminar un producto

**Solución:**
- El producto tiene ventas asociadas
- No se puede eliminar para mantener integridad de datos
- Puede desactivarlo editándolo (recomendado)

### Problema: No puedo eliminar un cliente

**Solución:**
- El cliente tiene deuda pendiente
- Debe liquidar todas las deudas primero
- O el cliente tiene ventas pendientes

---

## ❓ PREGUNTAS FRECUENTES

### ¿Necesito internet para usar el sistema?

**No.** El sistema funciona completamente offline. Todos los datos se guardan localmente en su computadora.

### ¿Puedo usar el sistema en varias computadoras?

Actualmente el sistema funciona en una computadora. Los datos están en esa computadora específica. Para usar en varias computadoras, se necesita una versión especial (consultar con soporte).

### ¿Qué pasa si se daña mi computadora?

Si tiene backups regulares, puede restaurar todos sus datos en otra computadora. **Por eso es importante hacer backups semanales.**

### ¿Puedo cambiar precios masivamente?

Sí, puede editar productos individualmente o importar productos con nuevos precios desde archivo JSON.

### ¿Cómo sé cuánto gano realmente?

Use el **Reporte de Rentabilidad** en el módulo **Reportes**. Este reporte muestra:
- Ingresos totales
- Costo de productos vendidos
- Gastos operacionales
- **Ganancia neta real**

### ¿Puedo ver ventas de días anteriores?

Sí, en **Historial de Ventas** puede filtrar por fecha y ver todas las ventas realizadas.

### ¿Cómo funcionan los fiados?

1. Realiza venta a crédito seleccionando cliente y clic en "Anotar"
2. La venta queda pendiente
3. Cuando el cliente paga, va a **Clientes**, busca al cliente y registra el pago
4. La deuda se actualiza automáticamente

### ¿Puedo editar una venta ya realizada?

Sí, en **Historial de Ventas** puede editar ventas si es necesario. Use con cuidado.

### ¿Qué significa "Efectivo Esperado"?

Es el dinero que **debería** haber en caja según:
- Monto inicial
- + Ventas en efectivo
- + Pagos en efectivo
- + Dinero agregado manualmente
- - Dinero retirado manualmente
- - Gastos pagados en efectivo

### ¿Cómo registro un gasto pagado con tarjeta?

En **Gastos**, al crear el gasto, seleccione método de pago "Tarjeta". El gasto se registra pero no afecta el efectivo físico.

---

## ⌨️ ATAJOS DE TECLADO

Para trabajar más rápido:

- **Alt + 1:** Ir a Punto de Venta
- **Alt + 2:** Ir a Productos
- **Alt + 3:** Ir a Clientes
- **Alt + 4:** Ir a Proveedores
- **Alt + 5:** Ir a Compras
- **Alt + 6:** Ir a Gastos
- **Alt + 7:** Ir a Caja
- **Alt + 8:** Ir a Inventario
- **Alt + 9:** Ir a Reportes
- **Ctrl + K:** Buscar producto (en POS)
- **Ctrl + B:** Crear backup
- **Esc:** Cerrar modal
- **Enter:** Agregar producto al carrito (en POS)

---

## 📞 SOPORTE TÉCNICO

### Contacto

**Email:** [Email de soporte]  
**WhatsApp:** [Número de WhatsApp]  
**Horario:** [Horario de atención]

### Qué Incluir al Contactar Soporte

1. Descripción del problema
2. Pasos para reproducirlo
3. Captura de pantalla (si aplica)
4. Versión del sistema (ver en Configuración)

---

## ✅ CHECKLIST DE USO DIARIO

### Inicio del Día
- [ ] Abrir caja
- [ ] Verificar stock bajo (en Inventario)
- [ ] Revisar ventas pendientes (en Clientes)

### Durante el Día
- [ ] Realizar ventas normalmente
- [ ] Registrar pagos de clientes cuando lleguen
- [ ] Registrar gastos cuando ocurran
- [ ] Agregar/retirar dinero de caja si es necesario

### Fin del Día
- [ ] Cerrar caja
- [ ] Revisar reporte diario
- [ ] Hacer backup (recomendado semanal, mínimo mensual)

---

## 🎯 CONSEJOS PARA MEJOR USO

1. **Haga backups regulares** - Al menos semanalmente
2. **Mantenga productos actualizados** - Precios y stock
3. **Registre todos los gastos** - Para reportes precisos
4. **Use categorías** - Facilita organización y reportes
5. **Revise reportes semanalmente** - Para tomar decisiones informadas
6. **Cierre la caja diariamente** - Para control preciso
7. **Registre pagos de clientes inmediatamente** - Mantiene deudas actualizadas

---

## 📚 GLOSARIO

- **POS:** Punto de Venta
- **Fiado:** Venta a crédito (el cliente paga después)
- **Cuenta Corriente:** Historial de compras y pagos de un cliente
- **Stock:** Cantidad de productos disponibles
- **Costo Promedio:** Costo calculado automáticamente al comprar productos
- **Efectivo Esperado:** Dinero que debería haber según registros
- **Ganancia Bruta:** Ingresos - Costo de Ventas
- **Ganancia Neta:** Ganancia Bruta - Gastos Operacionales
- **Margen:** Porcentaje de ganancia sobre ventas

---

**¡Gracias por usar el Sistema La Kurva!**

Para más ayuda, consulte la sección de Soporte Técnico o contacte directamente.

**Versión del Manual:** 1.1.0  
**Última Actualización:** Febrero 2026

---

## 🆕 MEJORAS RECIENTES

### Control de Caja Automático

Ahora el sistema registra automáticamente todos los movimientos de efectivo:

- ✅ **Ventas en efectivo** - Se registran automáticamente al completar la venta
- ✅ **Pagos de deudas en efectivo** - Se registran al recibir pagos de clientes
- ✅ **Pagos de compras en efectivo** - Se registran al pagar a proveedores
- ✅ **Gastos en efectivo** - Se registran al crear gastos pagados en efectivo

Esto asegura que el balance de caja siempre sea preciso y refleje todos los movimientos de dinero.

### Gestión de Stock Mejorada

- ✅ **Al eliminar una venta** - El stock de los productos se restaura automáticamente
- ✅ **Al eliminar una compra** - El stock y el costo promedio se revierten correctamente
- ✅ **Al editar una venta** - El stock se ajusta según los cambios realizados
- ✅ **Validación de stock** - El sistema previene ventas cuando no hay suficiente stock

### Reportes Más Precisos

Los reportes de rentabilidad ahora son más precisos porque:

- ✅ Usan el **costo histórico** de los productos (costo al momento de la venta)
- ✅ No se ven afectados por cambios posteriores en los costos
- ✅ Muestran la ganancia real que obtuvo en cada venta

### Validaciones Mejoradas

El sistema ahora previene errores comunes:

- ✅ **No permite sobrepagos** - Valida que no se pague más de lo debido
- ✅ **Valida stock antes de vender** - Previene ventas con stock insuficiente (incluye productos por **unidad** y por **peso (kg)**)
- ✅ **Valida montos** - Asegura que los pagos sean correctos
- ✅ **Stock nunca negativo** - No permite vender, ajustar ni registrar pérdidas/consumo si dejaría stock negativo

### Cuadratura de Caja

- ✅ Al cerrar caja, los **pagos de deuda** (clientes que pagan después) se cuentan una sola vez en el efectivo y tarjetas esperados
- ✅ La **diferencia (sobrante/faltante)** se calcula comparando solo el **efectivo contado** con el efectivo esperado

### Historial de Caja

- ✅ El botón **"Historial de esta caja"** abre correctamente el historial de la caja actual
- ✅ El modal del historial usa **fondo oscuro y texto claro** para una lectura más cómoda