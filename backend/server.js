const express = require('express');
const cors = require('cors');
const pathModule = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// Detección de empaquetado
const IS_PACKAGED = __dirname.includes('.asar');

// Cargar variables de entorno desde .env (userData en producción, backend/.env en desarrollo)
let envPath;
if (IS_PACKAGED) {
    const { app: electronApp } = require('electron');
    envPath = pathModule.join(electronApp.getPath('userData'), '.env');
} else {
    envPath = pathModule.join(__dirname, '.env');
}

// Si el .env no existe en producción, crearlo desde .env.example
if (IS_PACKAGED && !fs.existsSync(envPath)) {
    const envExamplePath = pathModule.join(__dirname, '.env.example');
    if (fs.existsSync(envExamplePath)) {
        const crypto = require('crypto');
        let envContent = fs.readFileSync(envExamplePath, 'utf8');
        
        const jwtSecret = crypto.randomBytes(64).toString('hex');
        envContent = envContent.replace('JWT_SECRET=GENERATE_ON_INSTALL', `JWT_SECRET=${jwtSecret}`);
        
        const gatewayPassword = crypto.randomBytes(32).toString('hex').substring(0, 32);
        envContent = envContent.replace('GATEWAY_PASSWORD=GENERATE_ON_INSTALL', `GATEWAY_PASSWORD=${gatewayPassword}`);
        
        fs.writeFileSync(envPath, envContent);
        console.log('[Setup] .env generado en userData:', envPath);
    }
}

require('dotenv').config({ path: envPath });

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('❌ CRITICAL ERROR: JWT_SECRET environment variable is not set. Please set it in backend/.env');
    process.exit(1);
}

app.use(cors({ origin: [/localhost:\d+$/, /127\.0\.0\.1:\d+$/] }));
app.use(express.json({ limit: '50mb' }));

// Servir archivos estáticos del frontend
const ROOT_DIR = pathModule.join(__dirname, '..');
const STATIC_OPTS = { etag: false, lastModified: false, setHeaders: (res) => { res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate'); } };
['css', 'js', 'images', 'icons'].forEach(dir => {
    const full = pathModule.join(ROOT_DIR, dir);
    if (fs.existsSync(full)) app.use(`/${dir}`, express.static(full, STATIC_OPTS));
});

// Servir subproyecto móvil separado
app.use('/mobile', express.static(pathModule.join(ROOT_DIR, 'mobile', 'www'), STATIC_OPTS));

app.get('/', (req, res) => res.sendFile(pathModule.join(ROOT_DIR, 'index.html')));
app.get('/index.html', (req, res) => res.sendFile(pathModule.join(ROOT_DIR, 'index.html')));
app.get('/manifest.json', (req, res) => res.sendFile(pathModule.join(ROOT_DIR, 'manifest.json')));
app.get('/version.json', (req, res) => res.sendFile(pathModule.join(ROOT_DIR, 'version.json')));
app.get('/sw.js', (req, res) => res.sendFile(pathModule.join(ROOT_DIR, 'sw.js')));

// Middleware de Autenticación Global
const { authMiddleware } = require('./middleware/auth');
app.use(authMiddleware);

// --- BASE DE DATOS E INICIALIZACIÓN ---
const { dbGet, dbRun, dbAll } = require('./database/connection');
const { initDatabaseSchema } = require('./database/migrations');

async function initializeDefaultData() {
    try {
        const userCount = await dbGet("SELECT COUNT(*) as count FROM users");
        const businesses = await dbAll("SELECT id, name, slug FROM businesses");
        
        if (userCount && userCount.count > 0) {
            console.log(`[Setup] BD ya inicializada (${userCount.count} usuario/s). Negocios:`, businesses.map(b => `"${b.name}"`).join(', '));
            
            // ponytail: Reparación automática de seguridad para usuarios con contraseña NULL
            const nullUsers = await dbAll("SELECT id, username FROM users WHERE password IS NULL OR password = ''");
            if (nullUsers && nullUsers.length > 0) {
                console.warn('[Setup] Reparando usuarios con contraseña nula:', nullUsers.map(u => u.username).join(', '));
                const defaultHash = await bcrypt.hash('Admin@2024!', 10);
                for (const u of nullUsers) {
                    const pass = (u.username === 'branco') ? await bcrypt.hash('1234', 10) : defaultHash;
                    await dbRun("UPDATE users SET password = ? WHERE id = ?", [pass, u.id]);
                }
            }

            const resetFile = pathModule.join(__dirname, '.reset_admin');
            if (fs.existsSync(resetFile)) {
                const hash = await bcrypt.hash('Admin@2024!', 10);
                await dbRun("UPDATE users SET password = ?, forcePasswordChange = 1 WHERE username = 'admin'", [hash]);
                console.log('⚠️ [Setup] CONTRASEÑA DE ADMIN RESTABLECIDA A: Admin@2024! (DEBE CAMBIARSE)');
                try { fs.unlinkSync(resetFile); } catch(e) {}
            }
            return;
        }

        console.log('[Setup] Base de datos vacía detectada. Creando datos iniciales...');

        const bizResult = await dbRun(
            "INSERT INTO businesses (name, slug, createdAt, isActive, plan) VALUES (?, ?, ?, 1, 'basic')",
            ['Mi Negocio', 'mi-negocio', new Date().toISOString()]
        );
        const businessId = bizResult.lastID;
        console.log(`[Setup] Negocio por defecto creado (id=${businessId})`);

        const defaultPassword = 'Admin@2024!';
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);

        await dbRun(
            "INSERT INTO users (username, password, role, business_id, createdAt, forcePasswordChange) VALUES (?, ?, 'owner', ?, ?, 1)",
            ['admin', hashedPassword, businessId, new Date().toISOString()]
        );

        console.log('✅ [Setup] Usuario por defecto creado:');
        console.log('   👤 Usuario  : admin');
        console.log('   🔑 Contraseña: Admin@2024!');
        console.log('   🏪 Negocio  : Mi Negocio');
        console.log('   ⚠️  SERÁ OBLIGADO A CAMBIAR CONTRASEÑA en primer login.');
    } catch (err) {
        console.error('[Setup] Error creando datos iniciales:', err.message);
    }
}

// Ejecutar migración e inicializar datos por defecto
initDatabaseSchema().then(async () => {
    await initializeDefaultData();
});

// --- RUTAS DE LA API (ENRUTADORES MODULARES) ---
const authRouter = require('./routes/auth');
const paymentsRouter = require('./routes/payments');
const complexRouter = require('./routes/complex');
const statsRouter = require('./routes/stats');
const systemRouter = require('./routes/system');
const aiRouter = require('./routes/ai');
const restRouter = require('./routes/rest');

app.use(authRouter);
app.use(paymentsRouter);
app.use(complexRouter);
app.use(statsRouter);
app.use(systemRouter);
app.use(aiRouter);
app.use(restRouter); // El enrutador REST de comodines debe registrarse al final

const srv = app.listen(PORT, '0.0.0.0', () => console.log(`Backend POS OK en puerto ${PORT}`));
srv.timeout = 0;
