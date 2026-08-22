class ReportController {
    static getSaleFiscalDetails(sale) {
        const total = parseFloat(sale.total) || 0;
        const documentType = sale.documentType || 'boleta';
        const isBoleta = documentType === 'boleta';

        // Neto e IVA según ley Chile y tipo de documento
        const fiscal = Sale.computeFiscalFromTotal(total, documentType);

        let costGross = 0;
        let costNet = 0;
        (sale.items || []).forEach(item => {
            const qty = parseFloat(item.quantity) || 0;
            const unitCost = parseFloat(item.costAtSale) || 0;
            const lineCost = qty * unitCost;
            costGross += lineCost;
            costNet += isBoleta ? Math.round(lineCost / 1.19) : lineCost;
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

        // Gastos Operativos reales del periodo (separados de las ventas)
        let operationalExpenses = 0;
        try {
            const expenses = await Expense.getByDateRange(startDate, endDate);
            expenses.forEach(e => {
                operationalExpenses += parseFloat(e.amount) || 0;
            });
        } catch (e) {
            console.warn('Error al calcular gastos en getFiscalSummary:', e);
        }

        // Margen comercial puro de los productos vendidos
        const grossCommercialProfit = totalNeto - totalCostNet;
        const commercialMarginPerc = totalNeto > 0 ? ((grossCommercialProfit / totalNeto) * 100).toFixed(1) : '0';

        const pocketProfit = totalAmount - totalCostGross - operationalExpenses;
        const realProfit = totalNeto - totalCostNet - Math.round(operationalExpenses / 1.19);

        // IVA Crédito (Compras tipo Factura en el periodo)
        const purchases = await Purchase.getByDateRange(startDate, endDate);
        const ivaCredito = purchases
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
            startDate,
            endDate,
            totalSales: sales.length,
            totalAmount,
            totalNeto,
            totalReturned,
            sales,
            purchases,
            ivaDebito,
            ivaCredito,
            grossCommercialProfit,
            commercialMarginPerc,
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

        // Gastos Operativos del periodo
        let operationalExpenses = 0;
        try {
            const expenses = await Expense.getByDateRange(start, end);
            expenses.forEach(e => {
                operationalExpenses += parseFloat(e.amount) || 0;
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

        const grossCommercialProfit = totalNeto - totalCostNet;
        const commercialMarginPerc = totalNeto > 0 ? ((grossCommercialProfit / totalNeto) * 100).toFixed(1) : '0';

        return {
            startDate: start,
            endDate: end,
            totalSales: sales.length,
            totalAmount: totalAmount,
            totalNeto: totalNeto,
            totalReturned: totalReturned,
            dailyBreakdown: Object.values(dailyBreakdown),
            sales: sales,
            ivaDebito: ivaDebito,
            ivaCredito: ivaCredito,
            grossCommercialProfit,
            commercialMarginPerc,
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
        const allProducts = await Product.getAll();
        const prodMap = new Map(allProducts.map(p => [String(p.id), p]));

        const productStats = {};

        sales.forEach(sale => {
            const productsInThisTicket = new Set();
            
            (sale.items || []).forEach(item => {
                const pid = item.productId || item.id;
                if (!productStats[pid]) {
                    const originalProd = prodMap.get(String(pid)) || {};
                    productStats[pid] = {
                        name: item.name || originalProd.name || 'Producto',
                        barcode: originalProd.barcode || '',
                        currentStock: originalProd.stock !== undefined ? originalProd.stock : null,
                        minStock: originalProd.minStock || 5,
                        type: originalProd.type || 'unit',
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
                const pid = item.productId || item.id;
                if (productStats[pid]) {
                    const qty      = parseFloat(item.quantity) || 0;
                    const unitCost = parseFloat(item.costAtSale) || parseFloat(item.cost) || 0;
                    productStats[pid].quantity  -= qty;
                    productStats[pid].total     -= parseFloat(item.total) || 0;
                    productStats[pid].costTotal -= unitCost * qty;
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

        // Gastos Operativos
        let totalExpenses = 0;
        try {
            const expenses = await Expense.getByDateRange(startDate, endDate);
            expenses.forEach(e => {
                totalExpenses += parseFloat(e.amount) || 0;
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
        const products = await Product.getAll() || [];
        
        // Ventas de los últimos 30 días para calcular velocidad de rotación y autonomía
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        
        let sales30Days = [];
        try {
            const rawSales = await Sale.getByDateRange(startDate, endDate) || [];
            sales30Days = rawSales.filter(s => s.status !== 'cancelled');
        } catch (e) {
            console.warn('Error al obtener ventas para autonomía de stock:', e);
        }

        const soldMap = {};
        sales30Days.forEach(s => {
            (s.items || []).forEach(item => {
                const pid = String(item.productId || item.id);
                soldMap[pid] = (soldMap[pid] || 0) + (parseFloat(item.quantity) || 0);
            });
        });

        let totalCostValue = 0;
        let totalRetailValue = 0;
        let dormantCapitalTotal = 0;

        const enrichedProducts = products.map(p => {
            const stock = parseFloat(p.stock) || 0;
            const minStock = parseFloat(p.minStock) || 5;
            const cost = parseFloat(p.cost) || 0;
            const price = parseFloat(p.price) || 0;
            const costVal = stock > 0 ? stock * cost : 0;
            const retailVal = stock > 0 ? stock * price : 0;

            totalCostValue += costVal;
            totalRetailValue += retailVal;

            const soldQty30 = soldMap[String(p.id)] || 0;
            const dailyAvg = soldQty30 / 30;

            let stockDays = null;
            if (stock <= 0) {
                stockDays = 0;
            } else if (dailyAvg > 0) {
                stockDays = Math.round(stock / dailyAvg);
            } else {
                stockDays = 999; // Sin rotación en 30 días
            }

            // Sugerencia de compra: reponer para 30 días o mínimo el doble del stock mínimo
            let suggestedOrder = 0;
            if (stock <= minStock || (stockDays !== null && stockDays <= 7)) {
                const targetStock = Math.max(minStock * 2, Math.ceil(dailyAvg * 30));
                suggestedOrder = Math.max(0, targetStock - stock);
            }

            // Capital inmovilizado: tiene stock > 0, valor en plata > 0 y 0 ventas en 30 días
            const isDormant = stock > 0 && costVal > 0 && soldQty30 === 0;
            if (isDormant) {
                dormantCapitalTotal += costVal;
            }

            return {
                ...p,
                stock,
                minStock,
                cost,
                price,
                costVal,
                retailVal,
                soldQty30,
                dailyAvg: dailyAvg.toFixed(2),
                stockDays,
                suggestedOrder,
                isDormant
            };
        });

        const lowStock = enrichedProducts.filter(p => p.stock > 0 && p.stock <= p.minStock);
        const outOfStock = enrichedProducts.filter(p => p.stock <= 0);
        const dormantStock = enrichedProducts.filter(p => p.isDormant);

        return {
            totalProducts: products.length,
            lowStock: lowStock,
            outOfStock: outOfStock,
            dormantStock: dormantStock,
            totalCostValue: totalCostValue,
            totalRetailValue: totalRetailValue,
            projectedProfit: Math.max(0, totalRetailValue - totalCostValue),
            dormantCapitalTotal: dormantCapitalTotal,
            products: enrichedProducts
        };
    }

    static async updateSalePayment(saleId, newMethod) {
        return await Sale.updatePaymentMethod(saleId, newMethod);
    }

    static async getStagnantProducts(days = 14) {
        const products = await Product.getAll() || [];
        const threshold = new Date();
        threshold.setDate(threshold.getDate() - parseInt(days));

        const categoryTrappedMap = {};

        const stagnantList = products.filter(p => {
            if ((parseFloat(p.stock) || 0) <= 0) return false;

            // Si nunca se ha vendido, comparar con fecha de creación
            if (!p.lastSoldAt) {
                const created = new Date(p.createdAt || Date.now());
                return created < threshold;
            }

            const lastSold = new Date(p.lastSoldAt);
            return lastSold < threshold;
        }).map(p => {
            const currentStock = parseFloat(p.stock) || 0;
            const cost = parseFloat(p.cost) || 0;
            const price = parseFloat(p.price) || 0;
            const costValue = currentStock * cost;
            const retailValue = currentStock * price;
            const category = p.category || 'General';

            const daysInactive = p.lastSoldAt
                ? Math.floor((new Date() - new Date(p.lastSoldAt)) / (1000 * 60 * 60 * 24))
                : Math.floor((new Date() - new Date(p.createdAt || Date.now())) / (1000 * 60 * 60 * 24));

            categoryTrappedMap[category] = (categoryTrappedMap[category] || 0) + costValue;

            const currentMargin = price > 0 ? Math.round(((price - cost) / price) * 100) : 0;
            // Precio mínimo de remate: recupera el costo + 5% para costos de transacción
            const minClearancePrice = Math.max(cost, Math.round(cost * 1.05));

            let actionLevel = 'yellow';
            let suggestedAction = '🟡 Reubicar cerca de caja';
            if (daysInactive > 60) {
                actionLevel = 'red';
                suggestedAction = '🔴 Rematar al costo / Pack';
            } else if (daysInactive > 30) {
                actionLevel = 'orange';
                suggestedAction = '🟠 Oferta 15% - 20%';
            }

            return {
                id: p.id,
                name: p.name,
                barcode: p.barcode || '',
                category: category,
                stock: currentStock,
                type: p.type || 'unit',
                price: price,
                cost: cost,
                currentMargin: currentMargin,
                minClearancePrice: minClearancePrice,
                lastSoldAt: p.lastSoldAt,
                daysInactive: daysInactive,
                costValue: costValue,
                retailValue: retailValue,
                actionLevel: actionLevel,
                suggestedAction: suggestedAction
            };
        });

        // Categoría con mayor dinero atrapado
        const sortedCats = Object.entries(categoryTrappedMap).sort((a, b) => b[1] - a[1]);
        const topStagnantCategory = sortedCats.length > 0 ? { name: sortedCats[0][0], amount: sortedCats[0][1] } : null;

        stagnantList.sort((a, b) => b.costValue - a.costValue); // Por defecto los que tienen más plata atrapada
        stagnantList._topStagnantCategory = topStagnantCategory;

        return stagnantList;
    }

    /**
     * Notebook Feature: Alerta de Costos Manuales
     * Analiza el historial de auditoría para encontrar cambios manuales en el costo
     * que no provienen de una compra (PPP), para detectar errores o robos.
     */
    static async getCostAlerts() {
        const logs = await AuditLogService.getByEntity('product') || [];
        let products = [];
        try {
            products = await Product.getAllIncludingDeleted() || [];
        } catch (_) {
            try { products = await Product.getAll() || []; } catch (_) {}
        }
        const pMap = new Map(products.map(p => [String(p.id), p]));

        const rawAlerts = logs.filter(l =>
            l.action === 'update' &&
            l.metadata &&
            (
                (l.metadata.changedFields && (l.metadata.changedFields.includes('cost') || l.metadata.changedFields.includes('costBruto') || l.metadata.changedFields.includes('costNeto'))) ||
                (l.metadata.changes && (l.metadata.changes.cost || l.metadata.changes.costBruto || l.metadata.changes.costNeto))
            )
        );

        const alerts = [];
        for (const l of rawAlerts) {
            const changes = l.metadata?.changes || {};
            const costChange = changes.cost || changes.costBruto || changes.costNeto;

            let oldCost = 0;
            let newCost = 0;
            if (costChange && typeof costChange === 'object') {
                oldCost = parseFloat(costChange.old) || 0;
                newCost = parseFloat(costChange.new) || 0;
            }

            // Filtrar cambios fantasmas donde el costo no varió realmente ($1000 -> $1000)
            if (Math.abs(newCost - oldCost) < 0.01) continue;

            const product = pMap.get(String(l.entityId)) || {};
            const productName = l.metadata?.productName || product.name || ('Producto #' + l.entityId);
            const barcode = product.barcode || '';
            const category = product.category || 'General';
            const price = parseFloat(product.price) || 0;
            const stock = parseFloat(product.stock) || 0;

            const oldMargin = price > 0 ? Math.round(((price - oldCost) / price) * 100) : 0;
            const newMargin = price > 0 ? Math.round(((price - newCost) / price) * 100) : 0;
            const marginDiff = newMargin - oldMargin; // ej: -15% o +10%
            const costDiffAmount = newCost - oldCost;
            const costDiffPerc = oldCost > 0 ? Math.round((costDiffAmount / oldCost) * 100) : 0;

            // Precio de venta sugerido para recuperar el margen original si el costo subió
            const suggestedNewPrice = (oldMargin > 0 && oldMargin < 100)
                ? Math.round(newCost / (1 - (oldMargin / 100)))
                : Math.round(newCost * 1.3);

            // Pérdida potencial en el stock actual si no se ajusta precio
            const stockImpact = (costDiffAmount > 0 && stock > 0) ? Math.round(costDiffAmount * stock) : 0;

            alerts.push({
                id: l.id,
                productId: l.entityId,
                productName,
                barcode,
                category,
                date: l.timestamp,
                userId: l.userId,
                username: l.username || 'Sistema',
                oldCost,
                newCost,
                costDiffAmount,
                costDiffPerc,
                price,
                stock,
                oldMargin,
                newMargin,
                marginDiff,
                suggestedNewPrice,
                stockImpact,
                isMarginReduced: marginDiff < 0,
                isCriticalMargin: marginDiff <= -5
            });
        }

        alerts.sort((a, b) => new Date(b.date) - new Date(a.date));
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
