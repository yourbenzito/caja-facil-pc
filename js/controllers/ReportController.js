class ReportController {
    static getSaleFiscalDetails(sale) {
        const total = parseFloat(sale.total) || 0;
        const documentType = sale.documentType || 'boleta';

        // Neto e IVA según ley Chile y tipo de documento
        const fiscal = Sale.computeFiscalFromTotal(total, documentType);

        let costGross = 0;
        let costNet = 0;
        (sale.items || []).forEach(item => {
            const qty = parseFloat(item.quantity) || 0;
            const unitCost = parseFloat(item.costAtSale) || 0;
            costGross += qty * unitCost;
            costNet += Math.round((qty * unitCost) / 1.19);
        });

        return {
            total,
            neto: fiscal.base_amount,
            iva: fiscal.tax_amount,
            costGross,
            costNet
        };
    }

    static async getCostHistory() {
        if (typeof ApiClient !== 'undefined') {
            return await ApiClient.get('reports/cost-history');
        }
        const response = await fetch(`${window.API_CONFIG.API_URL}/reports/cost-history`, {
            headers: ApiClient.getHeaders()
        });
        if (!response.ok) throw new Error('Error al obtener historial de costos');
        return await response.json();
    }

    static async getFiscalSummary(startDate, endDate) {
        const rawSales = await Sale.getByDateRange(startDate, endDate) || [];
        const sales = rawSales.filter(s => s.status !== 'cancelled');
        const returns = await SaleReturn.getByDateRange(startDate, endDate) || [];
        const totalReturned = Array.isArray(returns) ? returns.reduce((sum, r) => sum + (parseFloat(r.totalReturned) || 0), 0) : 0;

        let totalAmount = 0;
        let totalNeto = 0;
        let ivaDebito = 0;
        let totalCostGross = 0;
        let totalCostNet = 0;

        sales.forEach(sale => {
            const details = this.getSaleFiscalDetails(sale);
            totalAmount += details.total;
            totalNeto += details.neto;
            ivaDebito += details.iva;
            totalCostGross += details.costGross;
            totalCostNet += details.costNet;
        });

        // Ajustar totales con devoluciones (proporcionalmente al IVA)
        totalAmount -= totalReturned;
        const returnedNeto = Math.round(totalReturned / 1.19);
        const returnedIVA = totalReturned - returnedNeto;

        totalNeto -= returnedNeto;
        ivaDebito -= returnedIVA;

        // Gastos Operativos reales del periodo
        let operationalExpenses = 0;
        try {
            const movements = await CashMovement.getByDateRange(startDate, endDate);
            movements.forEach(m => {
                const isOut = m.type === 'out';
                const isGasto = (m.description || '').includes('[GASTO]') ||
                                (m.category && m.category !== '' &&
                                 !['sale','payment','withdraw','add'].includes(m.category));
                if (isOut && isGasto) {
                    operationalExpenses += parseFloat(m.amount) || 0;
                }
            });
        } catch (e) {
            console.warn('Error al calcular gastos en getFiscalSummary:', e);
        }

        const pocketProfit = totalAmount - totalCostGross - operationalExpenses;
        const realProfit = totalNeto - totalCostNet - Math.round(operationalExpenses / 1.19);

        // IVA Crédito (Compras tipo Factura en el periodo)
        // CORRECCIÓN: documentType puede ser 'factura', 'factura_neto' o 'factura_bruto'
        // El filtro === 'factura' antes nunca encontraba nada → IVA Crédito siempre $0
        const purchases = await Purchase.getByDateRange(startDate, endDate);
        const ivaCredito = purchases
            .filter(p => p.documentType && p.documentType.includes('factura'))
            .reduce((sum, p) => {
                const stored = parseFloat(p.ivaAmount) || 0;
                // Si ivaAmount fue guardado como 0 en un registro con subtotal,
                // recalcular como verificación de respaldo
                if (stored > 0) return sum + stored;
                const sub = parseFloat(p.subtotal) || 0;
                if (sub <= 0) return sum;
                const recalc = p.vatMode === 'gross'
                    ? sub - Math.round(sub / 1.19)
                    : Math.round(sub * 0.19);
                return sum + recalc;
            }, 0);

        return {
            startDate,
            endDate,
            totalSales: sales.length,
            totalAmount,
            totalReturned,
            sales,
            purchases,
            ivaDebito,
            ivaCredito,
            pocketProfit,
            realProfit,
            totalCostGross,
            totalCostNet,
            operationalExpenses
        };
    }

    static async getDailySales(date = new Date()) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const summary = await this.getFiscalSummary(startOfDay, endOfDay);
        return {
            ...summary,
            date: date
        };
    }

    static async getWeeklySales(weekStart = new Date()) {
        const start = new Date(weekStart);
        // Ajustar para que la semana comience el LUNES (Chile/Estándar ISO simplificado)
        // getDay() retorna 0 para domingo, 1 para lunes...
        const day = start.getDay();
        const diff = (day === 0 ? 6 : day - 1); // Si es domingo(0) retrocede 6, si es lunes(1) retrocede 0
        start.setDate(start.getDate() - diff);
        start.setHours(0, 0, 0, 0);

        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        end.setHours(23, 59, 59, 999);

        const rawSales = await Sale.getByDateRange(start, end, { _limit: 10000 }) || [];
        const sales = rawSales.filter(s => s.status !== 'cancelled');
        const returns = await SaleReturn.getByDateRange(start, end) || [];
        const totalReturned = returns.reduce((sum, r) => sum + (parseFloat(r.totalReturned) || 0), 0);

        // Agrupación por día para el desglose
        const dailyBreakdown = {};
        for (let i = 0; i < 7; i++) {
            const d = new Date(start);
            d.setDate(d.getDate() + i);
            const key = d.toISOString().split('T')[0];
            dailyBreakdown[key] = { date: new Date(d), total: 0, neto: 0, iva: 0, count: 0 };
        }

        let totalAmount = 0;
        let totalNeto = 0;
        let ivaDebito = 0;
        let totalCostGross = 0;
        let totalCostNet = 0;

        sales.forEach(sale => {
            const details = this.getSaleFiscalDetails(sale);
            totalAmount += details.total;
            totalNeto += details.neto;
            ivaDebito += details.iva;
            totalCostGross += details.costGross;
            totalCostNet += details.costNet;

            const dayKey = new Date(sale.date).toISOString().split('T')[0];
            if (dailyBreakdown[dayKey]) {
                dailyBreakdown[dayKey].total += details.total;
                dailyBreakdown[dayKey].neto += details.neto;
                dailyBreakdown[dayKey].iva += details.iva;
                dailyBreakdown[dayKey].count++;
            }
        });

        // Ajuste proporcional simplificado de devoluciones en el total general
        totalAmount -= totalReturned;
        const returnedNeto = Math.round(totalReturned / 1.19);
        const returnedIVA = totalReturned - returnedNeto;
        totalNeto -= returnedNeto;
        ivaDebito -= returnedIVA;

        // Gastos Operativos reales del periodo semanal
        let operationalExpenses = 0;
        try {
            const movements = await CashMovement.getByDateRange(start, end);
            movements.forEach(m => {
                const isOut = m.type === 'out';
                const isGasto = (m.description || '').includes('[GASTO]') ||
                                (m.category && m.category !== '' &&
                                 !['sale','payment','withdraw','add'].includes(m.category));
                if (isOut && isGasto) {
                    operationalExpenses += parseFloat(m.amount) || 0;
                }
            });
        } catch (e) {
            console.warn('Error al calcular gastos en getWeeklySales:', e);
        }

        const pocketProfit = totalAmount - totalCostGross - operationalExpenses;
        const realProfit = totalNeto - totalCostNet - Math.round(operationalExpenses / 1.19);

        const weekPurchases = await Purchase.getByDateRange(start, end);
        // CORRECCIÓN: mismo fix que en getFiscalSummary — includes('factura') en vez de === 'factura'
        const ivaCredito = weekPurchases
            .filter(p => p.documentType && p.documentType.includes('factura'))
            .reduce((sum, p) => {
                const stored = parseFloat(p.ivaAmount) || 0;
                if (stored > 0) return sum + stored;
                const sub = parseFloat(p.subtotal) || 0;
                if (sub <= 0) return sum;
                const recalc = p.vatMode === 'gross'
                    ? sub - Math.round(sub / 1.19)
                    : Math.round(sub * 0.19);
                return sum + recalc;
            }, 0);

        return {
            startDate: start,
            endDate: end,
            totalSales: sales.length,
            totalAmount: totalAmount,
            totalReturned: totalReturned,
            dailyBreakdown: Object.values(dailyBreakdown),
            sales: sales,
            ivaDebito: ivaDebito,
            ivaCredito: ivaCredito,
            pocketProfit,
            realProfit,
            totalCostGross,
            totalCostNet,
            operationalExpenses
        };
    }

    static async getMonthlySales(year, month) {
        const start = new Date(year, month, 1);
        const end = new Date(year, month + 1, 0, 23, 59, 59, 999);

        const summary = await this.getFiscalSummary(start, end);

        // Consumo y Pérdidas del mes
        const movements = await StockMovement.getByDateRange(start, end);
        const products = await Product.getAll();
        const productsMap = products.reduce((acc, p) => { acc[p.id] = p; return acc; }, {});

        const monthlyConsumption = movements
            .filter(m => m.type === 'consumption')
            .reduce((sum, m) => {
                const product = productsMap[m.productId];
                const val = parseFloat(m.cost_value) || (product ? (Math.abs(m.quantity) * (parseFloat(product.cost) || 0)) : 0);
                return sum + val;
            }, 0);

        const monthlyLoss = movements
            .filter(m => m.type === 'loss')
            .reduce((sum, m) => {
                const product = productsMap[m.productId];
                const val = parseFloat(m.cost_value) || (product ? (Math.abs(m.quantity) * (parseFloat(product.cost) || 0)) : 0);
                return sum + val;
            }, 0);

        return {
            ...summary,
            year,
            month,
            monthlyConsumption,
            monthlyLoss
        };
    }

    static async getSalesByProduct(startDate, endDate) {
        const rawSales = await Sale.getByDateRange(startDate, endDate) || [];
        const sales = rawSales.filter(s => s.status !== 'cancelled');
        const returns = await SaleReturn.getByDateRange(startDate, endDate) || [];

        const productStats = {};

        sales.forEach(sale => {
            // Usamos un Set por venta para no contar 2 veces el mismo ticket si hay items repetidos del mismo producto (que no debería, pero por seguridad)
            const productsInThisTicket = new Set();
            
            sale.items.forEach(item => {
                const pid = item.productId;
                if (!productStats[pid]) {
                    productStats[pid] = {
                        name: item.name,
                        quantity: 0,
                        total: 0,
                        costTotal: 0,
                        ticketCount: 0 
                    };
                }
                productStats[pid].quantity += parseFloat(item.quantity) || 0;
                productStats[pid].total    += parseFloat(item.total) || 0;
                const unitCost = parseFloat(item.costAtSale) || parseFloat(item.cost) || 0;
                productStats[pid].costTotal += unitCost * (parseFloat(item.quantity) || 0);
                
                if (!productsInThisTicket.has(pid)) {
                    productStats[pid].ticketCount++;
                    productsInThisTicket.add(pid);
                }
            });
        });

        returns.forEach(ret => {
            (ret.items || []).forEach(item => {
                const pid = item.productId;
                if (productStats[pid]) {
                    const qty      = parseFloat(item.quantity) || 0;
                    const unitCost = parseFloat(item.costAtSale) || parseFloat(item.cost) || 0;
                    productStats[pid].quantity  -= qty;
                    productStats[pid].total     -= parseFloat(item.total) || 0;
                    productStats[pid].costTotal -= unitCost * qty;
                    // Las devoluciones no restan ticketCount para mantener la estadistica de interes original
                }
            });
        });

        return Object.entries(productStats)
            .filter(([id, stats]) => stats.quantity > 0 || stats.total > 0)
            .map(([id, stats]) => {
                const grossProfit   = stats.total - stats.costTotal;
                const marginPercent = stats.total > 0
                    ? Math.round((grossProfit / stats.total) * 100)
                    : 0;
                const avgQtyPerTicket = stats.ticketCount > 0 ? (stats.quantity / stats.ticketCount).toFixed(2) : 0;
                
                return { 
                    productId: id, 
                    ...stats, 
                    grossProfit, 
                    marginPercent,
                    avgQtyPerTicket
                };
            })
            .sort((a, b) => b.quantity - a.quantity);
    }

    static async getProfitability(startDate, endDate) {
        const rawSales = await Sale.getByDateRange(startDate, endDate) || [];
        const sales = rawSales.filter(s => s.status !== 'cancelled');

        // FIX A5: Los pagos de clientes (abonos a deuda) NO son ingresos adicionales.
        // Ingreso (revenue) se reconoce al momento de la venta, no cuando el cliente paga.
        // Los pagos son flujo de caja, no ingreso. Se informan aparte para contexto.
        // OPTIMIZACIÓN FASE 5: Usar getByDateRange en vez de getAll() para evitar desbordar memoria.
        const paymentsInRange = await Payment.getByDateRange(startDate, endDate);
        const totalPayments = paymentsInRange
            .filter(p => p.paymentMethod !== 'discount')
            .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);


        // Revenue = solo ventas del período (base devengado, no base caja)
        let totalRevenue = 0;
        let totalCostOfSales = 0;
        const productStats = {};
        const categoryStats = {};

        // Optimizacion: Cargar todos los productos una vez (Mapa en memoria) para evitar N+1 queries
        const allProducts = await Product.getAll();
        const productMap = {};
        for (const p of allProducts) {
            productMap[p.id] = p;
        }

        for (const sale of sales) {
            const isBoleta = (sale.documentType || 'boleta') === 'boleta';
            const saleNeto = Math.round(sale.total / 1.19);
            const saleRevenue = isBoleta ? saleNeto : sale.total;

            totalRevenue += saleRevenue;

            for (const item of sale.items) {
                // Costo Neto Real (el usuario usa IVA Crédito)
                let itemCostGross;
                if (item.costAtSale !== undefined && item.costAtSale !== null) {
                    itemCostGross = parseFloat(item.costAtSale) * item.quantity;
                } else {
                    const product = productMap[item.productId];
                    itemCostGross = product ? (parseFloat(product.cost) || 0) * item.quantity : 0;
                }

                const itemCostNet = Math.round(itemCostGross / 1.19);

                // Ingreso por ítem proporcional al tipo de documento de la venta
                const itemTotal = parseFloat(item.total) || 0;
                const itemRevenue = isBoleta ? Math.round(itemTotal / 1.19) : itemTotal;
                const itemProfit = itemRevenue - itemCostNet;

                totalCostOfSales += itemCostNet;

                // Por producto
                const productId = item.productId;
                if (!productStats[productId]) {
                    const product = productMap[productId];
                    productStats[productId] = {
                        name: product ? product.name : (item.name || 'Producto eliminado'),
                        category: product ? (product.category || 'General') : 'General',
                        revenue: 0,
                        cost: 0,
                        profit: 0,
                        quantity: 0
                    };
                }
                productStats[productId].revenue += itemRevenue;
                productStats[productId].cost += itemCostNet;
                productStats[productId].profit += itemProfit;
                productStats[productId].quantity += item.quantity;

                // Por categoría
                const category = productStats[productId].category;
                if (!categoryStats[category]) {
                    categoryStats[category] = {
                        name: category,
                        revenue: 0,
                        cost: 0,
                        profit: 0
                    };
                }
                categoryStats[category].revenue += itemRevenue;
                categoryStats[category].cost += itemCostNet;
                categoryStats[category].profit += itemProfit;
            }
        }

        // FIX A5: NO sumar pagos a totalRevenue. Pagos = flujo de caja, no ingreso.
        // totalRevenue ya contiene el total de todas las ventas del período.

        // C5: Descontar devoluciones del período de revenue y costo
        let totalReturnedRevenue = 0;
        let totalReturnedCost = 0;
        try {
            const returns = await SaleReturn.getByDateRange(startDate, endDate);
            for (const ret of returns) {
                for (const item of (ret.items || [])) {
                    const itemRevenue = parseFloat(item.total) || 0;
                    totalReturnedRevenue += itemRevenue;

                    // Costo de lo devuelto: usar costAtSale si existe, fallback a costo actual
                    let itemCost;
                    if (item.costAtSale !== undefined && item.costAtSale !== null) {
                        itemCost = parseFloat(item.costAtSale) * (parseFloat(item.quantity) || 0);
                    } else {
                        const product = productMap[item.productId];
                        itemCost = product ? (parseFloat(product.cost) || 0) * (parseFloat(item.quantity) || 0) : 0;
                    }
                    totalReturnedCost += itemCost;

                    // Descontar de productStats y categoryStats si el producto está registrado
                    const pid = item.productId;
                    if (productStats[pid]) {
                        productStats[pid].revenue -= itemRevenue;
                        productStats[pid].cost -= itemCost;
                        productStats[pid].profit -= (itemRevenue - itemCost);
                        productStats[pid].quantity -= (parseFloat(item.quantity) || 0);
                    }
                    if (productStats[pid]) {
                        const cat = productStats[pid].category;
                        if (categoryStats[cat]) {
                            categoryStats[cat].revenue -= itemRevenue;
                            categoryStats[cat].cost -= itemCost;
                            categoryStats[cat].profit -= (itemRevenue - itemCost);
                        }
                    }
                }
            }
        } catch (returnError) {
            console.warn('ReportController: Error al calcular devoluciones para rentabilidad (ignorado):', returnError);
        }

        totalRevenue -= totalReturnedRevenue;
        totalCostOfSales -= totalReturnedCost;

        // Gastos Operativos reales del periodo de rentabilidad
        let totalExpenses = 0;
        try {
            const movements = await CashMovement.getByDateRange(startDate, endDate);
            movements.forEach(m => {
                const isOut = m.type === 'out';
                const isGasto = (m.description || '').includes('[GASTO]') ||
                                (m.category && m.category !== '' &&
                                 !['sale','payment','withdraw','add'].includes(m.category));
                if (isOut && isGasto) {
                    totalExpenses += parseFloat(m.amount) || 0;
                }
            });
        } catch (e) {
            console.warn('Error al calcular gastos en getProfitability:', e);
        }

        const grossProfit = totalRevenue - totalCostOfSales;
        const netProfit = grossProfit - totalExpenses;
        const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
        const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;


        // Calcular márgenes para productos y categorías
        Object.values(productStats).forEach(p => {
            p.margin = p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0;
        });

        Object.values(categoryStats).forEach(c => {
            c.margin = c.revenue > 0 ? (c.profit / c.revenue) * 100 : 0;
        });

        return {
            revenue: totalRevenue,
            costOfSales: totalCostOfSales,
            grossProfit: grossProfit,
            operationalExpenses: totalExpenses,
            profit: netProfit,
            margin: margin,
            grossMargin: grossMargin,
            // FIX A5: Incluir pagos como dato informativo (flujo de caja), NO como ingreso
            cashFlowFromPayments: totalPayments,
            // C5: Total devuelto en el período (informativo)
            totalReturns: totalReturnedRevenue,
            byProduct: Object.values(productStats).sort((a, b) => b.profit - a.profit),
            byCategory: Object.values(categoryStats).sort((a, b) => b.profit - a.profit)
        };
    }

    static async getStockReport() {
        const products = await Product.getAll();

        const lowStock = products.filter(p => p.stock <= p.minStock);
        const outOfStock = products.filter(p => p.stock === 0);

        const totalValue = products.reduce((sum, p) => {
            const stock = parseFloat(p.stock) || 0;
            const cost = parseFloat(p.cost) || 0;
            return sum + (stock > 0 && cost > 0 ? stock * cost : 0);
        }, 0);

        return {
            totalProducts: products.length,
            lowStock: lowStock,
            outOfStock: outOfStock,
            totalValue: totalValue,
            products: products
        };
    }

    static async updateSalePayment(saleId, newMethod) {
        return await Sale.updatePaymentMethod(saleId, newMethod);
    }

    static async getStagnantProducts(days = 14) {
        const products = await Product.getAll();
        const threshold = new Date();
        threshold.setDate(threshold.getDate() - parseInt(days));

        const stagnantList = products.filter(p => {
            if ((parseFloat(p.stock) || 0) <= 0) return false;

            // Si nunca se ha vendido, comparar con fecha de creación
            if (!p.lastSoldAt) {
                const created = new Date(p.createdAt);
                return created < threshold;
            }

            const lastSold = new Date(p.lastSoldAt);
            return lastSold < threshold;
        }).map(p => {
            const currentStock = parseFloat(p.stock) || 0;
            const daysInactive = p.lastSoldAt
                ? Math.floor((new Date() - new Date(p.lastSoldAt)) / (1000 * 60 * 60 * 24))
                : Math.floor((new Date() - new Date(p.createdAt)) / (1000 * 60 * 60 * 24));

            return {
                id: p.id,
                name: p.name,
                stock: currentStock,
                price: p.price,
                cost: p.cost,
                lastSoldAt: p.lastSoldAt,
                daysInactive: daysInactive,
                costValue: currentStock * (parseFloat(p.cost) || 0)
            };
        });

        // Ordenar por días de inactividad (más estancados primero)
        return stagnantList.sort((a, b) => b.daysInactive - a.daysInactive);
    }

    /**
     * Notebook Feature: Alerta de Costos Manuales
     * Analiza el historial de auditoría para encontrar cambios manuales en el costo
     * que no provienen de una compra (PPP), para detectar errores o robos.
     */
    static async getCostAlerts() {
        const logs = await AuditLogService.getByEntity('product');
        const alerts = logs.filter(l =>
            l.action === 'update' &&
            l.metadata &&
            l.metadata.changedFields &&
            l.metadata.changedFields.includes('cost')
        ).map(l => ({
            id: l.id,
            productId: l.entityId,
            date: l.timestamp,
            summary: l.summary,
            userId: l.userId,
            username: l.username || 'Sistema',
            metadata: l.metadata
        })).sort((a, b) => new Date(b.date) - new Date(a.date));

        // Enriquecer con nombres de productos si faltan (para logs antiguos)
        try {
            const products = await Product.getAllIncludingDeleted();
            const pMap = new Map(products.map(p => [String(p.id), p.name]));

            alerts.forEach(a => {
                if (a.metadata && !a.metadata.productName) {
                    a.metadata.productName = pMap.get(String(a.productId)) || null;
                }
            });
        } catch (e) {
            console.warn('Error enriqueciendo nombres de productos en alertas:', e);
        }

        return alerts;
    }

    /**
     * Check if there are any sales records at all (to detect historical data)
     * @returns {Promise<boolean>}
     */
    static async hasHistoricalData() {
        try {
            const count = await Sale.count();
            return count > 0;
        } catch (e) {
            console.error('Error checking historical data:', e);
            return false;
        }
    }

    /**
     * Obtiene el resumen de ventas de cada mes para un año específico.
     * @param {number} year
     * @returns {Promise<Array>} - Array de 12 objetos con { month, total, count }
     */
    static async getAnnualSales(year) {
        if (db.mode === 'sqlite') {
            try {
                return await window.ApiClient.get('sales/stats/annual', { year });
            } catch (e) {
                console.warn('getAnnualSales optimized failed, falling back to range scan:', e);
            }
        }

        const start = new Date(year, 0, 1, 0, 0, 0, 0);
        const end = new Date(year, 11, 31, 23, 59, 59, 999);

        // Pedimos todas las ventas del año. Optimizamos pidiendo solo una vez.
        const sales = await Sale.getByDateRange(start, end, { limit: 10000 });

        const monthlyData = Array(12).fill(0).map((_, i) => ({
            month: i,
            monthName: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][i],
            total: 0,
            count: 0
        }));

        sales.forEach(sale => {
            const d = new Date(sale.date);
            if (d.getFullYear() === parseInt(year)) {
                const m = d.getMonth();
                if (monthlyData[m]) {
                    monthlyData[m].total += parseFloat(sale.total) || 0;
                    monthlyData[m].count++;
                }
            }
        });

        return monthlyData;
    }

    /**
     * Agrupa ventas por hora del día (0–23) para reportes de horario pico.
     * @param {Array} sales
     * @returns {{ counts: number[], amounts: number[] }}
     */
    static aggregateHourlyStats(sales) {
        const counts = Array(24).fill(0);
        const amounts = Array(24).fill(0);
        if (!Array.isArray(sales)) return { counts, amounts };
        for (const sale of sales) {
            if (!sale || sale.date == null) continue;
            const h = new Date(sale.date).getHours();
            counts[h]++;
            amounts[h] += parseFloat(sale.total) || 0;
        }
        return { counts, amounts };
    }

    /**
     * @param {Date} startDate
     * @param {Date} endDate
     */
    static async getPeakHoursStats(startDate, endDate) {
        const rawSales = await Sale.getByDateRange(startDate, endDate, { limit: 5000 }) || [];
        const sales = rawSales.filter(s => s.status !== 'cancelled');
        const { counts, amounts } = this.aggregateHourlyStats(sales);
        return {
            counts,
            amounts,
            totalTickets: sales.length,
            startDate,
            endDate
        };
    }
}
