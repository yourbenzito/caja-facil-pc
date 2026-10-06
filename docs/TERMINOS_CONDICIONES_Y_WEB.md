# 📜 CAJA FÁCIL POS — TÉRMINOS, CONDICIONES DE USO Y ESPECIFICACIONES WEB

Documento oficial maestro que recopila las políticas legales, reglas de suscripción, límites técnicos, medidas anti-fraude y lineamientos para la futura página web comercial de Caja Fácil.

---

## 1. 🛡️ REGLAS Y CONDICIONES DE USO DE LA APLICACIÓN

### 1.1 Planes y Licenciamiento
* **🌱 PLAN FREE:**
  * Uso local exclusivo sin sincronización en la nube.
  * Límites: Hasta 50 productos en inventario, 100 ventas mensuales y 1 solo negocio.
  * No incluye respaldo automático en la nube ni conexión móvil.
* **💻 PLAN PC PRO:**
  * Uso profesional ilimitado en computadora.
  * Hasta 3 negocios/sucursales.
  * Respaldos periódicos en Supabase Cloud (al cierre de turno/caja y cada 12 horas).
* **📱 PLAN MÓVIL PRO:**
  * Uso profesional en dispositivos móviles con respaldo en Supabase.
* **⭐ PLAN FULL PRO:**
  * Acceso total e ilimitado tanto en PC como en Móvil.
  * Sincronización continua en tiempo real (WebSockets / Supabase Realtime).
  * Comunicación bidireccional inmediata entre cajas y dispositivos móviles.

### 1.2 Regla de Verificación Offline (Candado de 72 Horas)
* La aplicación permite operar sin conexión a internet para garantizar que el negocio nunca se detenga.
* **Límite de gracia:** Todo usuario con plan de pago debe conectarse a internet al menos una vez cada **72 horas** para validar el estado de su suscripción con el servidor de Supabase.
* Superadas las 72 horas continuas sin conexión, la app desactiva temporalmente las funciones PRO y opera en modo seguro básico hasta restablecer la conexión.

### 1.3 Integridad del Sistema y Anti-Fraude
* **Prohibición de Alteración del Reloj:** El usuario se compromete a no manipular ni atrasar deliberadamente la fecha u hora de su sistema operativo para evadir fechas de vencimiento. La aplicación valida el tiempo con marcas de tiempo cronológicas y servidores de red.
* **Prohibición de Ingeniería Inversa:** Queda terminantemente prohibido descompilar, modificar el código fuente, puentear validaciones criptográficas o distribuir licencias sin autorización.
* **Uso Exclusivo de Códigos:** Las claves de activación son de un solo uso y quedan permanentemente asociadas al correo del comprador en la base de datos de Supabase.

### 1.4 Sanciones por Incumplimiento
* **Revocación Inmediata de Licencia:** La detección de intentos de bypass, clonación de licencias o manipulación deliberada causará la cancelación inmediata de la suscripción sin derecho a reembolso.
* **Bloqueo de Acceso en Nube:** Supabase aplicará restricción de acceso (`status = 'banned'`) al `user_id` infractor y anulará los códigos de negocio asociados.

### 1.5 Roles, Empleados y Seguridad Operativa
* Cada empleado debe operar bajo su propia cuenta autorizada.
* El Dueño del negocio asume la responsabilidad total de las credenciales y accesos que otorga a su personal.
* El Dueño cuenta con la facultad de **inhabilitar en tiempo real** a cualquier empleado que renuncie o sea despedido, revocando de inmediato su acceso a las ventas y datos de la empresa.

---

## 2. 🌐 LINEAMIENTOS PARA LA FUTURA PÁGINA WEB COMERCIAL

Una vez concluida la aplicación, la página web oficial de Caja Fácil incluirá:

1. **Hero Section de Alto Impacto:**
   * Presentación de Caja Fácil como el sistema POS más rápido, confiable y moderno para negocios y comercios.
   * Modos de uso: PC Escritorio (Offline-First) + Móvil + Sincronización Cloud.
2. **Tabla Comparativa de Planes:**
   * Detalle transparente de los 4 planes (Free, PC Pro, Móvil Pro, Full Pro).
   * Botón de compra / suscripción automatizada.
3. **Seguridad y Respaldo Supabase:**
   * Explicación de cómo los datos del comerciante viajan encriptados y se respaldan en la nube con tecnología PostgreSQL / Supabase de nivel bancario.
4. **Portal de Canje de Licencias y Clientes:**
   * Espacio donde los clientes puedan verificar el estado de su suscripción ingresando su correo.
5. **Sección Legal Completa:**
   * Página dedicada a Términos y Condiciones de Servicio (basada en el apartado 1 de este documento).
   * Política de Privacidad de Datos y Garantía de Disponibilidad.
