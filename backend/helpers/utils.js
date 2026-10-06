/**
 * Convierte cualquier entrada (con coma o punto) a un número válido.
 */
function parseNumber(val) {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const cleaned = val.toString().replace(/,/g, '.').replace(/\s/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
}

/**
 * Redondeo según Ley N° 20.956 (Chile):
 * - Si termina en 1-5: redondear hacia abajo (a la decena inferior)
 * - Si termina en 6-9: redondear hacia arriba (a la decena superior)
 * - Si termina en 0: no cambiar
 */
function roundPrice(price) {
    const value = parseNumber(price);
    if (value === 0) return 0;
    
    const normalizedValue = Math.round(value * 100) / 100;
    const n = Math.floor(normalizedValue + 0.0001); 
    
    const lastDigit = n % 10;
    if (lastDigit >= 1 && lastDigit <= 5) {
        return Math.floor(n / 10) * 10;
    }
    if (lastDigit >= 6 && lastDigit <= 9) {
        return Math.ceil(n / 10) * 10;
    }
    return n;
}

/**
 * Calcula el desglose fiscal (IVA y comisión) desde el total.
 * Fórmula Legal Chile (Boletas).
 */
function computeFiscalFromTotal(total, documentType = 'boleta') {
    const TAX_RATE = 0.19;
    const COMMISSION_RATE = 0.40;
    const parsedTotal = parseNumber(total);

    if (documentType !== 'boleta') {
        return {
            base_amount: parsedTotal,
            tax_amount: 0,
            commission_amount: Math.round(parsedTotal - (parsedTotal / (1 + COMMISSION_RATE))),
            tax_rate: 0,
            commission_rate: COMMISSION_RATE,
            price_with_tax: parsedTotal
        };
    }

    const baseAmount = Math.round(parsedTotal / (1 + TAX_RATE));
    const taxAmount = parsedTotal - baseAmount;
    const commissionAmount = Math.round(parsedTotal - (parsedTotal / (1 + COMMISSION_RATE)));

    return {
        base_amount: baseAmount,
        tax_amount: taxAmount,
        commission_amount: commissionAmount,
        tax_rate: TAX_RATE,
        commission_rate: COMMISSION_RATE,
        price_with_tax: parsedTotal
    };
}

/**
 * Valida que los montos de una venta sean consistentes con la Ley 20.956 y el desglose fiscal.
 */
function validateSaleCalculations(saleData) {
    const errors = [];
    const warnings = [];

    const total = parseNumber(saleData.total);
    const subtotal = parseNumber(saleData.subtotal);
    const discount = parseNumber(saleData.discount);

    const roundedTotal = roundPrice(total);
    if (total !== roundedTotal) {
        warnings.push(`Total ${total} no cumple Ley 20.956. Debería ser ${roundedTotal}`);
    }

    const roundedSubtotal = roundPrice(subtotal);
    if (subtotal !== roundedSubtotal) {
        warnings.push(`Subtotal ${subtotal} no cumple Ley 20.956. Debería ser ${roundedSubtotal}`);
    }

    const documentType = saleData.documentType || 'boleta';
    const expectedFiscal = computeFiscalFromTotal(total, documentType);
    
    const baseAmount = parseNumber(saleData.base_amount);
    const taxAmount = parseNumber(saleData.tax_amount);
    const commissionAmount = parseNumber(saleData.commission_amount);

    if (Math.abs(baseAmount - expectedFiscal.base_amount) > 1) {
        errors.push(`base_amount incorrecto: esperado ${expectedFiscal.base_amount}, recibido ${baseAmount}`);
    }

    if (Math.abs(taxAmount - expectedFiscal.tax_amount) > 1) {
        errors.push(`tax_amount incorrecto: esperado ${expectedFiscal.tax_amount}, recibido ${taxAmount}`);
    }

    if (Math.abs(commissionAmount - expectedFiscal.commission_amount) > 1) {
        errors.push(`commission_amount incorrecto: esperado ${expectedFiscal.commission_amount}, recibido ${commissionAmount}`);
    }

    const expectedTotal = Math.max(0, subtotal - discount);
    if (Math.abs(total - expectedTotal) > 1) {
        errors.push(`Inconsistencia: subtotal(${subtotal}) - descuento(${discount}) = ${expectedTotal}, pero total es ${total}`);
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}

function stripSensitiveUserFields(row) {
    if (!row) return row;
    const { password, recoveryCode, ...safe } = row;
    return safe;
}

function computeCashRefundForSale(sale, payments) {
    let total = 0;
    for (const p of payments) {
        if (p.paymentMethod === 'cash') total += parseFloat(p.amount) || 0;
    }
    if (total <= 0 && sale.status === 'completed') {
        const method = (sale.paymentMethod || '').toLowerCase();
        if (method === 'cash') {
            total = parseFloat(sale.paidAmount) || parseFloat(sale.total) || 0;
        } else if (sale.paymentDetails) {
            const pd = typeof sale.paymentDetails === 'string' ? JSON.parse(sale.paymentDetails) : sale.paymentDetails;
            if (pd && pd.cash) total += parseFloat(pd.cash) || 0;
        }
    }
    return total;
}

function parseRow(row) {
    if (!row) return row;
    const newRow = { ...row };
    for (const k in newRow) {
        if (typeof newRow[k] === 'string' && (newRow[k].startsWith('{') || newRow[k].startsWith('['))) {
            try { newRow[k] = JSON.parse(newRow[k]); } catch(e){}
        }
    }
    return newRow;
}

function validatePasswordComplexity(password) {
    if (!password || password.length < 8) {
        return { valid: false, message: 'La contraseña debe tener al menos 8 caracteres' };
    }
    if (!/[A-Z]/.test(password)) {
        return { valid: false, message: 'La contraseña debe contener al menos una mayúscula' };
    }
    if (!/[a-z]/.test(password)) {
        return { valid: false, message: 'La contraseña debe contener al menos una minúscula' };
    }
    if (!/[0-9]/.test(password)) {
        return { valid: false, message: 'La contraseña debe contener al menos un número' };
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        return { valid: false, message: 'La contraseña debe contener al menos un carácter especial (!@#$%^&*(),.?":{}|<>)' };
    }
    return { valid: true };
}

function formatTitleCase(str) {
    if (!str || typeof str !== 'string') return 'General';
    const cleaned = str.trim().replace(/\s+/g, ' ');
    if (!cleaned) return 'General';
    return cleaned.split(' ').map(word => {
        if (!word) return '';
        if (word.length <= 3 && word === word.toUpperCase() && /^[A-ZÁÉÍÓÚÑ]+$/.test(word)) {
            return word;
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
}

module.exports = {
    parseNumber,
    roundPrice,
    computeFiscalFromTotal,
    validateSaleCalculations,
    stripSensitiveUserFields,
    computeCashRefundForSale,
    parseRow,
    validatePasswordComplexity,
    formatTitleCase
};
