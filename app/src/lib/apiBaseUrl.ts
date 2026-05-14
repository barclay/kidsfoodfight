import Constants from 'expo-constants';

const DEFAULT_FALLBACK = 'http://localhost:8000/api/v1';

function stripTrailingSlashes(url: string): string {
  return url.replace(/\/+$/, '');
}

/**
 * API origin + ``/api/v1`` prefix, from Expo ``extra.apiUrl`` (set in ``app.config.js``)
 * or ``EXPO_PUBLIC_API_URL`` as a last resort.
 *
 * In Expo Go, ``Constants.expoConfig`` / ``Constants.manifest`` can throw
 * ``ERR_CONSTANTS_MANIFEST_UNAVAILABLE`` before the dev manifest is attached; we catch
 * that so startup never surfaces a RedBox for manifest timing (RedBox + Fabric has
 * crashed native Expo Go on some simulator / OS builds).
 */
function apiUrlFromExtra(extra: unknown): string | null {
  if (extra && typeof extra === 'object' && 'apiUrl' in extra) {
    const v = (extra as { apiUrl: unknown }).apiUrl;
    if (typeof v === 'string' && v.trim().length > 0) {
      return stripTrailingSlashes(v.trim());
    }
  }
  return null;
}

export function getApiBaseUrl(): string {
  try {
    const fromExpo = apiUrlFromExtra(Constants.expoConfig?.extra);
    if (fromExpo) return fromExpo;
  } catch {
    /* Expo Go: manifest not ready yet */
  }
  try {
    const manifest = (Constants as { manifest?: { extra?: Record<string, unknown> } | null })
      .manifest;
    const fromManifest = apiUrlFromExtra(manifest?.extra);
    if (fromManifest) return fromManifest;
  } catch {
    /* same as above */
  }
  if (
    typeof process.env.EXPO_PUBLIC_API_URL === 'string' &&
    process.env.EXPO_PUBLIC_API_URL.trim().length > 0
  ) {
    return stripTrailingSlashes(process.env.EXPO_PUBLIC_API_URL.trim());
  }
  return DEFAULT_FALLBACK;
}
