/** ``GET /api/v1/users/me`` and ``POST /api/v1/me/profile-photo`` response (snake_case). */

export type LanguagePreference = 'system' | 'en' | 'es';

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
  /** Server copy of app language; null until the client has synced at least once. */
  language_preference: LanguagePreference | null;
}
