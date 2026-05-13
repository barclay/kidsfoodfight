import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { loginWithEmailPassword } from '../lib/authApi';
import { fetchCurrentUser } from '../lib/usersApi';
import type { UserMe } from '../types/userMe';

const TOKEN_KEY = 'kff_access_token';

type AuthContextValue = {
  token: string | null;
  isReady: boolean;
  me: UserMe | null;
  refreshMe: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [me, setMe] = useState<UserMe | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        if (await SecureStore.isAvailableAsync()) {
          const stored = await SecureStore.getItemAsync(TOKEN_KEY);
          if (!cancelled && stored) {
            setToken(stored);
          }
        }
      } finally {
        if (!cancelled) {
          setIsReady(true);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshMe = useCallback(async () => {
    if (!token) {
      setMe(null);
      return;
    }
    try {
      const user = await fetchCurrentUser(token);
      setMe(user);
    } catch {
      setMe(null);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      void refreshMe();
    } else {
      setMe(null);
    }
  }, [token, refreshMe]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { access_token: accessToken } = await loginWithEmailPassword(email, password);
    if (await SecureStore.isAvailableAsync()) {
      await SecureStore.setItemAsync(TOKEN_KEY, accessToken);
    }
    setToken(accessToken);
  }, []);

  const signOut = useCallback(async () => {
    if (await SecureStore.isAvailableAsync()) {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
    setToken(null);
    setMe(null);
  }, []);

  const value = useMemo(
    () => ({
      token,
      isReady,
      me,
      refreshMe,
      signIn,
      signOut,
    }),
    [token, isReady, me, refreshMe, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
