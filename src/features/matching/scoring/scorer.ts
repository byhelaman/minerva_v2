/**
 * Scorer - Orquestador del sistema de scoring
 * 
 * Calcula el score de cada candidato aplicando todas las penalizaciones
 * y determina la decisión final de matching.
 */

import type { ZoomMeetingCandidate } from '../services/matcher';
import type { ScoringContext, ScoringResult, MatchEvaluation, AppliedPenalty } from './types';
import { ALL_PENALTIES } from './penalties';
import { BASE_SCORE, THRESHOLDS } from '../config/matching.config';
import { normalizeString } from '../utils/normalizer';
import { logger } from '@/lib/logger';

/**
 * Calcula el score de un candidato aplicando todas las penalizaciones
 */
export function scoreCandidate(
    rawProgram: string,
    candidate: ZoomMeetingCandidate,
    allCandidates: ZoomMeetingCandidate[]
): ScoringResult {
    const ctx: ScoringContext = {
        rawProgram,
        rawTopic: candidate.topic,
        normalizedProgram: normalizeString(rawProgram),
        normalizedTopic: normalizeString(candidate.topic),
        candidate,
        allCandidates,
    };

    const penalties: AppliedPenalty[] = [];
    let score = BASE_SCORE;

    // Aplicar cada penalización
    for (const penaltyFn of ALL_PENALTIES) {
        const result = penaltyFn(ctx);
        if (result) {
            penalties.push(result);
            score += result.points; // Los puntos son negativos
        }
    }

    return {
        candidate,
        baseScore: BASE_SCORE,
        finalScore: Math.max(0, score), // No permitir scores negativos
        penalties,
        isDisqualified: score <= 0,
    };
}

/**
 * Evalúa todos los candidatos y determina la mejor decisión
 */
export function evaluateMatch(
    rawProgram: string,
    candidates: ZoomMeetingCandidate[]
): MatchEvaluation {
    if (candidates.length === 0) {
        return {
            bestMatch: null,
            allResults: [],
            decision: 'not_found',
            confidence: 'none',
            reason: 'No hay candidatos disponibles',
        };
    }

    // Calcular score para cada candidato
    const results = candidates.map(c => scoreCandidate(rawProgram, c, candidates));

    // Ordenar por score descendente
    results.sort((a, b) => b.finalScore - a.finalScore);

    // Filtrar candidatos no descalificados
    const validResults = results.filter(r => !r.isDisqualified && r.finalScore >= THRESHOLDS.MINIMUM);

    if (validResults.length === 0) {
        // Buscar el mejor candidato descalificado para dar una razón
        const bestRejected = results[0];
        const mainPenalty = bestRejected?.penalties[0];

        return {
            bestMatch: bestRejected || null,
            allResults: results,
            decision: 'not_found',
            confidence: 'none',
            reason: mainPenalty
                ? `${mainPenalty.name}: ${mainPenalty.reason || ''}`
                : 'Ningún candidato cumple los requisitos mínimos',
        };
    }

    const best = validResults[0];
    const second = validResults[1];

    // Verificar ambigüedad
    if (second) {
        const scoreDiff = best.finalScore - second.finalScore;
        if (scoreDiff < THRESHOLDS.AMBIGUITY_DIFF) {
            logger.debug('⚠️ Ambiguity Detected:');
            logger.debug(`   1. ${best.candidate.topic} (Score: ${best.finalScore})`);
            best.penalties.forEach(p => logger.debug(`      - ${p.name}: ${p.points} (${p.reason})`));

            logger.debug(`   2. ${second.candidate.topic} (Score: ${second.finalScore})`);
            second.penalties.forEach(p => logger.debug(`      - ${p.name}: ${p.points} (${p.reason})`));

            logger.debug(`   Diff: ${scoreDiff} < ${THRESHOLDS.AMBIGUITY_DIFF}`);

            return {
                decision: 'ambiguous',
                reason: `${validResults.length} candidatos con scores similares`,
                bestMatch: best,
                allResults: results, // Keep allResults for debugging/context
                confidence: 'low', // Explicitly set confidence for ambiguity
                ambiguousCandidates: validResults.map(r => r.candidate)
            };
        }
    }

    // Verificar penalizaciones de ambigüedad (orphan numbers/levels)
    const ambiguityPenalties = best.penalties.filter(p =>
        p.name === 'ORPHAN_NUMBER_WITH_SIBLINGS' ||
        p.name === 'ORPHAN_LEVEL_WITH_SIBLINGS'
    );

    if (ambiguityPenalties.length > 0 && best.finalScore < THRESHOLDS.HIGH_CONFIDENCE) {
        return {
            bestMatch: best,
            allResults: results,
            decision: 'ambiguous',
            confidence: 'low',
            reason: ambiguityPenalties[0].reason || 'Especificación incompleta',
            ambiguousCandidates: validResults.slice(0, 5).map(r => r.candidate),
        };
    }

    // Determinar nivel de confianza
    let confidence: 'high' | 'medium' | 'low';
    if (best.finalScore >= THRESHOLDS.HIGH_CONFIDENCE) {
        confidence = 'high';
    } else if (best.finalScore >= THRESHOLDS.MEDIUM_CONFIDENCE) {
        confidence = 'medium';
    } else {
        confidence = 'low';
    }

    // Para confianza baja, marcar como ambiguo
    if (confidence === 'low') {
        return {
            bestMatch: best,
            allResults: results,
            decision: 'ambiguous',
            confidence: 'low',
            reason: `Score bajo (${best.finalScore}) - requiere verificación`,
            ambiguousCandidates: validResults.slice(0, 5).map(r => r.candidate),
        };
    }

    return {
        bestMatch: best,
        allResults: results,
        decision: 'assigned', // El matcher determinará si es assigned o to_update según el host
        confidence,
        reason: confidence === 'high'
            ? '-'
            : `Confianza media (score: ${best.finalScore})`,
    };
}

/**
 * Genera un log detallado del resultado del scoring (para debug)
 */
export function logScoringResult(rawProgram: string, result: ScoringResult): void {
    logger.debug(`📊 Score: ${result.finalScore}/${result.baseScore}`);
    logger.debug(`   Candidato: ${result.candidate.topic}`);
    if (result.penalties.length > 0) {
        logger.debug(`   Penalizaciones:`);
        result.penalties.forEach(p => {
            logger.debug(`     - ${p.name}: ${p.points} (${p.reason || ''})`);
        });
    } else {
        logger.debug(`   ✅ Sin penalizaciones`);
    }
    if (result.isDisqualified) {
        logger.debug(`   ❌ DESCALIFICADO`);
    }
}
