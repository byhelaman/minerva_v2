/**
 * Rate Limiter para intentos de login
 * 
 * Implementa un sistema de lockout progresivo:
 * - Después de MAX_ATTEMPTS intentos fallidos, bloquea por LOCKOUT_DURATION
 * - El lockout se incrementa con cada bloqueo consecutivo
 * - Se resetea después de un login exitoso
 * - Estado persistido en localStorage para sobrevivir recargas
 */

import { STORAGE_KEYS } from "@/lib/constants";

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 30; // segundos
const LOCKOUT_MULTIPLIER = 2; // cada lockout duplica el tiempo
const STORAGE_KEY = STORAGE_KEYS.RATE_LIMIT;

interface RateLimitState {
    attempts: number;
    lockoutUntil: number | null;
    lockoutCount: number;
}

// Cargar estado desde localStorage o usar valores por defecto
function loadState(): RateLimitState {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch {
        // Si hay error parseando, usar valores por defecto
    }
    return {
        attempts: 0,
        lockoutUntil: null,
        lockoutCount: 0,
    };
}

// Guardar estado en localStorage
function saveState(state: RateLimitState): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        // Ignorar errores de localStorage (quota, etc.)
    }
}

// Estado inicial cargado desde localStorage
let state: RateLimitState = loadState();

/**
 * Verifica si el usuario está bloqueado
 */
export function isLockedOut(): { locked: boolean; remainingSeconds: number } {
    if (!state.lockoutUntil) {
        return { locked: false, remainingSeconds: 0 };
    }

    const now = Date.now();
    if (now >= state.lockoutUntil) {
        // Lockout expiró
        state.lockoutUntil = null;
        saveState(state);
        return { locked: false, remainingSeconds: 0 };
    }

    const remainingSeconds = Math.ceil((state.lockoutUntil - now) / 1000);
    return { locked: true, remainingSeconds };
}

/**
 * Registra un intento fallido de login
 * Retorna true si el usuario ha sido bloqueado
 */
export function recordFailedAttempt(): boolean {
    state.attempts++;

    if (state.attempts >= MAX_ATTEMPTS) {
        // Calcular duración del lockout (progresivo)
        const duration = LOCKOUT_DURATION * Math.pow(LOCKOUT_MULTIPLIER, state.lockoutCount);
        state.lockoutUntil = Date.now() + (duration * 1000);
        state.lockoutCount++;
        state.attempts = 0;
        saveState(state);
        return true;
    }

    saveState(state);
    return false;
}

/**
 * Resetea el contador después de un login exitoso
 */
export function resetAttempts(): void {
    state.attempts = 0;
    state.lockoutUntil = null;
    state.lockoutCount = 0;
    saveState(state);
}

/**
 * Obtiene el número de intentos restantes
 */
export function getRemainingAttempts(): number {
    return Math.max(0, MAX_ATTEMPTS - state.attempts);
}
