# SYSTEM_ARCHITECTURE_MASTER

## VISIÓN GENERAL

La arquitectura definitiva para CajaFácil en los próximos 5 años es una plataforma **SaaS Multi-tenant PWA (Progressive Web App) Offline-First**. 

El sistema debe operar de la siguiente forma: El usuario abre la web app, la cual descarga los recursos estáticos (Service Workers) y almacena el estado completo de su negocio localmente en su dispositivo mediante IndexedDB. El POS opera 100% sobre esta base de datos local garantizando **0 milisegundos de latencia** y tolerancia absoluta a cortes de internet. Paralelamente, un motor de sincronización (Background Sync) se encarga de subir las transacciones a un servidor backend centralizado en la nube tan pronto como la red esté disponible, y baja actualizaciones de inventario en tiempo real usando WebSockets o Server-Sent Events (SSE). 

Esta arquitectura une lo mejor de ambos mundos: la resiliencia e inmediatez de la aplicación de escritorio antigua, con la escalabilidad, actualizaciones instantáneas y ubicuidad de un SaaS moderno.

---

## STACK TECNOLÓGICO

### Frontend
* **Framework:** **React (Next.js en modo SSG/SPA) o Vite + React**. Se elige React por el ecosistema maduro de hooks, facilidad para construir interfaces altamente interactivas y su ecosistema de librerías PWA.
* **Lenguaje:** **TypeScript**. Mandatorio para evitar regresiones lógicas (especialmente en cálculos de dinero y redondeos fiscales) y asegurar interfaces de datos estrictas entre el front y el back.
* **Librerías Clave:**
  * **RxDB / WatermelonDB:** Base de datos local reactiva encima de IndexedDB. Resuelve la sincronización bidireccional y persistencia offline automáticamente.
  * **Tailwind CSS + shadcn/ui:** Para construir interfaces premium, accesibles y estandarizadas de forma muy rápida y con poco peso.
  * **Zustand / Jotai:** Manejo de estado global ligero (turnos de caja, carrito actual).
  * **React Hook Form + Zod:** Validaciones de formularios consistentes en ambos lados (front y back).

### Backend
* **Framework:** **Node.js con NestJS** (o Express fuertemente tipado). Se recomienda NestJS por su arquitectura modular nativa orientada a inyección de dependencias, perfecta para aplicaciones SaaS empresariales.
* **Arquitectura:** **Arquitectura Limpia (Clean Architecture) / Modular Monolith**. Un monolito escalable horizontalmente separado en dominios (Sales, Inventory, Auth). No se recomienda microservicios en etapas tempranas para evitar latencia interna y complejidad de transacciones distribuidas.

### Base de Datos
* **Motor:** **PostgreSQL**. Es el estándar de oro para SaaS. Permite aislamiento robusto (Row Level Security - RLS) y maneja transacciones ACID y JSONB con una fiabilidad muy superior a MySQL/SQLite en escenarios web.
* **Estrategia de Migración:** Script Node.js que reciba el JSON exportado de SQLite y realice un upsert atómico estructurado hacia PostgreSQL, adaptando `business_id` como clave foránea segura.

### Infraestructura
* **Hosting:** Frontend desplegado en **Vercel** o **Cloudflare Pages** (global edge). Backend en **AWS ECS** (contenedores) o **Render/Railway** para inicio rápido.
* **CDN:** **Cloudflare**. Para cachear estáticos, mitigar ataques DDoS y proveer SSL gratuito.
* **Almacenamiento:** Base de datos gestionada (**AWS RDS PostgreSQL** o **Supabase**).

---

## ARQUITECTURA OFFLINE-FIRST

El mayor riesgo de ir a la nube es perder la velocidad local. Para mantener la latencia a 0 ms:

