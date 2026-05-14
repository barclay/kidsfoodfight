import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthenticatedStorageImage } from '../AuthenticatedStorageImage';
import { apiFetch } from '../api';

export interface AdminUserListItem {
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

const AVATAR = 22;

export function UsersListPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<AdminUserListItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await apiFetch('/api/v1/admin/users?limit=200');
      if (!res.ok) {
        setError(`Failed to load users (${res.status})`);
        return;
      }
      const data = (await res.json()) as AdminUserListItem[];
      if (!cancelled) setRows(data);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <p style={{ color: '#b91c1c' }}>{error}</p>;

  return (
    <div>
      <h1>Users</h1>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>
            <th style={{ padding: 8 }}>Display name</th>
            <th style={{ padding: 8 }}>Time zone</th>
            <th style={{ padding: 8 }}>Email</th>
            <th style={{ padding: 8 }}>Team</th>
            <th style={{ padding: 8 }}>Active</th>
            <th style={{ padding: 8 }}>Admin</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr
              key={u.id}
              className="admin-table-click-row"
              onClick={() => navigate(`/users/${u.id}`)}
            >
              <td style={{ padding: 8 }}>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  {u.profile_photo_storage_url ? (
                    <AuthenticatedStorageImage
                      storageUrl={u.profile_photo_storage_url}
                      alt=""
                      width={AVATAR}
                      height={AVATAR}
                      style={{
                        width: AVATAR,
                        height: AVATAR,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <span
                      aria-hidden
                      style={{
                        display: 'inline-block',
                        width: AVATAR,
                        height: AVATAR,
                        minWidth: AVATAR,
                        borderRadius: '50%',
                        backgroundColor: '#e5e7eb',
                        border: '1px solid #d1d5db',
                        flexShrink: 0,
                      }}
                    />
                  )}
                  {u.display_name}
                </div>
              </td>
              <td style={{ padding: 8 }}>{u.timezone}</td>
              <td style={{ padding: 8 }}>{u.email}</td>
              <td style={{ padding: 8 }}>{u.team ? u.team.name : '—'}</td>
              <td style={{ padding: 8 }}>{u.is_active ? 'yes' : 'no'}</td>
              <td style={{ padding: 8 }}>{u.is_superuser ? 'yes' : 'no'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
