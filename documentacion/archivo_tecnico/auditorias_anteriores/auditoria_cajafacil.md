# Auditoría Técnica y Normativa -- Sistema de Ventas **CajaFácil**

Autor: Auditoría técnica (Full‑Stack + revisión normativa Chile)\
Fecha: 2026

------------------------------------------------------------------------

# 1. Contexto del sistema

El sistema **CajaFácil** actualmente tiene dos modalidades de uso:

1.  **Aplicación de escritorio**
    -   Empaquetada como `.exe`
    -   Construida con **Electron + Node.js**
    -   Base de datos local **SQLite**
2.  **Versión web / cloud**
    -   Dominio: `cajafacil.cl`
    -   Acceso: `cajafacil.cl` o `cajafacil.cl:3000`
    -   Servidor Node.js con Express
    -   Uso esperado:
        -   multidispositivo
        -   multicaja
        -   acceso remoto

Esto significa que el sistema intenta operar como:

**POS híbrido (local + cloud)**.

------------------------------------------------------------------------

# 2. Arquitectura actual detectada

Frontend: - HTML - CSS - JavaScript

Backend: - Node.js - Express

App escritorio: - Electron

Base de datos: - SQLite

Autenticación: - JWT - bcrypt

Exportación: - Excel - PDF

------------------------------------------------------------------------

# 3. Problemas de arquitectura detectados

## 3.1 Backend dentro del cliente (Electron)

Problema: El backend Node.js está empaquetado dentro de la aplicación
cliente.

Riesgos: - manipulación del código - modificación directa de base de
datos - dificultad para auditoría

### Ajuste recomendado

Separar arquitectura:

    Cliente POS
       ↓
    API REST segura
       ↓
    Base de datos central

Implementación sugerida:

-   Backend central en servidor cloud
-   API Express
-   Autenticación segura

------------------------------------------------------------------------

## 3.2 Base de datos SQLite para entorno multicaja

SQLite es una base de datos **local**, diseñada para:

-   aplicaciones individuales
-   baja concurrencia

Problemas en POS:

-   bloqueo de escritura
-   corrupción si el programa se cierra abruptamente
-   concurrencia limitada
-   mala escalabilidad

### Ajuste recomendado

Migrar base de datos a:

    PostgreSQL

o

    MySQL

Ventajas:

-   múltiples cajas simultáneas
-   integridad transaccional
-   mejor rendimiento

------------------------------------------------------------------------

## 3.3 Falta de control de concurrencia

Si dos cajas venden al mismo tiempo:

-   pueden duplicarse ventas
-   el stock puede quedar incorrecto

### Ajuste recomendado

Implementar:

-   transacciones SQL
-   bloqueo de stock
-   control ACID

------------------------------------------------------------------------

# 4. Problemas de seguridad

## 4.1 JWT en aplicación local

El token JWT pierde sentido si:

-   el usuario controla el código
-   puede generar tokens manualmente

### Ajuste recomendado

Autenticación centralizada en servidor.

------------------------------------------------------------------------

## 4.2 Manipulación de datos históricos

No existe protección para:

-   editar ventas pasadas
-   borrar ventas
-   alterar inventario

### Ajuste recomendado

Implementar tabla de auditoría:

    audit_log

Ejemplo:

  id   usuario   acción   fecha
  ---- --------- -------- -------

------------------------------------------------------------------------

# 5. Problemas de inventario

## 5.1 Riesgo de stock negativo

Operación actual:

    stock = stock - venta

Esto puede producir:

    stock = -5

### Ajuste recomendado

Validación obligatoria antes de venta.

------------------------------------------------------------------------

## 5.2 Falta de Kardex de inventario

Un sistema POS profesional requiere:

KARDEX

-   entrada
-   salida
-   ajuste
-   transferencia

### Ajuste recomendado

Crear tabla:

    movimientos_inventario

Columnas:

-   tipo
-   producto
-   cantidad
-   fecha
-   usuario

------------------------------------------------------------------------

# 6. Problemas tributarios (Normativa Chile)

Para operar legalmente en Chile, el sistema debe cumplir normativa del
**Servicio de Impuestos Internos (SII)**.

Requisitos obligatorios:

-   Boleta electrónica
-   Folios autorizados (CAF)
-   Firma electrónica
-   Envío al SII
-   Registro tributario

## Situación actual

El sistema **NO incluye**:

-   emisión de DTE
-   boletas electrónicas
-   firma digital
-   integración con SII

Por lo tanto:

**No puede usarse legalmente como sistema de facturación.**

Solo puede usarse como:

-   control interno
-   inventario
-   registro de ventas

------------------------------------------------------------------------

# 7. Problemas contables

El sistema actualmente no genera:

-   libro de ventas
-   libro de compras
-   registro de IVA débito/crédito

### Ajuste recomendado

Agregar módulo contable que genere:

    Libro de ventas mensual

Formato compatible con SII.

------------------------------------------------------------------------

# 8. Problemas técnicos detectados

Se encontraron scripts de reparación:

-   reparar_usuarios
-   reset_usuarios
-   saneamiento de base de datos

Esto indica:

-   inconsistencias en base de datos

### Ajuste recomendado

Implementar:

-   migraciones de base de datos
-   control de integridad
-   validaciones automáticas

------------------------------------------------------------------------

# 9. Problemas de calidad de software

No se detectaron:

-   pruebas unitarias
-   pruebas de integración
-   pruebas de carga

### Ajuste recomendado

Agregar testing:

    Jest

o

    Mocha

------------------------------------------------------------------------

# 10. Evaluación general del sistema

  Área               Evaluación
  ------------------ ------------
  Arquitectura       6/10
  Seguridad          4/10
  Inventario         5/10
  Escalabilidad      3/10
  Cumplimiento SII   0/10

------------------------------------------------------------------------

# 11. Roadmap recomendado para profesionalizar CajaFácil

Fase 1 -- Estabilización - migrar base de datos a PostgreSQL -
centralizar backend - implementar auditoría

Fase 2 -- POS profesional - control de inventario tipo kardex - control
multicaja - sistema de roles

Fase 3 -- cumplimiento legal Chile - integración con API del SII -
boleta electrónica - firma digital

------------------------------------------------------------------------

# 12. Conclusión

CajaFácil es un sistema POS funcional para uso interno o prototipo.

Sin embargo, para convertirse en un **POS comercial vendible en Chile**,
debe:

1.  mejorar arquitectura
2.  fortalecer seguridad
3.  implementar control contable
4.  integrar normativa del SII

Con estas mejoras el sistema podría evolucionar a un **POS cloud
multicaja profesional**.
