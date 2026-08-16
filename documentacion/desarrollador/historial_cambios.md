# CHANGELOG - POS Minimarket

Todas las mejoras y cambios notables del sistema se documentan aquí.

---

## [1.4.0] - 2026-07-30 - Copiloto IA, Devoluciones y Auditoría Avanzada

### 🤖 1) Copiloto de Inteligencia Artificial (`ai-copilot.js`)
- Widget conversacional flotante y ventana de chat integrada.
- Consultas en lenguaje natural sobre métricas de ventas, alertas de stock bajo y recomendaciones de reposición.
- Endpoint de backend `/ai/query` integrado a agregaciones de datos en SQLite.

### ↩️ 2) Notas de Crédito y Devoluciones (`creditNotes.js`)
- Módulo e interfaz para la emisión formal de devoluciones por clientes.
- Reconciliación y restituciones automáticas de inventario a través de `StockService.restoreSaleStock`.
- Reembolso de dinero o acreditación a saldo a favor en cuenta corriente.

### 🕵️ 3) Auditoría Inmutable del Sistema (`auditLogs.js`)
- Captura de eventos críticos (modificación de precios, cancelaciones de ventas, cierres de caja y logins).
- Panel de inspección de seguridad con filtros avanzados por usuario, rango de fechas y tipo de acción.

### 📦 4) Calculadora de Compras por Cajas/Display (`COMPRA_con_cajas.md`)
- Asistente de cálculo de costos unitarios netos y brutos (IVA 19%) a partir del valor de compra por bulto/caja.
- Conversión automática a unidades físicas individuales y recalculo de costo promedio ponderado.

---

## [1.3.0] - 2026-05-15 - Gastos Operacionales y Presupuesto

### 💸 1) Módulo de Gastos Operacionales (`expenses.js`)
- Registro de gastos por categoría (Arriendo, Servicios, Sueldos, Transporte, Insumos, Mantenimiento).
- Integración con el arqueo de caja para descontar salidas de efectivo inmediatas.
- Impacto directo en el cálculo de la ganancia neta real en el módulo de Reportes.

---

## [1.2.0] - 2026-02-02 - Mejoras de auditoría

Implementación de las 8 correcciones derivadas de la auditoría del sistema para minimarket.

### 1) Validación de datos (ventas, productos, stock)
- **ProductController** y formulario de productos usan **ProductValidator** en alta, edición e importación.
- **SaleValidator** rechaza la venta si el total no coincide con la suma de ítems (tolerancia 0.01).
- Validación de **unicidad de código de barras** al crear producto.
- Importación Excel/CSV valida cada fila con ProductValidator antes de crear/actualizar.

### 2) Seguridad en preload (Electron)
- **getPath**: solo se aceptan nombres en whitelist (`userData`, `temp`, `appData`, `home`, `documents`, `desktop`, `logs`).
- **backupSaveToDisk**: se valida que el payload sea string, tamaño máximo 100 MB y JSON válido.
- Misma validación aplicada al backup enviado en el cierre de la aplicación.

### 3) Vencimientos en producto
- Campo opcional **Fecha de vencimiento** (`expiryDate`) en producto (modelo, DB índice, formulario).
- **ProductValidator** valida formato AAAA-MM-DD si se informa.
- En **Productos**: columna "Venc." con badge "Vencido" / "Próximo a vencer" (7 días).
- En **Inventario**: tarjeta "Próx. a vencer" y tabla con productos que vencen en 7 días.

### 4) Límite de crédito en cliente
- Campo opcional **Límite de crédito** en cliente (modelo, formulario, detalle de cuenta).
- **SaleService.createSale**: antes de crear venta fiada se comprueba que deuda actual + total de la venta no supere el límite; si se supera, se rechaza con mensaje claro.

### 5) Transacción atómica venta + stock
- **SaleService.createSale** usa una sola **transacción IndexedDB** sobre `sales`, `products` y `stockMovements`.
- Si falla cualquier paso (crear venta, actualizar stock, crear movimientos), se hace rollback completo.
- Eliminado el rollback manual de venta huérfana; la atomicidad evita estados inconsistentes.

