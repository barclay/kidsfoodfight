import type { MeTournamentLeaderboardsPayload } from '../types/tournamentLeaderboard';
import { api } from './api';

export function fetchMeTournamentLeaderboards(token: string): Promise<MeTournamentLeaderboardsPayload> {
  return api.get<MeTournamentLeaderboardsPayload>('/me/tournament-leaderboards', token);
}
