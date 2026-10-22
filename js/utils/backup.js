const ENTITY_EXPORTS = [
    { key: 'sales', label: 'Ventas', type: 'store', store: 'sales', sheet: 'ventas' },
    { key: 'debts', label: 'Clientes y Deudas', type: 'custom', handler: 'customerDebts', sheet: 'clientes_deudas' },
    { key: 'suppliers', label: 'Proveedores', type: 'store', store: 'suppliers', sheet: 'proveedores' },
    { key: 'purchases', label: 'Compras', type: 'store', store: 'purchases', sheet: 'compras' },

    { key: 'cash', label: 'Caja', type: 'store', store: 'cashRegisters', sheet: 'caja' },
    { key: 'inventory', label: 'Inventario', type: 'store', store: 'products', sheet: 'inventario' },
    { key: 'history', label: 'Historial de Ventas', type: 'store', store: 'stockMovements', sheet: 'historial_ventas' },
    { key: 'reports', label: 'Reportes', type: 'custom', handler: 'reportsSummary', sheet: 'reportes' }
];
window.BACKUP_ENTITY_CONFIG = ENTITY_EXPORTS;

class BackupManager {
    static async exportAllData() {
        try {
            showNotification('Generando respaldo del negocio...', 'info');
            const data = await this.getBackupData();

            const json = JSON.stringify(data); // Sin espacios para máxima velocidad
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const dateStr = new Date().toISOString().slice(0, 10);
            a.download = `respaldo-negocio-${dateStr}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            showNotification('✅ Respaldo del negocio creado exitosamente', 'success');
        } catch (error) {
            console.error('Error creating backup:', error);
            showNotification('Error al crear respaldo: ' + error.message, 'error');
        }
    }

    /**
     * Obtiene el objeto de backup del negocio (sin usuarios ni contraseñas por seguridad).
     */
    static async getBackupData() {
        const products = await db.getAll('products');
        const categories = await db.getAll('categories');
        const sales = await db.getAll('sales');
        const customers = await db.getAll('customers');
        const suppliers = await db.getAll('suppliers');
        const purchases = await db.getAll('purchases');
        const expenses = await db.getAll('expenses');
        const cashRegisters = await db.getAll('cashRegisters');
        const cashMovements = await db.getAll('cashMovements');
        const stockMovements = await db.getAll('stockMovements');
        const settings = await db.getAll('settings');
        const payments = await db.getAll('payments');
        const businesses = await db.getAll('businesses');

        const customerCreditDeposits = await db.getAll('customerCreditDeposits');
        const customerCreditUses = await db.getAll('customerCreditUses');
        const auditLogs = await db.getAll('auditLogs');
        const productPriceHistory = await db.getAll('productPriceHistory');
        const productCostHistory = await db.getAll('productCostHistory');
        const supplierPayments = await db.getAll('supplierPayments');
        const saleReturns = await db.getAll('saleReturns');
        const debtPaymentSessions = await db.getAll('debtPaymentSessions');
        const counterNotes = await db.getAll('counterNotes');

        // CORRECCIÓN: Validar categorías por nombre e ID
        const categoryNames = new Set(categories.map(c => (c.name || '').toLowerCase().trim()));
        const categoryIds = new Set(categories.map(c => String(c.id)));
        const customerIds = new Set(customers.map(c => String(c.id)));
        const supplierIds = new Set(suppliers.map(s => String(s.id)));

        // Preservar la categoría del producto intacta y asegurar formato universal (PC ⟷ Mobile)
        let fixedProducts = 0;
        products.forEach(p => {
            if (!p.category || p.category === 'null' || p.category === 'undefined') {
                p.category = 'General';
                fixedProducts++;
            }
            // Campos universales duales para compatibilidad perfecta entre PC y Celular
            const finalPrice = Number(p.price !== undefined ? p.price : (p.salePrice !== undefined ? p.salePrice : 0));
            const finalCost = Number(p.cost !== undefined ? p.cost : (p.costPrice !== undefined ? p.costPrice : 0));
            const finalCode = (p.barcode || p.code || (p.id ? String(p.id) : '')).trim();
            const targetCloudId = p.cloud_id ? String(p.cloud_id) : (p.local_id ? String(p.local_id) : null);

            p.price = finalPrice;
            p.salePrice = finalPrice;
            p.cost = finalCost;
            p.costPrice = finalCost;
            p.barcode = finalCode;
            p.code = finalCode;
            p.cloud_id = targetCloudId;
            p.local_id = targetCloudId || String(p.id);
            p.isActive = p.isActive !== undefined ? p.isActive : (p.deletedAt ? 0 : 1);
            p.isFavorite = Boolean(p.isFavorite || p.is_favorite);
        });

        // Corregir ventas con clientes inexistentes
        let fixedSales = 0;
        sales.forEach(s => {
            if (s.customerId && !customerIds.has(s.customerId)) {
                s.customerId = null;
                fixedSales++;
            }
        });

        // Corregir compras con proveedores inexistentes
        let fixedPurchases = 0;
        purchases.forEach(p => {
            if (p.supplierId && !supplierIds.has(p.supplierId)) {
                p.supplierId = null;
                fixedPurchases++;
            }
        });

        // Corregir settings con ID nulo
        let fixedSettings = 0;
        settings.forEach((s, index) => {
            if (s.id === null || s.id === undefined) {
                s.id = Date.now() + index;
                fixedSettings++;
            }
        });

        if (fixedProducts > 0 || fixedSales > 0 || fixedPurchases > 0 || fixedSettings > 0) {
            console.warn(`Backup: Corregidos ${fixedProducts} productos, ${fixedSales} ventas, ${fixedPurchases} compras, ${fixedSettings} settings con foreign keys inválidos`);
        }

        const currentUser = (typeof AuthManager !== 'undefined' && typeof AuthManager.getCurrentUser === 'function') 
            ? AuthManager.getCurrentUser() 
            : null;
        const userEmail = currentUser?.email || localStorage.getItem('PMV_USER_EMAIL') || '';
        const bizName = localStorage.getItem('CURRENT_BUSINESS') || localStorage.getItem('PMV_BIZ') || 'Mi Negocio';

        return {
            appName: 'Caja Fácil POS',
            formatVersion: '2.0.0',
            version: '2.0.0',
            exportDate: new Date().toISOString(),
            exportedAt: new Date().toISOString(),
            ownerEmail: userEmail,
            businessName: bizName,
            products,
            categories,
            sales,
            customers,
            suppliers,
            purchases,
            expenses,
            cashRegisters,
            cashMovements,
            stockMovements,
            settings,
            payments,
            businesses,
            customerCreditDeposits,
            customerCreditUses,
            auditLogs,
            productPriceHistory,
            productCostHistory,
            supplierPayments,
            saleReturns,
            debtPaymentSessions,
            counterNotes
        };
    }

    /**
     * Guarda backup en disco (Electron: userData/backups). Si no hay api, hace export normal (descarga).
     */
    static async exportAllDataToDisk() {
        try {
            console.log('Exporting data to disk...');
            const data = await this.getBackupData();
            const json = JSON.stringify(data); // Optimizado sin identación
            if (typeof window !== 'undefined' && window.api && typeof window.api.backupSaveToDisk === 'function') {
                const result = await window.api.backupSaveToDisk(json);
                if (result && result.ok) {
                    if (typeof showNotification === 'function') {
                        showNotification('Backup automático guardado en disco', 'success');
                    }
                    return true;
                }
                if (result && result.error && typeof showNotification === 'function') {
                    showNotification('Error al guardar backup: ' + result.error, 'error');
                }
                return false;
            }
            this.exportAllData();
            return true;
        } catch (error) {
            console.error('Error en backup a disco:', error);
            if (typeof showNotification === 'function') {
                showNotification('Error en backup automático: ' + error.message, 'error');
            }
            return false;
        }
    }

    static async importData(jsonData, wipeCloud = true) {
        const hasPipeline = typeof LoadingPipelineModal !== 'undefined';
        try {
            if (hasPipeline) {
                LoadingPipelineModal.show({
                    title: 'Restauración del Sistema POS',
                    steps: [
                        { id: '1', label: 'Validando Archivo' },
                        { id: '2', label: 'Escribiendo en SQLite' },
                        { id: '3', label: 'Indexando Registros' },
                        { id: '4', label: 'Sincronización Final' }
                    ],
                    activeStep: 0,
                    percent: 15,
                    counterText: 'Analizando respaldo',
                    detailText: 'Comprobando integridad y tablas del archivo JSON...',
                    estimatedTime: 'Un momento...'
                });
            }

            const rawData = JSON.parse(jsonData);
            const data = (rawData && rawData.tables) ? rawData.tables : rawData;

            // Calcular total de registros para el contador en vivo
            let totalRecords = 0;
            const tableKeys = Object.keys(data).filter(k => !['version', 'exportDate', 'exportedAt', 'businessId', 'appName', 'formatVersion'].includes(k));
            tableKeys.forEach(k => {
                if (Array.isArray(data[k])) totalRecords += data[k].length;
            });

            console.log('Iniciando importación certificada (wipeCloud:', wipeCloud, ')...');
            console.log(`Tablas detectadas (${tableKeys.length}):`, tableKeys);
            console.log(`Total de registros calculados: ${totalRecords}`);

            if (db.mode === 'sqlite') {
                const activeBid = Number(localStorage.getItem('BUSINESS_ID') || 1);
                const currentUserId = (typeof SyncService !== 'undefined') ? await SyncService.getCurrentUserId() : null;
                
                if (hasPipeline) {
                    LoadingPipelineModal.update({
                        activeStep: 1,
                        percent: 45,
                        counterText: `0 / ${totalRecords.toLocaleString()} reg`,
                        detailText: `Escribiendo ${tableKeys.length} tablas en base de datos SQLite local...`,
                        estimatedTime: 'Unos segundos'
                    });
                } else {
                    if (wipeCloud) {
                        showNotification('🧹 Preparando restauración limpia en PC y Nube...', 'info');
                    } else {
                        showNotification('🚀 Iniciando transferencia inmediata...', 'success');
                    }
                }

                console.log('📦 Enviando datos a SQLite para negocio', activeBid, 'con wipeCloud =', wipeCloud);
                const payload = {
                    tables: data,
                    wipeCloud: Boolean(wipeCloud),
                    businessId: activeBid,
                    userId: currentUserId
                };

                const result = await ApiClient.post('migration/import', payload, false, { timeout: 300000 });
                console.log('📦 Resultado del servidor:', result);
                if (!result.success) {
                    throw new Error(result.error || 'Error en servidor');
                }

                if (hasPipeline) {
                    LoadingPipelineModal.update({
                        activeStep: 2,
                        percent: 78,
                        counterText: `${totalRecords.toLocaleString()} / ${totalRecords.toLocaleString()} reg`,
                        detailText: 'Reconstruyendo índices, llaves foráneas y balance contable...',
                        estimatedTime: 'Casi listo'
                    });
                }

                // Disparar sincronización inmediata hacia Supabase Cloud con los nuevos datos
                if (typeof SyncService !== 'undefined') {
                    if (hasPipeline) {
                        LoadingPipelineModal.update({
                            activeStep: 3,
                            percent: 92,
                            counterText: 'Nube & Local',
                            detailText: 'Sincronizando respaldo con Supabase Cloud...',
                            estimatedTime: 'Últimos segundos'
                        });
                    } else {
                        showNotification('☁️ Sincronizando respaldo completo con Supabase Cloud...', 'info');
                    }
                    try {
                        const syncRes = await SyncService.syncAll(true);
                        console.log('☁️ Resultado de sincronización post-restauración:', syncRes);
                    } catch (syncErr) {
                        console.warn('⚠️ Error en auto-sync post restauración:', syncErr);
                    }
                }
            } else {
                if (hasPipeline) {
                    LoadingPipelineModal.update({
                        activeStep: 1,
                        percent: 50,
                        counterText: `Guardando datos`,
                        detailText: 'Insertando registros en IndexedDB del navegador...',
                        estimatedTime: 'Unos segundos'
                    });
                } else {
                    showNotification('2/3: Guardando datos en navegador...', 'info');
                }
                
                // Modo IndexedDB: Importación de tablas operativas (excluyendo users y passwordResets)
                const stores = ['products', 'categories', 'sales', 'customers', 'suppliers', 'purchases', 'expenses', 'cashRegisters', 'cashMovements', 'stockMovements', 'settings', 'payments', 'businesses', 'customerCreditDeposits', 'customerCreditUses', 'auditLogs', 'productPriceHistory', 'productCostHistory', 'supplierPayments', 'saleReturns', 'debtPaymentSessions', 'counterNotes'];

                for (const store of stores) {
                    if (data[store] && Array.isArray(data[store])) {
                        for (const rawItem of data[store]) {
                            if (!rawItem || typeof rawItem !== 'object') continue;
                            const item = { ...rawItem };

                            if (store === 'products') {
                                const finalPrice = Number(item.price !== undefined ? item.price : (item.salePrice !== undefined ? item.salePrice : 0));
                                const finalCost = Number(item.cost !== undefined ? item.cost : (item.costPrice !== undefined ? item.costPrice : 0));
                                const finalCode = (item.barcode || item.code || (item.id ? String(item.id) : '')).trim();
                                item.price = finalPrice;
                                item.salePrice = finalPrice;
                                item.cost = finalCost;
                                item.costPrice = finalCost;
                                item.barcode = finalCode;
                                item.code = finalCode;
                                if (!item.cloud_id && item.local_id) item.cloud_id = String(item.local_id);
                                if (item.isActive === undefined) item.isActive = item.is_deleted ? 0 : 1;
                                if (!item.category) item.category = 'General';
                            } else if (store === 'customers') {
                                if (item.debt === undefined && item.totalDebt !== undefined) item.debt = Number(item.totalDebt) || 0;
                            }

                            if (item.id !== undefined || item.key !== undefined) {
                                await db.put(store, item);
                            } else {
                                await db.add(store, item);
                            }
                        }
                    }
                }
            }

            if (hasPipeline) {
                LoadingPipelineModal.update({
                    activeStep: 4,
                    percent: 100,
                    counterText: 'Completado',
                    detailText: '¡Base de datos restaurada y lista para operar!'
                });
                LoadingPipelineModal.finish({
                    title: '¡Restauración Completada con Éxito!',
                    message: `Se restauraron e indexaron ${totalRecords > 0 ? totalRecords.toLocaleString() : 'todos los'} registros correctamente en tu sistema.`,
                    onDone: () => location.reload()
                });
            } else {
                showNotification('✅ Datos reales importados exitosamente. Reiniciando...', 'success');
                setTimeout(() => location.reload(), 1500);
            }

        } catch (error) {
            console.error('Error importing data:', error);
            if (hasPipeline) {
                LoadingPipelineModal.close();
            }
            showNotification('Error al importar datos: ' + error.message, 'error');
        }
    }

    static buildWorkbook(sheetName, data) {
        const worksheet = XLSX.utils.json_to_sheet(data);
        return {
            SheetNames: [sheetName],
            Sheets: {
                [sheetName]: worksheet
            }
        };
    }

    static downloadWorkbook(workbook, filename) {
        const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([buffer], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    static async exportEntityToExcel(storeName, filename, sheetName) {
        try {
            const data = await db.getAll(storeName);
            if (!data.length) {
                showNotification(`No hay datos para ${filename}`, 'warning');
                return;
            }

            const workbook = this.buildWorkbook(sheetName, data);
            const dateStr = new Date().toISOString().slice(0, 10);
            this.downloadWorkbook(workbook, `${filename}-${dateStr}.xlsx`);
            showNotification(`${filename} exportados`, 'success');
        } catch (error) {
            console.error(`Error exportando ${filename}:`, error);
            showNotification(`Error al exportar ${filename}: ${error.message}`, 'error');
        }
    }

    static async importEntityFromExcel(storeName, sheetName, label, arrayBuffer) {
        const hasPipeline = typeof LoadingPipelineModal !== 'undefined';
        try {
            if (hasPipeline) {
                LoadingPipelineModal.show({
                    title: `Importando ${label} desde Excel`,
                    steps: [
                        { id: '1', label: 'Leyendo Hoja' },
                        { id: '2', label: 'Procesando Filas' },
                        { id: '3', label: 'Escribiendo en BD' },
                        { id: '4', label: 'Verificación Final' }
                    ],
                    activeStep: 0,
                    percent: 20,
                    counterText: 'Analizando Excel',
                    detailText: `Leyendo estructura de la hoja "${sheetName}"...`,
                    estimatedTime: 'Un momento...'
                });
            }

            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const sheet = workbook.Sheets[sheetName] || workbook.Sheets[workbook.SheetNames[0]];
            if (!sheet) throw new Error(`Hoja "${sheetName}" no encontrada`);

            const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
            if (!rows.length) throw new Error('El archivo no contiene datos válidos');

            const totalRows = rows.length;
            if (hasPipeline) {
                LoadingPipelineModal.update({
                    activeStep: 1,
                    percent: 45,
                    counterText: `0 / ${totalRows.toLocaleString()} filas`,
                    detailText: `Analizando ${totalRows} filas de datos...`,
                    estimatedTime: 'Unos segundos'
                });
            }

            // If importing products, log stock changes for audit trail
            let stockBefore = {};
            if (storeName === 'products') {
                try {
                    const currentProducts = await db.getAll('products');
                    for (const p of currentProducts) {
                        stockBefore[p.id] = { name: p.name, stock: parseFloat(p.stock) || 0 };
                    }
                } catch (_) { }
            }

            if (hasPipeline) {
                LoadingPipelineModal.update({
                    activeStep: 2,
                    percent: 70,
                    counterText: `${totalRows.toLocaleString()} filas`,
                    detailText: `Insertando registros de ${label} en la base de datos...`,
                    estimatedTime: 'Casi listo'
                });
            }

            for (const item of rows) {
                if (item && item.id) {
                    await db.put(storeName, item);
                } else {
                    await db.add(storeName, item);
                }
            }

            // Log stock changes if products were imported
            if (storeName === 'products') {
                try {
                    const importedProducts = await db.getAll('products');
                    const stockChanges = [];
                    for (const p of importedProducts) {
                        const before = stockBefore[p.id];
                        const newStock = parseFloat(p.stock) || 0;
                        if (before && Math.abs(before.stock - newStock) >= 0.01) {
                            stockChanges.push({
                                id: p.id, name: p.name || before.name,
                                stockBefore: before.stock, stockAfter: newStock,
                                delta: newStock - before.stock
                            });
                        }
                    }
                    if (stockChanges.length > 0) {
                        console.warn(`EXCEL IMPORT: ${stockChanges.length} producto(s) con cambio de stock:`, stockChanges);
                    }
                } catch (_) { }
            }

            if (hasPipeline) {
                LoadingPipelineModal.update({
                    activeStep: 3,
                    percent: 100,
                    counterText: `${totalRows.toLocaleString()} filas`,
                    detailText: `¡Registros de ${label} integrados con éxito!`
                });
                LoadingPipelineModal.finish({
                    title: `¡${label} Importados con Éxito!`,
                    message: `Se procesaron e ingresaron ${totalRows.toLocaleString()} registros desde tu archivo Excel.`,
                    onDone: () => location.reload()
                });
            } else {
                showNotification(`${label} importados correctamente`, 'success');
                setTimeout(() => location.reload(), 1500);
            }
        } catch (error) {
            console.error(`Error importando ${label}:`, error);
            if (hasPipeline) LoadingPipelineModal.close();
            showNotification(`Error al importar ${label}: ${error.message}`, 'error');
        }
    }

    static async exportCustomerDebts(sheetName, label) {
        try {
            const customers = await db.getAll('customers');
            const sales = await db.getAll('sales');
            const debtMap = {};

            sales.forEach(sale => {
                const customerId = sale.customerId;
                if (!customerId) return;
                const total = parseFloat(sale.total) || 0;
                const paid = parseFloat(sale.paidAmount) || 0;
                const outstanding = Math.max(0, total - paid);
                if (outstanding <= 0) return;
                debtMap[customerId] = (debtMap[customerId] || 0) + outstanding;
            });

            const rows = customers.map(customer => ({
                ...customer,
                outstandingDebt: debtMap[customer.id] || 0
            }));

            const workbook = this.buildWorkbook(sheetName, rows);
            const dateStr = new Date().toISOString().slice(0, 10);
            this.downloadWorkbook(workbook, `${label}-${dateStr}.xlsx`);
            showNotification(`${label} exportados`, 'success');
        } catch (error) {
            console.error(`Error exportando ${label}:`, error);
            showNotification(`Error al exportar ${label}: ${error.message}`, 'error');
        }
    }

    static async exportReportsSummary(sheetName, label) {
        try {
            const sales = await db.getAll('sales');
            const now = new Date();

            const startOfDay = new Date(now);
            startOfDay.setHours(0, 0, 0, 0);

            const startOfWeek = new Date(startOfDay);
            startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

            const filterRange = (start, end) => sale => {
                if (!sale || !sale.date) return false;
                const saleDate = new Date(sale.date);
                return saleDate >= start && saleDate <= end;
            };

            const summaryRows = [
                {
                    periodo: 'Diario',
                    ventas: sales.filter(filterRange(startOfDay, now)).length,
                    total: sales
                        .filter(filterRange(startOfDay, now))
                        .reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0)
                },
                {
                    periodo: 'Semanal',
                    ventas: sales.filter(filterRange(startOfWeek, now)).length,
                    total: sales
                        .filter(filterRange(startOfWeek, now))
                        .reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0)
                },
                {
                    periodo: 'Mensual',
                    ventas: sales.filter(filterRange(startOfMonth, now)).length,
                    total: sales
                        .filter(filterRange(startOfMonth, now))
                        .reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0)
                }
            ];

            const productStats = {};
            const thirtyDaysAgo = new Date(now);
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
            sales.forEach(sale => {
                if (!sale || !sale.items) return;
                const saleDate = new Date(sale.date);
                if (saleDate >= thirtyDaysAgo) {
                    sale.items.forEach(item => {
                        const id = item.productId;
                        if (!id) return;
                        if (!productStats[id]) {
                            productStats[id] = {
                                productId: id,
                                name: item.name,
                                quantity: 0,
                                total: 0
                            };
                        }
                        productStats[id].quantity += item.quantity || 0;
                        productStats[id].total += item.total || 0;
                    });
                }
            });

            const productRows = Object.values(productStats).sort((a, b) => b.total - a.total);

            const workbook = {
                SheetNames: ['resumen', 'productos'],
                Sheets: {
                    resumen: XLSX.utils.json_to_sheet(summaryRows),
                    productos: XLSX.utils.json_to_sheet(productRows)
                }
            };

            const dateStr = new Date().toISOString().slice(0, 10);
            this.downloadWorkbook(workbook, `${label}-${dateStr}.xlsx`);
            showNotification(`${label} exportados`, 'success');
        } catch (error) {
            console.error(`Error exportando ${label}:`, error);
            showNotification(`Error al exportar ${label}: ${error.message}`, 'error');
        }
    }

    static async clearAllData() {
        const confirmClear = await new Promise(resolve => {
            showConfirm(
                '⚠️ ADVERTENCIA: Esto eliminará TODOS los datos (Productos, Ventas, Clientes, Usuarios, etc.).\nEsta acción NO se puede deshacer.\n\n¿Estás realmente seguro de borrar todo?',
                () => resolve(true)
            );
            const originalClose = window.closeModal;
            window.closeModal = () => {
                resolve(false);
                window.closeModal = originalClose;
                originalClose();
            };
        });

        if (!confirmClear) return;

        try {
            // Delete databases
            // First clear all object stores
            const stores = ['products', 'categories', 'sales', 'customers',
                'suppliers', 'purchases', 'cashRegisters', 'cashMovements', 'stockMovements',
                'settings', 'users', 'payments', 'customerCreditDeposits', 'customerCreditUses',
                'auditLogs', 'productPriceHistory', 'productCostHistory', 'supplierPayments', 'saleReturns', 'passwordResets', 'debtPaymentSessions'];

            for (const store of stores) {
                try {
                    await db.clear(store);
                } catch (e) {
                    console.warn(`Could not clear store ${store}:`, e);
                }
            }

            // Nuke IndexedDB database completely to be sure
            const req = indexedDB.deleteDatabase('POSMinimarket');
            req.onsuccess = () => {
                console.log("Database deleted successfully");
            };
            req.onerror = () => {
                console.log("Couldn't delete database");
            };
            req.onblocked = () => {
                console.log("Couldn't delete database due to the operation being blocked");
            };

            // Clear session storage to logout
            sessionStorage.clear();
            localStorage.clear();

            showNotification('Todos los datos han sido eliminados. Reiniciando sistema...', 'success');
            setTimeout(() => window.location.reload(), 1500);
        } catch (error) {
            console.error('Error clearing data:', error);
            showNotification('Error al limpiar datos: ' + error.message, 'error');
        }
    }

    static async exportToCSV(storeName, filename) {
        try {
            const data = await db.getAll(storeName);

            if (data.length === 0) {
                showNotification('No hay datos para exportar', 'warning');
                return;
            }

            const headers = Object.keys(data[0]);
            const csvRows = [
                headers.join(','),
                ...data.map(row =>
                    headers.map(header => {
                        const value = row[header];
                        if (value === null || value === undefined) return '';
                        const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
                        return `"${stringValue.replace(/"/g, '""')}"`;
                    }).join(',')
                )
            ];

            const csv = csvRows.join('\n');
            const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${filename}-${formatDate(new Date())}.csv`;
            a.click();
            URL.revokeObjectURL(url);

            showNotification('CSV exportado exitosamente', 'success');
        } catch (error) {
            console.error('Error exporting CSV:', error);
            showNotification('Error al exportar CSV: ' + error.message, 'error');
        }
    }

    static getStorageInfo() {
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            navigator.storage.estimate().then(estimate => {
                const used = (estimate.usage / 1024 / 1024).toFixed(2);
                const quota = (estimate.quota / 1024 / 1024).toFixed(2);
                const percent = ((estimate.usage / estimate.quota) * 100).toFixed(1);

                console.log(`Almacenamiento usado: ${used} MB de ${quota} MB (${percent}%)`);
                return { used, quota, percent };
            });
        }
    }

    /* ------------------------------------------------------------------ */
    /* MÓDULO EXCEL: PRODUCTOS (PLANTILLA, EXPORTACIÓN E IMPORTACIÓN)       */
    /* ------------------------------------------------------------------ */

    /**
     * Descarga la plantilla oficial en Excel (.xlsx) con ejemplos para carga masiva de productos.
     */
    static downloadProductTemplate() {
        try {
            const templateData = [
                {
                    "Codigo_Barras": "7801234567890",
                    "Nombre_Producto": "Bebida Coca Cola 1.5L",
                    "Categoria": "Bebidas",
                    "Costo_Neto": 1000,
                    "Margen_Porcentaje": 30,
                    "Precio_Venta": 1550,
                    "Stock_Actual": 24,
                    "Stock_Minimo": 6,
                    "Tipo_Venta": "unit"
                },
                {
                    "Codigo_Barras": "7809876543210",
                    "Nombre_Producto": "Pan Batido / Hallulla",
                    "Categoria": "Panadería",
                    "Costo_Neto": 1200,
                    "Margen_Porcentaje": 25,
                    "Precio_Venta": 1800,
                    "Stock_Actual": 15.5,
                    "Stock_Minimo": 5,
                    "Tipo_Venta": "weight"
                },
                {
                    "Codigo_Barras": "",
                    "Nombre_Producto": "Leche Entera 1L",
                    "Categoria": "Lácteos",
                    "Costo_Neto": 850,
                    "Margen_Porcentaje": 28,
                    "Precio_Venta": 1290,
                    "Stock_Actual": 30,
                    "Stock_Minimo": 10,
                    "Tipo_Venta": "unit"
                }
            ];

            const workbook = this.buildWorkbook('Plantilla_Productos', templateData);
            this.downloadWorkbook(workbook, 'plantilla_productos_cajafacil.xlsx');
            if (typeof showNotification === 'function') {
                showNotification('📄 Plantilla de productos descargada con éxito', 'success');
            }
        } catch (error) {
            console.error('Error generando plantilla de productos:', error);
            if (typeof showNotification === 'function') {
                showNotification('Error al descargar plantilla: ' + error.message, 'error');
            }
        }
    }

    /**
     * Exporta el catálogo completo de productos a Excel (.xlsx) con datos limpios y legibles.
     */
    static async exportProductsToExcel() {
        try {
            if (typeof showNotification === 'function') {
                showNotification('Preparando exportación de productos...', 'info');
            }
            const products = await db.getAll('products');
            if (!products || products.length === 0) {
                if (typeof showNotification === 'function') {
                    showNotification('No hay productos registrados para exportar', 'warning');
                }
                return;
            }

            const exportRows = products.map(p => ({
                "ID": p.id || '',
                "Codigo_Barras": p.barcode || '',
                "Nombre_Producto": p.name || '',
                "Categoria": p.category || 'General',
                "Costo_Neto": parseFloat(p.costNeto || p.cost || 0),
                "Margen_%": parseFloat(p.markupPercent || 0),
                "Precio_Venta": parseFloat(p.price || 0),
                "Stock_Actual": parseFloat(p.stock || 0),
                "Stock_Minimo": parseFloat(p.minStock || 0),
                "Tipo": p.type === 'weight' ? 'Kilo/Pesable' : 'Unidad',
                "Estado": p.isActive === 0 ? 'Inactivo' : 'Activo'
            }));

            const workbook = this.buildWorkbook('Productos', exportRows);
            const dateStr = new Date().toISOString().slice(0, 10);
            this.downloadWorkbook(workbook, `catalogo_productos_${dateStr}.xlsx`);
            if (typeof showNotification === 'function') {
                showNotification(`✅ ${exportRows.length} productos exportados a Excel`, 'success');
            }
        } catch (error) {
            console.error('Error exportando productos a Excel:', error);
            if (typeof showNotification === 'function') {
                showNotification('Error al exportar productos: ' + error.message, 'error');
            }
        }
    }

    /**
     * Importa productos desde un archivo Excel (.xlsx o .csv) procesando encabezados flexibles.
     * @param {ArrayBuffer} arrayBuffer 
     * @param {Object} options { mode: 'update' | 'replace_stock' }
     */
    static async importProductsFromExcel(arrayBuffer, options = { mode: 'update' }) {
        try {
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            if (!worksheet) throw new Error('El archivo Excel no contiene hojas legibles');

            const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
            if (!rawRows || rawRows.length === 0) {
                throw new Error('El archivo Excel está vacío o no tiene filas válidas');
            }

            // Normalización de claves (insensible a mayúsculas, tildes y guiones)
            const cleanKey = (k) => String(k || '').trim().toLowerCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9]/g, '');

            const existingProducts = await db.getAll('products');
            const existingCategories = await db.getAll('categories');
            const categoryNames = new Set(existingCategories.map(c => (c.name || '').trim().toLowerCase()));

            const barcodeMap = new Map();
            const nameMap = new Map();
            existingProducts.forEach(p => {
                if (p.barcode) barcodeMap.set(String(p.barcode).trim(), p);
                if (p.name) nameMap.set(String(p.name).trim().toLowerCase(), p);
            });

            let createdCount = 0;
            let updatedCount = 0;
            let errorCount = 0;
            const newCategoriesToInsert = [];

            for (const row of rawRows) {
                const keys = Object.keys(row);
                let barcode = '', name = '', category = 'General', costNeto = 0, markup = 0, price = 0, stock = 0, minStock = 0, type = 'unit';

                keys.forEach(k => {
                    const ck = cleanKey(k);
                    const val = row[k];
                    if (['codigobarras', 'codigo', 'barcode', 'cod'].includes(ck)) {
                        barcode = String(val || '').trim();
                    } else if (['nombreproducto', 'nombre', 'producto', 'name', 'descripcion', 'item'].includes(ck)) {
                        name = String(val || '').trim();
                    } else if (['categoria', 'category', 'rubro'].includes(ck)) {
                        category = String(val || '').trim() || 'General';
                    } else if (['costoneto', 'costo', 'cost', 'costonetto'].includes(ck)) {
                        costNeto = parseFloat(val) || 0;
                    } else if (['margenporcentaje', 'margen', 'markup', 'utilidad'].includes(ck)) {
                        markup = parseFloat(val) || 0;
                    } else if (['precioventa', 'precio', 'price', 'pvp', 'valor'].includes(ck)) {
                        price = parseFloat(val) || 0;
                    } else if (['stockactual', 'stock', 'cantidad', 'qty', 'existencia'].includes(ck)) {
                        stock = parseFloat(val) || 0;
                    } else if (['stockminimo', 'minstock', 'stockmin'].includes(ck)) {
                        minStock = parseFloat(val) || 0;
                    } else if (['tipoventa', 'tipo', 'type', 'unidad'].includes(ck)) {
                        const t = String(val || '').toLowerCase();
                        type = (t.includes('kg') || t.includes('kilo') || t.includes('pes') || t.includes('weight')) ? 'weight' : 'unit';
                    }
                });

                if (!name) {
                    errorCount++;
                    continue;
                }

                // Cálculo automático si falta precio o costo
                if (price === 0 && costNeto > 0) {
                    const marginMultiplier = markup > 0 ? (1 + (markup / 100)) : 1.30;
                    price = Math.round(costNeto * 1.19 * marginMultiplier);
                }
                if (costNeto === 0 && price > 0) {
                    costNeto = Math.round(price / 1.19 / (markup > 0 ? (1 + (markup / 100)) : 1.30));
                }

                // Asegurar categoría
                const lowerCat = category.toLowerCase();
                if (!categoryNames.has(lowerCat) && !newCategoriesToInsert.includes(category)) {
                    newCategoriesToInsert.push(category);
                    categoryNames.add(lowerCat);
                }

                // Buscar si ya existe por código de barras o por nombre exacto
                let match = null;
                if (barcode && barcodeMap.has(barcode)) {
                    match = barcodeMap.get(barcode);
                } else if (nameMap.has(name.toLowerCase())) {
                    match = nameMap.get(name.toLowerCase());
                }

                const finalCost = Math.round(costNeto * 1.19); // Costo con IVA referencial

                if (match) {
                    // Actualización
                    const newStockValue = (options.mode === 'replace_stock') ? stock : (parseFloat(match.stock || 0) + stock);
                    const updatedProduct = {
                        ...match,
                        barcode: barcode || match.barcode || '',
                        name: name,
                        category: category,
                        cost: finalCost > 0 ? finalCost : (match.cost || 0),
                        costNeto: costNeto > 0 ? costNeto : (match.costNeto || 0),
                        markupPercent: markup > 0 ? markup : (match.markupPercent || 0),
                        price: price > 0 ? price : (match.price || 0),
                        stock: newStockValue,
                        minStock: minStock > 0 ? minStock : (match.minStock || 0),
                        type: type,
                        updatedAt: new Date().toISOString()
                    };
                    await db.put('products', updatedProduct);
                    updatedCount++;
                } else {
                    // Nuevo Producto
                    const newProduct = {
                        barcode: barcode,
                        name: name,
                        category: category,
                        cost: finalCost,
                        costNeto: costNeto,
                        markupPercent: markup,
                        ivaType: '19%',
                        price: price,
                        stock: stock,
                        minStock: minStock,
                        type: type,
                        isActive: 1,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        business_id: localStorage.getItem('BUSINESS_ID') || 1
                    };
                    const newId = await db.add('products', newProduct);
                    newProduct.id = newId;
                    if (barcode) barcodeMap.set(barcode, newProduct);
                    nameMap.set(name.toLowerCase(), newProduct);
                    createdCount++;
                }
            }

            // Insertar nuevas categorías
            for (const catName of newCategoriesToInsert) {
                try {
                    await db.add('categories', { name: catName, color: '#4f46e5', business_id: localStorage.getItem('BUSINESS_ID') || 1 });
                } catch (_) {}
            }

            if (db.clearCache) await db.clearCache('products');

            return {
                success: true,
                total: rawRows.length,
                created: createdCount,
                updated: updatedCount,
                errors: errorCount
            };
        } catch (error) {
            console.error('Error procesando importación de productos:', error);
            throw error;
        }
    }

    /* ------------------------------------------------------------------ */
    /* MÓDULO EXCEL: CLIENTES Y PROVEEDORES                              */
    /* ------------------------------------------------------------------ */

    static downloadCustomerTemplate() {
        const template = [
            { "Nombre_Completo": "Juan Perez", "RUT": "12.345.678-9", "Telefono": "+56912345678", "Email": "juan@correo.cl", "Limite_Credito": 50000, "Direccion": "Av. Principal 123" },
            { "Nombre_Completo": "Maria Gonzalez", "RUT": "18.765.432-1", "Telefono": "+56987654321", "Email": "maria@correo.cl", "Limite_Credito": 80000, "Direccion": "Pasaje Los Álamos 45" }
        ];
        const workbook = this.buildWorkbook('Plantilla_Clientes', template);
        this.downloadWorkbook(workbook, 'plantilla_clientes_cajafacil.xlsx');
        if (typeof showNotification === 'function') showNotification('📄 Plantilla de clientes descargada', 'success');
    }

    static async exportCustomersToExcel() {
        try {
            const customers = await db.getAll('customers');
            if (!customers.length) {
                if (typeof showNotification === 'function') showNotification('No hay clientes para exportar', 'warning');
                return;
            }
            const rows = customers.map(c => ({
                "ID": c.id || '',
                "Nombre": c.name || '',
                "RUT": c.rut || '',
                "Telefono": c.phone || '',
                "Email": c.email || '',
                "Direccion": c.address || '',
                "Limite_Credito": parseFloat(c.creditLimit || 0),
                "Saldo_Credito_Favor": parseFloat(c.balanceCredit || 0)
            }));
            const workbook = this.buildWorkbook('Clientes', rows);
            this.downloadWorkbook(workbook, `clientes_${new Date().toISOString().slice(0,10)}.xlsx`);
            if (typeof showNotification === 'function') showNotification(`✅ ${rows.length} clientes exportados a Excel`, 'success');
        } catch (error) {
            console.error('Error exportando clientes:', error);
            if (typeof showNotification === 'function') showNotification('Error: ' + error.message, 'error');
        }
    }

    static async importCustomersFromExcel(arrayBuffer) {
        try {
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
            if (!rawRows.length) throw new Error('Archivo sin registros');

            const cleanKey = (k) => String(k || '').trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');

            let count = 0;
            for (const r of rawRows) {
                let name = '', rut = '', phone = '', email = '', address = '', limit = 0;
                Object.keys(r).forEach(k => {
                    const ck = cleanKey(k);
                    const val = r[k];
                    if (['nombrecompleto', 'nombre', 'name', 'cliente'].includes(ck)) name = String(val || '').trim();
                    else if (['rut', 'run', 'identificacion'].includes(ck)) rut = String(val || '').trim();
                    else if (['telefono', 'phone', 'celular', 'movil'].includes(ck)) phone = String(val || '').trim();
                    else if (['email', 'correo'].includes(ck)) email = String(val || '').trim();
                    else if (['direccion', 'address', 'domicilio'].includes(ck)) address = String(val || '').trim();
                    else if (['limitecredito', 'limite', 'cupo'].includes(ck)) limit = parseFloat(val) || 0;
                });

                if (!name) continue;

                await db.add('customers', {
                    name, rut, phone, email, address,
                    creditLimit: limit,
                    balanceCredit: 0,
                    isActive: 1,
                    createdAt: new Date().toISOString(),
                    business_id: localStorage.getItem('BUSINESS_ID') || 1
                });
                count++;
            }
            if (db.clearCache) await db.clearCache('customers');
            return { success: true, imported: count };
        } catch (error) {
            console.error('Error importando clientes:', error);
            throw error;
        }
    }

    static downloadSupplierTemplate() {
        const template = [
            { "Nombre_Proveedor": "Distribuidora CCU", "Contacto": "Carlos Vendedor", "Telefono": "+56911223344", "Email": "pedidos@ccu.cl", "Direccion": "Camino Melipilla 1234" },
            { "Nombre_Proveedor": "Ideal Panadería", "Contacto": "Andrea Preventa", "Telefono": "+56955667788", "Email": "contacto@ideal.cl", "Direccion": "Av. Lo Espejo 900" }
        ];
        const workbook = this.buildWorkbook('Plantilla_Proveedores', template);
        this.downloadWorkbook(workbook, 'plantilla_proveedores_cajafacil.xlsx');
        if (typeof showNotification === 'function') showNotification('📄 Plantilla de proveedores descargada', 'success');
    }

    static async exportSuppliersToExcel() {
        try {
            const suppliers = await db.getAll('suppliers');
            if (!suppliers.length) {
                if (typeof showNotification === 'function') showNotification('No hay proveedores para exportar', 'warning');
                return;
            }
            const rows = suppliers.map(s => ({
                "ID": s.id || '',
                "Nombre_Proveedor": s.name || '',
                "Contacto": s.contact || '',
                "Telefono": s.phone || '',
                "Email": s.email || '',
                "Direccion": s.address || ''
            }));
            const workbook = this.buildWorkbook('Proveedores', rows);
            this.downloadWorkbook(workbook, `proveedores_${new Date().toISOString().slice(0,10)}.xlsx`);
            if (typeof showNotification === 'function') showNotification(`✅ ${rows.length} proveedores exportados a Excel`, 'success');
        } catch (error) {
            console.error('Error exportando proveedores:', error);
            if (typeof showNotification === 'function') showNotification('Error: ' + error.message, 'error');
        }
    }

    static async importSuppliersFromExcel(arrayBuffer) {
        try {
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
            if (!rawRows.length) throw new Error('Archivo sin registros');

            const cleanKey = (k) => String(k || '').trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');

            let count = 0;
            for (const r of rawRows) {
                let name = '', contact = '', phone = '', email = '', address = '';
                Object.keys(r).forEach(k => {
                    const ck = cleanKey(k);
                    const val = r[k];
                    if (['nombreproveedor', 'nombre', 'name', 'proveedor', 'razonsocial'].includes(ck)) name = String(val || '').trim();
                    else if (['contacto', 'contact', 'vendedor'].includes(ck)) contact = String(val || '').trim();
                    else if (['telefono', 'phone', 'celular'].includes(ck)) phone = String(val || '').trim();
                    else if (['email', 'correo'].includes(ck)) email = String(val || '').trim();
                    else if (['direccion', 'address'].includes(ck)) address = String(val || '').trim();
                });

                if (!name) continue;

                await db.add('suppliers', {
                    name, contact, phone, email, address,
                    isActive: 1,
                    createdAt: new Date().toISOString(),
                    business_id: localStorage.getItem('BUSINESS_ID') || 1
                });
                count++;
            }
            if (db.clearCache) await db.clearCache('suppliers');
            return { success: true, imported: count };
        } catch (error) {
            console.error('Error importando proveedores:', error);
            throw error;
        }
    }
}
