import { useEffect, useRef } from "react";
import { useLinkedSourceSync } from "../hooks/useLinkedSourceSync";
import { useSettings } from "@/components/settings-provider";
import { useTheme } from "@/components/theme-provider";
import { useAuth } from "@/components/auth-provider";
import { useZoomStore } from "@/features/matching/stores/useZoomStore";

export function GlobalSyncManager() {
    const { sync } = useLinkedSourceSync();
    const { settings, isLoading: isSettingsLoading } = useSettings();
    const { setTheme } = useTheme();
    const { profile, isLoading: isAuthLoading } = useAuth();
    const { fetchZoomData } = useZoomStore();

    const hasSynced = useRef(false);

    // Sincronizar tema al cargar configuración
    useEffect(() => {
        if (!isSettingsLoading && settings.theme) {
            setTheme(settings.theme);
        }
    }, [isSettingsLoading, settings.theme, setTheme]);

    useEffect(() => {
        // Ejecutar sync SOLO una vez al montarse el componente (Login exitoso / Inicio App)
        // Usamos ref para garantizar que no se dispare doble en React Strict Mode

        // Esperar a que tengamos perfil cargado para verificar permisos
        if (isAuthLoading) return;

        if (!hasSynced.current) {
            const isAdmin = (profile?.hierarchy_level ?? 0) >= 80;

            if (isAdmin) {
                console.log("Triggering initial sync...");
                sync(); // Excel Sync from OneDrive
                fetchZoomData(); // Load Zoom Data from DB
            } else {
                console.log("Skipping initial sync...");
            }

            hasSynced.current = true;
        }
    }, [sync, fetchZoomData, isAuthLoading, profile]);

    return null;
}
