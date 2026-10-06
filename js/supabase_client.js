/**
 * Cliente Oficial de Supabase para Caja Fácil (Frontend)
 */
const SUPABASE_CONFIG = {
    url: 'https://lqnrphuyitfuzlpgbmrx.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxbnJwaHV5aXRmdXpscGdibXJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNjAzMjgsImV4cCI6MjEwNTgzNjMyOH0.9yZBfzLAZpDXWkWdgnfYXZMUViGFW_ge5Tjqnq09vHc'
};

let supabaseClient = null;

function getSupabaseClient() {
    if (!supabaseClient) {
        if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
            supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
        } else if (typeof require !== 'undefined') {
            try {
                const { createClient } = require('@supabase/supabase-js');
                supabaseClient = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
            } catch (e) {
                console.warn('⚠️ No se pudo inicializar Supabase vía require:', e.message);
            }
        }
    }
    return supabaseClient;
}

window.getSupabaseClient = getSupabaseClient;
window.SUPABASE_CONFIG = SUPABASE_CONFIG;