### 6) Backup automático: rotación y verificación
- **Rotación**: se mantienen solo los últimos 30 archivos de backup (`BACKUP_MAX_FILES`); se borran los más antiguos al guardar uno nuevo.
- **Verificación post-escritura**: tras escribir el archivo se lee y se comprueba tamaño y que el contenido empiece por `{` (JSON de objeto).

### 7) ProductService y separación frontend/backend
- Nuevo **ProductService** con `createProduct(data)` y `updateProduct(id, data)` que centralizan validación (ProductValidator), barcode único y normalización de `expiryDate`.
- **ProductController.saveProduct** e **importación de productos** usan ProductService; las mutaciones de producto pasan por la misma capa de negocio.

### 8) Confirmaciones UX unificadas (modal)
- **updateCashRegister6** y **deleteCashRegister** usan el modal de confirmación de la app (`confirm(message, callback)`) en lugar de `window.confirm`.
- **Configuración > Generar código de recuperación** usa el mismo modal con callback para ejecutar la generación tras confirmar.

---

## [1.0.0] - 2025-12-26

### 🎉 Versión Inicial - Sistema Completo

#### ✨ Características Principales

**Módulo de Productos**
- CRUD completo de productos
- Soporte para productos por unidad y peso
- Código de barras
- Categorización (8 categorías predefinidas)
- Importación masiva desde JSON
- Control automático de stock
- Alertas de stock mínimo
- Búsqueda rápida

**Punto de Venta (POS)**
- Interfaz optimizada para ventas rápidas
- Búsqueda por código de barras o nombre
- Carrito de compras dinámico
- 4 métodos de pago: Efectivo, Tarjeta, QR, Otro
- Productos por peso con entrada manual
- Selección opcional de cliente
- Comprobante digital de venta
- Validación de caja abierta
- Autofocus en búsqueda

**Gestión de Clientes**
- Registro con nombre, teléfono, email
- Historial de compras por cliente
- Búsqueda rápida
- Asociación automática con ventas

**Gestión de Proveedores**
- Registro completo de proveedores
- Información de contacto
- Historial de compras

**Control de Compras**
- Registro de compras multi-producto
- Incremento automático de stock
- Cuentas por pagar
- Pagos parciales
- Estados: Pendiente/Pagado
- Historial completo

**Control de Caja**
- Apertura con monto inicial
- Estado en tiempo real
- Resumen por método de pago
- Cierre con conteo de efectivo
- Alertas automáticas:
  - Sobrante
  - Faltante
  - Cuadre perfecto
- Historial de cajas
- Prevención de ventas sin caja abierta

**Inventario**
- Deducción automática en ventas
- Incremento automático en compras
- Alertas de stock bajo
- Productos sin stock
- Ajustes manuales:
  - Ajuste de inventario
  - Pérdidas/Mermas
  - Consumo interno
- Historial completo de movimientos
- Cálculo de valor total de inventario

**Reportes**
- Ventas diarias
- Ventas semanales
- Ventas mensuales
- Top productos vendidos
- Análisis de rentabilidad (ingresos, costos, ganancia, margen)
- Reporte de stock
- Estadísticas visuales

**Configuración (NUEVO)**
- Estadísticas del sistema
- Exportación completa de datos (JSON)
- Importación de backups
- Exportación a CSV (ventas, productos)
- Limpieza de cache
- Reinstalación de PWA
- Eliminación de todos los datos
- Monitoreo de almacenamiento

#### 🎨 Interfaz y UX

- Diseño responsive (móvil y desktop)
- Notificaciones visuales
- Modales para formularios
- Confirmaciones de acciones críticas
- Loading states
- Empty states
- Badges de estado
- Indicador de caja abierta/cerrada en sidebar
- Atajos de teclado:
  - Alt + 1-9: Navegación rápida
  - Ctrl + K: Buscar producto
  - Ctrl + B: Crear backup
  - Esc: Cerrar modal
  - Enter: Agregar producto (POS)

#### 🔧 Características Técnicas

- JavaScript Vanilla (sin frameworks)
- IndexedDB para almacenamiento local
- PWA con Service Worker
- Funcionalidad 100% offline
- Formato de moneda: CLP (Peso Chileno)
- Arquitectura MVC
- 9 stores en base de datos
- 7 modelos de datos
- 6 controladores
- 9 vistas
- Cache de aplicación
- Manejo de errores robusto
- Validaciones de formularios
- Advertencia al cerrar con venta en curso

