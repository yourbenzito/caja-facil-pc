const CACHE_NAME = 'cajafacil-v1.4.2';
const ASSETS = [
    './',
    './index.html',
    './css/styles.css',
    // Core
    './js/config.js',
    './js/db.js',
    './js/auth.js',
    './js/app.js',
    './js/utils/api-client.js',
    './js/utils/formatter.js',
    './js/utils/alerts.js',
    './js/utils/backup.js',
    './js/utils/debounce.js',
    './js/utils/keyboard.js',
    './js/utils/validator.js',
    './js/utils/db-utilities.js',
    // Repositories
    './js/repositories/BaseRepository.js',
    './js/repositories/productRepository.js',
    './js/repositories/SaleRepository.js',
    './js/repositories/CustomerRepository.js',
    './js/repositories/PaymentRepository.js',
    './js/repositories/PurchaseRepository.js',
    './js/repositories/StockMovementRepository.js',
    './js/repositories/CashRegisterRepository.js',
    './js/repositories/CashMovementRepository.js',
    './js/repositories/SupplierRepository.js',
    './js/repositories/UserRepository.js',
    './js/repositories/PasswordResetRepository.js',
    './js/repositories/CustomerCreditDepositRepository.js',
    './js/repositories/CustomerCreditUseRepository.js',
    './js/repositories/SaleReturnRepository.js',
    './js/repositories/SupplierPaymentRepository.js',
    './js/repositories/ProductPriceHistoryRepository.js',
    // Services
    './js/services/PermissionService.js',
    './js/services/AuditLogService.js',
    './js/services/StockService.js',
    './js/services/PaymentService.js',
    './js/services/AccountService.js',
    './js/services/SaleService.js',
    './js/services/SaleReturnService.js',
    './js/services/SupplierPaymentService.js',
    './js/services/CustomerAccountService.js',
    './js/services/ProductService.js',
    // Validators
    './js/validators/PaymentValidator.js',
    './js/validators/SaleValidator.js',
    './js/validators/ProductValidator.js',
    // Models
    './js/models/User.js',
    './js/models/PasswordReset.js',
    './js/models/product.js',
    './js/models/ProductPriceHistory.js',
    './js/models/Sale.js',
    './js/models/SaleReturn.js',
    './js/models/Customer.js',
    './js/models/Supplier.js',
    './js/models/Purchase.js',
    './js/models/SupplierPayment.js',
    './js/models/CashRegister.js',
    './js/models/StockMovement.js',
    './js/models/CashMovement.js',
    './js/models/Payment.js',
    './js/models/CustomerCreditDeposit.js',
    './js/models/CustomerCreditUse.js',
    // Controllers
    './js/controllers/ProductController.js',
    './js/controllers/POSController.js',
    './js/controllers/CustomerController.js',
    './js/controllers/SupplierController.js',
    './js/controllers/CashController.js',
    './js/controllers/ReportController.js',
    // Views
    './js/views/pos.js',
    './js/views/products.js',
    './js/views/customers.js',
    './js/views/suppliers.js',
    './js/views/purchases.js',
    './js/views/cash.js',
    './js/views/inventory.js',
    './js/views/reports.js',
    './js/views/sales.js',
    './js/views/settings.js',
    './js/views/auditLogs.js',
    // Libs (locales)
    './js/libs/chart.js',
    './js/libs/jspdf.umd.min.js',
    './js/libs/jspdf.plugin.autotable.min.js',
    './js/libs/xlsx.full.min.js',
    // Manifest & Icons
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png'
];

// Instalación: Guardar archivos básicos en cache
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            console.log('[SW] Cacheando archivos base para CajaFácil...');
            await Promise.allSettled(ASSETS.map(url => cache.add(url).catch(e => console.warn('[SW] No cacheado:', url, e.message))));
        })
    );
});

// Escuchar mensaje del cliente para forzar activación
self.addEventListener('message', (event) => {
    if (event.data && event.data.action === 'skipWaiting') {
        self.skipWaiting();
    }
});

// Activación: Limpiar caches viejos
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
    console.log('[SW] Nueva versión activada:', CACHE_NAME);
});

// Estrategia de carga: Stale-While-Revalidate (Ultra rápido)
self.addEventListener('fetch', (event) => {
    // No interceptar peticiones de la API (siempre deben ir a la red local)
    if (event.request.url.includes('/api/')) return;

    // Solo interceptar peticiones GET
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                // Actualizar el cache en segundo plano si la respuesta es válida
                if (networkResponse.status === 200) {
                    const resClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, resClone);
                    });
                }
                return networkResponse;
            }).catch(() => cachedResponse);

            return cachedResponse || fetchPromise;
        })
    );
});
