---
name: qa_testing_expert
description: Directrices para el control de calidad, diseño de casos de prueba y cobertura en lógica crítica de ventas e inventario.
---

# 🧪 Guía de Calidad de Software, Pruebas y Rollbacks

Esta habilidad proporciona estándares para el diseño de pruebas, validación de lógica de negocio compleja y mitigación de fallos en producción.

---

## 📐 1. Diseño de Casos de Prueba (Lógica Crítica)

Toda modificación en el núcleo del negocio debe estar respaldada por casos de prueba claros.

### Áreas Críticas a Probar Obligatoriamente:
- **Ley de Redondeo (Ej. Ley Chilena 20.956):** Validar que las ventas en efectivo terminen redondeadas correctamente al entero correspondiente (ej. terminar en 1-5 redondea a 0, 6-9 redondea a 10).
- **Cálculo de Impuestos (IVA):** Asegurar la correcta discriminación del IVA en boletas y facturas y los totales finales.
- **Movimientos de Stock:** Verificar que las compras, ventas y devoluciones sumen o resten las cantidades exactas del inventario.
- **Aislamiento Multitenant:** Probar activamente que un usuario del `business_id` "A" bajo ninguna circunstancia pueda leer o modificar datos de un `business_id` "B".

---

## 💻 2. Pirámide y Automatización de Pruebas

- **Pruebas Unitarias:** Enfócate en probar funciones puras aisladas (cálculos matemáticos, formateadores, validaciones de DTOs) sin conectar la base de datos.
- **Pruebas de Integración:** Valida el flujo completo de persistencia de datos (ej. simular un flujo de venta completo desde la API local hasta la escritura en SQLite y la generación del ticket).
- **Simulación Offline:** Diseña pruebas que simulen la pérdida abrupta de red durante transacciones para garantizar la robustez del modo Offline-First.

---

## ⚠️ 3. Estrategias de Rollback (Planes de Retorno)

Antes de aplicar cualquier actualización técnica pesada (ej. cambios de esquema de base de datos), se debe diseñar una estrategia de reversión.
- **Backups Preventivos:** Antes de aplicar una migración, realiza una copia de seguridad física de la base de datos SQLite (`database.db`).
- **Migraciones Reversibles:** Cada script de base de datos que modifique tablas (`UP`) debe tener un script equivalente para deshacer los cambios (`DOWN`) en caso de fallo crítico en producción.
- **Rollback de Código:** Asegura que si la nueva versión de la aplicación falla al iniciar, el sistema vuelva de forma automática a la última versión estable sin comprometer los datos locales.
