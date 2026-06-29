/**
 * Escapa caracteres especiales de HTML para prevenir XSS.
 * Úsalo siempre al insertar texto dinámico en innerHTML.
 */
window.safeHTML = (str) => {
    if (str === null || str === undefined) return '';
    if (typeof str !== 'string') str = String(str);
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};
const safeHTML = window.safeHTML;
window.escapeHTML = window.safeHTML;
const escapeHTML = window.escapeHTML;

const formatCLP = (amount, skipRounding = false, decimals = 0) => {
    const value = parseFloat(amount);
    if (isNaN(value)) return '$0';
    
    // Si skipRounding es true, usamos el valor exacto (para cálculos o visualización precisa)
    // De lo contrario, usamos roundPrice (redondeo a la decena para precios finales)
    const processedValue = skipRounding ? value : roundPrice(value);
    
    return new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(processedValue);
};

/**
 * Convierte cualquier entrada (con coma o punto) a un número válido para JS.
 * Fundamental para que el sistema funcione igual en computadores con distintos idiomas de Windows.
 */
const parseNumber = (val) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    // Reemplazar coma por punto y quitar cualquier espacio
    const cleaned = val.toString().replace(/,/g, '.').replace(/\s/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
};

/**
 * Redondeo según Ley N° 20.956 (Chile, 2016):
 * - Si termina en 1-5: redondear hacia abajo (a la decena inferior)
 * - Si termina en 6-9: redondear hacia arriba (a la decena superior)
 * - Si termina en 0: no cambiar
 * 
 * MEJORA: Se añade un epsilon de 0.001 para evitar errores de precisión de punto flotante
 * que hacían que 755.99999 se redondeara distinto a 756.
 */
const roundPrice = (price) => {
    const value = parseNumber(price);
    if (value === 0) return 0;
    
    // Aplicamos un pequeño ajuste para compensar errores de precisión decimal de la CPU
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
};

/**
 * Standardize quantity rounding (for inventory) to 3 decimal places.
 * Prevents floating point errors like 0.19999999999999998.
 * @param {number|string} qty 
 * @returns {number}
 */
const roundQuantity = (qty) => {
    return Math.round((parseFloat(qty) || 0) * 1000) / 1000;
};

const formatNumber = (number) => {
    return new Intl.NumberFormat('es-CL').format(number);
};

const formatStock = (value, maxDecimals = 3) => {
    let decimals = parseInt(maxDecimals, 10);
    if (isNaN(decimals) || decimals < 0) decimals = 3;
    if (decimals > 20) decimals = 20;

    const parsed = parseFloat(value);
    if (Number.isNaN(parsed)) return '0';

    // Si es entero, no mostramos decimales, de lo contrario mostramos hasta el mínimo entre decimals y 3 por defecto
    const fractionDigits = parsed % 1 === 0 ? 0 : Math.min(decimals, 3);

    try {
        return new Intl.NumberFormat('es-CL', {
            minimumFractionDigits: fractionDigits,
            maximumFractionDigits: decimals
        }).format(parsed);
    } catch (e) {
        console.error('formatStock error:', e, { value, decimals, fractionDigits });
        return parsed.toString();
    }
};

const formatDate = (date) => {
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return 'Sin fecha';
        return new Intl.DateTimeFormat('es-CL', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(d);
    } catch (e) { return 'Sin fecha'; }
};

const formatDateTime = (date) => {
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return 'Sin fecha';
        return new Intl.DateTimeFormat('es-CL', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }).format(d);
    } catch (e) { return 'Sin fecha'; }
};

const formatTime = (date) => {
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return 'Sin hora';
        return new Intl.DateTimeFormat('es-CL', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }).format(d);
    } catch (e) { return 'Sin hora'; }
};

const formatMonthYear = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    // Si es YYYY-MM-DD o YYYY-MM
    if (parts.length >= 2) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        // Usar constructor con argumentos numéricos (año, mesIndex, día) para forzar fecha LOCAL
        const date = new Date(year, month - 1, 1);
        return new Intl.DateTimeFormat('es-CL', {
            month: 'long',
            year: 'numeric'
        }).format(date);
    }
    return dateStr;
};
