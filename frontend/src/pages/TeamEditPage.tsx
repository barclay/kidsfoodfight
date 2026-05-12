import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiFetch } from '../api';

interface TeamDetail {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
}

export function TeamEditPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [name, setName] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!teamId) return;
    let cancelled = false;
    (async () => {
      const res = await apiFetch(`/api/v1/admin/teams/${teamId}`);
      if (!res.ok) {
        setError('Team not found');
        return;
      }
      const t = (await res.json()) as TeamDetail;
      if (cancelled) return;
      setTeam(t);
      setName(t.name);
    })();
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    const res = await apiFetch(`/api/v1/admin/teams/${teamId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { detail?: string };
      setError(j.detail ?? `Save failed (${res.status})`);
      return;
    }
    const t = (await res.json()) as TeamDetail;
    setTeam(t);
    setMessage('Saved.');
  }

  if (error && !team) return <p style={{ color: '#b91c1c' }}>{error}</p>;
  if (!team) return <p>Loading…</p>;

  return (
    <div>
      <p>
        <Link to="/users">← Users</Link>
      </p>
      <h1>Edit team</h1>
      <p>
        <strong>Invite code</strong> (read-only): <code>{team.invite_code}</code>
      </p>
      <form onSubmit={onSubmit} style={{ maxWidth: 480 }}>
        <label style={{ display: 'block', marginBottom: 12 }}>
          Name
          <input
            style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
        {message ? <p style={{ color: '#15803d' }}>{message}</p> : null}
        <button type="submit" style={{ padding: '8px 16px' }}>
          Save
        </button>
      </form>
    </div>
  );
}
