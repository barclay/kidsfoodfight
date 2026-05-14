import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../api';

export interface AdminTeamListItem {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
  member_count: number;
}

export function TeamsListPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<AdminTeamListItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await apiFetch('/api/v1/admin/teams?limit=100');
      if (!res.ok) {
        setError(`Failed to load teams (${res.status})`);
        return;
      }
      const data = (await res.json()) as AdminTeamListItem[];
      if (!cancelled) setRows(data);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <p style={{ color: '#b91c1c' }}>{error}</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Teams</h1>
        <Link
          to="/teams/create"
          style={{
            padding: '8px 16px',
            background: '#111',
            color: '#fff',
            textDecoration: 'none',
            borderRadius: 6,
            fontSize: 14,
          }}
        >
          Create team
        </Link>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>
            <th style={{ padding: 8 }}>Name</th>
            <th style={{ padding: 8 }}>Invite code</th>
            <th style={{ padding: 8 }}>Members</th>
            <th style={{ padding: 8 }}>Created</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr
              key={t.id}
              className="admin-table-click-row"
              onClick={() => navigate(`/teams/${t.id}`)}
            >
              <td style={{ padding: 8 }}>{t.name}</td>
              <td style={{ padding: 8 }}>
                <code>{t.invite_code}</code>
              </td>
              <td style={{ padding: 8 }}>{t.member_count}</td>
              <td style={{ padding: 8 }}>{new Date(t.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? <p style={{ color: '#666', marginTop: 16 }}>No teams yet.</p> : null}
    </div>
  );
}
