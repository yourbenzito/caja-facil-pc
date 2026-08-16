---
name: error_handling_expert
description: Estándares para la captura de errores, generación de logs descriptivos y diseño de alertas amigables para el usuario.
---

# 🚨 Guía de Gestión de Errores, Logs y Alertas de Usuario

Esta habilidad proporciona estándares para la captura proactiva de fallos, la creación de registros detallados (logs) y el diseño de una interfaz de usuario tolerante a fallos.

---

## 🎯 1. Captura de Errores Robustos

- **Bloques `try/catch` Inteligentes:** No captures errores para simplemente ignorarlos. Cada captura de error debe tener un propósito: reintentar la operación, notificar al usuario o registrar el fallo para su posterior análisis.
- **Manejo Global de Excepciones:** Configura escuchadores de errores globales en Electron (`process.on('uncaughtException')` y `process.on('unhandledRejection')`) para evitar cierres inesperados (crashes) de la aplicación completa.
- **Aislamiento de Fallos:** Si un módulo secundario falla (ej. cargar el logo en una boleta), asegúrate de que no detenga el flujo principal de venta.

---

## 📝 2. Estrategia de Logs (Registros del Sistema)

- **Logs para la IA y Desarrolladores:**
  - Registra el contexto del error: nombre del archivo, función, argumentos recibidos y la pila de llamadas (*stack trace*).
  - Estructura los logs en JSON para facilitar su lectura por herramientas automatizadas.
- **Niveles de Log:**
  - `INFO`: Mensajes de flujo normal (ej. "Conexión a base de datos establecida").
  - `WARN`: Situaciones anormales pero controlables (ej. "Intento de cobro fallido por saldo insuficiente", "Impresora desconectada").
  - `ERROR`: Fallos graves que impiden completar una operación clave (ej. "Error al guardar la venta en la base de datos").
- **Persistencia Local:** Guarda los logs en archivos rotativos en el disco duro local para poder analizarlos en caso de que ocurra un problema fuera de línea.

---

## 📢 3. Comunicación al Usuario (Alertas de Negocio)

- **Traducción de Errores Técnicos:** Está prohibido mostrar mensajes técnicos, códigos SQL o volcados de memoria directamente al usuario final.
- **Mensajes Accionables y Empáticos:** Traduce los fallos a lenguaje cotidiano que indique al usuario qué hacer a continuación:
  - *Incorrecto:* `Error: connection timeout to 192.168.1.100:9100. Connection refused.`
  - *Correcto:* `No pudimos conectarnos con la impresora de boletas. Por favor, verifica que esté encendida, con papel y conectada al cable USB.`
- **Diseño de Alertas:** Utiliza banners discretos en la interfaz para advertencias menores, y ventanas emergentes (modales) claras únicamente para errores críticos que detengan una transacción.

---

## 🔄 4. Recuperación Automática (Resiliencia)

- **Reintentos Automáticos:** En operaciones de sincronización de red que fallen por micro-cortes de internet, implementa reintentos automáticos con un retraso exponencial (esperar 2s, luego 4s, luego 8s, etc.).
- **Degradación Elegante:** Si un servicio en la nube no está disponible, el sistema debe deshabilitar sutilmente ese botón o función en la pantalla y permitir al usuario seguir utilizando el resto de herramientas locales del POS sin bloqueos.
