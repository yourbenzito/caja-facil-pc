---
name: pos_hardware_expert
description: Directrices para la integración de hardware de punto de venta como impresoras térmicas, lectores de barras y cajones de dinero.
---

# 🔌 Guía de Integración de Hardware de Punto de Venta (POS)

Esta habilidad proporciona directrices para conectar y controlar dispositivos periféricos comunes en un entorno de venta físico a través de Electron y Node.js.

---

## 🏷️ 1. Lectores de Códigos de Barras

Los lectores de códigos de barras USB emulan un teclado físico que escribe muy rápido y suele terminar con la tecla `Enter`.
- **Manejo del Foco:** Asegúrate de que el cursor esté siempre posicionado en el campo de entrada de búsqueda de productos de forma predeterminada, o captura los eventos de teclado globalmente si el usuario está en la pantalla de ventas.
- **Detección de Entrada Rápida:** Implementa lógica para diferenciar la escritura humana de la velocidad de entrada del lector de códigos para evitar búsquedas parciales en la base de datos.
- **Prevención de Comportamientos por Defecto:** Evita que el `Enter` del lector envíe formularios incompletos accidentalmente. Captura la tecla `Enter` para añadir directamente el producto al carrito de compras.

---

## 🖨️ 2. Impresoras Térmicas de Boletas (ESC/POS)

Las impresoras térmicas de 58mm o 80mm utilizan el protocolo estándar de comandos industriales ESC/POS.
- **Comandos Críticos de Control:**
  - *Inicializar impresora:* `\x1b\x40` (ESC @)
  - *Alineación de texto:* Izquierda (`\x1b\x61\x00`), Centro (`\x1b\x61\x01`), Derecha (`\x1b\x61\x02`).
  - *Corte de papel:* `\x1d\x56\x41\x03` (GS V A) o `\x1d\x56\x00`.
- **Formateo y Diseño:**
  - Diseña boletas compactas de un máximo de 32 caracteres de ancho para papel de 58mm, y 48 caracteres para papel de 80mm.
  - Usa líneas divisorias claras hechas con guiones (`-`) o iguales (`=`) para separar las secciones de la boleta (Encabezado, Ítems, Totales, Pie de página).
- **Codificación de Caracteres:** Convierte los textos a la página de códigos adecuada (por ejemplo, CP850 o similar) antes de enviarlos a la impresora para asegurar que los acentos y la letra "ñ" se impriman correctamente en lugar de caracteres extraños.

---

## 💵 3. Apertura de Cajones de Dinero

Los cajones de dinero suelen conectarse físicamente a la impresora térmica mediante un cable RJ11 (cable telefónico).
- **Comando de Apertura:** Para abrir el cajón, se debe enviar un pulso eléctrico a través de la impresora usando el comando ESC/POS específico:
  - *Comando común:* `\x1b\x70\x00\x19\xfa` (abre el cajón conectado al pin 2) o `\x1b\x70\x01\x19\xfa` (pin 5).
- **Seguridad en Apertura:** Lanza el comando de apertura del cajón únicamente al registrar un pago en efectivo exitoso o bajo un permiso de usuario autorizado con registro en el historial de auditoría.

---

## 🖥️ 4. Conectividad en Electron

- **Detección de Estado:** Monitorea la presencia de impresoras conectadas en el sistema operativo antes de mandar a imprimir para notificar al usuario con alertas amigables si la impresora está desconectada.
- **Colas de Impresión:** Utiliza colas de impresión asíncronas para que el hilo de interfaz de usuario de ventas nunca se congele mientras se procesa o imprime una boleta.
