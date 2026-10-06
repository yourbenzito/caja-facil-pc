# 📘 CAJA FÁCIL POS — CATÁLOGO FUNCIONAL Y DE MÓDULOS DEL SISTEMA

Este documento describe con máxima precisión y detalle técnico-funcional cada módulo, pantalla, botón, validación y regla de negocio de **Caja Fácil PC POS**.

---

## 📑 ÍNDICE DE MÓDULOS

1. [Punto de Venta (POS) & Cobro Rápido](#1-punto-de-venta-pos--cobro-rápido)
2. [Historial y Detalle de Ventas](#2-historial-y-detalle-de-ventas)
3. [Caja Registradora, Turnos y Arqueo Ciego](#3-caja-registradora-turnos-y-arqueo-ciego)
4. [Control de Inventario, Kardex y Mermas](#4-control-de-inventario-kardex-y-mermas)
5. [Catálogo de Productos y Balanza](#5-catálogo-de-productos-y-balanza)
6. [Clientes, Cuentas Corrientes (Fiados) y Saldo a Favor](#6-clientes-cuentas-corrientes-fiados-y-saldo-a-favor)
7. [Proveedores y Cuentas Comerciales](#7-proveedores-y-cuentas-comerciales)
8. [Compras y Recepción de Mercadería](#8-compras-y-recepción-de-mercadería)
9. [Gastos Operacionales del Local](#9-gastos-operacionales-del-local)
10. [Centro de Reportes Ejecutivo, Termómetro IVA F29 y Deudores](#10-centro-de-reportes-ejecutivo-termómetro-iva-f29-y-deudores)
11. [Notas de Crédito y Devoluciones](#11-notas-de-crédito-y-devoluciones)
12. [Auditoría y Trazabilidad de Empleados](#12-auditoría-y-trazabilidad-de-empleados)
13. [Campana de Notificaciones Multi-Caja en Tiempo Real](#13-campana-de-notificaciones-multi-caja-en-tiempo-real)
14. [Ajustes, Impresoras Térmicas y Configuración del Negocio](#14-ajustes-impresoras-térmicas-y-configuración-del-negocio)

---

## 1. PUNTO DE VENTA (POS) & COBRO RÁPIDO

El módulo POS (`js/views/pos.js`, `js/controllers/POSController.js`) es el corazón operativo del mostrador. Diseñado para funcionar 100% con teclado, escáner láser o pantallas táctiles.

### A. Buscador Inteligente y Escáner Láser
* **Búsqueda instantánea (F1):** Filtra en tiempo real por código de barra exacto, código interno o palabras clave en el nombre del producto con debounce optimizado.
* **Escaneo en ráfaga:** Soporta lectores de código de barra USB/Bluetooth con filtro de debounce (800ms) para evitar disparos accidentales dobles.
* **Lectura de Balanza (Peso / Granel):** Si el código escaneado proviene de una balanza con código embebido de peso, el sistema extrae automáticamente los kilogramos y los agrega directo al carrito.

### B. Ventana Modal de Producto y Alerta Flexible de Stock
* **Ajuste de Cantidad y Precio:** Permite ingresar la cantidad (fraccionaria para kilos, entera para unidades) y modificar el precio unitario en caliente con vista previa del subtotal.
* **Alerta Amable de Producto Agotado:** Si el producto tiene stock en 0 o negativo:
  * Despliega un distintivo de advertencia: *«⚠️ Producto sin stock en sistema. ¿Deseas venderlo de todas formas?»*.
  * Botones: `[CANCELAR]` y `[⚠️ VENDER DE TODAS FORMAS]`.
  * Si el cajero confirma, se añade al carro y se deja constancia preventiva en el Centro de Notificaciones (Campana `🔔`).
* **Regla de Redondeo (Ley 20.956 de Chile):** Todos los cálculos intermedios y finales para pagos en efectivo se redondean automáticamente a la decena superior o inferior según la normativa legal chilena.

### C. Múltiples Carritos en Espera (Ventas Paralelas)
* **Barra de Espera (`heldSalesTabBar`):** Permite dejar una compra en pausa (por ejemplo, si un cliente olvidó su billetera en el auto) y abrir hasta 10 carritos en paralelo con el nombre del cliente o un folio provisorio.
* Al recuperar una venta en espera, se restaura el cliente asignado, los productos, precios modificados y descuentos aplicados.

### D. Métodos de Pago y Finalización (F2)
* **Cobro Rápido 1-Clic:** Botones directos `⚡ EFECTIVO EXACTO` (finaliza la venta en 1 segundo calculando vuelto $0) y `💳 TARJETA` (emite comprobante directo para POS Transbank/Redelcom/MercadoPago).
* **Modal Completo de Cobro:** Permite pagar con métodos combinados:
  * Efectivo (calculador de vuelto en pantalla gigante).
  * Tarjeta de Débito / Crédito.
  * Transferencia / Código QR.
  * Crédito del Cliente (Fiado en cuenta corriente).
  * Saldo a Favor disponible del cliente.
* **Reconocimiento del Cliente (F3):** Despliega el buscador de clientes mostrando en tiempo real su RUT, su límite de crédito, su deuda pendiente acumulada y su saldo a favor actual.

---

## 2. HISTORIAL Y DETALLE DE VENTAS

Ubicado en `js/views/sales.js`. Proporciona la fiscalización y reimpresión de todas las ventas del negocio.

* **Filtros de Búsqueda:** Por folio de boleta, rango de fechas, cajero, estado de pago (`completed` vs `pending/fiado`) y método de pago.
* **Detalle Completo de Transacción:** Desglose producto a producto con cantidad, precio cobrado, subtotal, impuestos (IVA 19%) y detalle de vuelto entregado.
* **Reimpresión de Comprobante Térmico:** Botón para reenviar la orden a la impresora de 58mm u 80mm configurada.
* **Anulación y Devolución Segura:** Enlace directo para emitir Notas de Crédito sin alterar la base de datos de manera destructiva.

---

## 3. CAJA REGISTRADORA, TURNOS Y ARQUEO CIEGO

Ubicado en `js/views/cash.js` y `js/controllers/CashController.js`. Controla el flujo físico de dinero y previene descuadres.

### A. Apertura de Turno
* Requiere indicar el **Monto Inicial en Efectivo** (fondo de sencillo).
* **Aislamiento Multi-Terminal:** Cada computadora física (`PC-1`, `PC-2`) abre y opera su propio turno independiente con su propio folio y dinero físico sin mezclarse.

### B. Movimientos de Caja
* **Ingresos de Efectivo (`type: 'in'`):** Registro de dinero extra aportado por el dueño durante la jornada con justificación obligatoria.
* **Retiros de Efectivo (`type: 'out'`):** Salidas de efectivo para pago a proveedores express, retiro personal del dueño o compras de insumos.
* **Bloqueo Preventivo Antifraude:** El sistema valida contra `summary.expectedCash`. Si un cajero intenta retirar $30.000 y en la caja solo hay $18.000, el sistema **bloquea la operación** y emite una alerta roja a la Campana de Notificaciones.

### C. Cierre Definitivo con Arqueo Ciego
* **Filosofía de Arqueo Ciego:** El cajero declara el dinero físico que cuenta en la gaveta (efectivo, comprobantes de tarjeta, transferencias) sin ver previamente lo que el sistema espera.
* **Teclado Táctil Integrado (`TouchNumpad`):** Para terminales touch sin teclado físico.
* **Cálculo de Descuadre:** El sistema compara lo declarado contra lo vendido y calcula de inmediato el descuadre:
  * `0`: Cuadratura Perfecta.
  * `+$X`: Sobrante de caja.
  * `-$X`: Faltante de dinero.
* **Generación Automática del Reporte Z en PDF:** Al confirmar el cierre, el sistema genera de forma autónoma el archivo `Reporte_Z_Caja_XX.pdf` y lo deposita directamente en el **Escritorio de Windows**.
* **Compartición Rápida:** Botón para enviar el resumen del cierre por WhatsApp al dueño en un solo clic.

---

## 4. CONTROL DE INVENTARIO, KARDEX Y MERMAS

Ubicado en `js/views/inventory.js` y `js/services/StockService.js`. Mantiene el control estricto de la mercadería.

* **Semáforo de Existencias:**
  * 🟢 Stock Óptimo.
  * 🟡 Bajo Stock (por debajo del stock mínimo configurado).
  * 🔴 Agotado ($0$ unidades o negativo).
* **Ajustes de Inventario:** Modificaciones directas para calibrar el stock físico real tras una toma de inventario físico.
* **Consumos Internos:** Registro de productos tomados para el uso del propio negocio (ej: artículos de limpieza, insumos de cocina) descontando el inventario al costo de compra.
* **Mermas y Pérdidas:** Registro de mercadería vencida, dañada o rota.
* **Anulación Auditada (Cero Borrado Destructivo):** Si un consumo o merma se registró por error, el botón de anular solicita un motivo formal, marca el registro como `cancelled` y ejecuta automáticamente un ajuste compensatorio que **devuelve las unidades al inventario**, manteniendo la integridad contable.
* **Kardex y Valorización:** Cálculo en tiempo real del valor total del inventario a precio de costo y a precio de venta proyectado.

---

## 5. CATÁLOGO DE PRODUCTOS Y BALANZA

Ubicado en `js/views/products.js` y `js/models/Product.js`.

* **Ficha Técnica del Producto:**
  * Código de barras (soporta EAN-13, Code 128, etc.).
  * Nombre y descripción.
  * Categoría asociada.
  * Costo neto de compra y Margen de ganancia deseado (%).
  * Precio final de venta al público (con IVA incluido).
  * Stock actual y Stock mínimo de alerta.
  * Tipo de producto: **Por Unidad** (`unit`) o **Por Peso / Balanza** (`weight`).
  * Fecha de caducidad / vencimiento (con avisos automáticos de productos prontos a vencer).
* **Importación y Exportación Masiva en Excel:** Carga o descarga de todo el catálogo mediante planillas `.xlsx` compatibles con Excel y Google Sheets.

---

## 6. CLIENTES, CUENTAS CORRIENTES (FIADOS) Y SALDO A FAVOR

Ubicado en `js/views/customers.js` y `js/models/Customer.js`.

### A. Ficha del Cliente y Límite de Crédito
* Registro de Nombre, RUT, Teléfono, Dirección y Límite de Crédito Máximo permitido para fiados.

### B. Gestión de Fiados y Cuentas Corrientes
* Registro de compras al crédito con fecha, productos llevados y saldo adeudado.
* **Registro de Abonos:** El cliente puede abonar cualquier suma a su deuda. El sistema cancela las ventas más antiguas primero (criterio FIFO contable) y emite un comprobante térmico de abono.

### C. Cartera de Saldo a Favor (Anticipos)
* Si un cliente deja dinero pagado por adelantado o tiene una devolución a su favor, el sistema almacena su `balance_credit`.
* **Sincronización Multi-Caja:** Cuando el cliente compra en la PC 1 o en la PC 2, ambas computadoras conocen su saldo a favor real en línea.

### D. Semáforo de Morosidad por Antigüedad
* 🟢 **Al Día (≤ 15 días):** Crédito comercial normal.
* 🟡 **En Observación (16 a 30 días):** Alerta preventiva de cobranza.
* 🔴 **Moroso Crítico (> 30 días):** Requiere congelamiento de crédito hasta regularizar.

---

## 7. PROVEEDORES Y CUENTAS COMERCIALES

Ubicado en `js/views/suppliers.js` y `js/models/Supplier.js`.

* Directorio con RUT, Razón Social, Vendedor de contacto, Teléfono y Correo.
* Historial acumulado de compras realizadas al proveedor.
* Control de cuentas por pagar por compras al crédito.

---

## 8. COMPRAS Y RECEPCIÓN DE MERCADERÍA

Ubicado en `js/views/purchases.js`. Diseñado para abastecimiento eficiente.

* **Recepción de Facturas:** Registro de número de factura, proveedor y fecha de emisión.
* **Calculadora de Cajas / Bultos:** Permite ingresar que se compró una "Caja de 24 unidades a $12.000". El sistema calcula de inmediato el costo unitario de $500 y suma las 24 unidades al inventario físico.
* **Actualización Automática de Costo:** Al recibir mercadería, el costo del producto se actualiza y queda registrado en `productCostHistory` para que las ganancias en reportes siempre reflejen el costo histórico exacto.

---

## 9. GASTOS OPERACIONALES DEL LOCAL

Ubicado en `js/views/expenses.js`. Registra los costos fijos y variables del negocio.

* **Categorías de Gasto:** Arriendo, Servicios Básicos (Luz, Agua, Gas), Sueldos y Anticipos, Fletes, Mantenimiento, Aseo e Impuestos.
* **Fuente del Pago:** Permite indicar si el gasto se pagó con dinero de la **Caja de Turno** (afectando el arqueo) o con **Fondos Externos** (cuenta bancaria del dueño).
* Permite comparar el gasto mensual acumulado vs presupuesto.

---

## 10. CENTRO DE REPORTES EJECUTIVO, TERMÓMETRO IVA F29 Y DEUDORES

Ubicado en `js/views/reports.js`. Panel de control financiero de alto impacto visual.

### A. Barra de Control y Selector Multi-Terminal
* **Filtros Rápidos 1-Clic:** `⚡ Hoy`, `⏪ Ayer`, `📅 Esta Semana`, `🗓️ Este Mes`.
* **Selector Multi-Caja:** Alterna al instante entre `🏢 Todo el Negocio` (consolidado global), `💻 PC 1` o `💻 PC 2`.
* **Modo Nocturno y Colores de Acento:** Conmutador Claro / Oscuro (`midnight`) con acentos Esmeralda, Rubí, Ámbar o Índigo.

### B. Cuadrícula de 4 Tarjetas KPI Ejecutivas
1. **Total Vendido (Bruto):** Total facturado con comparador de tendencia vs período anterior (`▲ +X%` o `▼ -X%`), número de boletas y ticket promedio.
2. **Ganancia Real (CMV):** Margen de utilidad neto descontando el costo real de reposición histórico de cada producto vendido.
3. **Flujo Neto en Caja:** Conciliación real de dinero ingresado menos gastos pagados con badge de Superávit o Déficit.
4. **IVA Débito Fiscal:** Monto acumulado de IVA correspondiente a las ventas del período.

### C. Gráficos Interactivos Duales (Chart.js Local)
* **Curva de Ventas por Tramo Horario:** Identificación visual automática de la **🔥 Hora Pico** de mayores ingresos.
* **Rosquilla de Medios de Pago:** Participación porcentual de Efectivo, Tarjetas, Transferencias y Fiados.

### D. Termómetro Fiscal IVA F29 en Vivo
* Muestra en tiempo real:
  * **🔴 IVA Débito:** Impuesto generado por las ventas.
  * **🟢 IVA Crédito + Remanente:** Impuesto a favor recuperado en compras de mercadería.
  * **⚖️ Provisión a Pagar o 🎉 Remanente a Favor:** Previsión exacta del pago de impuestos del mes más el 1% de PPM.

---

## 11. NOTAS DE CRÉDITO Y DEVOLUCIONES

Ubicado en `js/views/creditNotes.js`.

* Registro de devoluciones de mercadería vinculadas a un folio de venta original.
* Opciones de resolución:
  * Reingreso automático de las unidades devueltas al inventario.
  * Devolución de dinero en efectivo de la caja actual o emisión de **Saldo a Favor** para futuras compras del cliente.

---

## 12. AUDITORÍA Y TRAZABILIDAD DE EMPLEADOS

Ubicado en `js/views/auditLogs.js`.

* Bitácora inmutable donde queda registrada toda acción crítica:
  * Modificación de precios o costos de productos.
  * Anulaciones de ventas o mermas.
  * Aperturas y cierres de turno de caja registradora.
  * Intentos de retiro de dinero bloqueados por fondos insuficientes.
* Cada registro almacena: Fecha/Hora exacta, Nombre del empleado, Rol, Terminal física (`PC-1` o `PC-2`) y Detalle técnico de la acción.

---

## 13. CAMPANA DE NOTIFICACIONES MULTI-CAJA EN TIEMPO REAL

Ubicado en `js/services/NotificationCenter.js`.

* **Botón de Campana (`🔔`) en la Barra Superior:**
  * Indicador badge numérico de alertas no leídas.
  * Panel desplegable con historial de advertencias operativas.
* **Tipos de Alerta Emitidas:**
  * ⚠️ **Ventas sin stock:** Avisa cuando un cajero vendió un producto agotado.
  * ⛔ **Retiros bloqueados:** Alerta si se intentó sacar más efectivo del existente.
  * 🔒 **Cierre de Local en Proceso:** Avisa a la PC 2 cuando la PC 1 inicia el arqueo final.
  * ℹ️ **Retiros exitosos y cambios de turno.**

---

## 14. AJUSTES, IMPRESORAS TÉRMICAS Y CONFIGURACIÓN DEL NEGOCIO

Ubicado en `js/views/settings.js`.

* **Datos del Negocio en Boleta:** RUT, Razón Social, Nombre de Fantasía, Dirección, Teléfono, Comuna y Mensaje de Pie de Página en tickets térmicos.
* **Configuración de Impresoras:**
  * Selector de ancho: Formato 58mm o Formato 80mm.
  * Impresión directa sin diálogo de Windows mediante motor nativo de Electron.
  * Comando de corte automático de papel y apertura de gaveta portamonedas (cajón de dinero conectado por RJ11 a la impresora).
* **Gestión de Personal y Seguridad:** Creación de usuarios cajeros y administradores con claves encriptadas.
* **Licenciamiento y Sincronización:** Vinculación con cuenta Supabase Cloud y visualización del estado de conexión de la terminal.
