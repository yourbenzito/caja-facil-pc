# DEVELOPMENT_RULES

## REGLA 1: FUENTE DE VERDAD

Las únicas fuentes de verdad del proyecto son:
* CONTEXT_MASTER.md
* MIGRATION_CONTEXT.md
* SYSTEM_ARCHITECTURE_MASTER.md

Nunca asumir comportamientos que no estén documentados.

---

## REGLA 2: NO MODIFICAR REGLAS DE NEGOCIO

Las siguientes reglas son inmutables:
* Ley de Redondeo 20.956.
* Flujo de Fiados.
* Cuadratura ciega de caja.
* Separación por business_id.
* Registro inmutable de movimientos.

---

## REGLA 3: TIPADO ESTRICTO

Todo código nuevo debe:
* Usar TypeScript estricto.
* Evitar any.
* Definir DTOs.
* Definir Interfaces.
* Definir tipos compartidos.

---

## REGLA 4: NO DUPLICAR LÓGICA

Antes de crear una función:
* Buscar reutilización.
* Buscar servicios existentes.
* Buscar utilidades existentes.

---

## REGLA 5: SEGURIDAD

Nunca:
* Confiar en validaciones frontend.
* Exponer business_id editable.
* Exponer tokens en localStorage.
* Ejecutar consultas sin aislamiento tenant.

---

## REGLA 6: OFFLINE-FIRST

Toda funcionalidad nueva debe funcionar:
* Con internet.
* Sin internet.
* Durante sincronización.

---

## REGLA 7: DESARROLLO POR FASES

Antes de programar:
1. Analizar impacto.
2. Diseñar solución.
3. Identificar archivos afectados.
4. Implementar.
5. Probar.
6. Documentar.

---

## REGLA 8: CALIDAD

Todo cambio debe incluir:
* Casos de prueba.
* Riesgos.
* Validaciones.
* Estrategia de rollback.

---

## REGLA 9: DOCUMENTACIÓN

Cada módulo debe mantener:
* Objetivo.
* Dependencias.
* Flujo.
* Restricciones.

---

## REGLA 10: PRINCIPIO GENERAL

Priorizar:
1. Correctitud de negocio.
2. Integridad de datos.
3. Experiencia offline.
4. Rendimiento.
5. Escalabilidad.

---

## REGLA 11: NO INVENTAR FUNCIONALIDADES

Si una funcionalidad no está documentada explícitamente en:
* CONTEXT_MASTER.md
* MIGRATION_CONTEXT.md
* SYSTEM_ARCHITECTURE_MASTER.md

La IA debe:
1. Marcar la información como desconocida.
2. Solicitar aclaración antes de implementar.
3. Diferenciar claramente entre:
   * Información confirmada.
   * Inferencias razonables.
   * Suposiciones.
4. No implementar reglas de negocio no documentadas.

---

## REGLA 12: CONSERVAR COMPATIBILIDAD DE DATOS

Toda modificación de entidades, tablas, relaciones o estructuras de datos debe:
* Mantener compatibilidad con versiones anteriores cuando sea posible.
* Incluir estrategia de migración.
* Mantener integridad histórica.
* Evitar pérdida de información.
* Preservar registros contables y auditorías.

Ningún cambio de esquema puede realizarse sin evaluar impacto en datos existentes.

---

## REGLA 13: MOVIMIENTOS SON SAGRADOS

Los siguientes registros son inmutables:
* stockMovements
* cashMovements
* payments
* auditLogs

Nunca corregir errores mediante:
* UPDATE
* DELETE

Las correcciones deben realizarse mediante:
* movimientos compensatorios
* ajustes
* notas de crédito
* registros de reversa

El historial debe mantenerse completo y trazable.

---

## REGLA 14: TESTS OBLIGATORIOS PARA REGLAS CRÍTICAS

Toda modificación relacionada con:
* ventas
* caja
* inventario
* pagos
* fiados
* cálculos de IVA
* ley de redondeo

Debe incluir:
* pruebas unitarias
* pruebas de integración cuando corresponda
* validación de escenarios límite

No se deben modificar reglas financieras sin cobertura de pruebas.

---

## REGLA 15: RENDIMIENTO DEL POS

El módulo POS tiene prioridad máxima sobre cualquier otro módulo.

Nunca introducir:
* llamadas innecesarias a red
* consultas bloqueantes
* procesos pesados en la interfaz
* dependencias que afecten la velocidad de escaneo

La experiencia de caja debe sentirse instantánea incluso durante sincronización.

---

## REGLA 16: AUDITORÍA OBLIGATORIA

Toda acción sensible debe generar un registro auditable.

Ejemplos:
* anulación de ventas
* modificaciones de precios
* cambios de costos
* ajustes de inventario
* cierres de caja
* cambios de permisos
* eliminación lógica de registros

Toda auditoría debe registrar:
* usuario
* fecha y hora
* business_id
* acción realizada
* entidad afectada
* valor anterior
* valor nuevo
* motivo del cambio cuando corresponda
