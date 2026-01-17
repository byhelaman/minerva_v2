/**
 * Logger con niveles para el sistema de matching
 * 
 * En desarrollo: muestra todos los niveles (debug, info, warn, error)
 * En producción: solo muestra warn y error
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

// En producción solo mostrar warn y error
const getCurrentLevel = (): LogLevel => {
    // import.meta.env.DEV es true en desarrollo
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
        return 'debug';
    }
    return 'warn';
};

const shouldLog = (level: LogLevel): boolean => {
    const currentLevel = getCurrentLevel();
    return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
};

/**
 * Logger configurable por niveles
 * 
 * @example
 * logger.debug('Detalles de matching:', data);
 * logger.info('Match encontrado');
 * logger.warn('Múltiples candidatos');
 * logger.error('Error en scoring');
 * 
 * // Grupos colapsados
 * logger.group('🔍 Match: Programa X');
 * logger.debug('Paso 1...');
 * logger.groupEnd();
 */
export const logger = {
    debug: (...args: unknown[]): void => {
        if (shouldLog('debug')) {
            console.log(...args);
        }
    },

    info: (...args: unknown[]): void => {
        if (shouldLog('info')) {
            console.info(...args);
        }
    },

    warn: (...args: unknown[]): void => {
        if (shouldLog('warn')) {
            console.warn(...args);
        }
    },

    error: (...args: unknown[]): void => {
        if (shouldLog('error')) {
            console.error(...args);
        }
    },

    /**
     * Grupo colapsado - en producción no muestra nada
     */
    group: (label: string): void => {
        if (shouldLog('debug')) {
            console.groupCollapsed(label);
        }
    },

    groupEnd: (): void => {
        if (shouldLog('debug')) {
            console.groupEnd();
        }
    },
};

export default logger;
