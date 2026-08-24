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

        // CORRECCIÓN: Validar y corregir foreign keys antes de exportar
        const categoryIds = new Set(categories.map(c => c.id));
        const customerIds = new Set(customers.map(c => c.id));
        const supplierIds = new Set(suppliers.map(s => s.id));

        // Corregir productos con categorías inexistentes
        let fixedProducts = 0;
        products.forEach(p => {
            if (p.category && !categoryIds.has(p.category)) {
                p.category = null;
                fixedProducts++;
            }
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

        return {
            version: '1.0.0',
            exportDate: new Date().toISOString(),
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
            debtPaymentSessions
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

    static async importData(jsonData) {
        try {
            const rawData = JSON.parse(jsonData);
            const data = (rawData && rawData.tables) ? rawData.tables : rawData;

            console.log('Iniciando importación certificada...');
            console.log('Tablas en el archivo:', Object.keys(data).filter(k => !['version', 'exportDate', 'exportedAt', 'businessId'].includes(k)));

            if (db.mode === 'sqlite') {
                showNotification('🚀 Iniciando transferencia inmediata...', 'success');
                console.log('📦 Enviando datos a SQLite...');
                const result = await ApiClient.post('migration/import', data, false, { timeout: 300000 });
                console.log('📦 Resultado del servidor:', result);
                if (!result.success) {
                    throw new Error(result.error || 'Error en servidor');
                }
            } else {
                showNotification('2/3: Guardando datos en navegador...', 'info');
                // Modo IndexedDB: Importación de tablas operativas (excluyendo users y passwordResets)
                const stores = ['products', 'categories', 'sales', 'customers', 'suppliers', 'purchases', 'expenses', 'cashRegisters', 'cashMovements', 'stockMovements', 'settings', 'payments', 'businesses', 'customerCreditDeposits', 'customerCreditUses', 'auditLogs', 'productPriceHistory', 'productCostHistory', 'supplierPayments', 'saleReturns', 'debtPaymentSessions'];

                for (const store of stores) {
                    if (data[store] && Array.isArray(data[store])) {
                        for (const item of data[store]) {
                            if (item && (item.id !== undefined || item.key !== undefined)) {
                                await db.put(store, item);
                            } else {
                                await db.add(store, item);
                            }
                        }
                    }
                }
            }

            showNotification('✅ Datos importados exitosamente. Recargando...', 'success');
            setTimeout(() => location.reload(), 1500);
        } catch (error) {
            console.error('Error importing data:', error);
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
        try {
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const sheet = workbook.Sheets[sheetName] || workbook.Sheets[workbook.SheetNames[0]];
            if (!sheet) throw new Error(`Hoja "${sheetName}" no encontrada`);

            const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
            if (!rows.length) throw new Error('El archivo no contiene datos válidos');

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

            showNotification(`${label} importados correctamente`, 'success');
            setTimeout(() => location.reload(), 1500);
        } catch (error) {
            console.error(`Error importando ${label}:`, error);
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
}
