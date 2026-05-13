import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiFetch } from '../api';
import type { AdminTeamListItem } from './TeamsListPage';

interface AdminUserDetail {
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
}

export function UserEditPage() {
  const { userId } = useParams<{ userId: string }>();
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [timezone, setTimezone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isSuperuser, setIsSuperuser] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [teamId, setTeamId] = useState('');
  const [teams, setTeams] = useState<AdminTeamListItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const [userRes, teamsRes] = await Promise.all([
        apiFetch(`/api/v1/admin/users/${userId}`),
        apiFetch('/api/v1/admin/teams?limit=100'),
      ]);
      if (!userRes.ok) {
        setError('User not found');
        return;
      }
      const u = (await userRes.json()) as AdminUserDetail;
      if (cancelled) return;
      setUser(u);
      setDisplayName(u.display_name);
      setTimezone(u.timezone);
      setEmail(u.email);
      setIsActive(u.is_active);
      setIsSuperuser(u.is_superuser);
      setIsVerified(u.is_verified);
      setTeamId(u.team_id ?? '');

      if (teamsRes.ok) {
        const list = (await teamsRes.json()) as AdminTeamListItem[];
        if (!cancelled) setTeams(list);
      } else if (!cancelled) {
        setTeams([]);
      }
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
      display_name: displayName,
      timezone,
      email,
      is_active: isActive,
      is_superuser: isSuperuser,
      is_verified: isVerified,
    };
    if (password.trim()) {
      body.password = password;
    }
    const nextTeamId = teamId.trim() === '' ? null : teamId.trim();
    const prevTeamId = user.team_id ?? null;
    if (nextTeamId !== prevTeamId) {
      body.team_id = nextTeamId;
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
    setTeamId(u.team_id ?? '');
    setTimezone(u.timezone);
    setMessage('Saved.');
  }

  const teamOptions = useMemo(() => {
    const byId = new Map(teams.map((t) => [t.id, t]));
    if (user?.team && !byId.has(user.team.id)) {
      byId.set(user.team.id, {
        id: user.team.id,
        name: user.team.name,
        invite_code: user.team.invite_code,
        created_at: '',
        member_count: 0,
      });
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [teams, user]);

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
          Display name
          <input
            style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
        </label>
        <label style={{ display: 'block', marginBottom: 12 }}>
          Time zone (IANA)
          <input
            style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            placeholder="America/Los_Angeles"
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
          Team
          <select
            style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
          >
            <option value="">— No team —</option>
            {teamOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.invite_code})
              </option>
            ))}
          </select>
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
