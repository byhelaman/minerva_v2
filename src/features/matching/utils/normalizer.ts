/**
 * Utilidad para normalizar cadenas para búsqueda difusa (fuzzy matching).
 * Portado de V1 'referencia/src/services/matching.py'
 */

// Lista de palabras irrelevantes para eliminar de las cadenas antes de comparar
// Port exacto del regex de Python
const IRRELEVANT_WORDS_PATTERN = new RegExp(
    "\\b(" +
    [
        // Modalidades
        "online",
        "presencial",
        "virtual",
        "hibrido",
        "remoto",
        // Idiomas
        "english",
        "ingles",
        "espanol",
        "aleman",
        "coreano",
        "chino",
        "ruso",
        "japones",
        "frances",
        "italiano",
        "mandarin",
        // Niveles y cursos
        "nivelacion",
        "beginner",
        "electiv[oa]s?",
        "leccion[es]?",
        "repit[eo]?",
        "repaso",
        "crash",
        "complete",
        "revision",
        "evaluacion[es]?",
        // Organización / estructura
        // "grupo", // Comentado en el código fuente original V1
        "bvp",
        "bvd",
        "bvs",
        "pia",
        "mod",
        "esp",
        // "l\d+", // Comentado en el código fuente original V1
        "otg",
        "kids",
        "look\\s?\\d+", // Ajustado para escape de strings en JS
        "tz\\d+",       // Ajustado para escape de strings en JS
        "impact",
        "keynote",
        "advanced",
        "time",
        "zone",
        // Ubicación / país
        "per",
        "ven",
        "arg",
        "uru",
        // Otros
        "true",
        "business",
        "social",
        "travel",
        "gerencia",
        "beca",
        "camacho",
    ].join("|") +
    ")\\b",
    "gi" // Global + Case Insensitive
);

/**
 * Elimina palabras irrelevantes del texto basado en la lista regex
 */
export function removeIrrelevant(text: string): string {
    if (!text) return "";
    return text.replace(IRRELEVANT_WORDS_PATTERN, " ").replace(/\s+/g, " ").trim();
}

/**
 * Lógica central de normalización.
 * 1. Eliminar palabras irrelevantes
 * 2. Normalizar Unicode (NFD)
 * 3. Eliminar signos diacríticos (acentos)
 * 4. Convertir a minúsculas y limpiar
 */
export function normalizeString(s: string): string {
    if (!s) return "";

    // 1. Eliminar Palabras Irrelevantes
    let processed = removeIrrelevant(s);

    // 2. Normalizar Unicode (NFD - descompone caracteres)
    processed = processed.normalize("NFD");

    // 3. Eliminar caracteres combinados (acentos/diacríticos)
    processed = processed.replace(/[\u0300-\u036f]/g, "");

    // 4. Limpieza estándar (minúsculas, caracteres especiales a espacios)
    processed = processed
        .toLowerCase()
        .replace(/[’‘ʻ‚]/g, "'") // Normalizar comillas
        .replace(/[-_–—]/g, " ") // Normalizar guiones
        .replace(/[^\w\s']/g, " ") // Eliminar caracteres especiales (mantener espacios y comillas)
        .replace(/\s+/g, " ") // Colapsar espacios múltiples
        .trim();

    return processed;
}

/**
 * Normalización canónica (más estricta, elimina todo lo no alfanumérico)
 * Usado para coincidencias exactas de ID si es necesario.
 */
export function canonical(s: string): string {
    return normalizeString(s).replace(/\W+/g, "");
}
