const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://lqnrphuyitfuzlpgbmrx.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxbnJwaHV5aXRmdXpscGdibXJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNjAzMjgsImV4cCI6MjEwNTgzNjMyOH0.9yZBfzLAZpDXWkWdgnfYXZMUViGFW_ge5Tjqnq09vHc';
// Clave Service Role solo permitida si está definida explícitamente en el entorno protegido (.env)
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || null;

// Cliente público para autenticación y llamadas estándar
const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Crea un cliente Supabase autenticado con el token JWT de la sesión del usuario.
 * Garantiza que las llamadas respeten al 100% las políticas Row Level Security (RLS).
 * @param {string} userJwtToken
 */
function createUserClient(userJwtToken) {
    if (!userJwtToken) return supabase;
    const token = userJwtToken.startsWith('Bearer ') ? userJwtToken.slice(7) : userJwtToken;
    return createClient(supabaseUrl, supabaseAnonKey, {
        global: {
            headers: {
                Authorization: `Bearer ${token}`
            }
        },
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    });
}

// Cliente administrativo (solo si se provee explícitamente en variables de entorno para scripts de mantenimiento)
let supabaseAdmin = null;
if (supabaseServiceRoleKey) {
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
}

module.exports = {
    supabase,
    supabaseAdmin,
    createUserClient,
    supabaseUrl,
    supabaseAnonKey
};
