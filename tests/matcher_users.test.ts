
import { describe, it, expect, beforeEach } from 'vitest';
import { MatchingService, ZoomMeetingCandidate, ZoomUserCandidate } from '../src/features/matching/services/matcher';

// Usuarios Mock de DB - datos ficticios para tests
const mockUsers: ZoomUserCandidate[] = [
    { id: 'u1', email: 'u1@test.com', first_name: 'Laura Maria', last_name: 'Torres Mendez', display_name: 'Laura Torres Mendez' },
    { id: 'u2', email: 'u2@test.com', first_name: 'Carlos', last_name: 'Ramos', display_name: 'Carlos Angel' },
    { id: 'u3', email: 'u3@test.com', first_name: 'Pablo Luis', last_name: 'Vargas Chen', display_name: 'Pablo Luis Vargas Chen 陳' },
    { id: 'u4', email: 'u4@test.com', first_name: 'Sofia', last_name: 'Morales', display_name: 'Sofia Morales' },
];

const mockMeetings: ZoomMeetingCandidate[] = [
    { meeting_id: 'dummy', topic: 'Any Program', host_id: 'h0', start_time: '2023-01-01' }
];

describe('MatchingService - Users', () => {
    let matcher: MatchingService;

    beforeEach(() => {
        matcher = new MatchingService(mockMeetings, mockUsers);
    });

    it('should match Instructor: Laura Torres', () => {
        const schedule = { program: 'Any Program', instructor: 'Laura Maria Torres' } as any;
        const result = matcher.findMatch(schedule);
        expect(result.found_instructor?.id).toBe('u1');
    });

    it('should match Instructor: Carlos Ramos', () => {
        const schedule = { program: 'Any Program', instructor: 'CARLOS ANGEL RAMOS SILVA' } as any;
        const result = matcher.findMatch(schedule);
        expect(result.found_instructor?.id).toBe('u2');
    });

    it('should match Instructor: Pablo Luis Vargas', () => {
        const schedule = { program: 'Any Program', instructor: 'Pablo Luis Vargas' } as any;
        const result = matcher.findMatch(schedule);
        expect(result.found_instructor?.id).toBe('u3');
    });

    it('should match Instructor: Sofia Morales', () => {
        const schedule = { program: 'Any Program', instructor: 'SOFIA DEL CARMEN MORALES VEGA' } as any;
        const result = matcher.findMatch(schedule);
        expect(result.found_instructor?.id).toBe('u4');
    });

    // ========== CASOS DE TEST NEGATIVOS ==========

    it('should NOT match Pedro Garcia when searching for Juan Garcia', () => {
        // Solo coincide apellido - no debería ser suficiente
        const schedule = { program: 'Any Program', instructor: 'Juan Garcia Lopez' } as any;
        const result = matcher.findMatch(schedule);
        expect(result.found_instructor).toBeUndefined();
    });

    it('should NOT match Carlos Ramos when searching for Eduardo Ramos', () => {
        // Mismo apellido, diferente nombre - no debería coincidir
        const schedule = { program: 'Any Program', instructor: 'Eduardo Antonio Ramos' } as any;
        const result = matcher.findMatch(schedule);
        expect(result.found_instructor).toBeUndefined();
    });

    it('should NOT match Sofia Morales when searching for Sofia Rodriguez', () => {
        // Mismo nombre, diferente apellido - no debería coincidir
        const schedule = { program: 'Any Program', instructor: 'Sofia Patricia Rodriguez' } as any;
        const result = matcher.findMatch(schedule);
        expect(result.found_instructor).toBeUndefined();
    });
});
