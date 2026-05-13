import type { UserMe } from '../types/userMe';
import { api } from './api';

export async function fetchCurrentUser(token: string): Promise<UserMe> {
  return api.get<UserMe>('/users/me', token);
}
