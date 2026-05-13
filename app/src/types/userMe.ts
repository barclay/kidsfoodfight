/** ``GET /api/v1/users/me`` and ``POST /api/v1/me/profile-photo`` response (snake_case). */

export interface UserMe {
  id: string;
  email: string;
  is_active: boolean;
  is_superuser: boolean;
  is_verified: boolean;
  display_name: string;
  timezone: string;
  created_at: string;
  last_seen_at: string | null;
  profile_photo_storage_url: string | null;
}
