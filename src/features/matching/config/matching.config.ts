/**
 * Configuración del Sistema de Matching
 * 
 * Este archivo contiene toda la configuración del sistema de scoring,
 * incluyendo penalizaciones, umbrales y tokens estructurales.
 */

// ============================================================================
// PENALIZACIONES
// ============================================================================

export const PENALTIES = {
    // Descartadores (score <= 0 después de aplicar)
    CRITICAL_TOKEN_MISMATCH: -100,  // CH vs TRIO vs DUO
    LEVEL_CONFLICT: -100,           // L3 vs L2
    COMPANY_CONFLICT: -100,         // Scopibank vs Hayduk

    // Severos
    PROGRAM_VS_PERSON: -80,         // Query es programa, topic es persona
    STRUCTURAL_TOKEN_MISSING: -50,  // TRIO en query pero no en topic
    WEAK_MATCH: -80,                // No hay coincidencias distintivas (aumentado de -50)
    MISSING_TOKEN: -70,             // Falta un token distintivo individual (Aumentado para rechazar falsos positivos)
    MISSING_NUMERIC_TOKEN: -20,     // Falta un número suelto (Tratar como nivel implícito faltante, penalidad baja)
    MISSING_TOKEN_EXTRA_INFO: -10,  // Token extra información (si ya se cubrió el topic base >= 2 tokens)
    GROUP_NUMBER_CONFLICT: -80,     // CH 1 vs CH 3 (aumentado para rechazo estricto)
    NUMERIC_CONFLICT: -30,          // Números no coinciden

    // Leves (causan ambigüedad)
    ORPHAN_NUMBER_WITH_SIBLINGS: -60, // Número en topic no en query + hay hermanos (AUMENTADO para evitar asignar general a específico)
    ORPHAN_LEVEL_WITH_SIBLINGS: -60,  // Nivel en topic no en query + hay hermanos (AUMENTADO para evitar asignar general a específico)

    // Informativas (no afectan mucho, solo para ranking)
    LEVEL_MISMATCH_IGNORED: -10,      // Nivel diferente pero ignorado por configuración (para detección de duplicados)
} as const;

// ============================================================================
// UMBRALES DE DECISIÓN
// ============================================================================

export const THRESHOLDS = {
    // Score mínimo para match confiable
    HIGH_CONFIDENCE: 70,

    // Score mínimo para match con warning
    MEDIUM_CONFIDENCE: 50,

    // Score mínimo para considerar (por debajo = not_found)
    MINIMUM: 30,

    // Diferencia máxima de score entre candidatos para considerar ambiguo
    AMBIGUITY_DIFF: 15,

    // Fuse.js score máximo aceptable
    FUSE_MAX_SCORE: 0.3,

    // Token overlap mínimo para Token Set Match
    TOKEN_OVERLAP_MIN: 0.5,
    MIN_MATCHING_TOKENS: 2,
} as const;

// ============================================================================
// SCORE BASE
// ============================================================================

export const BASE_SCORE = 100;

// ============================================================================
// TOKENS ESTRUCTURALES Y SINÓNIMOS
// ============================================================================

/**
 * Grupos de sinónimos - tokens dentro del mismo grupo son equivalentes
 * para propósitos de matching estructural
 */
export const SYNONYM_GROUPS = [
    ['duo', 'bvd'],     // Duo y su abreviatura
    ['privado', 'bvp'], // Privado y su abreviatura
    ['trio'],           // TRIO (sin sinónimos)
    ['ch'],             // CH (sin sinónimos)
    // Nota: BVS no está en ningún grupo porque es genérico/variable
] as const;

/**
 * Tokens de tipo de programa - usados para:
 * 1. Detectar conflictos críticos (CH vs TRIO vs DUO vs BVP vs BVS)
 * 2. Excluir al contar tokens distintivos en scoring
 * 
 * NOTA: Estos NO se eliminan en normalización para poder detectar conflictos
 */
export const STRUCTURAL_TOKENS = new Set([
    'duo', 'trio', 'ch', 'bvd', 'bvp', 'bvs', 'privado'
]);

/**
 * Tipos de programa que indican que una query busca un programa
 * (no una persona)
 */
export const PROGRAM_TYPES = new Set(['trio', 'duo', 'ch', 'bvd', 'bvp', 'bvs']);

// ============================================================================
// PATRONES REGEX
// ============================================================================

/**
 * Patrón para detectar indicadores de nivel (L3, N4, Level 5, Nivel 3)
 */
export const LEVEL_PATTERN = /\b(?:l|n|level|nivel)\s*(\d+)\b/gi;

/**
 * Patrón para detectar formato de persona
 * 
 * Formatos de Schedule (80% de casos aprox):
 *   "Apellido(s) (EMPRESA/PAIS)(MODALIDAD), Nombre(s)"
 *   Ejemplos:
 *   - Garcia Lopez (EMPRESA)(Online), Juan Carlos
 *   - Martinez Ruiz (ACME)(ONLINE), Maria Elena
 * 
 * Formatos de Zoom Topic:
 *   "NOMBRE APELLIDO APELLIDO - INFO (ONLINE)"
 *   Ejemplos:
 *   - JUAN GARCIA LOPEZ - KEYNOTES ADVANCED (ONLINE)
 *   - BVP - MARIA MARTINEZ RUIZ - L1 (ONLINE)
 */
export const PERSON_FORMAT_PATTERNS = [
    // Formato Schedule: "Apellido (...)(...), Nombre" - uno o más paréntesis seguido de coma
    /^\s*[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+.*\([^)]+\).*,\s*[A-ZÁÉÍÓÚÑ]/,

    // Formato Zoom: "NOMBRE APELLIDO APELLIDO - INFO" - mayúsculas con guión separador
    // Permite espacios al inicio y múltiples espacios alrededor del guión
    /^\s*[A-ZÁÉÍÓÚÑ]+\s+[A-ZÁÉÍÓÚÑ]+\s+[A-ZÁÉÍÓÚÑ]+\s+-\s*/,

    // Formato Zoom con BVP/BVD: "BVP - NOMBRE APELLIDO APELLIDO"
    /^\s*BV[PDS]\s*-\s*[A-ZÁÉÍÓÚÑ]+\s+[A-ZÁÉÍÓÚÑ]+/i,

    // Formato: "NOMBRE NOMBRE NOMBRE NOMBRE (" - 4+ palabras en mayúsculas
    /^\s*[A-ZÁÉÍÓÚÑ]+\s+[A-ZÁÉÍÓÚÑ]+\s+[A-ZÁÉÍÓÚÑ]+\s+[A-ZÁÉÍÓÚÑ]+\s*\(/,
];
