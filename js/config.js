// js/config.js

export const CONFIG = {
    SUPABASE_URL: 'https://mvtatdvpsjynvayhhksc.supabase.co',
    // NOTA: Asegúrate de que tus políticas RLS (Row Level Security) en Supabase estén activas,
    // ya que esta clave es visible en el navegador.
    SUPABASE_KEY: 'sb_publishable_XtV2kYHISXME2K-STuHmdw_UUGTZyvS',
};

// Verificación de seguridad para asegurar que la librería base se cargó
if (typeof window.supabase === 'undefined') {
    console.error('CRÍTICO: La librería de Supabase no se ha cargado. Verifica tu index.html');
}

// Inicialización y exportación del cliente (Singleton)
export const supabaseClient = window.supabase 
    ? window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY) 
    : null;