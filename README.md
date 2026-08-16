# 🚀 Sistema de Ventas La Kurva - Panel de Control

Bienvenido al sistema de gestión para minimarkets. Este documento sirve como punto de entrada central para toda la documentación organizada del proyecto.

---

## � Tabla de Contenidos

- [Instalación](#instalación)
- [Primeros Pasos](#primeros-pasos)
- [Seguridad](#seguridad)
- [Comandos](#comandos)
- [Estructura de Documentación](#estructura-de-documentación)

---

## 📦 Instalación

### Requisitos Previos

- **Node.js** v18 o superior
- **npm** v9 o superior
- **Windows 10/11** (recomendado) o Linux/macOS

### Instalación desde Código Fuente

1. **Clonar o descargar el repositorio:**
   ```bash
   git clone <repositorio>
   cd Sistema-Ventas-Negocio
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```
   
   Esto ejecutará automáticamente el script `setup-env.js` que genera:
   - `JWT_SECRET` único para la instalación
   - `GATEWAY_PASSWORD` único para la instalación

3. **Iniciar la aplicación:**
   ```bash
   npm start
   ```

### Instalación desde Ejecutable (.exe)

1. Descargar el instalador desde el hosting oficial
2. Ejecutar el instalador
3. Seguir las instrucciones del asistente
4. La aplicación se instalará y configurará automáticamente

---

## 🚀 Primeros Pasos

### Primer Login

Al iniciar la aplicación por primera vez, debes usar las credenciales por defecto:

- **Usuario:** `admin`
- **Contraseña:** `Admin@2024!`
- **Negocio:** `Mi Negocio`

⚠️ **IMPORTANTE:** Serás obligado a cambiar la contraseña en el primer login por seguridad.

### Cambio de Contraseña Obligatorio

El sistema implementa seguridad forzada:
1. Al primer login, aparecerá un modal obligatorio de cambio de contraseña
2. La nueva contraseña debe cumplir con:
   - Mínimo 8 caracteres
   - Al menos una letra mayúscula
   - Al menos una letra minúscula
   - Al menos un número
   - Al menos un carácter especial (!@#$%^&*)
3. No puedes usar la misma contraseña anterior

### Configuración Inicial

Después del primer login, se recomienda:
1. Configurar el nombre de tu negocio
2. Agregar tus primeros productos
3. Configurar métodos de pago
4. Establecer precios y categorías

---

## 🔒 Seguridad

### Características de Seguridad Implementadas

1. **JWT_SECRET Único por Instalación**
   - Cada instalación genera un JWT_SECRET único automáticamente
   - Los tokens de sesión son válidos por 30 días
   - No hay secretos hardcoded en el código

2. **Forzado de Cambio de Contraseña**
   - El usuario admin debe cambiar su contraseña en el primer login
   - Validación de complejidad de contraseña
   - No permite reutilizar la misma contraseña

3. **Validación de Entrada**
   - Validación de longitud en campos críticos
   - Sanitización de datos de usuario
   - Protección contra SQL injection (parámetros SQL)

4. **CORS Configurado**
   - Solo permite conexiones desde localhost y 127.0.0.1
   - Apropiado para aplicaciones Electron locales

### Archivos de Seguridad

- `backend/.env` - Contiene JWT_SECRET y GATEWAY_PASSWORD (NO compartir)
- `backend/.env.example` - Template para nuevas instalaciones

---

## 🛠️ Comandos

### Desarrollo

```bash
npm start          # Iniciar aplicación en modo desarrollo
npm run server     # Iniciar solo el servidor backend
npm run app        # Iniciar solo la aplicación Electron
```

### Empaquetado

```bash
npm run build      # Generar instalador .exe (Windows)
```

### Utilidades

```bash
npm run setup      # Ejecutar script de configuración de entorno
npm run importar   # Importar datos desde backup
```

---

## �📁 Estructura de Documentación

Toda la documentación ha sido organizada y optimizada para facilitar su acceso:

### 👤 Para el Cliente (Usuario Final)
*   [**Manual de Usuario**](./documentacion/cliente/manual_usuario.md): Guía completa paso a paso de uso del sistema y sus 15 módulos.
*   [**Guía Rápida**](./documentacion/cliente/guia_rapida.md): Resumen ejecutivo de operaciones diarias (apertura, venta, gastos, cierre).

### 💼 Para el Equipo Técnico y Desarrolladores
*   [**Guía Técnica**](./documentacion/desarrollador/guia_tecnica.md): Arquitectura híbrida SQLite/IndexedDB, flujo de datos y endpoints API REST.
*   [**Contexto Maestro**](./CONTEXT_MASTER.md): Visión general del modelo de negocio, esquema de base de datos y 15 módulos.
*   [**Arquitectura del Sistema**](./SYSTEM_ARCHITECTURE_MASTER.md): Especificaciones técnicas para escalamiento SaaS y PWA.
*   [**Historial de Cambios**](./documentacion/desarrollador/historial_cambios.md): Changelog detallado desde la v1.0.0 hasta la v1.4.0.
*   [**Estrategia Comercial**](./documentacion/desarrollador/estrategia_comercial.md): Licenciamiento y posicionamiento comercial.

---

## ⚡ Resumen de Funcionalidades (v1.4.0 - 15 Módulos)

*   **1. Punto de Venta (POS):** Rápido, offline, soporte para código de barras, venta por kg, Ley 20.956 y fiados.
*   **2. Catálogo de Productos:** Control de stock, categorías, alertas de stock mínimo y fechas de vencimiento.
*   **3. Clientes y Fiados:** Gestión de cuentas corrientes, límites de crédito y registro de abonos parciales/totales.
*   **4. Proveedores:** Directorio de contactos e historial de cuentas por pagar comercial.
*   **5. Compras y Calculadora de Cajas:** Recepción de mercadería con desglose automático de costo unitario por bulto/display.
*   **6. Gastos Operacionales:** Control de egresos del local (arriendos, servicios, sueldos) con presupuesto mensual.
*   **7. Devoluciones y Notas de Crédito:** Emisión formal de notas de crédito con restitución automática al stock.
*   **8. Copiloto Inteligente (IA):** Asistente conversacional para consultas de ventas y recomendaciones de reposición.
*   **9. Visor de Auditoría:** Bitácora inmutable de seguridad para trazabilidad de logins, ediciones y anulaciones.
*   **10. Caja Registradora:** Control de aperturas, cierres, arqueos y movimientos de efectivo sin doble conteo.
*   **11. Inventario y Kardex:** Bitácora física, mermas, consumo interno y valorización del stock (costo vs venta).
*   **12. Reportes de Rentabilidad:** Análisis estadístico y cálculo de ganancia neta real deduciendo costos y gastos.
*   **13. Historial de Ventas:** Reemisión de comprobantes, consulta navegable de tickets y edición de transacciones.
*   **14. Dashboard:** Panel central interactivo con métricas del día y accesos rápidos.
*   **15. Configuración y Seguridad:** Usuarios, roles, datos del negocio, JWT tokens y respaldos JSON.

---

## 🆘 Soporte

Para problemas técnicos o preguntas:
1. Revisar la [Guía Rápida](./documentacion/cliente/guia_rapida.md)
2. Consultar el [Manual de Usuario](./documentacion/cliente/manual_usuario.md)
3. Consultar la [Guía Técnica](./documentacion/desarrollador/guia_tecnica.md)

---

**Versión:** 1.4.0  
**Última actualización:** Julio 2026
