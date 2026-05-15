import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resources } from './resources';

export type AppLanguage = 'en' | 'es';

export function detectDeviceLanguage(): AppLanguage {
  const code = Localization.getLocales()[0]?.languageCode?.toLowerCase() ?? 'en';
  return code.startsWith('es') ? 'es' : 'en';
}

void i18n.use(initReactI18next).init({
  resources,
  lng: detectDeviceLanguage(),
  fallbackLng: 'en',
  compatibilityJSON: 'v4',
  interpolation: { escapeValue: false },
});

export default i18n;