* **IndexedDB (RxDB/WatermelonDB):** Toda escritura del cajero (ej. completar una venta) hace un `INSERT` en la BD local del navegador. La UI se actualiza inmediatamente sin esperar al servidor.
* **Service Workers:** Cachean todo el HTML, JS, CSS y recursos visuales para que la aplicación cargue de inmediato incluso en Modo Avión.
* **Sincronización:** Un proceso en segundo plano escucha los cambios locales (`observable streams`). Si hay conexión, empuja una cola de "Mutation Events" al servidor (ej. `[CREATE_SALE, UPDATE_STOCK]`).
* **Resolución de Conflictos:** Estrategia basada en **CRDTs (Conflict-free Replicated Data Types)** o "El último servidor manda con marcas de tiempo (LWW - Last Write Wins)". Dado que las operaciones contables se modelan como "Movimientos" (Event Sourcing local) en lugar de "Updates" directos, no hay conflicto de sobreescritura (si dos vendedores venden el último pan, el saldo quedará en negativo, y luego el admin hace un ajuste de merma).

---

## MULTITENANCY (Multi-Inquilino)

Aislamiento lógico seguro (Separación en la misma BD):

1. **Columna `business_id` Mandatoria:** Toda tabla transaccional o de negocio tendrá esta columna.
2. **Row Level Security (RLS):** Si se usa Supabase o Postgres puro, habilitar RLS para que sea imposible que un query omita el filtro `business_id`. A nivel ORM (ej. Prisma/TypeORM), configurar un Prisma Client Extension o Interceptor que inyecte `where: { business_id: req.user.businessId }` en cada consulta por defecto.
3. **Control Jerárquico:** Soporte para `account_id` (Franquicias/Sucursales) de modo que un `admin_global` pueda ver estadísticas cruzadas de varios `business_id` si comparten la misma cuenta padre.

---

## SEGURIDAD

* **Autenticación:** OAuth 2.0 y Auth local.
* **JWT y Refresh Tokens:**
  * **Access Token:** Corta vida (15 min), guardado en Memoria (closure/variable JS) para prevenir robo por XSS.
  * **Refresh Token:** Larga vida (30 días), guardado en una Cookie `HttpOnly, Secure, SameSite=Strict`. El backend emite un nuevo Access Token al recibir esta cookie, previniendo secuestro de sesión y ataques CSRF.
* **Protección XSS:** Manejo nativo por parte de React (escapa inyecciones HTML) y estricta Content-Security-Policy (CSP) en Cloudflare.
* **Protección CSRF:** Mitigada con `SameSite` en cookies y rechazo explícito en NestJS a orígenes cruzados no reconocidos.

---

## ESTRUCTURA DE MÓDULOS

### Frontend
* **`@core/POS`:** Escáner, carrito de compras local, pagos rápidos, impresión de tickets/boletas web (Web Bluetooth API o ESC/POS a servidor local secundario si es necesario).
* **`@domain/Inventory`:** CRUD de productos offline-first, categorías, kardex y ajustes de merma.
* **`@domain/Customers`:** Fichas de cliente, historial de fiados (Cuentas por cobrar), modal de abonos a deudas.
* **`@domain/Cash`:** Apertura y cierre de turnos locales, ingresos, retiros e historial de turnos diarios.
* **`@reports/Analytics`:** Cuadros de mando, exportación a XLSX y PDF en un Web Worker para no congelar la UI.
* **`@shared/Settings`:** Configuraciones del negocio (moneda, impuestos, usuarios, terminal MercadoPago).

### Backend (Módulos NestJS)
* **`AuthModule`:** Gestión de roles (Admin/Cashier), emisión de JWT, recuperación de PIN.
* **`SalesModule`:** Recepción de transacciones enviadas por la cola Offline. Validación estricta de Ley 20.956 y cuadraturas.
* **`InventoryModule`:** Control de stock central, sincronizado vía WebSockets hacia todas las cajas abiertas.
* **`CustomersModule`:** Gestión central de deudores y validación de cobros.
* **`CashModule`:** Auditoría centralizada de turnos de caja para reportabilidad de dueños remotos.
* **`ReportsModule`:** Agregaciones pesadas en SQL para enviar métricas calculadas a clientes.

