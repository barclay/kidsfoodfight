const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

/** Build ``GET /api/v1/media/...`` URL for a ``data/...`` storage key (matches backend quoting). */
export function mediaUrlForStorageKey(storageKey: string): string {
  const encoded = storageKey.split('/').map(encodeURIComponent).join('/');
  return `${API_BASE_URL}/media/${encoded}`;
}
