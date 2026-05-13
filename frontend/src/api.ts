const TOKEN_KEY = 'kff_admin_token';

export function getApiBase(): string {
  const v = import.meta.env.VITE_API_URL as string | undefined;
  if (v === '') {
    return '';
  }
  if (v === undefined) {
    return 'http://localhost:8000';
  }
  return v;
}

/** Path for ``apiFetch`` (Bearer auth). ``storageUrl`` is a ``data/...`` key. */
export function mediaPathFromStoragePath(storageUrl: string): string {
  const pathSegments = storageUrl.split('/').map(encodeURIComponent).join('/');
  return `/api/v1/media/${pathSegments}`;
}

/** Absolute URL (no auth); ``<img src>`` will **not** work for JWT-protected media—use ``AuthenticatedStorageImage``. */
export function mediaUrlFromStoragePath(storageUrl: string): string {
  const base = getApiBase().replace(/\/$/, '');
  return `${base}${mediaPathFromStoragePath(storageUrl)}`;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token === null) {
    localStorage.removeItem(TOKEN_KEY);
  } else {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(`${getApiBase()}${path}`, { ...init, headers });
}

/** Fetch media with admin JWT and open in a new tab (object URL; revoked after 2 minutes). */
export async function openAuthenticatedMediaInNewTab(storageUrl: string): Promise<boolean> {
  try {
    const res = await apiFetch(mediaPathFromStoragePath(storageUrl));
    if (!res.ok) return false;
    const blob = await res.blob();
    const u = URL.createObjectURL(blob);
    window.open(u, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(u), 120_000);
    return true;
  } catch {
    return false;
  }
}

/** Token URL expects form field `username` (OAuth2); value must be the user's email. */
export async function login(email: string, password: string): Promise<void> {
  const body = new URLSearchParams({ username: email, password });
  const res = await fetch(`${getApiBase()}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(err.detail ?? `Login failed (${res.status})`);
  }
  const data = (await res.json()) as { access_token: string };
  setToken(data.access_token);
}
