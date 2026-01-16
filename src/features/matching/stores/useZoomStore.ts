import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { ZoomMeetingCandidate, MatchingService, MatchResult } from '../services/matcher';
import { Schedule } from '@/features/schedules/utils/excel-parser';

interface ZoomUser {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    display_name: string;
}

interface ZoomState {
    // Datos
    meetings: ZoomMeetingCandidate[];
    users: ZoomUser[];
    matchResults: MatchResult[];

    // Estado UI
    isSyncing: boolean;
    syncProgress: number; // 0-100
    syncError: string | null;
    lastSyncedAt: string | null;

    // Estado de Carga de Datos
    isLoadingData: boolean;

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
    isLoadingData: false,

    fetchZoomData: async () => {
        set({ isLoadingData: true });
        try {
            // Fetch Meetings (Pagination loop)
            let allMeetings: any[] = [];
            let page = 0;
            const pageSize = 1000;
            let hasMore = true;

            while (hasMore) {
                const { data: meetings, error: meetingsError } = await supabase
                    .from('zoom_meetings')
                    .select('meeting_id, topic, host_id, start_time, join_url')
                    .range(page * pageSize, (page + 1) * pageSize - 1);

                if (meetingsError) throw meetingsError;

                if (meetings) {
                    allMeetings = [...allMeetings, ...meetings];
                    if (meetings.length < pageSize) hasMore = false;
                    else page++;
                } else {
                    hasMore = false;
                }
            }

            // Fetch Users (Pagination loop)
            let allUsers: any[] = [];
            page = 0;
            hasMore = true;

            while (hasMore) {
                const { data: users, error: usersError } = await supabase
                    .from('zoom_users')
                    .select('id, email, first_name, last_name, display_name')
                    .range(page * pageSize, (page + 1) * pageSize - 1);

                if (usersError) throw usersError;

                if (users) {
                    allUsers = [...allUsers, ...users];
                    if (users.length < pageSize) hasMore = false;
                    else page++;
                } else {
                    hasMore = false;
                }
            }

            set({
                meetings: allMeetings as unknown as ZoomMeetingCandidate[],
                users: allUsers as unknown as ZoomUser[]
            });
        } catch (error) {
            console.error("Error fetching Zoom data:", error);
            // Optionally set an error state here if needed
        } finally {
            set({ isLoadingData: false });
        }
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
        const users = get().users;

        // Pass both meetings and users to the matcher
        const matcher = new MatchingService(meetings, users);
        const results = matcher.matchAll(schedules);

        set({ matchResults: results });
    },

    resolveConflict: (schedule: Schedule, selectedMeeting: ZoomMeetingCandidate) => {
        // Actualizar el resultado del match manualmente
        const results = get().matchResults.map(r => {
            if (r.schedule === schedule) {
                return {
                    ...r,
                    status: 'assigned' as const,
                    bestMatch: selectedMeeting,
                    // Opcionalmente limpiar candidatos para bloquear la selección
                };
            }
            return r;
        });
        set({ matchResults: results });
    }
}));

