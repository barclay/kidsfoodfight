import type { AvailableChallenge } from '../types/challenges';
import { api } from './api';

export async function fetchAvailableChallenges(token: string): Promise<AvailableChallenge[]> {
  return api.get<AvailableChallenge[]>('/challenges/available', token);
}
