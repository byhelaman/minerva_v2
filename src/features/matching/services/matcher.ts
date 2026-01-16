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

export interface ZoomUserCandidate {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    display_name: string;
}

export interface MatchResult {
    schedule: Schedule;
    status: 'assigned' | 'to_update' | 'not_found';
    reason: string;
    meeting_id?: string;
    found_instructor?: {
        id: string;
        email: string;
        display_name: string;
    };
    bestMatch?: ZoomMeetingCandidate;
    candidates: ZoomMeetingCandidate[];
    score?: number;
}

/**
 * Servicio para emparejar Horarios con Reuniones de Zoom y Validar Anfitriones.
 * Lógica portada de Python (assignment_api.py / matching.py)
 */
export class MatchingService {
    private fuseMeetings: Fuse<ZoomMeetingCandidate>;
    private fuseUsers: Fuse<ZoomUserCandidate>;
    private meetingsDict: Record<string, ZoomMeetingCandidate> = {};
    private usersDict: Record<string, ZoomUserCandidate> = {};
    private usersDictDisplay: Record<string, ZoomUserCandidate> = {};
    private users: ZoomUserCandidate[] = [];

    constructor(meetings: ZoomMeetingCandidate[], users: ZoomUserCandidate[] = []) {
        this.users = users;
        // 1. Preparar Diccionarios para Búsqueda Exacta (Normalizada)
        meetings.forEach(m => {
            const key = normalizeString(m.topic);
            if (key) this.meetingsDict[key] = m;
        });

        users.forEach(u => {
            // Clave Primaria: Nombre Completo
            const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim();
            if (fullName) {
                this.usersDict[normalizeString(fullName)] = u;
            }
            // Clave Secundaria: Display Name
            if (u.display_name) {
                this.usersDictDisplay[normalizeString(u.display_name)] = u;
            }
        });

        // 2. Configurar Fuse.js para Búsquedas Difusas (Meetings)
        const meetingsOptions: IFuseOptions<ZoomMeetingCandidate> = {
            includeScore: true,
            keys: ['topic'],
            threshold: 0.3, // Umbral estricto
            ignoreLocation: true,
            useExtendedSearch: true,
        };
        // Pre-procesar para Fuse
        const normalizedMeetings = meetings.map(m => ({
            ...m,
            normalized_topic: normalizeString(m.topic)
        }));
        this.fuseMeetings = new Fuse(normalizedMeetings, {
            ...meetingsOptions,
            keys: ['normalized_topic']
        });

        // 3. Configurar Fuse.js para Búsquedas Difusas (Users)
        const usersOptions: IFuseOptions<ZoomUserCandidate> = {
            includeScore: true,
            threshold: 0.45, // Relaxed from 0.35 to handle "Julio Jesus Carpio Zegarra" vs "Julio Carpio"
            ignoreLocation: true,
            ignoreFieldNorm: true, // Help with length differences
            keys: ['normalized_name', 'normalized_display']
        };
        const normalizedUsers = users.map(u => ({
            ...u,
            normalized_name: normalizeString(`${u.first_name} ${u.last_name}`),
            normalized_display: normalizeString(u.display_name)
        }));
        this.fuseUsers = new Fuse(normalizedUsers, usersOptions);
    }

