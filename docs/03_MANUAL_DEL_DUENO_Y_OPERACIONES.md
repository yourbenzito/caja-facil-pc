# 👑 CAJA FÁCIL POS — MANUAL MAESTRO DEL DUEÑO Y GUÍA DE OPERACIONES PRO

Este manual está diseñado exclusivamente para ti como **Dueño o Administrador del Negocio**. Aquí aprenderás a operar tu sistema como un verdadero profesional, controlar tu dinero al centavo, fiscalizar a tus empleados y resolver cualquier imprevisto técnico o comercial sin estrés.

---

## 📑 ÍNDICE DE CONTENIDOS

1. [Filosofía de Control: El Secreto del Arqueo Ciego](#1-filosofía-de-control-el-secreto-del-arqueo-ciego)
2. [Rutina Diaria del Negocio Paso a Paso](#2-rutina-diaria-del-negocio-paso-a-paso)
3. [Control de Fiados y Cartera de Clientes](#3-control-de-fiados-y-cartera-de-clientes)
4. [Control de Mercadería, Mermas y Consumos](#4-control-de-mercadería-mermas-y-consumos)
5. [Fiscalización Antifraude y Auditoría de Empleados](#5-fiscalización-antifraude-y-auditoría-de-empleados)
6. [Conciliación del IVA F29 y Finanzas Mensuales](#6-conciliación-del-iva-f29-y-finanzas-mensuales)
7. [Protocolos de Emergencia: Sin Luz o Sin Internet](#7-protocolos-de-emergencia-sin-luz-o-sin-internet)
8. [Guía de Hardware: Impresoras, Gavetas y Escáneres](#8-guía-de-hardware-impresoras-gavetas-y-escáneres)
9. [Instalación en Nuevas Computadoras (PC 2, PC 3)](#9-instalación-en-nuevas-computadoras-pc-2-pc-3)

---

## 1. FILOSOFÍA DE CONTROL: EL SECRETO DEL ARQUEO CIEGO

El error más común en los negocios tradicionales es que el cajero sabe cuánto dinero "debería haber" antes de contar. Eso facilita que, si sobra dinero, el empleado pueda guardárselo sin que te des cuenta.

Caja Fácil utiliza la técnica del **Arqueo Ciego**:
* Al momento del cierre de caja, la pantalla **no le muestra al cajero cuánto dinero se vendió**.
* El cajero debe contar físicamente los billetes, monedas y vouchers de tarjeta e ingresarlos uno a uno.
* Solo después de que el cajero confirma su conteo, el sistema compara contra las ventas registradas y genera el informe con el descuadre exacto:
  * **Sobrante (`+$X`):** Indica que se cobró de más a un cliente o se omitió registrar una entrada de dinero.
  * **Faltante (`-$X`):** Falta dinero físico en la gaveta (vuelto mal entregado o robo hormiga).
  * **Cuadre Perfecto (`$0`):** Cada peso físico coincide exactamente con las boletas.

---

## 2. RUTINA DIARIA DEL NEGOCIO PASO A PASO

### Paso 1: Inicio de la Jornada (Apertura de Caja)
1. Al encender el computador y abrir Caja Fácil, ve al módulo **Caja**.
2. Pulsa en **Abrir Caja**.
3. Ingresa el **Fondo Inicial de Efectivo** (el "sencillo" para dar vueltos, ej: $20.000).
4. Pulsa Confirmar. A partir de este momento, el POS queda habilitado para vender.
   * *Si tienes dos computadores (PC 1 y PC 2), cada uno abre su propia caja física sin interferir con el otro.*

### Paso 2: Durante el Día (Atención Rápida)
* **Ventas en Espera:** Si un cliente en la fila olvida un producto o va a buscar dinero al auto, no borres su compra. Pulsa el botón `[Pausar]` en la barra superior. Se abrirá una nueva venta limpia y podrás recuperar la compra del cliente anterior con un solo clic.
* **Retiros de Dinero:** Si tienes que pagar un flete o sacar dinero para un gasto urgente, ve a **Caja ➔ Retiro de Efectivo** y registra el motivo. **Nunca saques dinero sin registrarlo**, o la caja saldrá descuadrada al final del día.
  * *El sistema bloqueará cualquier intento de retiro que supere el efectivo real disponible en la gaveta.*

### Paso 3: Cierre de Turno o Fin del Día
1. Al terminar el turno, ve a **Caja ➔ Cierre de Caja**.
2. Cuenta el dinero de la gaveta e ingrésalo en cada campo (Efectivo, Tarjeta, Transferencias).
3. Pulsa **Confirmar Cierre Definitivo**.
4. **Listo:** En tu Escritorio de Windows aparecerá automáticamente el archivo `Reporte_Z_Caja_XX.pdf` con el balance contable y la firma del cajero.
5. Puedes enviar el resumen por WhatsApp a tu propio teléfono con el botón de compartir.

---

## 3. CONTROL DE FIADOS Y CARTERA DE CLIENTES

El crédito a vecinos o clientes frecuentes (el "fiado") fideliza, pero sin control quiebra negocios.

### Reglas de Oro para Fiados en Caja Fácil:
1. **Asignar Límite Máximo:** En el módulo **Clientes**, define a cada cliente un límite prudente (ej: $30.000). El POS te avisará si una compra supera ese límite.
2. **Revisar el Semáforo de Morosidad:**
   * 🟢 **Verde (≤ 15 días):** Cliente confiable dentro del plazo normal de pago.
   * 🟡 **Amarillo (16 a 30 días):** Alerta. Recuérdale su deuda cordialmente al comprar.
   * 🔴 **Rojo (> 30 días):** Moroso crítico. Bloquea nuevas ventas al crédito hasta que abone.
3. **Registro de Abonos:**
   * Cuando el cliente venga a pagar, ve a **Clientes ➔ Ver Cuenta Corriente ➔ Registrar Abono**.
   * Ingresa el monto (ej: si debe $25.000 y abona $10.000).
   * El sistema cancelará las deudas más viejas primero y le imprimirá un comprobante térmico con su saldo pendiente actualizado.
4. **Saldo a Favor (Anticipos):** Si un cliente deja dinero pagado por adelantado, aparecerá en verde en ambas cajas (PC 1 y PC 2) para usarse como medio de pago en su próxima compra.

---

## 4. CONTROL DE MERCADERÍA, MERMAS Y CONSUMOS

### Mermas (Pérdidas Reales) vs Consumo Interno
* **Consumo Interno:** Mercadería que se utiliza para el propio local (café para los empleados, detergente para el piso). Al registrarlo, el sistema lo descuenta del stock a **precio de costo**, no de venta.
* **Mermas / Pérdidas:** Productos vencidos, envases rotos o frutas dañadas.
* **Auditoría de Anulaciones:** Los empleados **no pueden borrar mermas en silencio**. Si anulan un registro, el sistema exige un motivo obligatorio y devuelve automáticamente las unidades al stock, quedando todo registrado en la bitácora de auditoría.

### Alerta Amable de Productos Agotados
Si un producto tiene stock en 0 o negativo, el sistema no frena la venta: muestra una advertencia amarilla con la opción de **`[VENDER DE TODAS FORMAS]`**. Al venderlo, la campana superior (`🔔`) te avisará para que sepas qué producto debes reponer en tu próxima compra a proveedores.

---

## 5. FISCALIZACIÓN ANTIFRAUDE Y AUDITORÍA DE EMPLEADOS

Como dueño, tienes a tu disposición el módulo **Auditoría (`auditLogs`)**. En este módulo puedes fiscalizar:
* A qué hora exacta abrió y cerró caja cada empleado.
* Si alguien intentó modificar el precio o costo de un producto en el catálogo.
* Si alguien intentó retirar más efectivo del disponible en caja (aparecerá en rojo como intento bloqueado).
* Qué boletas o notas de crédito se emitieron y desde qué computadora física (`PC-1` o `PC-2`).

---

## 6. CONCILIACIÓN DEL IVA F29 Y FINANZAS MENSUALES

En el módulo **Reportes**, dispones del **Termómetro Fiscal IVA F29 en Vivo**:
* **🔴 IVA Débito Fiscal:** El 19% acumulado de todas tus ventas con boleta/factura en el mes.
* **🟢 IVA Crédito Fiscal + Remanente:** El 19% de todas las facturas de compra ingresadas a tus proveedores más el saldo a favor del mes anterior.
* **Previsión Estimada:** El sistema te calcula en tiempo real cuánto deberás pagar al SII el día 20 del mes siguiente (incluyendo el 1% de PPM). De esta forma nunca tendrás sorpresas al pagar tus impuestos.

---

## 7. PROTOCOLOS DE EMERGENCIA: SIN LUZ O SIN INTERNET

Caja Fácil es **100% Offline-First**. Tu negocio nunca se detiene.

### Si se corta el Internet:
1. **Sigue vendiendo normalmente.** El escáner, los precios, la impresora y los cobros siguen funcionando a máxima velocidad en la base de datos local de tu computador.
2. La campana indicará modo local.
3. **Cuando vuelva el internet:** El sistema detectará la conexión de forma automática y subirá todas las ventas, clientes y turnos a la nube en segundo plano de manera silenciosa, sin recargar pantallas ni interrumpir a los cajeros.

### Respaldos de Seguridad Manuales:
Aunque el sistema crea un respaldo físico diario automático en tu disco duro, una vez al mes es una excelente práctica exportar un respaldo a un pendrive:
* Ve a **Ajustes ➔ Respaldos ➔ Exportar Base de Datos** y guarda el archivo en tu pendrive.

---

## 8. GUÍA DE HARDWARE: IMPRESORAS, GAVETAS Y ESCÁNERES

### A. Impresoras Térmicas (58mm y 80mm)
* Conecta la impresora por cable USB al computador.
* En Windows, instala el driver oficial del fabricante o el controlador genérico *POS-58* o *POS-80*.
* En Caja Fácil, ve a **Ajustes ➔ Impresora**, selecciona el modelo detectado y el ancho de papel (58mm para boletas angostas, 80mm para formato estándar).
* Haz clic en **Probar Impresión**. El ticket de prueba debe salir nítido y sin demora.

### B. Gaveta Portamonedas (Cajón de Dinero)
* El cajón de dinero no se conecta al computador; se conecta mediante un cable telefónico (RJ11) directamente a la parte trasera de la impresora térmica.
* Al finalizar una venta en efectivo o pulsar el botón de apertura manual en Caja Fácil, la impresora envía un pulso eléctrico que **abre automáticamente el cajón**.

### C. Lectores de Código de Barra
* Los escáneres USB funcionan como teclados virtuales (Plug & Play). No requieren programas adicionales.
* Basta con conectar el cable USB a la computadora y comenzar a escanear productos en el POS.

---

## 9. INSTALACIÓN EN NUEVAS COMPUTADORAS (PC 2, PC 3)

Para añadir una segunda computadora de cobro en tu local:
1. En tu PC principal, compila el instalador con `npm run build` o copia el archivo `.exe` desde la carpeta `dist/` a un pendrive.
2. Conecta el pendrive en la PC 2 y ejecuta el instalador `.exe`.
3. Inicia sesión con tu misma cuenta y contraseña de dueño.
4. **Listo:** La PC 2 descargará automáticamente tu catálogo de productos y comenzará a operar sincronizada con la PC 1 en tiempo real.
