# 📜 HISTORIAL DE MIGRACIONES, PARCHES Y SCRIPTS HISTÓRICOS

Este documento sirve como registro técnico y de negocio de los parches, scripts de prueba y migraciones aplicadas en etapas anteriores del desarrollo de **Caja Fácil POS**. Se preserva el contexto de negocio sin almacenar código obsoleto.

---

## ☁️ 1. Migraciones de Base de Datos en Supabase (Nube)

### A. Corrección de Recursión RLS (Error 500)
- **Objetivo:** Resolver un error HTTP 500 originado por llamadas circulares entre las tablas `businesses` (negocios) y `business_members` (empleados y miembros).
- **Solución implementada:** Se crearon funciones PostgreSQL con `SECURITY DEFINER` (`check_is_business_owner`) para consultar la pertenencia de usuarios sin disparar ciclos infinitos de políticas de seguridad Row Level Security (RLS).
- **Estado:** Aplicado con éxito en el esquema de Supabase.

### B. Reset Limpio y Alineación de Esquemas (PC & Mobile)
- **Objetivo:** Depurar datos de prueba y unificar la estructura de columnas para que la versión de escritorio (PC) y la aplicación móvil utilicen exactamente los mismos campos.
- **Campos alineados:** Códigos únicos de negocio (`business_code`), RUT/identificación fiscal, teléfono, moneda y estado activo.
- **Licencia del Dueño:** Se aseguró la persistencia de la cuenta principal del propietario como usuario con licencia vitalicia y plan completo.
- **Estado:** Aplicado con éxito en el esquema de Supabase.

### C. Migración Multi-Negocio y Roles Vitalicios
- **Objetivo:** Permitir que múltiples negocios operen de forma aislada (multi-tenant) con control de empleados y prevención de fraudes.
- **Estructura:** Tabla `user_licenses` para control de suscripciones y `business_members` para control de permisos por usuario y sucursal.
- **Estado:** Aplicado con éxito en el esquema de Supabase.

---

## 🛠️ 2. Scripts de Parches y Pruebas Locales (Directorio `scratch/`)

Durante fases previas de desarrollo e iteración con agentes IA, se generaron scripts de mantenimiento temporal que resolvieron los siguientes puntos:

### A. Fusión y Corrección de Datos de Usuarios (`brankito` y `miguel`)
- **Propósito:** Resolver inconsistencias de duplicados entre usuarios y negocios en la base de datos local SQLite, consolidando registros y deudas pendientes.
- **Scripts asociados:** `check_duplicates_brankito_miguel.js`, `merge_brankito_miguel.js`, `inspect_debt.js`.
- **Resultado:** Base de datos local saneada e integrada.

### B. Parches Fase 3 y Fase 4 (Sincronización y Módulos de Venta)
- **Propósito:** Ajustar controladores de sincronización bidireccional entre SQLite y Supabase, validación de stock en tiempo real y componentes visuales modales.
- **Scripts asociados:** `patch_phase3*.js`, `patch_phase4*.js`.
- **Resultado:** Lógica incorporada permanentemente en los archivos de producción (`backend/` y `js/`).

### C. Suites de Pruebas de Integración
- **Propósito:** Verificar el flujo completo de ventas rápidas, cobro, asignación de turnos de caja y sincronización en la nube.
- **Scripts asociados:** `test_phase1.js`, `test_phase5.js`, `test_sale.js`, `test_sync.js`, `test_migrations.js`.
- **Resultado:** Validaciones completadas satisfactoriamente.

---

> **Nota:** Todos los parches y funcionalidades activas se encuentran incorporados de forma permanente en el código fuente de `backend/`, `js/` y `schema.sql`.
