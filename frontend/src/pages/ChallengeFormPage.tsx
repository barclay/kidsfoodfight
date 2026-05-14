import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../api';

interface TournamentOption {
  id: string;
  name: string;
}

interface ChallengeDetail {
  id: string;
  tournament_id: string | null;
  title: string;
  description: string | null;
  challenge_type: string;
  points: number;
  day: number;
  created_at: string;
}

const CHALLENGE_TYPES = ['food', 'fitness', 'shopping', 'game'] as const;

export function ChallengeFormPage() {
  const { challengeId } = useParams<{ challengeId: string }>();
  const [searchParams] = useSearchParams();
  const loc = useLocation();
  const navigate = useNavigate();
  const isCreate = loc.pathname.endsWith('/challenges/create');

  const [tournaments, setTournaments] = useState<TournamentOption[]>([]);
  const [tournamentId, setTournamentId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [challengeType, setChallengeType] = useState<string>('food');
  const [points, setPoints] = useState(10);
  const [day, setDay] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await apiFetch('/api/v1/admin/tournaments?limit=100');
      if (!res.ok) {
        setError('Failed to load tournaments');
        return;
      }
      const data = (await res.json()) as TournamentOption[];
      if (cancelled) return;
      setTournaments(data);
      if (isCreate) {
        const pre = searchParams.get('tournamentId');
        if (pre && data.some((t) => t.id === pre)) {
          setTournamentId(pre);
        } else if (data.length === 1) {
          setTournamentId(data[0].id);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isCreate, searchParams]);

  useEffect(() => {
    if (isCreate || !challengeId) return;
    let cancelled = false;
    (async () => {
      const res = await apiFetch(`/api/v1/admin/challenges/${challengeId}`);
      if (!res.ok) {
        setError('Challenge not found');
        return;
      }
      const c = (await res.json()) as ChallengeDetail;
      if (cancelled) return;
      setTournamentId(c.tournament_id ?? '');
      setTitle(c.title);
      setDescription(c.description ?? '');
      setChallengeType(c.challenge_type);
      setPoints(c.points);
      setDay(c.day);
    })();
    return () => {
      cancelled = true;
    };
  }, [isCreate, challengeId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    const payload = {
      tournament_id: tournamentId,
      title,
      description: description.trim() ? description : null,
      challenge_type: challengeType,
      points,
      day,
    };
    if (!tournamentId) {
      setError('Select a tournament.');
      return;
    }
    if (isCreate) {
      const res = await apiFetch('/api/v1/admin/challenges', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { detail?: string | unknown };
        setError(typeof j.detail === 'string' ? j.detail : `Create failed (${res.status})`);
        return;
      }
      const c = (await res.json()) as ChallengeDetail;
      navigate(`/challenges/${c.id}`);
      return;
    }
    const res = await apiFetch(`/api/v1/admin/challenges/${challengeId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { detail?: string | unknown };
      setError(typeof j.detail === 'string' ? j.detail : `Save failed (${res.status})`);
      return;
    }
    setMessage('Saved.');
  }

  async function onDelete() {
    if (!challengeId) return;
    if (!window.confirm('Delete this challenge? Related posts will be removed.')) return;
    const res = await apiFetch(`/api/v1/admin/challenges/${challengeId}`, { method: 'DELETE' });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { detail?: string | unknown };
      setError(typeof j.detail === 'string' ? j.detail : `Delete failed (${res.status})`);
      return;
    }
    navigate('/challenges');
  }

  if (error && !isCreate && title === '') return <p style={{ color: '#b91c1c' }}>{error}</p>;

  return (
    <div>
      <p>
        <Link to="/challenges">← Challenges</Link>
        {!isCreate && challengeId ? (
          <>
            {' · '}
            <Link to={`/challenges/${challengeId}`}>View</Link>
          </>
        ) : null}
      </p>
      <h1>{isCreate ? 'New challenge' : 'Edit challenge'}</h1>
      <form onSubmit={onSubmit} style={{ maxWidth: 520 }}>
        <label style={{ display: 'block', marginBottom: 12 }}>
          Tournament
          <select
            style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}
            value={tournamentId}
            onChange={(e) => setTournamentId(e.target.value)}
            required
          >
            <option value="" disabled>
              Select…
            </option>
            {tournaments.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'block', marginBottom: 12 }}>
          Title
          <input
            style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </label>
        <label style={{ display: 'block', marginBottom: 12 }}>
          Description
          <textarea
            style={{ display: 'block', width: '100%', marginTop: 4, padding: 8, minHeight: 100 }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label style={{ display: 'block', marginBottom: 12 }}>
          Type
          <select
            style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}
            value={challengeType}
            onChange={(e) => setChallengeType(e.target.value)}
          >
            {CHALLENGE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'block', marginBottom: 12 }}>
          Points
          <input
            type="number"
            min={0}
            style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}
            value={points}
            onChange={(e) => setPoints(Number(e.target.value))}
            required
          />
        </label>
        <label style={{ display: 'block', marginBottom: 12 }}>
          Day (1-based within tournament)
          <input
            type="number"
            min={1}
            style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}
            value={day}
            onChange={(e) => setDay(Number(e.target.value))}
            required
          />
        </label>
        {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
        {message ? <p style={{ color: '#15803d' }}>{message}</p> : null}
        <button type="submit" style={{ padding: '8px 16px', marginRight: 8 }}>
          {isCreate ? 'Create' : 'Save'}
        </button>
        {!isCreate && challengeId ? (
          <button type="button" style={{ padding: '8px 16px', color: '#b91c1c' }} onClick={onDelete}>
            Delete
          </button>
        ) : null}
      </form>
    </div>
  );
}
