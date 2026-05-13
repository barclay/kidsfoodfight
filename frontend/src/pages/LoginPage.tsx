import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, login } from '../api';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      const probe = await apiFetch('/api/v1/admin/users?limit=1');
      if (probe.status === 403) {
        throw new Error('This account is not an administrator (needs is_superuser).');
      }
      if (!probe.ok) {
        throw new Error(`Cannot reach admin API (${probe.status})`);
      }
      navigate('/users');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: '4rem auto', padding: '0 1rem' }}>
      <h1>KFF Admin</h1>
      <p style={{ color: '#555', fontSize: 14 }}>
        Sign in with a user that has <code>is_superuser</code> set in the database.
      </p>
      <form onSubmit={onSubmit}>
        <label style={{ display: 'block', marginBottom: 8 }}>
          Email
          <input
            style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <label style={{ display: 'block', marginBottom: 8 }}>
          Password
          <input
            style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error ? <p style={{ color: '#b91c1c', fontSize: 14 }}>{error}</p> : null}
        <button type="submit" disabled={loading} style={{ marginTop: 8, padding: '8px 16px' }}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
