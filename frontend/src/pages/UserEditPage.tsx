import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiFetch } from '../api';

interface AdminUserDetail {
  id: string;
  email: string;
  username: string;
  is_active: boolean;
  is_superuser: boolean;
  is_verified: boolean;
  created_at: string;
  last_seen_at: string | null;
  team_id: string | null;
  team: { id: string; name: string; invite_code: string } | null;
}

export function UserEditPage() {
  const { userId } = useParams<{ userId: string }>();
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isSuperuser, setIsSuperuser] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [teamId, setTeamId] = useState('');
  const [clearTeam, setClearTeam] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const res = await apiFetch(`/api/v1/admin/users/${userId}`);
      if (!res.ok) {
        setError('User not found');
        return;
      }
      const u = (await res.json()) as AdminUserDetail;
      if (cancelled) return;
      setUser(u);
      setUsername(u.username);
      setEmail(u.email);
      setIsActive(u.is_active);
      setIsSuperuser(u.is_superuser);
      setIsVerified(u.is_verified);
      setTeamId(u.team_id ?? '');
      setClearTeam(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || !userId) return;
    setMessage(null);
    setError(null);
    const body: Record<string, unknown> = {
      username,
      email,
      is_active: isActive,
      is_superuser: isSuperuser,
      is_verified: isVerified,
    };
    if (password.trim()) {
      body.password = password;
    }
    if (clearTeam) {
      body.team_id = null;
    } else if (teamId.trim() && teamId.trim() !== (user.team_id ?? '')) {
      body.team_id = teamId.trim();
    }
    const res = await apiFetch(`/api/v1/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { detail?: string };
      setError(j.detail ?? `Save failed (${res.status})`);
      return;
    }
    const u = (await res.json()) as AdminUserDetail;
    setUser(u);
    setPassword('');
    setClearTeam(false);
    setTeamId(u.team_id ?? '');
    setMessage('Saved.');
  }

  if (error && !user) return <p style={{ color: '#b91c1c' }}>{error}</p>;
  if (!user) return <p>Loading…</p>;

  return (
    <div>
      <p>
        <Link to="/users">← Users</Link>
      </p>
      <h1>Edit user</h1>
      {user.team ? (
        <p>
          Team:{' '}
          <Link to={`/teams/${user.team.id}`}>
            {user.team.name} ({user.team.invite_code})
          </Link>
        </p>
      ) : (
        <p>No team</p>
      )}
      <form onSubmit={onSubmit} style={{ maxWidth: 480 }}>
        <label style={{ display: 'block', marginBottom: 12 }}>
          Username
          <input
            style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </label>
        <label style={{ display: 'block', marginBottom: 12 }}>
          Email
          <input
            style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label style={{ display: 'block', marginBottom: 12 }}>
          New password (optional)
          <input
            style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Active
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <input type="checkbox" checked={isSuperuser} onChange={(e) => setIsSuperuser(e.target.checked)} />
          Superuser (admin)
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <input type="checkbox" checked={isVerified} onChange={(e) => setIsVerified(e.target.checked)} />
          Verified email
        </label>
        <label style={{ display: 'block', marginBottom: 12 }}>
          Team ID (UUID)
          <input
            style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            disabled={clearTeam}
            placeholder="paste team UUID to assign"
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <input type="checkbox" checked={clearTeam} onChange={(e) => setClearTeam(e.target.checked)} />
          Remove from team
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
