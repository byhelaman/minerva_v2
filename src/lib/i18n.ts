import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from '../locales/en.json';
import es from '../locales/es.json';
import fr from '../locales/fr.json';

i18n
    // detectar idioma del usuario
    // saber más: https://github.com/i18next/i18next-browser-languageDetector
    .use(LanguageDetector)
    // pasar la instancia i18n a react-i18next.
    .use(initReactI18next)
    // inicializar i18next
    // para todas las opciones leer: https://www.i18next.com/overview/configuration-options
    .init({
        debug: true,
        fallbackLng: 'en',
        detection: {
            // Solo usar localStorage, ignorando navigator (idioma del sistema)
            order: ['localStorage'],
            // Guardar idioma del usuario en localStorage
            caches: ['localStorage'],
        },
        interpolation: {
            escapeValue: false, // no es necesario para react ya que escapa por defecto
        },
        resources: {
            en: {
                translation: en
            },
            es: {
                translation: es
            },
            fr: {
                translation: fr
            }
        }
    });

export default i18n;