    /**
     * Encontrar mejores coincidencias para un solo horario
     */
    public findMatch(schedule: Schedule): MatchResult {
        const result: MatchResult = {
            schedule,
            status: 'not_found',
            reason: '',
            candidates: []
        };

        const programNormalized = normalizeString(schedule.program);
        const instructorNormalized = normalizeString(schedule.instructor);

        console.groupCollapsed(`🔍 Match: ${schedule.program} (${schedule.instructor})`);
        console.log("Raw:", { program: schedule.program, instructor: schedule.instructor });
        console.log("Normalized:", { program: programNormalized, instructor: instructorNormalized });

        // ---------------------------------------------------------------------
        // PASO 1: Encontrar la Reunión (Exacto o Difuso)
        // ---------------------------------------------------------------------
        let meeting: ZoomMeetingCandidate | undefined;
        let meetingScore = 1;

        // 1.a. Búsqueda Exacta
        if (this.meetingsDict[programNormalized]) {
            meeting = this.meetingsDict[programNormalized];
            meetingScore = 0;
            console.log("✅ Meeting Exact Match:", meeting.topic);
        }
        // 1.b. Búsqueda Difusa
        else {
            const searchResults = this.fuseMeetings.search(programNormalized);
            console.log("🤔 Meeting Fuzzy Candidates:", searchResults.map(r => ({ topic: r.item.topic, score: r.score })));

            if (searchResults.length > 0) {
                const best = searchResults[0];
                if (best.score !== undefined && best.score <= 0.3) {
                    meeting = best.item;
                    meetingScore = best.score;
                    console.log("✅ Meeting Fuzzy Match Selected:", meeting.topic, "Score:", meetingScore);
                } else {
                    console.log("❌ Meeting Fuzzy Matches found but Score too low (> 0.3)");
                }
            } else {
                console.log("❌ No Meeting Fuzzy Candidates found");
            }
        }

        if (!meeting) {
            result.status = 'not_found';
            result.reason = 'Meeting not found';
            console.log("🏁 Result: NOT FOUND (Meeting)");
            console.groupEnd();
            return result;
        }

        result.meeting_id = meeting.meeting_id;
        result.bestMatch = meeting;
        result.score = meetingScore;

        // ---------------------------------------------------------------------
        // PASO 2: Encontrar al Instructor (Exacto o Difuso)
        // ---------------------------------------------------------------------
        let instructor: ZoomUserCandidate | undefined;

        // 2.a. Búsqueda Exacta (Nombre Completo o Display Name)
        if (this.usersDict[instructorNormalized]) {
            instructor = this.usersDict[instructorNormalized];
            console.log("✅ Instructor Exact Match (Name):", instructor.display_name);
        } else if (this.usersDictDisplay[instructorNormalized]) {
            instructor = this.usersDictDisplay[instructorNormalized];
            console.log("✅ Instructor Exact Match (Display):", instructor.display_name);
        } else {
            // 2.a.1 Token Set Match (Robust Fallback for "First Last" inside "First Middle Last MatLast")
            // Mimics Python's token_set_ratio logic which handles subsets well.
            const queryTokens = new Set(instructorNormalized.split(" "));

            // Find ALL candidates that are subsets
            const tokenMatches = this.users.filter(u => {
                const uNameTokens = normalizeString(`${u.first_name} ${u.last_name}`).split(" ");
                const uDisplayTokens = normalizeString(u.display_name).split(" ");

                // Check if user is subset of query (Query has MORE info)
                const nameIsSubset = uNameTokens.every(t => queryTokens.has(t));
                const displayIsSubset = uDisplayTokens.every(t => queryTokens.has(t));

                return nameIsSubset || displayIsSubset;
            });

            // Select the BEST match (the one with the most tokens) to avoid ambiguity
            // e.g. "Juan Carlos Perez" vs "Juan Perez". "Juan Perez" (2 tokens) is better than "Juan" (1 token)
            // if both match.
            let bestTokenMatch: ZoomUserCandidate | undefined;
            if (tokenMatches.length > 0) {
                bestTokenMatch = tokenMatches.reduce((prev, current) => {
                    const prevLen = Math.max(
                        normalizeString(`${prev.first_name} ${prev.last_name}`).split(" ").length,
                        normalizeString(prev.display_name).split(" ").length
                    );
                    const currLen = Math.max(
                        normalizeString(`${current.first_name} ${current.last_name}`).split(" ").length,
                        normalizeString(current.display_name).split(" ").length
                    );
                    return (currLen > prevLen) ? current : prev;
                });
            }

            if (bestTokenMatch) {
                instructor = bestTokenMatch;
                console.log("✅ Instructor Token Subset Match (Best):", instructor.display_name);
            }
            // 2.b. Búsqueda Difusa
            else {
                const userResults = this.fuseUsers.search(instructorNormalized);
                console.log("🤔 Instructor Fuzzy Candidates:", userResults.map(r => ({
                    name: `${r.item.first_name} ${r.item.last_name}`,
                    display: r.item.display_name,
                    score: r.score
                })));

                if (userResults.length > 0) {
                    const bestUser = userResults[0];
                    if (bestUser.score !== undefined && bestUser.score <= 0.45) {
                        instructor = bestUser.item;
                        console.log("✅ Instructor Fuzzy Match Selected:", instructor.display_name, "Score:", bestUser.score);
                    } else {
                        console.log("❌ Instructor Fuzzy Matches found but Score too low (> 0.45)");
                    }
                } else {
                    console.log("❌ No Instructor Fuzzy Candidates found");
                }
            }
        }

        if (!instructor) {
            // Encontramos reunión pero NO instructor -> Problema de datos, pero la reunión "existe"
            result.status = 'not_found';
            result.reason = 'Instructor not found';
            console.log("🏁 Result: NOT FOUND (Instructor)");
            console.groupEnd();
            return result;
        }

        result.found_instructor = {
            id: instructor.id,
            email: instructor.email,
            display_name: instructor.display_name
        };

        // ---------------------------------------------------------------------
        // PASO 3: Validar Anfitrión (Match)
        // Compare meeting.host_id vs instructor.id
        // ---------------------------------------------------------------------
        console.log("⚖️ Validating Host:");
        console.log("   Meeting Host ID:", meeting.host_id);
        console.log("   Instructor ID:  ", instructor.id);

        if (meeting.host_id === instructor.id) {
            result.status = 'assigned';
            result.reason = '-'; // Todo OK
            console.log("🏁 Result: ASSIGNED");
        } else {
            result.status = 'to_update';
            result.reason = '-';
            console.log("🏁 Result: TO UPDATE");
        }

        console.groupEnd();
        return result;
    }

    /**
     * Procesar horarios en lote
     */
    public matchAll(schedules: Schedule[]): MatchResult[] {
        return schedules.map(s => this.findMatch(s));
    }
}

