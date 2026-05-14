/** ``GET /api/v1/me/tournament-leaderboards`` (snake_case from API). */

export interface MeTournamentLeaderboardRow {
  rank: number;
  team_id: string;
  team_name: string;
  total_points: number;
  challenges_completed: number;
}

export interface MeActiveTournamentLeaderboard {
  tournament_id: string;
  tournament_name: string;
  rows: MeTournamentLeaderboardRow[];
}

export interface MeTournamentLeaderboardsPayload {
  my_team_id: string | null;
  active_leaderboards: MeActiveTournamentLeaderboard[];
}
