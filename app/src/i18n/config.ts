import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resources } from './resources';

export type AppLanguage = 'en' | 'es';

/**
 * Device UI language without `expo-localization` (avoids native module / rebuild issues).
 * Uses the same ICU locale Hermes exposes via `Intl`.
 */
export function detectDeviceLanguage(): AppLanguage {
  try {
    const tag = Intl.DateTimeFormat().resolvedOptions().locale ?? 'en';
    const code = tag.split(/[-_]/)[0]?.toLowerCase() ?? 'en';
    return code.startsWith('es') ? 'es' : 'en';
  } catch {
    return 'en';
  }
}

void i18n.use(initReactI18next).init({
  resources,
  lng: detectDeviceLanguage(),
  fallbackLng: 'en',
  compatibilityJSON: 'v4',
  interpolation: { escapeValue: false },
});

export default i18n;
