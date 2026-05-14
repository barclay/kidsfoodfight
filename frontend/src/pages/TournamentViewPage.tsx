import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiFetch } from '../api';

interface TournamentDetail {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  length_days: number;
  created_at: string;
}

interface LeaderboardRow {
  rank: number;
  team_id: string;
  team_name: string;
  team_tournament_id: string;
  total_points: number;
  challenges_completed: number;
}

export function TournamentViewPage() {
  const navigate = useNavigate();
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const [tournament, setTournament] = useState<TournamentDetail | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);

  useEffect(() => {
    if (!tournamentId) return;
    let cancelled = false;
    (async () => {
      const [tRes, lbRes] = await Promise.all([
        apiFetch(`/api/v1/admin/tournaments/${tournamentId}`),
        apiFetch(`/api/v1/admin/tournaments/${tournamentId}/leaderboard`),
      ]);
      if (!tRes.ok) {
        if (!cancelled) {
          setError('Tournament not found');
          setTournament(null);
          setLeaderboard([]);
          setLeaderboardError(null);
        }
        return;
      }
      const t = (await tRes.json()) as TournamentDetail;
      let lb: LeaderboardRow[] = [];
      let lbErr: string | null = null;
      if (lbRes.ok) {
        lb = (await lbRes.json()) as LeaderboardRow[];
      } else {
        lbErr = `Could not load leaderboard (${lbRes.status})`;
      }
      if (!cancelled) {
        setTournament(t);
        setLeaderboard(lb);
        setLeaderboardError(lbErr);
        setError(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tournamentId]);

  const endLabel = useMemo(() => {
    if (!tournament) return '';
    const start = new Date(tournament.start_date);
    const end = new Date(start);
    end.setDate(end.getDate() + tournament.length_days - 1);
    return end.toLocaleDateString();
  }, [tournament]);

  if (error && !tournament) return <p style={{ color: '#b91c1c' }}>{error}</p>;
  if (!tournament) return <p>Loading…</p>;

  return (
    <div>
      <p>
        <Link to="/tournaments">← Tournaments</Link>
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>{tournament.name}</h1>
        <Link
          to={`/tournaments/${tournament.id}/edit`}
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

      <dl style={{ marginTop: 16, maxWidth: 560 }}>
        <dt style={{ fontWeight: 600, marginTop: 8 }}>Start</dt>
        <dd style={{ margin: 0 }}>{new Date(tournament.start_date).toLocaleString()}</dd>
        <dt style={{ fontWeight: 600, marginTop: 8 }}>Length</dt>
        <dd style={{ margin: 0 }}>
          {tournament.length_days} day{tournament.length_days === 1 ? '' : 's'} (through {endLabel})
        </dd>
        <dt style={{ fontWeight: 600, marginTop: 8 }}>Created</dt>
        <dd style={{ margin: 0 }}>{new Date(tournament.created_at).toLocaleString()}</dd>
        <dt style={{ fontWeight: 600, marginTop: 8 }}>Description</dt>
        <dd style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{tournament.description?.trim() ? tournament.description : '—'}</dd>
      </dl>

      <p style={{ marginTop: 20 }}>
        <Link to={`/challenges?tournamentId=${encodeURIComponent(tournament.id)}`}>Challenges for this tournament</Link>
      </p>

      <section style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Leaderboard</h2>
        {leaderboardError ? <p style={{ color: '#b91c1c', fontSize: 14 }}>{leaderboardError}</p> : null}
        <p style={{ color: '#666', fontSize: 14, marginTop: 0, marginBottom: 12 }}>
          Teams enrolled in this tournament, ranked by total points from approved challenge completions (one award per
          challenge per team).
        </p>
        {leaderboard.length === 0 ? (
          <p style={{ color: '#666' }}>No teams enrolled yet.</p>
        ) : (
          <table style={{ width: '100%', maxWidth: 720, borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>
                <th style={{ padding: 8, width: 56 }}>#</th>
                <th style={{ padding: 8 }}>Team</th>
                <th style={{ padding: 8 }}>Challenges</th>
                <th style={{ padding: 8 }}>Points</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((row) => (
                <tr
                  key={row.team_tournament_id}
                  className="admin-table-click-row"
                  onClick={() => navigate(`/teams/${row.team_id}`)}
                >
                  <td style={{ padding: 8 }}>{row.rank}</td>
                  <td style={{ padding: 8 }}>{row.team_name}</td>
                  <td style={{ padding: 8 }}>{row.challenges_completed}</td>
                  <td style={{ padding: 8 }}>{row.total_points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
