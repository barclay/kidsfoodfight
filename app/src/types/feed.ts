/** Response shape from ``GET /api/v1/feed/posts`` (snake_case). */

export interface FeedPostPhoto {
  sort_order: number;
  url: string;
  description?: string | null;
}

export interface FeedPostItem {
  id: string;
  created_at: string;
  author_display_name: string;
  author_profile_photo_url?: string | null;
  author_team_name?: string | null;
  challenge_title: string;
  comment: string | null;
  approved: boolean;
  photos: FeedPostPhoto[];
}
