import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiFetch } from '../api';

interface ChallengeDetail {
  id: string;
  tournament_id: string;
  tournament_name: string;
  title: string;
  description: string | null;
  challenge_type: string;
  points: number;
  day: number;
  created_at: string;
}

export function ChallengeViewPage() {
  const { challengeId } = useParams<{ challengeId: string }>();
  const [c, setC] = useState<ChallengeDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!challengeId) return;
    let cancelled = false;
    (async () => {
      const res = await apiFetch(`/api/v1/admin/challenges/${challengeId}`);
      if (!res.ok) {
        if (!cancelled) setError('Challenge not found');
        return;
      }
      const row = (await res.json()) as ChallengeDetail;
      if (!cancelled) {
        setC(row);
        setError(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [challengeId]);

  if (error && !c) return <p style={{ color: '#b91c1c' }}>{error}</p>;
  if (!c) return <p>Loading…</p>;

  return (
    <div>
      <p>
        <Link to="/challenges">← Challenges</Link>
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>{c.title}</h1>
        <Link
          to={`/challenges/${c.id}/edit`}
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
        <dt style={{ fontWeight: 600, marginTop: 8 }}>Tournament</dt>
        <dd style={{ margin: 0 }}>{c.tournament_name}</dd>
        <dt style={{ fontWeight: 600, marginTop: 8 }}>Day</dt>
        <dd style={{ margin: 0 }}>{c.day}</dd>
        <dt style={{ fontWeight: 600, marginTop: 8 }}>Type</dt>
        <dd style={{ margin: 0 }}>{c.challenge_type}</dd>
        <dt style={{ fontWeight: 600, marginTop: 8 }}>Points</dt>
        <dd style={{ margin: 0 }}>{c.points}</dd>
        <dt style={{ fontWeight: 600, marginTop: 8 }}>Created</dt>
        <dd style={{ margin: 0 }}>{new Date(c.created_at).toLocaleString()}</dd>
        <dt style={{ fontWeight: 600, marginTop: 8 }}>Description</dt>
        <dd style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{c.description ?? '—'}</dd>
      </dl>
    </div>
  );
}