---

## MODELO DE DESPLIEGUE

* **Desarrollo (Dev):** Base de datos PostgreSQL en Docker. Hot Reload local vía Vite. (localhost:5173).
* **Testing (Staging):** Vercel Preview Environments conectados a una DB remota (Neon/Supabase en modo staging). Pruebas E2E automáticas con Playwright simulando cortes de red en el navegador.
* **Producción (Prod):** Despliegue en rama `main`. Auto-escalado de contenedores del backend en AWS/Render. DB en Multi-AZ (alta disponibilidad) con backups automatizados cada hora (Point-in-Time Recovery).

---

## ROADMAP DE IMPLEMENTACIÓN

* **Fase 1: MVP Backend & Data Layer (Semanas 1-4)**
  * Diseño del esquema en PostgreSQL.
  * Desarrollo del backend NestJS (Auth, Multitenancy interceptors, endpoints base).
  * Desarrollo de script de migración automática desde SQLite a Postgres.
* **Fase 2: Motor Offline-First Frontend (Semanas 5-8)**
  * Configuración de React, RxDB/WatermelonDB, y Service Workers.
  * Replicación de la BD del usuario actual en IndexedDB.
  * Flujo lógico de guardado local sin red.
* **Fase 3: Core de Negocio UI (Semanas 9-12)**
  * Recreación del POS, Inventario, Clientes, y Cajas con la nueva interfaz de React + Tailwind.
  * Integración con la lógica fiscal (Redondeos, IVA).
* **Fase 4: Sincronización, Pagos y Pulido (Semanas 13-16)**
  * Activación de Background Sync hacia la nube.
  * Integración del SDK MercadoPago.
  * Pruebas beta en terreno (simulando cortes de cable de red). Carga masiva de negocios reales.

---

## DECISIONES ARQUITECTÓNICAS (Justificación Corta)

1. **¿Por qué PWA Offline-First sobre Web Tradicional?** Un minimarket requiere una venta procesada en <1s. Depender del ping a AWS en cada ítem escaneado haría el sistema inusable. IndexedDB local es un requerimiento de negocio, no un lujo.
2. **¿Por qué NestJS / Monolito Modular?** La facturación, inventario y caja interactúan continuamente. Los microservicios añadirían complejidad de red que un equipo pequeño no puede mantener.
3. **¿Por qué PostgreSQL?** Posee RLS nativo (seguridad por inquilino en el motor de la base de datos). Evita fugas de datos entre negocios por error humano en el código.

---

## RIESGOS TÉCNICOS Y MITIGACIONES

* **Riesgo 1: Pérdida temporal de datos si se borra el caché del navegador antes de sincronizar.**
  * *Mitigación:* Usar la cuota persistente de almacenamiento de la API web (`navigator.storage.persist()`). Notificar visualmente (ícono de nube en rojo) si hay operaciones en cola pendientes de subir, advirtiendo al usuario no borrar datos de navegación.
* **Riesgo 2: Dificultad para interactuar con impresoras térmicas locales desde un navegador web.**
  * *Mitigación:* Utilizar la API Web Serial/Web Bluetooth si el hardware es compatible. Alternativa: Proveer un micro-agente instalable secundario en Go/Node que levante un server `localhost:4000` solo para comandar impresoras ESC/POS locales evadiendo restricciones del browser.
* **Riesgo 3: Complejidad en resolución de conflictos de sincronización (Split-brain).**
  * *Mitigación:* Basar toda la contabilidad en Registros Inmutables (Append-Only Ledgers). Nunca actualizar `stock=10`, sino insertar un registro `type=sale, qty=-1`. La nube simplemente consolida movimientos y recalcula la foto actual, eliminando la mayoría de los conflictos.
