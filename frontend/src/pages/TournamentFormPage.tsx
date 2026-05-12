import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { apiFetch } from '../api';

interface TournamentDetail {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  length_days: number;
  created_at: string;
}

function isoToLocalDatetimeValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TournamentFormPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const loc = useLocation();
  const navigate = useNavigate();
  const isCreate = loc.pathname.endsWith('/tournaments/create');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startLocal, setStartLocal] = useState('');
  const [lengthDays, setLengthDays] = useState(7);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isCreate) return;
    const d = new Date();
    setStartLocal(isoToLocalDatetimeValue(d.toISOString()));
  }, [isCreate]);

  useEffect(() => {
    if (isCreate || !tournamentId) return;
    let cancelled = false;
    (async () => {
      const res = await apiFetch(`/api/v1/admin/tournaments/${tournamentId}`);
      if (!res.ok) {
        setError('Tournament not found');
        return;
      }
      const t = (await res.json()) as TournamentDetail;
      if (cancelled) return;
      setName(t.name);
      setDescription(t.description ?? '');
      setStartLocal(isoToLocalDatetimeValue(t.start_date));
      setLengthDays(t.length_days);
    })();
    return () => {
      cancelled = true;
    };
  }, [isCreate, tournamentId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    const startIso = new Date(startLocal).toISOString();
    const payload = {
      name,
      description: description.trim() ? description : null,
      start_date: startIso,
      length_days: lengthDays,
    };
    if (isCreate) {
      const res = await apiFetch('/api/v1/admin/tournaments', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { detail?: string | unknown };
        setError(typeof j.detail === 'string' ? j.detail : `Create failed (${res.status})`);
        return;
      }
      const t = (await res.json()) as TournamentDetail;
      navigate(`/tournaments/${t.id}`);
      return;
    }
    const res = await apiFetch(`/api/v1/admin/tournaments/${tournamentId}`, {
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

  if (error && !isCreate && name === '') return <p style={{ color: '#b91c1c' }}>{error}</p>;

  return (
    <div>
      <p>
        <Link to="/tournaments">← Tournaments</Link>
      </p>
      <h1>{isCreate ? 'New tournament' : 'Edit tournament'}</h1>
      <form onSubmit={onSubmit} style={{ maxWidth: 520 }}>
        <label style={{ display: 'block', marginBottom: 12 }}>
          Name
          <input
            style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <label style={{ display: 'block', marginBottom: 12 }}>
          Description
          <textarea
            style={{ display: 'block', width: '100%', marginTop: 4, padding: 8, minHeight: 80 }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label style={{ display: 'block', marginBottom: 12 }}>
          Start (local)
          <input
            type="datetime-local"
            style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}
            value={startLocal}
            onChange={(e) => setStartLocal(e.target.value)}
            required
          />
        </label>
        <label style={{ display: 'block', marginBottom: 12 }}>
          Length (days)
          <input
            type="number"
            min={1}
            style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}
            value={lengthDays}
            onChange={(e) => setLengthDays(Number(e.target.value))}
            required
          />
        </label>
        {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
        {message ? <p style={{ color: '#15803d' }}>{message}</p> : null}
        <button type="submit" style={{ padding: '8px 16px' }}>
          {isCreate ? 'Create' : 'Save'}
        </button>
      </form>
    </div>
  );
}
