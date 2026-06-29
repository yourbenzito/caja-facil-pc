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

### 👤 Para el Cliente (Tu Comprador)
*   [**Manual de Usuario**](./documentacion/cliente/manual_usuario.md): Guía completa de uso del sistema, desde la primera venta hasta el cierre de caja. **(Este es el archivo que debes entregarle)**.

### 💼 Para Ti (Desarrollador / Vendedor)
*   [**Estrategia Comercial**](./documentacion/desarrollador/estrategia_comercial.md): Precios sugeridos, argumentos de venta y qué información compartir.
*   [**Guía Técnica**](./documentacion/desarrollador/guia_tecnica.md): Arquitectura del sistema, tecnologías y módulos internos.
*   [**Auditoría de Base de Datos**](./documentacion/desarrollador/auditoria_base_de_datos.md): Análisis profundo del esquema IndexedDB y mejoras críticas implementadas.
*   [**Historial de Cambios**](./documentacion/desarrollador/historial_cambios.md): Registro de versiones y evoluciones del sistema.

### 🏛️ Archivo Histórico y Técnico
*   [**Fases de Desarrollo**](./documentacion/archivo_tecnico/fases/): Reportes técnicos de cada fase implementada.
*   [**Mejoras de Stock**](./documentacion/archivo_tecnico/pasos_stock/): Detalle paso a paso de la corrección del motor de inventario.
*   [**Auditorías Anteriores**](./documentacion/archivo_tecnico/auditorias_anteriores/): Documentos de referencia sobre auditorías de stock y caja.

---

## ⚡ Resumen del Sistema (v1.0.0)

*   **Punto de Venta (POS):** Rápido, offline, soporte para código de barras y fiados.
*   **Inventario Inteligente:** Validación de stock real, trazabilidad total y conciliación automática.
*   **Gestión Financiera:** Control de caja con cuadratura, reportes de rentabilidad bruta y neta.
*   **Privacidad:** Datos 100% locales en la computadora del cliente (SQLite/IndexedDB).
*   **Seguridad:** JWT tokens, forzado de cambio de contraseña, validación de entrada.
*   **Actualizaciones:** Sistema automático de actualizaciones (configurable).
*   **Exportación:** Exportación completa de negocio (sin usuarios) para backup/migración.

---

## 🆘 Soporte

Para problemas técnicos o preguntas:
1. Revisar el [Manual de Usuario](./documentacion/cliente/manual_usuario.md)
2. Consultar la [Guía Técnica](./documentacion/desarrollador/guia_tecnica.md)
3. Contactar al soporte técnico

---

**Versión:** 1.0.0  
**Última actualización:** Junio 2026
