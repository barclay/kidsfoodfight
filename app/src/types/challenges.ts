/** Response items from ``GET /api/v1/challenges/available`` (snake_case). */

export interface AvailableChallenge {
  id: string;
  tournament_id: string;
  tournament_name: string;
  title: string;
  description: string | null;
  challenge_type: string;
  points: number;
  day: number;
  is_focus_day: boolean;
}
