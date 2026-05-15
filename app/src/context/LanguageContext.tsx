import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import i18n, { detectDeviceLanguage, type AppLanguage } from '../i18n/config';

const STORAGE_KEY = '@kff/language_preference';

export type LanguagePreference = 'system' | AppLanguage;

type LanguageContextValue = {
  /** Resolved UI language after applying preference and device locale. */
  language: AppLanguage;
  preference: LanguagePreference;
  setPreference: (next: LanguagePreference) => Promise<void>;
  isReady: boolean;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function resolveLanguage(preference: LanguagePreference): AppLanguage {
  if (preference === 'system') {
    return detectDeviceLanguage();
  }
  return preference;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<LanguagePreference>('system');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && (raw === 'en' || raw === 'es' || raw === 'system')) {
          setPreferenceState(raw);
        }
      } finally {
        if (!cancelled) {
          setIsReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const language = useMemo(() => resolveLanguage(preference), [preference]);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    void i18n.changeLanguage(language);
  }, [isReady, language]);

  const setPreference = useCallback(async (next: LanguagePreference) => {
    setPreferenceState(next);
    await AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo(
    () => ({
      language,
      preference,
      setPreference,
      isReady,
    }),
    [language, preference, setPreference, isReady],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return ctx;
}
