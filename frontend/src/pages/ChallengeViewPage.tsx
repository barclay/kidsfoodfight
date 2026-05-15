import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { LocaleTabBar, type AppLocale } from '../components/LocaleTabBar';
import { apiFetch } from '../api';

interface ChallengeLocaleOut {
  title: string;
  description: string | null;
}

interface TournamentLocaleOut {
  name: string;
  description: string | null;
}

interface ChallengeDetail {
  id: string;
  tournament_id: string | null;
  tournament_name: string;
  title: string;
  description: string | null;
  challenge_type: string;
  points: number;
  day: number;
  created_at: string;
  translations: Record<AppLocale, ChallengeLocaleOut>;
  tournament_translations?: Record<AppLocale, TournamentLocaleOut>;
}

export function ChallengeViewPage() {
  const { challengeId } = useParams<{ challengeId: string }>();
  const [c, setC] = useState<ChallengeDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localeTab, setLocaleTab] = useState<AppLocale>('en');

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

  const preview = useMemo(() => {
    if (!c) {
      return { title: '—', description: '—', tournamentLabel: '—' };
    }
    const loc = c.translations[localeTab];
    const title = (loc?.title ?? '').trim() || '—';
    const description = (loc?.description ?? '').trim() ? String(loc?.description).trim() : '—';
    const fromLoc = (c.tournament_translations?.[localeTab]?.name ?? '').trim();
    let tournamentLabel: string;
    if (fromLoc) {
      tournamentLabel = fromLoc;
    } else if (!c.tournament_translations || Object.keys(c.tournament_translations).length === 0) {
      tournamentLabel = c.tournament_name.trim() || '—';
    } else {
      tournamentLabel = '—';
    }
    return { title, description, tournamentLabel };
  }, [c, localeTab]);

  if (error && !c) return <p style={{ color: '#b91c1c' }}>{error}</p>;
  if (!c) return <p>Loading…</p>;

  return (
    <div>
      <p>
        <Link to="/challenges">← Challenges</Link>
      </p>
      <LocaleTabBar
        ariaLabel="Preview language"
        value={localeTab}
        onChange={setLocaleTab}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>{preview.title}</h1>
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
        <dd style={{ margin: 0 }}>
          {c.tournament_id ? (
            <Link to={`/tournaments/${c.tournament_id}`}>{preview.tournamentLabel}</Link>
          ) : (
            <span>{preview.tournamentLabel}</span>
          )}
        </dd>
        <dt style={{ fontWeight: 600, marginTop: 8 }}>Day</dt>
        <dd style={{ margin: 0 }}>{c.day}</dd>
        <dt style={{ fontWeight: 600, marginTop: 8 }}>Type</dt>
        <dd style={{ margin: 0 }}>{c.challenge_type}</dd>
        <dt style={{ fontWeight: 600, marginTop: 8 }}>Points</dt>
        <dd style={{ margin: 0 }}>{c.points}</dd>
        <dt style={{ fontWeight: 600, marginTop: 8 }}>Created</dt>
        <dd style={{ margin: 0 }}>{new Date(c.created_at).toLocaleString()}</dd>
        <dt style={{ fontWeight: 600, marginTop: 8 }}>Description</dt>
        <dd style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{preview.description}</dd>
      </dl>
    </div>
  );
}
