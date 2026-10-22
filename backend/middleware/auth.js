const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

const { switchUserDatabase, switchBusinessDatabase, getActiveUserId } = require('../database/connection');

const authMiddleware = async (req, res, next) => {
    const rPath = req.path.toLowerCase().replace(/\/$/, "");
    
    // Solo protegemos rutas que empiezan con /api
    if (!rPath.startsWith('/api')) return next();

    const publicPaths = [
        '/api/auth/login', 
        '/api/auth/register', 
        '/api/auth/join', 
        '/api/status', 
        '/api/system/status', 
        '/api/system/activity', 
        '/api/system/setup-status',
        '/api/sync/status',
        '/api/sync/cloud',
        '/api/auth/verify-user',
        '/api/auth/has-admin-pin',
        '/api/auth/verify-admin-pin',
        '/api/auth/verify-recovery-code',
        '/api/auth/reset-password-pin',
        '/api/auth/reset-password-code',
        '/api/auth/supabase-session',
        '/api/auth/local-offline-session',
        '/api/businesses/list',
        '/api/businesses/create',
        '/api/businesses/join',
        '/api/businesses/check-local-data',
        '/api/businesses/link-local',
        '/api/auth/verify-owner-password',
        '/api/auth/update-display-name'
    ];

    const rawUsernameHeader = req.headers['x-username'];
    let headerUsername = null;
    if (rawUsernameHeader) {
        try { headerUsername = decodeURIComponent(rawUsernameHeader); } catch (_) { headerUsername = rawUsernameHeader; }
    }

    if (publicPaths.some(p => rPath === p.toLowerCase()) || rPath.startsWith('/api/businesses/by-code')) {
        req.username = headerUsername;
        const token = req.headers['authorization']?.split(' ')[1];
        if (token) {
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                req.userId = decoded.userId || decoded.id;
                req.supabaseUserId = decoded.supabaseUserId || null;
                req.userRole = decoded.role || 'cashier';
                req.username = decoded.username || decoded.name || headerUsername || null;

                if (req.userRole === 'employee' || req.userRole === 'cashier') {
                    req.business_id = decoded.business_id || 1;
                } else {
                    const headerBid = req.headers['x-business-id'] ? parseInt(req.headers['x-business-id'], 10) : null;
                    req.business_id = (headerBid && !isNaN(headerBid) && headerBid > 0) ? headerBid : (decoded.business_id || 1);
                }

                await switchBusinessDatabase(req.business_id);
            } catch (_) {}
        } else {
            const headerBid = req.headers['x-business-id'] ? parseInt(req.headers['x-business-id'], 10) : null;
            if (headerBid && !isNaN(headerBid) && headerBid > 0) {
                req.business_id = headerBid;
                await switchBusinessDatabase(headerBid);
            }
        }
        return next();
    }

    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token faltante' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId || decoded.id;
        req.supabaseUserId = decoded.supabaseUserId || null;
        req.userRole = decoded.role || 'cashier';
        req.username = decoded.username || decoded.name || headerUsername || null;

        // Candado estricto de roles: Un empleado/cajero nunca puede alterar la sucursal
        if (req.userRole === 'employee' || req.userRole === 'cashier') {
            req.business_id = decoded.business_id || 1;
        } else {
            const headerBid = req.headers['x-business-id'] ? parseInt(req.headers['x-business-id'], 10) : null;
            req.business_id = (headerBid && !isNaN(headerBid) && headerBid > 0) ? headerBid : (decoded.business_id || 1);
        }

        // Conmutar a la base de datos física del negocio activo
        await switchBusinessDatabase(req.business_id);

        next();
    } catch (err) { 
        return res.status(401).json({ error: 'Token invalido' }); 
    }
};

function requireRole(...roles) {
    return (req, res, next) => {
        if (!roles.includes(req.userRole)) return res.status(403).json({ error: 'Sin permiso para esta operación' });
        next();
    };
}

module.exports = {
    authMiddleware,
    requireRole
};
