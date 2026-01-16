
import { MatchingService, ZoomMeetingCandidate, ZoomUserCandidate } from '../src/features/matching/services/matcher';

// Mock Data
const mockMeetings: ZoomMeetingCandidate[] = [
    { meeting_id: '100', topic: 'DUO PANTOJA - SALAS L1 (REPSOL) ONLINE', host_id: 'host1', start_time: '2023-01-01' },
    { meeting_id: '999', topic: 'Any', host_id: 'host2', start_time: '2023-01-01' }
];

const mockUsers: ZoomUserCandidate[] = [
    { id: 'u1', email: 'jessie@test.com', first_name: 'Jessie Lidia', last_name: 'Vasquez de Velasco', display_name: 'Jessie Vásquez de Velasco' },
    { id: 'u2', email: 'julio@test.com', first_name: 'Julio', last_name: 'Carpio', display_name: 'Julio Carpio' },
    { id: 'u3', email: 'karina@test.com', first_name: 'Karina', last_name: 'Bermudez', display_name: 'Karina Bermudez' },
    { id: 'u4', email: 'miguel@test.com', first_name: 'Miguel', last_name: 'Berrospi', display_name: 'Miguel Angel' },
    { id: 'u5', email: 'juan.wu@test.com', first_name: 'Juan Pablo', last_name: 'Warthon Wu', display_name: 'Juan Pablo Warthon Wu 吳' },
];

describe('MatchingService', () => {
    let matcher: MatchingService;

    beforeEach(() => {
        matcher = new MatchingService(mockMeetings, mockUsers);
    });

    it('should find exact meeting match (normalized)', () => {
        // Use a valid instructor so the result isn't "not_found" (due to instructor missing)
        const schedule = { program: 'DUO PANTOJA - SALAS L1 (REPSOL) ONLINE', instructor: 'Jessie Lidia Vasquez' } as any;
        const result = matcher.findMatch(schedule);
        expect(result.meeting_id).toBe('100');
        // Status should be 'to_update' because host1 != u1, but definitely NOT 'not_found'
        expect(result.status).not.toBe('not_found');
    });

    it('should match instructor with Fuzzy/Token Logic: Jessie Lidia Vasquez', () => {
        const schedule = { program: 'Any', instructor: 'Jessie Lidia Vasquez' } as any;
        const result = matcher.findMatch(schedule);
        expect(result.found_instructor?.id).toBe('u1');
    });

    it('should match instructor with Token Subset: JULIO JESUS CARPIO ZEGARRA', () => {
        const schedule = { program: 'Any', instructor: 'JULIO JESUS CARPIO ZEGARRA' } as any;
        const result = matcher.findMatch(schedule);
        expect(result.found_instructor?.id).toBe('u2'); // Julio Carpio
    });

    it('should match instructor with Token Subset: KARINA DEL VALLE BERMUDEZ TREJO', () => {
        const schedule = { program: 'Any', instructor: 'KARINA DEL VALLE BERMUDEZ TREJO' } as any;
        const result = matcher.findMatch(schedule);
        expect(result.found_instructor?.id).toBe('u3'); // Karina Bermudez
    });

    it('should match instructor with Token Subset (Display Name focus): MIGUEL ANGEL BERROSPI RAMIREZ', () => {
        const schedule = { program: 'Any', instructor: 'MIGUEL ANGEL BERROSPI RAMIREZ' } as any;
        const result = matcher.findMatch(schedule);
        expect(result.found_instructor?.id).toBe('u4'); // Miguel Angel
    });

    describe('Ambiguity Resolution (Best Token Match)', () => {
        it('should correctly match "Juan Pablo Warthon Wu 吳" (Most specific)', () => {
            const result = matcher.findMatch({ program: 'Any', instructor: 'Juan Pablo Warthon Wu 吳' } as any);
            expect(result.found_instructor?.id).toBe('u5');
        });

        // Obsolete test cases for u6 and u7 removed as per user request

        it('should handle partial "Juan Pablo Warthon Wu" matching to u5', () => {
            // Even without Chinese char, u5 has 4 matching tokens vs u6 with 3.
            const result = matcher.findMatch({ program: 'Any', instructor: 'Juan Pablo Warthon Wu' } as any);
            expect(result.found_instructor?.id).toBe('u5');
        });
    });
});
