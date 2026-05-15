import type { LanguagePreference, UserMe } from '../types/userMe';
import { api } from './api';

export async function fetchCurrentUser(token: string): Promise<UserMe> {
  return api.get<UserMe>('/users/me', token);
}

export async function patchCurrentUser(
  token: string,
  body: { language_preference: LanguagePreference },
): Promise<UserMe> {
  return api.patch<UserMe>('/users/me', body, token);
}
