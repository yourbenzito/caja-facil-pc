const express = require('express');
const router = express.Router();
const { dbGet, dbRun, dbAll, getTableColumns, filterToColumns } = require('../database/connection');
const { parseRow, stripSensitiveUserFields } = require('../helpers/utils');
const { requireRole } = require('../middleware/auth');

const ALLOWED_TABLES = [
    'products', 'categories', 'sales', 'customers', 'suppliers', 
    'purchases', 'cashRegisters', 'cashMovements', 'stockMovements', 
    'settings', 'users', 'auditLogs', 'saleReturns', 'expenses', 
    'supplierPayments', 'customerCreditDeposits', 'customerCreditUses', 
    'productPriceHistory', 'productCostHistory', 'businesses', 
    'payments', 'passwordResets', 'debtPaymentSessions'
];

function validateTable(table) { 
    if (!ALLOWED_TABLES.includes(table)) throw new Error('Tabla no permitida'); 
}

function sanitizeSortColumn(sortCol, allowedCols) {
    if (!sortCol || !allowedCols.includes(sortCol)) return null;
    return sortCol;
}

function getLevenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) matrix[i][j] = matrix[i - 1][j - 1];
            else matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
        }
    }
    return matrix[b.length][a.length];
}

router.get('/api/:table', async (req, res) => {
    const { table } = req.params; 
    const bid = req.business_id;
    try {
        validateTable(table); 
        let { _sort, _order = 'DESC', _limit, _offset, ...filters } = req.query;
        
        if (!_limit && req.query.limit) _limit = req.query.limit;
        if (!_offset && req.query.offset) _offset = req.query.offset;
        if (!_sort && req.query.sort) _sort = req.query.sort;
        if (!_order && req.query.order) _order = req.query.order;

        Object.keys(filters).forEach(k => {
            if (k.startsWith('_') || ['limit', 'offset', 'sort', 'order'].includes(k)) {
                delete filters[k];
            }
        });

        const tableInfo = await dbAll(`PRAGMA table_info(${table})`);
        const allowedCols = tableInfo.map(c => c.name);
        const hasBusinessId = allowedCols.includes('business_id');

        let sql = `SELECT * FROM ${table}`;
        const params = [];

        if (hasBusinessId) {
            sql += ` WHERE business_id = ?`;
            params.push(bid);
        } else {
            sql += ` WHERE 1=1`;
        }
        
        Object.keys(filters).forEach(k => {
            const val = filters[k];
            const baseCol = k.replace(/_gte$|_lte$|_like$/, '');
            if (!allowedCols.includes(baseCol)) return;
            if (k.endsWith('_gte')) { sql += ` AND ${baseCol} >= ?`; params.push(val); }
            else if (k.endsWith('_lte')) { sql += ` AND ${baseCol} <= ?`; params.push(val); }
            else if (k.endsWith('_like')) { sql += ` AND ${baseCol} LIKE ?`; params.push(`%${val}%`); }
            else { sql += ` AND ${k} = ?`; params.push(val); }
        });

        if (!filters.hasOwnProperty('isActive') && ['products', 'customers', 'suppliers'].includes(table)) {
            sql += ` AND isActive = 1`;
        }

        const defaultSort = (table === 'settings') ? 'key' : 'id';
        const safeSort = sanitizeSortColumn(_sort, allowedCols) || defaultSort;
        const safeOrder = String(_order).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        sql += ` ORDER BY ${safeSort} ${safeOrder}`;
        if (_limit) { 
            sql += ` LIMIT ?`; 
            params.push(parseInt(_limit)); 
            if (_offset) { 
                sql += ` OFFSET ?`; 
                params.push(parseInt(_offset)); 
            } 
        }
        
        const rows = await dbAll(sql, params);
        const parsed = rows.map(parseRow);
        if (table === 'users') return res.json(parsed.map(stripSensitiveUserFields));
        res.json(parsed);
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

router.get('/api/:table/search', async (req, res) => {
    const { table } = req.params; 
    const { q } = req.query; 
    const bid = req.business_id; 
    if (!q) return res.json([]);

    try {
        validateTable(table);
        const tableInfo = await dbAll(`PRAGMA table_info(${table})`);
        const hasBusinessId = tableInfo.some(info => info.name === 'business_id');

        let cs = ['name'];
        if (table === 'products') cs = ['name', 'barcode', 'description'];
        else if (table === 'customers') cs = ['name', 'rut', 'phone', 'email'];
        else if (table === 'suppliers') cs = ['name', 'phone', 'email'];
        else if (table === 'sales') cs = ['saleNumber'];
        else if (table === 'purchases') cs = ['invoiceNumber', 'purchaseNumber'];
        
        const queryTerms = q.toLowerCase().split(' ').filter(t => t);
        const ps = [];
        if (hasBusinessId) ps.push(bid);

        const conds = queryTerms.map(t => {
            const g = cs.map(c => { ps.push(`%${t}%`); return `${c} LIKE ?`; });
            return `(${g.join(' OR ')})`;
        });
        
        let sql = `SELECT * FROM ${table} WHERE ${hasBusinessId ? 'business_id = ? AND ' : ''} (${conds.join(' AND ')})`;
        if (['products', 'customers', 'suppliers'].includes(table)) {
            sql += ` AND isActive = 1`;
        }
        sql += ` LIMIT 100`;

        const rows = (await dbAll(sql, ps)).map(parseRow);
        
        const searchStr = q.toLowerCase();
        const scoredRows = rows.map(row => {
            let score = 0;
            const name = (row.name || '').toLowerCase();
            
            if (name === searchStr) score += 1000; 
            else if (name.startsWith(searchStr)) score += 500; 
            else if (name.includes(' ' + searchStr)) score += 300; 
            else if (name.includes(searchStr)) score += 100; 
            
            if (row.barcode && row.barcode === q) score += 2000;

            if (searchStr.length > 2) {
                const words = name.split(' ');
                words.forEach(w => {
                    const dist = getLevenshteinDistance(searchStr, w);
                    if (dist === 0) score += 200;
                    else if (dist === 1) score += 50; 
                });
            }

            return { ...row, _score: score };
        });

        scoredRows.sort((a, b) => {
            if (b._score !== a._score) return b._score - a._score;
            return (a.name || '').localeCompare(b.name || '');
        });

        res.json(scoredRows.slice(0, 50)); 
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

router.post('/api/:table', async (req, res) => {
    const { table } = req.params; 
    const bid = req.business_id;
    try { 
        validateTable(table);
        if (table === 'users' && !['owner'].includes(req.userRole)) {
            return res.status(403).json({ error: 'Solo el propietario puede crear usuarios' });
        }
        const allowedCols = await getTableColumns(table);
        const hasBusinessId = allowedCols.includes('business_id');

        const item = filterToColumns({ ...req.body }, allowedCols);
        if (hasBusinessId) item.business_id = bid;

        const ks = Object.keys(item); 
        const r = await dbRun(`INSERT INTO ${table} (${ks.join(',')}) VALUES (${ks.map(()=>'?').join(',')})`, ks.map(k => typeof item[k] === 'object' ? JSON.stringify(item[k]) : item[k])); 
        const response = { id: r.lastID, ...item };
        if (table === 'users') return res.json(stripSensitiveUserFields(response));
        res.json(response); 
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

router.get('/api/:table/:id', async (req, res) => {
    const { table, id } = req.params; 
    const bid = req.business_id;
    try { 
        validateTable(table); 
        const allowedCols = await getTableColumns(table);
        const hasBusinessId = allowedCols.includes('business_id');

        const pk = (table === 'settings') ? 'key' : 'id'; 
        let sql = `SELECT * FROM ${table} WHERE ${pk} = ?`;
        const params = [id];
        if (hasBusinessId) { sql += ` AND business_id = ?`; params.push(bid); }

        const r = await dbGet(sql, params); 
        if (!r) return res.status(table === 'settings' ? 200 : 404).json(table === 'settings' ? null : { error: 'No encontrado' }); 
        const row = parseRow(r);
        res.json(table === 'users' ? stripSensitiveUserFields(row) : row); 
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

router.put('/api/:table/:id', async (req, res) => {
    const { table, id } = req.params;
    const bid = req.business_id;
    try { 
        validateTable(table);
        if (table === 'auditLogs') {
            return res.status(403).json({ error: 'La auditoría es inalterable y no se puede modificar' });
        }
        if (table === 'users' && !['owner'].includes(req.userRole)) {
            return res.status(403).json({ error: 'Solo el propietario puede modificar usuarios' });
        }
        const allowedCols = await getTableColumns(table);
        const hasBusinessId = allowedCols.includes('business_id');

        const item = filterToColumns({ ...req.body }, allowedCols);
        delete item.id; 
        delete item.business_id; 
        delete item.key; 
        const ks = Object.keys(item); 
        if (ks.length === 0) return res.json({ success: true });
        
        let sql;
        let params;
        if (table === 'settings') {
            const val = typeof item.value === 'object' ? JSON.stringify(item.value) : item.value;
            sql = `INSERT OR REPLACE INTO settings (key, value, business_id) VALUES (?, ?, ?)`;
            params = [id, val, bid];
        } else {
            sql = `UPDATE ${table} SET ${ks.map(k => `${k} = ?`).join(',')} WHERE id = ?`;
            params = [...ks.map(k => typeof item[k] === 'object' ? JSON.stringify(item[k]) : item[k]), id];
            if (hasBusinessId) { sql += ` AND business_id = ?`; params.push(bid); }
        }

        await dbRun(sql, params); 
        res.json({ success: true }); 
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

router.delete('/api/:table/:id', async (req, res) => {
    const { table, id } = req.params; 
    const bid = req.business_id;
    try {
        validateTable(table);
        if (table === 'auditLogs') {
            return res.status(403).json({ error: 'La auditoría es inalterable y no se puede eliminar' });
        }
        if (table === 'users' && !['owner'].includes(req.userRole)) {
            return res.status(403).json({ error: 'Solo el propietario puede eliminar usuarios' });
        }
        const pk = (table === 'settings') ? 'key' : 'id';

        if (table === 'customers') {
            const customer = await dbGet("SELECT balanceCredit FROM customers WHERE id = ? AND business_id = ?", [id, bid]);
            if (customer) {
                const debtRow = await dbGet(
                    "SELECT IFNULL(SUM(total - paidAmount), 0) as debt FROM sales WHERE customerId = ? AND status IN ('pending', 'partial') AND business_id = ?",
                    [id, bid]
                );
                const debt = parseFloat(debtRow?.debt) || 0;
                if (debt > 0.01) return res.status(400).json({ error: 'No se puede eliminar un cliente con deuda pendiente. Primero debe saldar su cuenta.' });
                if (Math.abs(customer.balanceCredit || 0) > 0.01) return res.status(400).json({ error: 'No se puede eliminar un cliente con saldo a favor. Primero debe utilizar su saldo.' });
            }
        }

        if (table === 'products') {
            const product = await dbGet("SELECT stock FROM products WHERE id = ? AND business_id = ?", [id, bid]);
            if (product && (parseFloat(product.stock) || 0) > 0) {
                return res.status(400).json({ error: 'No se puede eliminar un producto con stock disponible. Primero realice un ajuste de salida.' });
            }
        }

        const tableInfo = await dbAll(`PRAGMA table_info(${table})`);
        const hasBusinessId = tableInfo.some(info => info.name === 'business_id');

        if (['products', 'customers', 'suppliers'].includes(table)) {
            let sql = `UPDATE ${table} SET isActive = 0, updatedAt = ? WHERE ${pk} = ?`;
            const params = [new Date().toISOString(), id];
            if (hasBusinessId) { sql += ` AND business_id = ?`; params.push(bid); }

            await dbRun(sql, params);
            return res.json({ success: true, message: 'Registro desactivado correctamente (Soft Delete)' });
        }

        let sql = `DELETE FROM ${table} WHERE ${pk} = ?`;
        const params = [id];
        if (hasBusinessId) { sql += ` AND business_id = ?`; params.push(bid); }

        await dbRun(sql, params);
        res.json({ success: true });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

module.exports = router;
