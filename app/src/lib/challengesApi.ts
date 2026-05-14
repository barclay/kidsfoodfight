import type { AvailableChallenge } from '../types/challenges';
import type { JoinableTournament } from '../types/joinableTournament';
import { api } from './api';

export async function fetchAvailableChallenges(token: string): Promise<AvailableChallenge[]> {
  return api.get<AvailableChallenge[]>('/challenges/available', token);
}

export async function fetchJoinableTournaments(token: string): Promise<JoinableTournament[]> {
  return api.get<JoinableTournament[]>('/challenges/joinable-tournaments', token);
}

export async function joinTournament(
  token: string,
  tournamentId: string,
): Promise<{ tournament_id: string; tournament_name: string }> {
  return api.post<{ tournament_id: string; tournament_name: string }>(
    '/challenges/join-tournament',
    { tournament_id: tournamentId },
    token,
  );
}
