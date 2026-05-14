/** ``GET /api/v1/challenges/joinable-tournaments`` (snake_case from API). */

export interface JoinableTournament {
  tournament_id: string;
  tournament_name: string;
  current_local_day: number;
  length_days: number;
}
