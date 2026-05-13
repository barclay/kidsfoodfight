import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../api';

interface TournamentOption {
  id: string;
  name: string;
}

export interface ChallengeRow {
  id: string;
  tournament_id: string;
  tournament_name: string;
  title: string;
  description: string | null;
  challenge_type: string;
  points: number;
  day: number;
  created_at: string;
}

export function ChallengesListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tournamentFilter = searchParams.get('tournamentId') ?? '';

  const [tournaments, setTournaments] = useState<TournamentOption[]>([]);
  const [rows, setRows] = useState<ChallengeRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const listUrl = useMemo(() => {
    const u = new URLSearchParams({ limit: '200' });
    if (tournamentFilter) u.set('tournament_id', tournamentFilter);
    return `/api/v1/admin/challenges?${u.toString()}`;
  }, [tournamentFilter]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await apiFetch('/api/v1/admin/tournaments?limit=100');
      if (!res.ok) return;
      const data = (await res.json()) as TournamentOption[];
      if (!cancelled) setTournaments(data);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await apiFetch(listUrl);
      if (!res.ok) {
        setError(`Failed to load challenges (${res.status})`);
        return;
      }
      const data = (await res.json()) as ChallengeRow[];
      if (!cancelled) {
        setRows(data);
        setError(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listUrl]);

  function onFilterChange(nextTournamentId: string) {
    const next = new URLSearchParams(searchParams);
    if (nextTournamentId) {
      next.set('tournamentId', nextTournamentId);
    } else {
      next.delete('tournamentId');
    }
    setSearchParams(next);
  }

  const createHref =
    tournamentFilter !== ''
      ? `/challenges/create?tournamentId=${encodeURIComponent(tournamentFilter)}`
      : '/challenges/create';

  return (
    <div>
      <h1 style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        Challenges
        <Link to={createHref} style={{ fontSize: 14, fontWeight: 'normal' }}>
          + New challenge
        </Link>
      </h1>
      <label style={{ display: 'block', marginBottom: 16, maxWidth: 360 }}>
        Tournament filter
        <select
          style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}
          value={tournamentFilter}
          onChange={(e) => onFilterChange(e.target.value)}
        >
          <option value="">All tournaments</option>
          {tournaments.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      {error ? <p style={{ color: '#b91c1c', marginBottom: 12 }}>{error}</p> : null}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>
            <th style={{ padding: 8 }}>Title</th>
            <th style={{ padding: 8 }}>Tournament</th>
            <th style={{ padding: 8 }}>Day</th>
            <th style={{ padding: 8 }}>Type</th>
            <th style={{ padding: 8 }}>Points</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: 8 }}>
                <Link to={`/challenges/${c.id}`}>{c.title}</Link>
              </td>
              <td style={{ padding: 8 }}>{c.tournament_name}</td>
              <td style={{ padding: 8 }}>{c.day}</td>
              <td style={{ padding: 8 }}>{c.challenge_type}</td>
              <td style={{ padding: 8 }}>{c.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
