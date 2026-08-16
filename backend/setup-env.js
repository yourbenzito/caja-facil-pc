#!/usr/bin/env node
/**
 * Script de configuración inicial del entorno
 * Genera JWT_SECRET único y configura variables de entorno
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Generar un JWT_SECRET seguro y único (64 bytes hexadecimales)
function generateJWTSecret() {
    return crypto.randomBytes(64).toString('hex');
}

// Generar un GATEWAY_PASSWORD seguro
function generateGatewayPassword() {
    const length = 32;
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
}

// Ruta del archivo .env
const envPath = path.join(__dirname, '.env');
const envExamplePath = path.join(__dirname, '.env.example');

// Leer archivo .env.example si existe, si no usar valores por defecto
let envContent = '';
if (fs.existsSync(envExamplePath)) {
    envContent = fs.readFileSync(envExamplePath, 'utf8');
} else {
    envContent = `# CONFIGURACIÓN DEL SERVIDOR CAJAFÁCIL POS
# ================================================
# AMBIENTE: development = tu PC | production = VPS real
# ================================================
NODE_ENV=development
PORT=3000

# JWT para seguridad de sesiones (generado automáticamente)
JWT_SECRET=GENERATE_ON_INSTALL

# GATEWAY SECURITY LOCK (generado automáticamente)
GATEWAY_PASSWORD=GENERATE_ON_INSTALL

# BASE DE DATOS LOCAL
DATA_DIR=./data

# SUPER ADMIN
SUPER_ADMIN_USERNAME=admin

# APP CONFIG
APP_URL=http://localhost:3000

# MERCADOPAGO CONFIGURACIÓN
MERCADOPAGO_ACCESS_TOKEN=
MERCADOPAGO_PUBLIC_KEY=
MERCADOPAGO_APP_ID=
MERCADOPAGO_DEVICE_ID=
`;
}

// Generar valores únicos
const jwtSecret = generateJWTSecret();
const gatewayPassword = generateGatewayPassword();

// Reemplazar placeholders
envContent = envContent.replace('JWT_SECRET=GENERATE_ON_INSTALL', `JWT_SECRET=${jwtSecret}`);
envContent = envContent.replace('GATEWAY_PASSWORD=GENERATE_ON_INSTALL', `GATEWAY_PASSWORD=${gatewayPassword}`);

// Escribir archivo .env
fs.writeFileSync(envPath, envContent);

console.log('✅ Archivo .env configurado exitosamente');
console.log('🔐 JWT_SECRET generado (64 bytes hexadecimales)');
console.log('🔐 GATEWAY_PASSWORD generado (32 caracteres aleatorios)');
console.log('');
console.log('⚠️  IMPORTANTE: Guarda una copia de seguridad de este archivo .env');
console.log('⚠️  Si pierdes el JWT_SECRET, todos los tokens de sesión serán inválidos');
