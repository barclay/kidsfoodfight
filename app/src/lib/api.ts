import { getApiBaseUrl } from './apiBaseUrl';
import i18n from '../i18n/config';

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (!headers['Accept-Language'] && i18n.language) {
    headers['Accept-Language'] = i18n.language;
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail ?? `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string, token?: string) =>
    request<T>(path, { method: 'GET' }, token),

  post: <T>(path: string, body: unknown, token?: string) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }, token),

  put: <T>(path: string, body: unknown, token?: string) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }, token),

  patch: <T>(path: string, body: unknown, token?: string) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }, token),

  delete: <T>(path: string, token?: string) =>
    request<T>(path, { method: 'DELETE' }, token),
};
