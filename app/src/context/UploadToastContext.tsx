import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../lib/colors';

export type UploadToastTask = {
  title: string;
  /** Shown briefly after a successful upload (default: "Done"). */
  successMessage?: string;
  run: (onProgress: (fraction: number) => void) => Promise<unknown>;
};

type ToastState =
  | { mode: 'hidden' }
  | { mode: 'progress'; title: string; progress: number; indeterminate: boolean }
  | { mode: 'success'; message: string }
  | { mode: 'error'; message: string };

type UploadToastContextValue = {
  enqueueUpload: (task: UploadToastTask) => void;
};

const UploadToastContext = createContext<UploadToastContextValue | null>(null);

function UploadToastOverlay({ state }: { state: ToastState }) {
  const insets = useSafeAreaInsets();
  if (state.mode === 'hidden') {
    return null;
  }

  return (
    <View
      style={[styles.overlayRoot, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}
      pointerEvents="none"
    >
      <View style={styles.card}>
        {state.mode === 'progress' ? (
          <>
            <Text style={styles.title}>{state.title}</Text>
            <View style={styles.track}>
              {state.indeterminate ? (
                <View style={styles.indeterminateRow}>
                  <ActivityIndicator color={Colors.teal} size="small" />
                </View>
              ) : (
                <View style={[styles.fill, { width: `${Math.round(state.progress * 100)}%` }]} />
              )}
            </View>
          </>
        ) : null}
        {state.mode === 'success' ? (
          <Text style={styles.successText}>{state.message}</Text>
        ) : null}
        {state.mode === 'error' ? <Text style={styles.errorText}>{state.message}</Text> : null}
      </View>
    </View>
  );
}

export function UploadToastProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [state, setState] = useState<ToastState>({ mode: 'hidden' });
  const queueRef = useRef<UploadToastTask[]>([]);
  const pumpingRef = useRef(false);

  const runTask = useCallback(
    async (task: UploadToastTask) => {
      setState({ mode: 'progress', title: task.title, progress: 0, indeterminate: true });
      try {
        await task.run((fraction) => {
          setState((prev) => {
            if (prev.mode !== 'progress') {
              return prev;
            }
            if (fraction < 0) {
              return { ...prev, indeterminate: true };
            }
            return {
              mode: 'progress',
              title: prev.title,
              progress: Math.min(1, Math.max(0, fraction)),
              indeterminate: false,
            };
          });
        });
        setState({ mode: 'success', message: task.successMessage ?? t('uploadToast.done') });
        await new Promise<void>((r) => setTimeout(r, 1600));
      } catch (e) {
        const message = e instanceof Error ? e.message : t('uploadToast.failed');
        setState({ mode: 'error', message });
        await new Promise<void>((r) => setTimeout(r, 3800));
      }
      setState({ mode: 'hidden' });
    },
    [t],
  );

  const pump = useCallback(async () => {
    if (pumpingRef.current) {
      return;
    }
    const next = queueRef.current.shift();
    if (!next) {
      return;
    }
    pumpingRef.current = true;
    try {
      await runTask(next);
    } finally {
      pumpingRef.current = false;
      if (queueRef.current.length > 0) {
        void pump();
      }
    }
  }, [runTask]);

  const enqueueUpload = useCallback(
    (task: UploadToastTask) => {
      queueRef.current.push(task);
      void pump();
    },
    [pump],
  );

  const value = useMemo(() => ({ enqueueUpload }), [enqueueUpload]);

  return (
    <UploadToastContext.Provider value={value}>
      {children}
      <UploadToastOverlay state={state} />
    </UploadToastContext.Provider>
  );
}

export function useUploadToast(): UploadToastContextValue {
  const ctx = useContext(UploadToastContext);
  if (!ctx) {
    throw new Error('useUploadToast must be used within UploadToastProvider');
  }
  return ctx;
}

const styles = StyleSheet.create({
  overlayRoot: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    zIndex: 9999,
    elevation: 24,
  },
  card: {
    minWidth: '88%',
    maxWidth: 420,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: Colors.teal,
  },
  indeterminateRow: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  successText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.lime,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.red,
  },
});
