import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../api';

interface TournamentRow {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  length_days: number;
  created_at: string;
}

type SortKey = 'name' | 'start_date' | 'length_days';
type SortDir = 'asc' | 'desc';

const thButton: CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  margin: 0,
  font: 'inherit',
  fontWeight: 600,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  color: 'inherit',
  textAlign: 'left',
};

function SortIndicator({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span style={{ fontSize: 12, opacity: active ? 1 : 0.35 }} aria-hidden>
      {active ? (dir === 'asc' ? '↑' : '↓') : '↕'}
    </span>
  );
}

export function TournamentsListPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<TournamentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('start_date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  function onHeaderClick(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir(key === 'name' ? 'asc' : 'desc');
  }

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      let cmp: number;
      if (sortKey === 'name') {
        cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      } else if (sortKey === 'start_date') {
        cmp = new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
      } else {
        cmp = a.length_days - b.length_days;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

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
            <th style={{ padding: 8 }}>
              <button
                type="button"
                style={thButton}
                onClick={(e) => {
                  e.stopPropagation();
                  onHeaderClick('name');
                }}
                aria-sort={sortKey === 'name' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                Name
                <SortIndicator active={sortKey === 'name'} dir={sortDir} />
              </button>
            </th>
            <th style={{ padding: 8 }}>
              <button
                type="button"
                style={thButton}
                onClick={(e) => {
                  e.stopPropagation();
                  onHeaderClick('start_date');
                }}
                aria-sort={sortKey === 'start_date' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                Start
                <SortIndicator active={sortKey === 'start_date'} dir={sortDir} />
              </button>
            </th>
            <th style={{ padding: 8 }}>
              <button
                type="button"
                style={thButton}
                onClick={(e) => {
                  e.stopPropagation();
                  onHeaderClick('length_days');
                }}
                aria-sort={sortKey === 'length_days' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                Days
                <SortIndicator active={sortKey === 'length_days'} dir={sortDir} />
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((t) => (
            <tr
              key={t.id}
              className="admin-table-click-row"
              onClick={() => navigate(`/tournaments/${t.id}`)}
            >
              <td style={{ padding: 8 }}>{t.name}</td>
              <td style={{ padding: 8 }}>{new Date(t.start_date).toLocaleString()}</td>
              <td style={{ padding: 8 }}>{t.length_days}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