#### 📚 Documentación

- README.md completo
- DOCUMENTACION.md detallada
- INICIO-RAPIDO.md tutorial
- DESPLIEGUE.md para producción
- productos-ejemplo.json con 25 productos
- Comentarios en código crítico

#### 🔒 Seguridad

- Almacenamiento local seguro
- Validaciones de entrada
- Confirmación de acciones destructivas
- Sin exposición de datos sensibles

---

## [1.1.0] - 2026-02-02

### Fixed – Caja (cuadratura y UX)

- **Cuadratura al cerrar caja:** Se eliminó la duplicación de pagos de deuda en el resumen; el efectivo esperado usa solo el resumen por método de pago de ventas. La diferencia (sobrante/faltante) se calcula comparando **solo el efectivo contado** con el efectivo esperado (la vista envía solo efectivo, no la suma de todos los medios).
- **SaleRepository.getTotalByPaymentMethod:** Ajuste para ventas `pending`/`partial` sin `paymentDetails`: se evita doble conteo con registros de `Payment`; si no hay Payment y hay `paidAmount`, se atribuye al método de la venta o efectivo.
- **Vista Caja:** Botón «Historial de esta caja» corregido (variable en scope). Modal del historial con fondo oscuro y texto claro para mejor contraste.

### Fixed – Stock e inventario

- **ProductValidator:** Validación de stock para productos tipo `weight`; uso de `parseFloat` y validación de cantidad.
- **Product.updateStock:** Uso de `parseFloat`; se lanza error si una resta dejaría stock negativo.
- **Sale.updateSale:** Reconciliación de stock al editar ítems (cantidades o ítems eliminados): se restaura o descuenta stock según diferencias por `productId`.
- **Purchase.delete:** Antes de eliminar la compra se llama a `StockService.revertPurchaseStock()`.
- **SaleService.createSale:** Si `StockService.processSaleStock()` falla después de crear la venta, se elimina la venta (rollback).
- **StockService.processSaleStock:** Validación de stock con `ProductValidator.validateStock()` antes de restar.
- **StockService.createAdjustment:** Si la cantidad es negativa se valida stock suficiente; si es 0 no se realiza operación.
- **ProductRepository.findLowStock:** Uso de `parseFloat` y manejo de `minStock` indefinido (tratado como 0).

### Changed – Inventario (vista)

- Tarjeta «Valor Inventario» renombrada a **«Valor Inventario Precio Costo»**.
- Nueva tarjeta **«Valor Inventario Precio Venta»** (stock × precio de venta). Ambos valores se recalculan con los movimientos de stock.

---

## Roadmap - Futuras Mejoras

### [1.1.0] - Planificado
- [ ] Gestión de múltiples usuarios/cajeros
- [ ] Permisos y roles
- [ ] Impresión de tickets
- [ ] Integración con impresoras térmicas

### [1.2.0] - Planificado
- [ ] Descuentos y promociones
- [ ] Cupones
- [ ] Programa de fidelidad
- [ ] Puntos de cliente

### [1.3.0] - Planificado
- [ ] Sincronización con servidor en la nube
- [ ] Backup automático en servidor
- [ ] Multi-tienda
- [ ] Reportes avanzados con gráficos

### [2.0.0] - Futuro
- [ ] Integración con balanza digital
- [ ] Facturación electrónica SII Chile
- [ ] Integración con pasarelas de pago
- [ ] App móvil nativa (React Native)
- [ ] Dashboard en tiempo real
- [ ] Inteligencia artificial para predicción de stock

---

## Formato del Changelog

Este changelog sigue el formato de [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y el proyecto adhiere a [Versionado Semántico](https://semver.org/lang/es/).

### Tipos de Cambios
- **Added** (Agregado): Nuevas características
- **Changed** (Cambiado): Cambios en funcionalidad existente
- **Deprecated** (Obsoleto): Características que serán removidas
- **Removed** (Removido): Características removidas
- **Fixed** (Arreglado): Corrección de bugs
- **Security** (Seguridad): Mejoras de seguridad

---

**Última actualización:** 2 de Febrero, 2026
