/**
 * Utilidad para normalizar cadenas para búsqueda difusa (fuzzy matching).
 * Portado de V1 'referencia/src/services/matching.py'
 * 
 * Las palabras irrelevantes ahora se cargan desde un archivo JSON externo
 * para facilitar el mantenimiento.
 */

import irrelevantWordsConfig from '../config/irrelevant-words.json';

/**
 * Construye el patrón regex desde la configuración JSON
 */
function buildIrrelevantWordsPattern(): RegExp {
    const allWords: string[] = [];

    // Agregar todas las palabras de categorías (palabras simples)
    for (const category of Object.values(irrelevantWordsConfig.categories)) {
        allWords.push(...category);
    }

    // Agregar patrones regex especiales
    allWords.push(...irrelevantWordsConfig.patterns.items);

    // Construir el patrón regex con word boundaries
    const pattern = "\\b(" + allWords.join("|") + ")\\b";
    return new RegExp(pattern, "gi");
}

// Construir el patrón una sola vez al cargar el módulo
const IRRELEVANT_WORDS_PATTERN = buildIrrelevantWordsPattern();

/**
 * Elimina palabras irrelevantes del texto basado en la lista configurada
 */
export function removeIrrelevant(text: string): string {
    if (!text) return "";
    return text.replace(IRRELEVANT_WORDS_PATTERN, " ").replace(/\s+/g, " ").trim();
}

/**
 * Lógica central de normalización.
 * 1. Pre-limpiar caracteres especiales (underscores a espacios)
 * 2. Eliminar palabras irrelevantes
 * 3. Normalizar Unicode (NFD)
 * 4. Eliminar signos diacríticos (acentos)
 * 5. Convertir a minúsculas y limpiar
 */
export function normalizeString(s: string): string {
    if (!s) return "";

    // 1. Pre-limpiar: Convertir underscores y guiones a espacios ANTES de eliminar palabras
    // Esto permite que "F2F_PER" se convierta en "F2F PER" y ambas palabras se eliminen
    let processed = s.replace(/[-_–—]/g, " ");

    // 2. Eliminar Palabras Irrelevantes
    processed = removeIrrelevant(processed);

    // 3. Normalizar Unicode (NFD - descompone caracteres)
    processed = processed.normalize("NFD");

    // 4. Eliminar caracteres combinados (acentos/diacríticos)
    processed = processed.replace(/[\u0300-\u036f]/g, "");

    // 5. Limpieza estándar (minúsculas, caracteres especiales a espacios)
    processed = processed
        .toLowerCase()
        .replace(/[''ʻ‚]/g, "'") // Normalizar comillas
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
