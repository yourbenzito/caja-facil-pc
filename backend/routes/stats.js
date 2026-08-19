const express = require('express');
const router = express.Router();
const { dbGet, dbAll } = require('../database/connection');
const { parseRow } = require('../helpers/utils');

router.get('/api/sales/max-sale-number', async (req, res) => {
    try { 
        const r = await dbGet("SELECT MAX(CAST(saleNumber AS INTEGER)) as max FROM sales WHERE business_id = ?", [req.business_id]); 
        res.json({ max: r?.max || 0 }); 
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

router.get('/api/purchases/max-purchase-number', async (req, res) => {
    try { 
        const r = await dbGet("SELECT MAX(CAST(purchaseNumber AS INTEGER)) as max FROM purchases WHERE business_id = ?", [req.business_id]); 
        res.json({ max: r?.max || 0 }); 
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

router.get('/api/products/stats/categories', async (req, res) => {
    const bid = req.business_id;
    try { 
        res.json(await dbAll("SELECT category, COUNT(*) as total, SUM(CASE WHEN stock <= 0 THEN 1 ELSE 0 END) as out, SUM(CASE WHEN stock > 0 AND stock <= minStock THEN 1 ELSE 0 END) as low, SUM(CASE WHEN stock < 0 THEN 1 ELSE 0 END) as negative FROM products WHERE business_id = ? AND isActive = 1 GROUP BY category", [bid])); 
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

router.get('/api/sales/stats/annual', async (req, res) => {
    const year = req.query.year || new Date().getFullYear();
    const bid = req.business_id;
    try {
        const rawStats = await dbAll(`
            SELECT 
                strftime('%m', date) as month,
                SUM(total) as total,
                COUNT(*) as count
            FROM sales
            WHERE business_id = ? AND strftime('%Y', date) = ? AND status != 'cancelled'
            GROUP BY month
        `, [bid, year.toString()]);

        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const fullStats = monthNames.map((name, i) => {
            const monthNum = (i + 1).toString().padStart(2, '0');
            const stat = rawStats.find(s => s.month === monthNum);
            return {
                month: i,
                monthName: name,
                total: stat ? stat.total : 0,
                count: stat ? stat.count : 0
            };
        });

        res.json(fullStats);
    } catch (error) {
        console.error('Error in annual stats:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/api/purchases/stats/summary', async (req, res) => {
    const bid = req.business_id;
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const stats = await dbGet(`
            SELECT 
                COUNT(*) as totalCount, 
                SUM(total) as totalAmount, 
                SUM(CASE WHEN status = 'pending' AND (total - paidAmount) > 2.0 THEN (total - paidAmount) ELSE 0 END) as totalDebt,
                SUM(CASE WHEN date >= ? THEN total ELSE 0 END) as monthTotal,
                SUM(CASE WHEN status = 'pending' AND (total - paidAmount) > 2.0 THEN 1 ELSE 0 END) as pendingCount
            FROM purchases 
            WHERE business_id = ?`, [startOfMonth, bid]);
        res.json({ summary: stats });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

router.get('/api/reports/cost-history', async (req, res) => {
    const bid = req.business_id;
    const threshold = parseFloat(req.query.threshold) || 5; 
    try {
        const history = await dbAll(`
            SELECT h.*, p.name as productName, p.barcode, p.price as currentPrice,
                   pur.purchaseNumber, pur.supplierId, s.name as supplierName
            FROM productCostHistory h
            JOIN products p ON h.productId = p.id AND p.business_id = h.business_id
            LEFT JOIN purchases pur ON h.referenceId = pur.id AND pur.business_id = h.business_id
            LEFT JOIN suppliers s ON pur.supplierId = s.id AND s.business_id = h.business_id
            WHERE h.business_id = ?
            ORDER BY h.date DESC
            LIMIT 300
        `, [bid]);
        
        const notable = history.filter(h => {
            const oldCost = parseFloat(h.oldCost) || 0;
            const newCost = parseFloat(h.newCost) || 0;
            if (oldCost === 0) return newCost > 0; 
            const variance = Math.abs((newCost - oldCost) / oldCost * 100);
            return variance >= threshold;
        });
        
        res.json(notable);
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

router.get('/api/products/:id/last-purchase-cost', async (req, res) => {
    const { id } = req.params;
    const bid = req.business_id;
    try {
        const lastPurchase = await dbGet(`
            SELECT p.id, p.date, p.items, p.purchaseNumber
            FROM purchases p
            WHERE p.business_id = ? 
            AND p.status != 'cancelled'
            AND p.items LIKE ?
            ORDER BY p.date DESC
            LIMIT 1
        `, [bid, `%"productId":${id}%`]);
        
        if (!lastPurchase) {
            res.json({ cost: null, costNeto: null, date: null });
            return;
        }
        
        const items = JSON.parse(lastPurchase.items);
        const productItem = items.find(item => item.productId == id);
        
        if (!productItem) {
            res.json({ cost: null, costNeto: null, date: null });
            return;
        }
        
        let costNeto = 0;
        let costGross = 0;
        if (productItem.enteredCostMode === 'gross') {
            costGross = parseFloat(productItem.enteredCost) || (parseFloat(productItem.cost) * 1.19) || 0;
            costNeto = parseFloat((costGross / 1.19).toFixed(3));
        } else {
            costNeto = parseFloat(productItem.costNeto) || parseFloat(productItem.enteredCost) || parseFloat(productItem.cost) || 0;
            costGross = parseFloat((costNeto * 1.19).toFixed(3));
        }
        
        res.json({
            cost: parseFloat(costGross.toFixed(3)),
            costNeto: parseFloat(costNeto.toFixed(3)),
            date: lastPurchase.date,
            reason: `Compra #${lastPurchase.purchaseNumber || lastPurchase.id}`,
            referenceId: lastPurchase.id
        });
    } catch (err) { 
        console.error('Error al obtener último costo de compra:', err);
        res.status(500).json({ error: err.message }); 
    }
});

router.get('/api/sales/stats/summary', async (req, res) => {
    const bid = req.business_id;
    try {
        const stats = await dbGet(`SELECT COUNT(*) as totalSales, SUM(total) as totalAmount, SUM(CASE WHEN status IN ('pending', 'partial') THEN (total - paidAmount) ELSE 0 END) as pendingAmount FROM sales WHERE business_id = ? AND status != 'cancelled'`, [bid]);
        res.json(stats);
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

router.get('/api/customers/pos/summary', async (req, res) => {
    const bid = req.business_id;
    try { 
        res.json(await dbAll("SELECT c.id, c.name, c.rut, c.balanceCredit, IFNULL(SUM(CASE WHEN s.status IN ('pending', 'partial') THEN (s.total - s.paidAmount) ELSE 0 END), 0) as totalDebt FROM customers c LEFT JOIN sales s ON c.id = s.customerId AND s.business_id = ? WHERE c.business_id = ? AND c.isActive = 1 GROUP BY c.id", [bid, bid])); 
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

router.get('/api/customers/:id/account-status', async (req, res) => {
    const { id } = req.params; 
    const bid = req.business_id;
    try {
        const c = await dbGet("SELECT * FROM customers WHERE id = ? AND business_id = ?", [id, bid]); 
        if (!c) return res.status(404).json({ error: 'No encontrado' });
        
        const pend = await dbAll("SELECT * FROM sales WHERE customerId = ? AND status IN ('pending', 'partial') AND business_id = ? ORDER BY date ASC", [id, bid]);
        const movs = await dbAll("SELECT p.*, s.saleNumber FROM payments p LEFT JOIN sales s ON p.saleId = s.id WHERE p.customerId = ? AND p.business_id = ? ORDER BY p.date DESC", [id, bid]);
        const deps = await dbAll("SELECT * FROM customerCreditDeposits WHERE customerId = ? AND business_id = ?", [id, bid]);
        const uses = await dbAll("SELECT * FROM customerCreditUses WHERE customerId = ? AND business_id = ?", [id, bid]);

        const saleIds = pend.map(s => s.id);
        const returnsMap = {};
        if (saleIds.length > 0) {
            const placeholders = saleIds.map(() => '?').join(',');
            const returns = await dbAll(`SELECT saleId, SUM(totalReturned) as totalReturned FROM saleReturns WHERE business_id = ? AND saleId IN (${placeholders}) GROUP BY saleId`, [bid, ...saleIds]);
            returns.forEach(r => {
                returnsMap[r.saleId] = parseFloat(r.totalReturned) || 0;
            });
        }

        const formattedPendingSales = pend.map(s => {
            const row = parseRow(s);
            const returned = returnsMap[row.id] || 0;
            const total = parseFloat(row.total) || 0;
            const paid = parseFloat(row.paidAmount) || 0;
            const remaining = Math.max(0, total - returned - paid);
            return {
                ...row,
                saleId: row.id,
                returned,
                paid,
                remaining
            };
        });

        const totalDebt = formattedPendingSales.reduce((acc, s) => acc + s.remaining, 0);

        res.json({ 
            summary: { 
                totalDebt: totalDebt, 
                balanceCredit: c.balanceCredit || 0 
            }, 
            balance: {
                totalDebt: totalDebt,
                totalCredit: c.balanceCredit || 0
            },
            pendingSales: formattedPendingSales, 
            movements: movs.map(parseRow), 
            creditHistory: [...deps.map(d => ({...d, type:'deposit'})), ...uses.map(u => ({...u, type:'use'}))].map(parseRow) 
        });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

router.get('/api/sales/list/latest', async (req, res) => {
    const { limit = 50, offset = 0 } = req.query; 
    const bid = req.business_id;
    try { 
        res.json((await dbAll("SELECT * FROM sales WHERE business_id = ? ORDER BY date DESC LIMIT ? OFFSET ?", [bid, parseInt(limit), parseInt(offset)])).map(parseRow)); 
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

router.get('/api/purchases/list/latest', async (req, res) => {
    const { limit = 50, offset = 0 } = req.query; 
    const bid = req.business_id;
    try { 
        res.json((await dbAll("SELECT * FROM purchases WHERE business_id = ? ORDER BY date DESC LIMIT ? OFFSET ?", [bid, parseInt(limit), parseInt(offset)])).map(parseRow)); 
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

router.get('/api/sale-returns/list/latest', async (req, res) => {
    const { limit = 50, offset = 0, dateFrom, dateTo } = req.query; 
    const bid = req.business_id;
    try {
        let query = `
            SELECT r.*, s.customerId, c.name as clientName
            FROM saleReturns r
            LEFT JOIN sales s ON r.saleId = s.id AND r.business_id = s.business_id
            LEFT JOIN customers c ON s.customerId = c.id AND s.business_id = c.business_id
            WHERE r.business_id = ?
        `;
        const params = [bid];

        if (dateFrom && dateTo) {
            query += ` AND r.date >= ? AND r.date <= ?`;
            params.push(dateFrom + 'T00:00:00', dateTo + 'T23:59:59');
        } else if (dateFrom) {
            query += ` AND r.date >= ?`;
            params.push(dateFrom + 'T00:00:00');
        }

        query += ` ORDER BY r.date DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const returns = await dbAll(query, params);
        res.json(returns.map(parseRow));
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

router.get('/api/analytics/decision-matrix', async (req, res) => {
    const bid = req.business_id;
    try {
        const query = `
            SELECT 
                p.id, p.name, p.category, p.stock, p.costNeto, p.price, p.additionalTaxesConfig,
                COALESCE(SUM(ABS(sm.quantity)), 0) as totalSold30Days
            FROM products p
            LEFT JOIN stockMovements sm ON sm.productId = p.id 
                AND sm.type = 'sale' 
                AND sm.date >= datetime('now', '-30 days') 
                AND sm.business_id = p.business_id
            WHERE p.business_id = ? AND p.isActive = 1
            GROUP BY p.id
        `;
        const rawProducts = await dbAll(query, [bid]);
        
        const matrix = rawProducts.map(p => {
            const velocity = p.totalSold30Days / 30; // Unidades diarias
            
            // Calcular impuestos adicionales
            let extraTaxes = 0;
            if (p.additionalTaxesConfig) {
                try {
                    const taxes = JSON.parse(p.additionalTaxesConfig);
                    if (Array.isArray(taxes)) {
                        taxes.forEach(t => {
                            extraTaxes += (p.costNeto * (parseFloat(t.rate) / 100));
                        });
                    }
                } catch(e) {}
            }
            
            const costTotal = (p.costNeto * 1.19) + extraTaxes;
            const marginUnit = p.price - costTotal;
            const dailyProfit = marginUnit * velocity;
            
            // Clasificación BCG adaptada
            let category = 'peso_muerto';
            if (velocity > 0.5 && marginUnit > 200) category = 'estrella';
            else if (velocity > 0.5 && marginUnit <= 200) category = 'caballo';
            else if (velocity <= 0.5 && marginUnit > 200) category = 'lento_rentable';

            return {
                ...p,
                velocity: Math.round(velocity * 10) / 10,
                reorderPoint: Math.round(velocity * 3), // Asumiendo 3 días reposición
                marginUnit: Math.round(marginUnit),
                dailyProfit: Math.round(dailyProfit),
                matrixCategory: category
            };
        });

        res.json(matrix);
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

module.exports = router;
