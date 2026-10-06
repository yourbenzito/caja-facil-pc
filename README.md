# 🛒 CAJA FÁCIL POS — SISTEMA INTEGRAL DE PUNTO DE VENTA

**Caja Fácil POS** es una plataforma moderna de Punto de Venta (POS) y administración comercial diseñada para minimarkets, almacenes y comercios minoristas. Construida bajo arquitectura **Offline-First**, garantiza operatividad continua sin internet con sincronización en tiempo real hacia la nube (**Supabase Cloud**) y soporte multi-caja.

---

## 📚 DOCUMENTACIÓN MAESTRA DEL SISTEMA

Toda la documentación oficial, actualizada y detallada se encuentra centralizada en la carpeta [`docs/`](./docs/):

| Documento | Destinatario | Descripción |
| :--- | :--- | :--- |
| [**01. Módulos y Funcionalidades**](./docs/01_MODULOS_Y_FUNCIONALIDADES.md) | **Usuarios y Analistas** | Catálogo exhaustivo de absolutamente todas las funciones, pantallas, botones, validaciones y reglas de negocio del sistema (POS, Caja, Inventario, Clientes, Compras, F29, etc.). |
| [**02. Arquitectura Técnica e IA**](./docs/02_ARQUITECTURA_TECNICA_IA.md) | **IA y Desarrolladores Senior** | Especificación técnica de ingeniería: Electron, Node.js Express, base de datos SQLite WAL, motor de sincronización delta con Supabase Cloud, WebSockets Realtime, seguridad JWT y empaquetado. |
| [**03. Manual del Dueño y Operaciones Pro**](./docs/03_MANUAL_DEL_DUENO_Y_OPERACIONES.md) | **Dueño del Negocio / Admin** | Guía práctica de alto nivel: filosofía de arqueo ciego, control de fiados, fiscalización de empleados, protocolos de emergencia sin internet, instalación de impresoras térmicas y configuración de nuevas PCs. |

---

## ⚡ COMANDOS RÁPIDOS DE DESARROLLO

```bash
# Iniciar en modo desarrollo (PC principal)
npm start

# Compilar instalador ejecutable de Windows (.exe en /dist)
npm run build
```

---

## 🛡️ CARACTERÍSTICAS CLAVE

* **100% Offline-First:** Si se corta la luz o el internet, el sistema sigue cobrando y emitiendo boletas en su base de datos local SQLite.
* **Sincronización Silenciosa:** Al reconectar internet, sincroniza automáticamente con la nube sin recargar pantallas ni interrumpir a los cajeros.
* **Multi-Caja en Tiempo Real:** Soporte para múltiples terminales de cobro simultáneas (`PC-1`, `PC-2`) con turnos independientes de caja y control preventivo de retiros.
* **Campana de Alertas 🔔:** Notificaciones en vivo sobre ventas sin stock, arqueos de cierre de tienda y movimientos de dinero.
* **Cumplimiento Tributario:** Cálculos adaptados a la Ley de Redondeo 20.956 y Termómetro Fiscal IVA F29 en vivo.
