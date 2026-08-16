---
name: software_development_expert
description: Reglas y estándares para el desarrollo de lógica de negocio backend, bases de datos SQLite, comunicación Electron y arquitecturas seguras.
---

# 💻 Guía de Desarrollo de Software y Arquitectura Segura

Esta habilidad proporciona directrices, principios de diseño y reglas de calidad para la programación de backend, lógica de negocio y arquitectura de datos.

---

## 🏗️ 1. Tipado Estricto y Estructura de Código (TypeScript)

- **TypeScript Estricto:** Evita el uso de `any` a toda costa. Define tipos explícitos para todas las variables y retornos de funciones.
- **DTOs e Interfaces:** Utiliza Data Transfer Objects (DTOs) para la entrada y salida de las APIs. Define interfaces claras para los servicios y modelos de datos.
- **Modularidad:** Separa la lógica de presentación (frontend/renderizador), la lógica de transporte/API (controladores, IPC) y la lógica de negocio (servicios, modelos).

---

## 🔐 2. Seguridad y Aislamiento Multi-Tenant

- **Aislamiento por Negocio (Tenant Isolation):** Todas las consultas a la base de datos deben incluir y filtrar estrictamente por el `business_id` correspondiente al negocio activo.
- **Validaciones Robustas:** Nunca confíes en la validación del frontend. Valida exhaustivamente todos los parámetros de entrada en el backend (tipos, rangos, formatos).
- **Manejo de Secretos:** Nunca expongas credenciales, tokens o variables de entorno en el código fuente ni en el localStorage del frontend. Utiliza variables de entorno (`process.env`) manejadas de forma segura.

---

## 📊 3. Lógica Contable e Inmutabilidad de Datos

- **Registros Sagrados (Inmutables):** Los registros transaccionales como movimientos de stock (`stockMovements`), movimientos de caja (`cashMovements`), pagos (`payments`) e historiales de auditoría (`auditLogs`) son **inmutables**.
- **No Modificar Históricos:** Está estrictamente prohibido realizar operaciones `UPDATE` o `DELETE` sobre registros sagrados para corregir errores.
- **Correcciones mediante Compensación:** Cualquier corrección de inventario o caja debe realizarse mediante la creación de un nuevo movimiento compensatorio (ajuste, nota de crédito, registro de reversa) para mantener la trazabilidad completa.
- **Auditoría Obligatoria:** Cada acción crítica (anulación, cambio de precios, ajustes manuales) debe registrar: usuario, fecha/hora, negocio (`business_id`), valor anterior, valor nuevo y motivo.

---

## 📶 4. Diseño Offline-First y Sincronización

- **Funcionamiento Autónomo:** La aplicación debe ser completamente funcional localmente sin conexión a internet (usando la base de datos SQLite local).
- **Sincronización Silenciosa:** Diseña la sincronización de datos con el servidor en la nube de fondo sin interrumpir la operación del punto de venta (POS).
- **Manejo de Conflictos:** Implementa lógica robusta para resolver colisiones de datos (por ejemplo, conflictos de IDs autoincrementales usando UUIDs temporales o timestamps).

---

## 🚀 5. Rendimiento y Concurrencia (Electron / SQLite)

- **Prioridad del POS:** El Punto de Venta es el componente más crítico. Ninguna operación pesada (como reportes masivos o sincronización pesada) debe bloquear el hilo principal ni la interfaz de usuario de ventas.
- **Optimización de SQLite:** Utiliza índices adecuados para acelerar búsquedas comunes. Agrupa múltiples inserciones en una sola transacción SQL (`BEGIN TRANSACTION` / `COMMIT`) para evitar bloqueos del disco duro.
- **Comunicación IPC Eficiente:** Mantén los mensajes entre el proceso Main y Renderer de Electron lo más ligeros posible.
