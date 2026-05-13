import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../api';

export function TeamCreatePage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch('/api/v1/admin/teams', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { detail?: string };
        setError(j.detail ?? `Create failed (${res.status})`);
        return;
      }
      const t = (await res.json()) as { id: string };
      navigate(`/teams/${t.id}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <p>
        <Link to="/teams">← Teams</Link>
      </p>
      <h1>Create team</h1>
      <p style={{ color: '#555', fontSize: 14 }}>
        An invite code is generated automatically. You can add members on the next screen.
      </p>
      <form onSubmit={onSubmit} style={{ maxWidth: 480 }}>
        <label style={{ display: 'block', marginBottom: 12 }}>
          Team name
          <input
            style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={1}
            maxLength={128}
          />
        </label>
        {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
        <button type="submit" disabled={loading} style={{ marginTop: 8, padding: '8px 16px' }}>
          {loading ? 'Creating…' : 'Create'}
        </button>
      </form>
    </div>
  );
}
