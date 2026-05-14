import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AuthenticatedStorageImage } from '../AuthenticatedStorageImage';
import { apiFetch } from '../api';

interface AdminUserDetail {
  id: string;
  email: string;
  display_name: string;
  timezone: string;
  is_active: boolean;
  is_superuser: boolean;
  is_verified: boolean;
  created_at: string;
  last_seen_at: string | null;
  team_id: string | null;
  team: { id: string; name: string; invite_code: string } | null;
  profile_photo_storage_url?: string | null;
}

const PHOTO_SIZE = 160;

export function UserViewPage() {
  const { userId } = useParams<{ userId: string }>();
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const res = await apiFetch(`/api/v1/admin/users/${userId}`);
      if (!res.ok) {
        if (!cancelled) setError('User not found');
        return;
      }
      const u = (await res.json()) as AdminUserDetail;
      if (!cancelled) {
        setUser(u);
        setError(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (error && !user) return <p style={{ color: '#b91c1c' }}>{error}</p>;
  if (!user) return <p>Loading…</p>;

  return (
    <div>
      <p>
        <Link to="/users">← Users</Link>
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>{user.display_name}</h1>
        <Link
          to={`/users/${user.id}/edit`}
          style={{
            padding: '8px 16px',
            background: '#111',
            color: '#fff',
            textDecoration: 'none',
            borderRadius: 6,
            fontSize: 14,
          }}
        >
          Edit
        </Link>
      </div>

      <div style={{ marginTop: 20, display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Profile photo</div>
          {user.profile_photo_storage_url ? (
            <AuthenticatedStorageImage
              storageUrl={user.profile_photo_storage_url}
              alt=""
              width={PHOTO_SIZE}
              height={PHOTO_SIZE}
              style={{
                width: PHOTO_SIZE,
                height: PHOTO_SIZE,
                borderRadius: '50%',
                objectFit: 'cover',
                display: 'block',
                border: '1px solid #e5e7eb',
              }}
            />
          ) : (
            <div
              aria-hidden
              style={{
                width: PHOTO_SIZE,
                height: PHOTO_SIZE,
                borderRadius: '50%',
                backgroundColor: '#e5e7eb',
                border: '1px solid #d1d5db',
              }}
            />
          )}
        </div>

        <dl style={{ margin: 0, minWidth: 260, flex: '1 1 280px' }}>
          <dt style={{ fontWeight: 600, marginTop: 8 }}>Email</dt>
          <dd style={{ margin: 0 }}>{user.email}</dd>
          <dt style={{ fontWeight: 600, marginTop: 8 }}>Time zone</dt>
          <dd style={{ margin: 0 }}>{user.timezone}</dd>
          <dt style={{ fontWeight: 600, marginTop: 8 }}>Active</dt>
          <dd style={{ margin: 0 }}>{user.is_active ? 'yes' : 'no'}</dd>
          <dt style={{ fontWeight: 600, marginTop: 8 }}>Superuser</dt>
          <dd style={{ margin: 0 }}>{user.is_superuser ? 'yes' : 'no'}</dd>
          <dt style={{ fontWeight: 600, marginTop: 8 }}>Verified email</dt>
          <dd style={{ margin: 0 }}>{user.is_verified ? 'yes' : 'no'}</dd>
          <dt style={{ fontWeight: 600, marginTop: 8 }}>Created</dt>
          <dd style={{ margin: 0 }}>{new Date(user.created_at).toLocaleString()}</dd>
          <dt style={{ fontWeight: 600, marginTop: 8 }}>Last seen</dt>
          <dd style={{ margin: 0 }}>{user.last_seen_at ? new Date(user.last_seen_at).toLocaleString() : '—'}</dd>
          <dt style={{ fontWeight: 600, marginTop: 8 }}>Team</dt>
          <dd style={{ margin: 0 }}>
            {user.team ? (
              <Link to={`/teams/${user.team.id}`}>
                {user.team.name} ({user.team.invite_code})
              </Link>
            ) : (
              '—'
            )}
          </dd>
        </dl>
      </div>
    </div>
  );
}
