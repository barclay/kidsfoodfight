import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api';

interface TournamentRow {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  length_days: number;
  created_at: string;
}

export function TournamentsListPage() {
  const [rows, setRows] = useState<TournamentRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await apiFetch('/api/v1/admin/tournaments?limit=100');
      if (!res.ok) {
        setError(`Failed to load tournaments (${res.status})`);
        return;
      }
      const data = (await res.json()) as TournamentRow[];
      if (!cancelled) setRows(data);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <p style={{ color: '#b91c1c' }}>{error}</p>;

  return (
    <div>
      <h1 style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        Tournaments
        <Link to="/tournaments/create" style={{ fontSize: 14, fontWeight: 'normal' }}>
          + New tournament
        </Link>
      </h1>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>
            <th style={{ padding: 8 }}>Name</th>
            <th style={{ padding: 8 }}>Start</th>
            <th style={{ padding: 8 }}>Days</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: 8 }}>
                <Link to={`/tournaments/${t.id}`}>{t.name}</Link>
              </td>
              <td style={{ padding: 8 }}>{new Date(t.start_date).toLocaleString()}</td>
              <td style={{ padding: 8 }}>{t.length_days}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
