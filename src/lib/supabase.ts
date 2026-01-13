import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase environment variables");
}

/**
 * Cliente Supabase configurado para aplicaciones de escritorio (Tauri)
 * 
 * Estrategia de sesión para apps desktop:
 * - persistSession: true → guarda tokens en localStorage para sobrevivir cierres de app
 * - autoRefreshToken: true → refresca automáticamente el JWT antes de que expire
 * - detectSessionInUrl: false → no es necesario en desktop (no hay OAuth redirects por URL)
 * - storageKey: personalizado para evitar conflictos
 * 
 * El refresh token tiene una expiración larga (por defecto 7 días en Supabase).
 * Cuando el usuario reabre la app:
 * 1. Se carga la sesión desde localStorage
 * 2. Si el JWT expiró pero el refresh token es válido, se renueva automáticamente
 * 3. Si el refresh token también expiró, el usuario debe re-autenticarse
 */
export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        // Persistir sesión en localStorage (sobrevive cierres de app)
        persistSession: true,

        // Refrescar token automáticamente antes de que expire
        autoRefreshToken: true,

        // No detectar sesión en URL (no aplica para desktop apps)
        detectSessionInUrl: false,

        // Key única para esta app
        storageKey: "minerva-auth-token",

        // Tipo de almacenamiento (localStorage por defecto, funciona bien en Tauri)
        storage: localStorage,

        // Flow type para login (PKCE es más seguro)
        flowType: "pkce",
    },
    global: {
        // Headers personalizados para identificar la app
        headers: {
            "x-app-name": "minerva-desktop",
            "x-app-version": import.meta.env.VITE_APP_VERSION || "0.1.0",
        },
    },
});

// Listener para refrescar sesión cuando la ventana vuelve a estar activa
// Útil cuando la app estuvo en background por mucho tiempo
if (typeof window !== "undefined") {
    document.addEventListener("visibilitychange", async () => {
        if (document.visibilityState === "visible") {
            // Intentar refrescar la sesión cuando la app vuelve a primer plano
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                // Si hay sesión, verificar si necesita refresh
                const expiresAt = session.expires_at;
                const now = Math.floor(Date.now() / 1000);
                const fiveMinutes = 5 * 60;

                // Si el token expira en menos de 5 minutos, refrescar proactivamente
                if (expiresAt && (expiresAt - now) < fiveMinutes) {
                    await supabase.auth.refreshSession();
                }
            }
        }
    });
}

