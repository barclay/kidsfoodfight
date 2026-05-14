import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiFetch } from '../api';

interface TeamMember {
  id: string;
  email: string;
  display_name: string;
}

interface TeamTournamentEntry {
  id: string;
  tournament_id: string;
  tournament_name: string;
  joined_at: string;
  total_points: number;
}

interface TeamDetail {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
  members: TeamMember[];
  tournaments?: TeamTournamentEntry[];
}

export function TeamViewPage() {
  const navigate = useNavigate();
  const { teamId } = useParams<{ teamId: string }>();
  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!teamId) return;
    let cancelled = false;
    (async () => {
      const res = await apiFetch(`/api/v1/admin/teams/${teamId}`);
      if (!res.ok) {
        if (!cancelled) setError('Team not found');
        return;
      }
      const t = (await res.json()) as TeamDetail;
      if (!cancelled) {
        setTeam(t);
        setError(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  const tournamentsSorted = useMemo(() => {
    const list = team?.tournaments ?? [];
    return [...list].sort((a, b) => a.tournament_name.localeCompare(b.tournament_name));
  }, [team?.tournaments]);

  if (error && !team) return <p style={{ color: '#b91c1c' }}>{error}</p>;
  if (!team) return <p>Loading…</p>;

  return (
    <div>
      <p>
        <Link to="/teams">← Teams</Link>
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>{team.name}</h1>
        <Link
          to={`/teams/${team.id}/edit`}
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
        <dt style={{ fontWeight: 600, marginTop: 8 }}>Invite code</dt>
        <dd style={{ margin: 0 }}>
          <code>{team.invite_code}</code>
        </dd>
        <dt style={{ fontWeight: 600, marginTop: 8 }}>Created</dt>
        <dd style={{ margin: 0 }}>{new Date(team.created_at).toLocaleString()}</dd>
      </dl>

      <section style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Tournaments</h2>
        {tournamentsSorted.length === 0 ? (
          <p style={{ color: '#666' }}>Not enrolled in any tournaments yet.</p>
        ) : (
          <table style={{ width: '100%', maxWidth: 560, borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>
                <th style={{ padding: 8 }}>Tournament</th>
                <th style={{ padding: 8 }}>Points</th>
                <th style={{ padding: 8 }}>Joined</th>
              </tr>
            </thead>
            <tbody>
              {tournamentsSorted.map((e) => (
                <tr
                  key={e.id}
                  className="admin-table-click-row"
                  onClick={() => navigate(`/tournaments/${e.tournament_id}`)}
                >
                  <td style={{ padding: 8 }}>{e.tournament_name}</td>
                  <td style={{ padding: 8 }}>{e.total_points ?? 0}</td>
                  <td style={{ padding: 8 }}>{new Date(e.joined_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Members ({team.members.length})</h2>
        {team.members.length === 0 ? (
          <p style={{ color: '#666' }}>No members yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>
                <th style={{ padding: 8 }}>Display name</th>
                <th style={{ padding: 8 }}>Email</th>
              </tr>
            </thead>
            <tbody>
              {team.members.map((m) => (
                <tr
                  key={m.id}
                  className="admin-table-click-row"
                  onClick={() => navigate(`/users/${m.id}`)}
                >
                  <td style={{ padding: 8 }}>{m.display_name}</td>
                  <td style={{ padding: 8 }}>{m.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
