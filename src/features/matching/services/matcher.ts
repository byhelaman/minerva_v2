import Fuse, { IFuseOptions } from 'fuse.js';
import { Schedule } from '@/features/schedules/utils/excel-parser';
import { normalizeString } from '../utils/normalizer';

export interface ZoomMeetingCandidate {
    meeting_id: string;
    topic: string;
    host_id: string;
    start_time: string;
    join_url?: string;
}

export interface MatchResult {
    schedule: Schedule;
    status: 'matched' | 'ambiguous' | 'not_found';
    bestMatch?: ZoomMeetingCandidate;
    candidates: ZoomMeetingCandidate[];
    score?: number; // 0 es coincidencia perfecta, 1 es sin coincidencia (estándar Fuse.js)
}

/**
 * Servicio para emparejar Horarios (Schedules) con Reuniones de Zoom usando Fuse.js
 * Estrategia: "Solo Nombre" (Nombre del Programa vs Tema de la Reunión)
 */
export class MatchingService {
    private fuse: Fuse<ZoomMeetingCandidate>;

    constructor(meetings: ZoomMeetingCandidate[]) {
        // Configurar Fuse.js
        const options: IFuseOptions<ZoomMeetingCandidate> = {
            includeScore: true,
            // Buscar principalmente en 'topic'
            keys: ['topic'],
            // Umbral: 0.0 = perfecto, 1.0 = nada.
            // 0.3 permite algo de flexibilidad pero requiere alta relevancia.
            threshold: 0.3,
            ignoreLocation: true, // Buscar en cualquier parte de la cadena
            useExtendedSearch: true,

            // Fuse no soporta normalización personalizada simple en el índice sin pre-proceso.
            // Así que pre-procesaremos tanto los datos del índice como las consultas.
        };

        // MEJOR ENFOQUE: Crear una lista buscable con temas normalizados
        const normalizedMeetings = meetings.map(m => ({
            ...m,
            normalized_topic: normalizeString(m.topic)
        }));

        this.fuse = new Fuse(normalizedMeetings, {
            ...options,
            keys: ['normalized_topic'] // Buscar contra la versión normalizada
        });
    }

    /**
     * Encontrar mejores coincidencias para un solo horario
     */
    public findMatch(schedule: Schedule): MatchResult {
        // 1. Normalizar la consulta (Programa del Horario)
        const query = normalizeString(schedule.program);

        if (!query) {
            return {
                schedule,
                status: 'not_found',
                candidates: []
            };
        }

        // 2. Ejecutar Búsqueda
        const searchResults = this.fuse.search(query);

        // 3. Analizar Resultados
        if (searchResults.length === 0) {
            return {
                schedule,
                status: 'not_found',
                candidates: []
            };
        }

        const bestResult = searchResults[0];
        const score = bestResult.score ?? 1;

        // Umbrales
        const MATCH_THRESHOLD = 0.15; // Muy buena coincidencia (0 es perfecto)
        const AMBIGUOUS_THRESHOLD = 0.35; // Aceptable pero quizás ambiguo

        // Chequear ambigüedad: 
        // Si el segundo resultado está muy cerca del primero (diferencia de score < 0.05), es ambiguo
        let isAmbiguous = false;
        if (searchResults.length > 1) {
            const secondScore = searchResults[1].score ?? 1;
            if (Math.abs(secondScore - score) < 0.05) {
                isAmbiguous = true;
            }
        }

        let status: 'matched' | 'ambiguous' | 'not_found' = 'not_found';

        if (score <= MATCH_THRESHOLD && !isAmbiguous) {
            status = 'matched';
        } else if (score <= AMBIGUOUS_THRESHOLD || (score <= MATCH_THRESHOLD && isAmbiguous)) {
            status = 'ambiguous';
        }

        // Mapear de vuelta a ZoomMeetingCandidate original (removiendo normalized_topic)
        const candidates = searchResults.slice(0, 5).map(r => {
            const { normalized_topic, ...original } = r.item as any;
            return original as ZoomMeetingCandidate;
        });

        return {
            schedule,
            status,
            bestMatch: candidates[0],
            candidates,
            score
        };
    }

    /**
     * Procesar horarios en lote
     */
    public matchAll(schedules: Schedule[]): MatchResult[] {
        return schedules.map(s => this.findMatch(s));
    }
}
