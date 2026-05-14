import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiFetch } from '../api';

const modalBackdrop: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.45)',
  zIndex: 100,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
};

const modalPanel: CSSProperties = {
  background: '#fff',
  borderRadius: 8,
  maxWidth: 520,
  width: '100%',
  maxHeight: '85vh',
  overflow: 'auto',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
};

function isoToLocalDatetimeValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

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
  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloneName, setCloneName] = useState('');
  const [cloneDescription, setCloneDescription] = useState('');
  const [cloneStartLocal, setCloneStartLocal] = useState('');
  const [cloneLengthDays, setCloneLengthDays] = useState(7);
  const [cloneBusy, setCloneBusy] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);

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

  function openCloneModal() {
    if (!tournament) return;
    setCloneName(tournament.name);
    setCloneDescription(tournament.description ?? '');
    setCloneStartLocal(isoToLocalDatetimeValue(tournament.start_date));
    setCloneLengthDays(tournament.length_days);
    setCloneError(null);
    setCloneOpen(true);
  }

  async function onCloneSubmit(e: FormEvent) {
    e.preventDefault();
    if (!tournamentId || cloneBusy) return;
    setCloneBusy(true);
    setCloneError(null);
    const startIso = new Date(cloneStartLocal).toISOString();
    const payload = {
      name: cloneName,
      description: cloneDescription.trim() ? cloneDescription : null,
      start_date: startIso,
      length_days: cloneLengthDays,
    };
    const res = await apiFetch(`/api/v1/admin/tournaments/${tournamentId}/clone`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setCloneBusy(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { detail?: string | unknown };
      setCloneError(typeof j.detail === 'string' ? j.detail : `Clone failed (${res.status})`);
      return;
    }
    const t = (await res.json()) as TournamentDetail;
    setCloneOpen(false);
    navigate(`/tournaments/${t.id}`);
  }

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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={openCloneModal}
            style={{
              padding: '8px 16px',
              background: '#fff',
              color: '#111',
              border: '1px solid #ccc',
              borderRadius: 6,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Clone…
          </button>
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

      {cloneOpen ? (
        <div style={modalBackdrop} role="presentation" onClick={() => !cloneBusy && setCloneOpen(false)}>
          <div style={modalPanel} role="dialog" aria-modal aria-labelledby="clone-tournament-title" onClick={(ev) => ev.stopPropagation()}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #eee' }}>
              <h2 id="clone-tournament-title" style={{ margin: 0, fontSize: 18 }}>
                Clone tournament
              </h2>
              <p style={{ margin: '8px 0 0', fontSize: 14, color: '#555' }}>
                Creates a new tournament and copies all challenges from this one. Team enrollments are not copied.
              </p>
            </div>
            <form onSubmit={onCloneSubmit} style={{ padding: 20 }}>
              <label style={{ display: 'block', marginBottom: 12 }}>
                Name
                <input
                  style={{ display: 'block', width: '100%', marginTop: 4, padding: 8, boxSizing: 'border-box' }}
                  value={cloneName}
                  onChange={(e) => setCloneName(e.target.value)}
                  required
                  disabled={cloneBusy}
                />
              </label>
              <label style={{ display: 'block', marginBottom: 12 }}>
                Description
                <textarea
                  style={{ display: 'block', width: '100%', marginTop: 4, padding: 8, minHeight: 80, boxSizing: 'border-box' }}
                  value={cloneDescription}
                  onChange={(e) => setCloneDescription(e.target.value)}
                  disabled={cloneBusy}
                />
              </label>
              <label style={{ display: 'block', marginBottom: 12 }}>
                Start (local)
                <input
                  type="datetime-local"
                  style={{ display: 'block', width: '100%', marginTop: 4, padding: 8, boxSizing: 'border-box' }}
                  value={cloneStartLocal}
                  onChange={(e) => setCloneStartLocal(e.target.value)}
                  required
                  disabled={cloneBusy}
                />
              </label>
              <label style={{ display: 'block', marginBottom: 12 }}>
                Length (days)
                <input
                  type="number"
                  min={1}
                  style={{ display: 'block', width: '100%', marginTop: 4, padding: 8, boxSizing: 'border-box' }}
                  value={cloneLengthDays}
                  onChange={(e) => setCloneLengthDays(Number(e.target.value))}
                  required
                  disabled={cloneBusy}
                />
              </label>
              {cloneError ? <p style={{ color: '#b91c1c', marginTop: 0 }}>{cloneError}</p> : null}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => !cloneBusy && setCloneOpen(false)}
                  style={{ padding: '8px 16px', cursor: cloneBusy ? 'not-allowed' : 'pointer' }}
                  disabled={cloneBusy}
                >
                  Cancel
                </button>
                <button type="submit" style={{ padding: '8px 16px', cursor: cloneBusy ? 'wait' : 'pointer' }} disabled={cloneBusy}>
                  {cloneBusy ? 'Cloning…' : 'Clone tournament'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
