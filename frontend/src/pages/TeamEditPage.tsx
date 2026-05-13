import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiFetch } from '../api';
import type { AdminUserListItem } from './UsersListPage';

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
}

interface TeamDetail {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
  members: TeamMember[];
  tournaments?: TeamTournamentEntry[];
}

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
  maxWidth: 560,
  width: '100%',
  maxHeight: '85vh',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
};

export function TeamEditPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [name, setName] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [rosterOpen, setRosterOpen] = useState(false);
  const [allUsers, setAllUsers] = useState<AdminUserListItem[]>([]);
  const [rosterFilter, setRosterFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);

  const [allTournaments, setAllTournaments] = useState<{ id: string; name: string }[]>([]);
  const [selectedTournamentIds, setSelectedTournamentIds] = useState<Set<string>>(new Set());
  const [tournamentMessage, setTournamentMessage] = useState<string | null>(null);
  const [tournamentError, setTournamentError] = useState<string | null>(null);
  const [tournamentSaving, setTournamentSaving] = useState(false);

  const loadTeam = useCallback(async () => {
    if (!teamId) return;
    const res = await apiFetch(`/api/v1/admin/teams/${teamId}`);
    if (!res.ok) {
      setError('Team not found');
      setTeam(null);
      return;
    }
    const t = (await res.json()) as TeamDetail;
    setTeam(t);
    setName(t.name);
    setSelectedTournamentIds(new Set((t.tournaments ?? []).map((e) => e.tournament_id)));
    setError(null);
  }, [teamId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadTeam();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [loadTeam]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await apiFetch('/api/v1/admin/tournaments?limit=100');
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as { id: string; name: string }[];
      setAllTournaments([...data].sort((a, b) => a.name.localeCompare(b.name)));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!teamId) return;
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
    setSelectedTournamentIds(new Set((t.tournaments ?? []).map((e) => e.tournament_id)));
    setMessage('Saved.');
  }

  async function openRosterModal() {
    if (!teamId) return;
    setRosterError(null);
    setRosterFilter('');
    setRosterLoading(true);
    setRosterOpen(true);
    try {
      const [usersRes, teamRes] = await Promise.all([
        apiFetch('/api/v1/admin/users?limit=200'),
        apiFetch(`/api/v1/admin/teams/${teamId}`),
      ]);
      if (!usersRes.ok) {
        setRosterError(`Could not load users (${usersRes.status})`);
        setAllUsers([]);
        return;
      }
      if (!teamRes.ok) {
        setRosterError('Could not load team');
        setAllUsers([]);
        return;
      }
      const users = (await usersRes.json()) as AdminUserListItem[];
      const fresh = (await teamRes.json()) as TeamDetail;
      setAllUsers(users);
      setSelectedIds(new Set(fresh.members.map((m) => m.id)));
    } finally {
      setRosterLoading(false);
    }
  }

  const filteredUsers = useMemo(() => {
    const q = rosterFilter.trim().toLowerCase();
    if (!q) return allUsers;
    return allUsers.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        u.display_name.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q),
    );
  }, [allUsers, rosterFilter]);

  function toggleUser(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTournament(id: string) {
    setSelectedTournamentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function saveTournaments() {
    if (!teamId) return;
    setTournamentMessage(null);
    setTournamentError(null);
    setTournamentSaving(true);
    try {
      const res = await apiFetch(`/api/v1/admin/teams/${teamId}/tournaments`, {
        method: 'PUT',
        body: JSON.stringify({ tournament_ids: Array.from(selectedTournamentIds) }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { detail?: string };
        setTournamentError(typeof j.detail === 'string' ? j.detail : `Save failed (${res.status})`);
        return;
      }
      const t = (await res.json()) as TeamDetail;
      setTeam(t);
      setSelectedTournamentIds(new Set((t.tournaments ?? []).map((e) => e.tournament_id)));
      setTournamentMessage('Tournament enrollment updated.');
      setMessage(null);
    } finally {
      setTournamentSaving(false);
    }
  }

  async function saveRoster() {
    if (!teamId) return;
    setRosterError(null);
    setRosterLoading(true);
    try {
      const res = await apiFetch(`/api/v1/admin/teams/${teamId}/members`, {
        method: 'PUT',
        body: JSON.stringify({ user_ids: Array.from(selectedIds) }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { detail?: string };
        setRosterError(j.detail ?? `Save failed (${res.status})`);
        return;
      }
      const t = (await res.json()) as TeamDetail;
      setTeam(t);
      setSelectedTournamentIds(new Set((t.tournaments ?? []).map((e) => e.tournament_id)));
      setRosterOpen(false);
      setMessage('Team roster updated.');
    } finally {
      setRosterLoading(false);
    }
  }

  if (error && !team) return <p style={{ color: '#b91c1c' }}>{error}</p>;
  if (!team) return <p>Loading…</p>;

  return (
    <div>
      <p>
        <Link to="/teams">← Teams</Link>
        {teamId ? (
          <>
            {' · '}
            <Link to={`/teams/${teamId}`}>View</Link>
          </>
        ) : null}
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
          Save name
        </button>
      </form>

      <section style={{ marginTop: 32, maxWidth: 560 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>Tournaments</h2>
        <p style={{ color: '#555', fontSize: 14, marginTop: 0 }}>
          Select which tournaments this team is enrolled in. Saving replaces the full enrollment list (you can select
          none to clear).
        </p>
        {allTournaments.length === 0 ? (
          <p style={{ color: '#666' }}>No tournaments in the system yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: '12px 0 0', padding: 0 }}>
            {allTournaments.map((tr) => (
              <li
                key={tr.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '6px 0',
                  borderBottom: '1px solid #f0f0f0',
                }}
              >
                <input
                  type="checkbox"
                  id={`tournament-${tr.id}`}
                  checked={selectedTournamentIds.has(tr.id)}
                  onChange={() => toggleTournament(tr.id)}
                />
                <label htmlFor={`tournament-${tr.id}`} style={{ cursor: 'pointer' }}>
                  {tr.name}
                </label>
              </li>
            ))}
          </ul>
        )}
        {tournamentError ? <p style={{ color: '#b91c1c', marginTop: 12 }}>{tournamentError}</p> : null}
        {tournamentMessage ? <p style={{ color: '#15803d', marginTop: 12 }}>{tournamentMessage}</p> : null}
        <button
          type="button"
          style={{ marginTop: 12, padding: '8px 16px' }}
          disabled={tournamentSaving || allTournaments.length === 0}
          onClick={() => void saveTournaments()}
        >
          {tournamentSaving ? 'Saving…' : 'Save tournament enrollment'}
        </button>
      </section>

      <section style={{ marginTop: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Members</h2>
          <button type="button" onClick={openRosterModal} style={{ padding: '8px 16px' }}>
            Edit roster…
          </button>
        </div>
        <p style={{ color: '#555', fontSize: 14, marginTop: 0 }}>
          Pick users from the directory. Saving replaces the whole roster for this team (users can only be on one
          team).
        </p>
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
                <tr key={m.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: 8 }}>
                    <Link to={`/users/${m.id}`}>{m.display_name}</Link>
                  </td>
                  <td style={{ padding: 8 }}>{m.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {rosterOpen ? (
        <div style={modalBackdrop} role="presentation" onClick={() => !rosterLoading && setRosterOpen(false)}>
          <div style={modalPanel} role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '16px 16px 8px', borderBottom: '1px solid #eee' }}>
              <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>Choose team members</h2>
              <input
                type="search"
                placeholder="Filter by name or email…"
                value={rosterFilter}
                onChange={(e) => setRosterFilter(e.target.value)}
                style={{ width: '100%', padding: 8, boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ overflow: 'auto', flex: 1, padding: '8px 16px' }}>
              {rosterLoading && allUsers.length === 0 ? (
                <p>Loading users…</p>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {filteredUsers.map((u) => {
                    const onTeam = selectedIds.has(u.id);
                    const otherTeam = u.team && u.team.id !== teamId;
                    return (
                      <li
                        key={u.id}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 10,
                          padding: '8px 0',
                          borderBottom: '1px solid #f0f0f0',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={onTeam}
                          onChange={() => toggleUser(u.id)}
                          style={{ marginTop: 4 }}
                          id={`roster-${u.id}`}
                        />
                        <label htmlFor={`roster-${u.id}`} style={{ flex: 1, cursor: 'pointer' }}>
                          <strong>{u.display_name}</strong>
                          <div style={{ fontSize: 13, color: '#444' }}>{u.email}</div>
                          {otherTeam ? (
                            <div style={{ fontSize: 12, color: '#b45309', marginTop: 4 }}>
                              Currently on team: {u.team!.name} ({u.team!.invite_code}) — selecting adds to this team
                              and removes from the other.
                            </div>
                          ) : null}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
              {filteredUsers.length === 0 && !rosterLoading ? <p style={{ color: '#666' }}>No matching users.</p> : null}
            </div>
            {rosterError ? (
              <p style={{ color: '#b91c1c', padding: '0 16px', margin: '0 0 8px' }}>{rosterError}</p>
            ) : null}
            <div style={{ padding: 16, borderTop: '1px solid #eee', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" disabled={rosterLoading} onClick={() => setRosterOpen(false)}>
                Cancel
              </button>
              <button type="button" disabled={rosterLoading} onClick={saveRoster}>
                {rosterLoading ? 'Saving…' : 'Save roster'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
