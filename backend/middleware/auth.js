const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

const authMiddleware = (req, res, next) => {
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
        '/api/auth/verify-user',
        '/api/auth/has-admin-pin',
        '/api/auth/verify-admin-pin',
        '/api/auth/verify-recovery-code',
        '/api/auth/reset-password-pin',
        '/api/auth/reset-password-code',
        '/api/businesses/list'
    ];
    if (publicPaths.some(p => rPath === p.toLowerCase())) return next();

    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token faltante' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId || decoded.id;
        req.business_id = decoded.business_id || 1;
        req.userRole = decoded.role || 'cashier';
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
