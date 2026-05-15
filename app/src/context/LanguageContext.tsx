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
import { patchCurrentUser } from '../lib/usersApi';
import type { LanguagePreference } from '../types/userMe';
import { useAuth } from './AuthContext';

export type { LanguagePreference } from '../types/userMe';

const STORAGE_KEY = '@kff/language_preference';

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

function isStoredPreference(raw: string | null): raw is LanguagePreference {
  return raw === 'en' || raw === 'es' || raw === 'system';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { token, me, refreshMe } = useAuth();
  const [preference, setPreferenceState] = useState<LanguagePreference>('system');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && isStoredPreference(raw)) {
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

  /** When the account has a saved preference, treat the server as source of truth. */
  useEffect(() => {
    if (!isReady || !me?.language_preference) {
      return;
    }
    const server = me.language_preference;
    setPreferenceState((prev) => {
      if (prev === server) {
        return prev;
      }
      void AsyncStorage.setItem(STORAGE_KEY, server);
      return server;
    });
  }, [isReady, me?.language_preference]);

  const language = useMemo(() => resolveLanguage(preference), [preference]);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    void i18n.changeLanguage(language);
  }, [isReady, language]);

  const setPreference = useCallback(
    async (next: LanguagePreference) => {
      setPreferenceState(next);
      await AsyncStorage.setItem(STORAGE_KEY, next);
      if (token) {
        try {
          await patchCurrentUser(token, { language_preference: next });
          await refreshMe();
        } catch {
          // Local preference still applied; sync can retry on next sign-in.
        }
      }
    },
    [token, refreshMe],
  );

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
