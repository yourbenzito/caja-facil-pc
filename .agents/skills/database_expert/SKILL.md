---
name: database_expert
description: Estándares para el diseño, optimización, integridad y migración de bases de datos locales con SQLite.
---

# 🗄️ Guía de Optimización e Integridad de Base de Datos (SQLite)

Esta habilidad proporciona directrices y mejores prácticas para el diseño, consulta, optimización y migración segura de datos en entornos basados en SQLite.

---

## ⚡ 1. Configuración de Rendimiento y Concurrencia

SQLite puede ser extremadamente rápido si se configura con los parámetros adecuados (`PRAGMAs`).
- **Modo WAL (Write-Ahead Logging):** Activa siempre el modo WAL para permitir lecturas y escrituras concurrentes sin bloquear la base de datos:
  ```sql
  PRAGMA journal_mode = WAL;
  ```
- **Llaves Foráneas:** Asegúrate de activar el soporte de llaves foráneas en cada conexión para garantizar la integridad referencial:
  ```sql
  PRAGMA foreign_keys = ON;
  ```
- **Sincronización:** Usa `PRAGMA synchronous = NORMAL;` junto con WAL para un excelente balance entre seguridad ante cortes de energía y velocidad de escritura.

---

## 🔒 2. Seguridad Transaccional (ACID)

- **Transacciones Explícitas:** Agrupa siempre las operaciones de escritura relacionadas (ej. registrar venta + restar stock + registrar movimiento de caja) dentro de una transacción explícita (`BEGIN TRANSACTION` y `COMMIT`).
- **Control de Rollbacks:** En caso de error en cualquier paso de la transacción, ejecuta inmediatamente un `ROLLBACK` para evitar dejar la base de datos en un estado inconsistente (datos a medias).
- **Transacciones Cortas:** Mantén el código dentro de las transacciones lo más rápido posible. No realices llamadas de red, lecturas de archivos pesados o cálculos complejos dentro de un bloque transaccional para evitar bloquear la base de datos a otros procesos.

---

## 📈 3. Optimización de Consultas e Indexación

- **Estrategia de Índices:** Crea índices en columnas que se usen frecuentemente en cláusulas `WHERE`, `JOIN` y `ORDER BY`.
  - *Clave:* En sistemas multi-tenant, crea índices compuestos que incluyan el `business_id` (ej. `CREATE INDEX idx_products_business_sku ON products(business_id, sku);`).
- **Evitar Escaneos Completos (Table Scans):** Monitorea consultas lentas usando la sentencia `EXPLAIN QUERY PLAN` para verificar que utilicen los índices creados.
- **Evitar `SELECT *`:** Solicita únicamente las columnas necesarias. Esto reduce el consumo de memoria y la transferencia de datos entre SQLite y el backend de Node.js.

---

## 🔄 4. Migraciones de Esquema Seguras

- **Migraciones Incrementales:** Los cambios de base de datos deben realizarse mediante archivos de migración numerados secuencialmente (ej. `001-init.sql`, `002-add-discount.sql`).
- **Retrocompatibilidad:** Asegúrate de que los cambios de esquema no rompan versiones anteriores del código de la aplicación (muy importante en sistemas offline-first donde los clientes actualizan a ritmos diferentes).
- **Pruebas de Migración:** Antes de aplicar una migración en producción, pruébala en un entorno de desarrollo con datos simulados y verifica la consistencia tras la migración.
