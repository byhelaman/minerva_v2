import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { ZoomMeetingCandidate, MatchingService, MatchResult } from '../services/matcher';
import { Schedule } from '@/features/schedules/utils/excel-parser';

interface ZoomState {
    // Datos
    meetings: ZoomMeetingCandidate[];
    users: any[]; // Definir interfaz de Usuario propiamente si es necesario
    matchResults: MatchResult[];

    // Estado UI
    isSyncing: boolean;
    syncProgress: number; // 0-100
    syncError: string | null;
    lastSyncedAt: string | null;

    // Acciones
    fetchZoomData: () => Promise<void>;
    triggerSync: () => Promise<void>;
    runMatching: (schedules: Schedule[]) => void;
    resolveConflict: (schedule: Schedule, selectedMeeting: ZoomMeetingCandidate) => void;
}

export const useZoomStore = create<ZoomState>((set, get) => ({
    meetings: [],
    users: [],
    matchResults: [],
    isSyncing: false,
    syncProgress: 0,
    syncError: null,
    lastSyncedAt: null,

    fetchZoomData: async () => {
        // Obtenemos los datos, si falla que lance error para ser manejado por quien lo llama (UI o triggerSync)
        const { data: meetings, error: meetingsError } = await supabase
            .from('zoom_meetings')
            .select('*');

        if (meetingsError) throw meetingsError;

        set({ meetings: meetings as unknown as ZoomMeetingCandidate[] });
    },

    triggerSync: async () => {
        set({ isSyncing: true, syncError: null, syncProgress: 10 });
        try {
            // 1. Verificar sesión y refrescar si es necesario
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();

            if (sessionError || !session) {
                console.warn("No active session during sync trigger. Attempting refresh...");
                const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
                if (refreshError || !refreshData.session) {
                    throw new Error("Authentication failed: No active session. Please log in again.");
                }
            }

            console.log("Session verified.");

            // 2. Invocar Edge Function
            const { data, error } = await supabase.functions.invoke('zoom-sync', {
                method: 'POST',
            });

            if (error) {
                // Si es un error de la función (ej: 401 o 500 lanzado por throw error), viene aquí
                const errorMessage = error instanceof Error ? error.message : "Error invocando función";

                // Intentar parsear si el body traía un JSON de error
                let context = "";
                if (typeof error === 'object' && error !== null && 'context' in error) {
                    // @ts-ignore
                    context = JSON.stringify(error.context);
                }

                throw new Error(errorMessage + (context ? ` ${context}` : ""));
            }

            // Validar respuesta de negocio (la función devuelve json)
            if (!data || data.error) {
                throw new Error(data?.error || "La sincronización falló sin detalles.");
            }

            set({ syncProgress: 80 });

            // Refrescar datos locales
            await get().fetchZoomData();

            set({
                isSyncing: false,
                syncProgress: 100,
                lastSyncedAt: new Date().toISOString()
            });

        } catch (error: any) {
            console.error('Fallo en sincronización:', error);
            set({
                isSyncing: false,
                syncError: error.message || 'Unknown error during synchronization'
            });
            throw error; // Relanzar para que la UI (ZoomIntegration) sepa que falló
        }
    },

    runMatching: (schedules: Schedule[]) => {
        const meetings = get().meetings;
        const matcher = new MatchingService(meetings);
        const results = matcher.matchAll(schedules);

        set({ matchResults: results });
    },

    resolveConflict: (schedule: Schedule, selectedMeeting: ZoomMeetingCandidate) => {
        // Actualizar el resultado del match manualmente
        const results = get().matchResults.map(r => {
            if (r.schedule === schedule) {
                return {
                    ...r,
                    status: 'matched' as const,
                    bestMatch: selectedMeeting,
                    // Opcionalmente limpiar candidatos para bloquear la selección
                };
            }
            return r;
        });
        set({ matchResults: results });
    }
}));
