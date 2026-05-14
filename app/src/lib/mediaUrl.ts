import { getApiBaseUrl } from './apiBaseUrl';

/** Build ``GET /api/v1/media/...`` URL for a ``data/...`` storage key (matches backend quoting). */
export function mediaUrlForStorageKey(storageKey: string): string {
  const encoded = storageKey.split('/').map(encodeURIComponent).join('/');
  return `${getApiBaseUrl()}/media/${encoded}`;
}
