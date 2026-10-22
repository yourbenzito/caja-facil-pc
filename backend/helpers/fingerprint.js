const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Ubicación protegida para la firma de máquina (persistente ante borrado de BD o .json)
const IS_PACKAGED = __dirname.includes('.asar');
let sigDir;
if (IS_PACKAGED) {
    try {
        const { app: electronApp } = require('electron');
        sigDir = electronApp.getPath('userData');
    } catch (_) {
        sigDir = path.join(__dirname, '..', 'data');
    }
} else {
    sigDir = path.join(__dirname, '..', 'data');
}

const SIG_FILE = path.join(sigDir, 'machine_fingerprint.sig');

/**
 * Genera o recupera la huella inmutable de máquina (Hardware Fingerprint)
 * Combina MAC address física, hostname, arquitectura y salt criptográfico.
 */
function getMachineFingerprint() {
    try {
        if (!fs.existsSync(sigDir)) {
            fs.mkdirSync(sigDir, { recursive: true });
        }

        if (fs.existsSync(SIG_FILE)) {
            const saved = fs.readFileSync(SIG_FILE, 'utf8').trim();
            if (saved && saved.length === 64) {
                return saved;
            }
        }

        // Obtener la MAC de la primera interfaz física no interna
        const netInterfaces = os.networkInterfaces();
        let macAddress = '00:00:00:00:00:00';
        for (const name of Object.keys(netInterfaces)) {
            const iface = netInterfaces[name]?.find(i => !i.internal && i.mac && i.mac !== '00:00:00:00:00:00');
            if (iface) {
                macAddress = iface.mac;
                break;
            }
        }

        const rawHardware = [
            macAddress,
            os.hostname(),
            os.arch(),
            os.cpus()[0]?.model || 'unknown_cpu',
            os.totalmem()
        ].join('|');

        const salt = process.env.JWT_SECRET || 'CAJAFACIL_SECURE_SALT_2026';
        const fingerprint = crypto.createHmac('sha256', salt).update(rawHardware).digest('hex');

        fs.writeFileSync(SIG_FILE, fingerprint, 'utf8');
        return fingerprint;
    } catch (e) {
        console.warn('[Fingerprint] Error obteniendo hardware hash:', e.message);
        // Fallback determinista seguro
        const salt = process.env.JWT_SECRET || 'CAJAFACIL_FALLBACK_SALT';
        return crypto.createHmac('sha256', salt).update(os.hostname() || 'localhost').digest('hex');
    }
}

/**
 * Validador oficial de RUT Chileno con algoritmo Módulo 11
 */
function validateRut(rutCompleto) {
    if (!rutCompleto || typeof rutCompleto !== 'string') return false;

    // Limpiar puntos y espacios, convertir k a K
    const cleanRut = rutCompleto.replace(/\./g, '').replace(/-/g, '').trim().toUpperCase();
    if (cleanRut.length < 8 || cleanRut.length > 9) return false;

    const cuerpo = cleanRut.slice(0, -1);
    const dv = cleanRut.slice(-1);

    if (!/^\d+$/.test(cuerpo)) return false;

    // Calcular dígito verificador esperado con Módulo 11
    let suma = 0;
    let multiplo = 2;

    for (let i = cuerpo.length - 1; i >= 0; i--) {
        suma += parseInt(cuerpo.charAt(i), 10) * multiplo;
        multiplo = (multiplo < 7) ? multiplo + 1 : 2;
    }

    const dvEsperadoNum = 11 - (suma % 11);
    let dvEsperado = '';
    if (dvEsperadoNum === 11) dvEsperado = '0';
    else if (dvEsperadoNum === 10) dvEsperado = 'K';
    else dvEsperado = dvEsperadoNum.toString();

    return dv === dvEsperado;
}

/**
 * Formatea un RUT a estándar limpio: 12345678-K (sin puntos)
 */
function formatCleanRut(rutCompleto) {
    if (!rutCompleto) return '';
    const clean = rutCompleto.replace(/\./g, '').replace(/-/g, '').trim().toUpperCase();
    if (clean.length < 2) return clean;
    return `${clean.slice(0, -1)}-${clean.slice(-1)}`;
}

module.exports = {
    getMachineFingerprint,
    validateRut,
    formatCleanRut
};
