import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { LocaleTabBar, type AppLocale } from '../components/LocaleTabBar';
import { apiFetch } from '../api';

interface TournamentOption {
  id: string;
  name: string;
}

interface ChallengeLocalePayload {
  title: string;
  description: string | null;
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
  translations: Record<AppLocale, ChallengeLocalePayload>;
  tournament_translations?: Record<AppLocale, { name: string; description: string | null }>;
}

const CHALLENGE_TYPES = ['food', 'fitness', 'shopping', 'game'] as const;

const emptyLocale = (): ChallengeLocalePayload => ({ title: '', description: '' });

/** Shimmer keyframe injected once into the document head. */
function ensureShimmerKeyframes() {
  if (document.getElementById('kff-shimmer-style')) return;
  const el = document.createElement('style');
  el.id = 'kff-shimmer-style';
  el.textContent = `
    @keyframes kff-shimmer {
      0%   { background-position: -400px 0; }
      100% { background-position:  400px 0; }
    }
    .kff-translating {
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 400px 100%;
      animation: kff-shimmer 1.4s ease-in-out infinite;
      border-radius: 4px;
      pointer-events: none;
      color: transparent !important;
      resize: none;
    }
  `;
  document.head.appendChild(el);
}

// ── Translation helper ────────────────────────────────────────────────────

interface TranslateResponse {
  es_fields: Record<string, string>;
}

async function fetchTranslation(
  enFields: Record<string, string>,
): Promise<Record<string, string> | null> {
  const filled = Object.fromEntries(
    Object.entries(enFields).filter(([, v]) => v && v.trim()),
  );
  if (!Object.keys(filled).length) return null;
  const res = await apiFetch('/api/v1/admin/translate', {
    method: 'POST',
    body: JSON.stringify({ content_type: 'challenge', en_fields: filled }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as TranslateResponse;
  return data.es_fields;
}

// ── Component ─────────────────────────────────────────────────────────────

export function ChallengeFormPage() {
  const { challengeId } = useParams<{ challengeId: string }>();
  const [searchParams] = useSearchParams();
  const loc = useLocation();
  const navigate = useNavigate();
  const isCreate = loc.pathname.endsWith('/challenges/create');

  const [localeTab, setLocaleTab] = useState<AppLocale>('en');
  const [tournaments, setTournaments] = useState<TournamentOption[]>([]);
  const [tournamentId, setTournamentId] = useState('');
  const [translations, setTranslations] = useState<Record<AppLocale, ChallengeLocalePayload>>({
    en: emptyLocale(),
    es: emptyLocale(),
  });
  const [challengeType, setChallengeType] = useState<string>('food');
  const [points, setPoints] = useState(10);
  const [day, setDay] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(!isCreate);

  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  // Track whether Es fields were populated by auto-translate (vs. human)
  const translateAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    ensureShimmerKeyframes();
  }, []);

  // ── Load tournaments ────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await apiFetch('/api/v1/admin/tournaments?limit=100');
      if (!res.ok) { setError('Failed to load tournaments'); return; }
      const data = (await res.json()) as TournamentOption[];
      if (cancelled) return;
      setTournaments(data);
      if (isCreate) {
        const pre = searchParams.get('tournamentId');
        if (pre && data.some((t) => t.id === pre)) setTournamentId(pre);
        else if (data.length === 1) setTournamentId(data[0].id);
      }
    })();
    return () => { cancelled = true; };
  }, [isCreate, searchParams]);

  // ── Load existing challenge ─────────────────────────────────────────────
  useEffect(() => {
    if (isCreate || !challengeId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`/api/v1/admin/challenges/${challengeId}`);
        if (!res.ok) { if (!cancelled) setLoadError('Challenge not found'); return; }
        const c = (await res.json()) as ChallengeDetail;
        if (cancelled) return;
        setTournamentId(c.tournament_id ?? '');
        setTranslations({
          en: {
            title: c.translations.en?.title ?? c.title,
            description: c.translations.en?.description ?? c.description ?? '',
          },
          es: {
            title: c.translations.es?.title ?? '',
            description: c.translations.es?.description ?? '',
          },
        });
        setChallengeType(c.challenge_type);
        setPoints(c.points);
        setDay(c.day);
        setError(null);
        setLoadError(null);
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isCreate, challengeId]);

  // ── Setters ──────────────────────────────────────────────────────────────
  function setLocaleField<K extends keyof ChallengeLocalePayload>(field: K, value: string) {
    setTranslations((prev) => ({
      ...prev,
      [localeTab]: { ...prev[localeTab], [field]: value },
    }));
  }

  // ── Auto-translate ───────────────────────────────────────────────────────
  const runTranslate = useCallback(async () => {
    const enTitle = translations.en.title.trim();
    if (!enTitle) return; // nothing to translate yet
    // Cancel any in-flight request
    translateAbortRef.current?.abort();
    const ctrl = new AbortController();
    translateAbortRef.current = ctrl;
    setTranslating(true);
    setTranslateError(null);
    const enFields: Record<string, string> = { title: enTitle };
    if (translations.en.description?.trim()) {
      enFields.description = translations.en.description.trim();
    }
    try {
      const result = await fetchTranslation(enFields);
      if (ctrl.signal.aborted) return;
      if (!result) {
        setTranslateError('Translation service unavailable — fill in Spanish manually.');
        return;
      }
      setTranslations((prev) => ({
        ...prev,
        es: {
          title: result.title ?? prev.es.title,
          description: result.description !== undefined ? result.description : prev.es.description,
        },
      }));
    } catch {
      if (!ctrl.signal.aborted) {
        setTranslateError('Translation failed — fill in Spanish manually.');
      }
    } finally {
      if (!ctrl.signal.aborted) setTranslating(false);
    }
  }, [translations.en]);

  function handleTabClick(tab: AppLocale) {
    if (tab === localeTab) return;
    setLocaleTab(tab);
    if (tab === 'es') {
      const esEmpty =
        !translations.es.title.trim() && !translations.es.description?.trim();
      const enHasContent = !!translations.en.title.trim();
      if (esEmpty && enHasContent) {
        void runTranslate();
      }
    }
  }

  // ── Submit / delete ─────────────────────────────────────────────────────
  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    if (!translations.en.title.trim()) { setError('English title is required.'); return; }
    if (!tournamentId) { setError('Select a tournament.'); return; }
    const payload = {
      tournament_id: tournamentId,
      translations: {
        en: {
          title: translations.en.title.trim(),
          description: translations.en.description?.trim() || null,
        },
        es: {
          title: translations.es.title.trim(),
          description: translations.es.description?.trim() || null,
        },
      },
      challenge_type: challengeType,
      points,
      day,
    };
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
      navigate(`/challenges/${((await res.json()) as ChallengeDetail).id}`);
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

  if (!isCreate && detailLoading) return <p>Loading…</p>;
  if (!isCreate && loadError) return <p style={{ color: '#b91c1c' }}>{loadError}</p>;

  const showEsOverlay = localeTab === 'es' && translating;
  const inputStyle = (base: CSSProperties = {}): CSSProperties => ({
    display: 'block',
    width: '100%',
    marginTop: 4,
    padding: 8,
    ...base,
  });

  return (
    <div>
      <p>
        <Link to="/challenges">← Challenges</Link>
        {!isCreate && challengeId ? (
          <>{' · '}<Link to={`/challenges/${challengeId}`}>View</Link></>
        ) : null}
      </p>
      <h1>{isCreate ? 'New challenge' : 'Edit challenge'}</h1>

      <LocaleTabBar
        ariaLabel="Challenge language"
        value={localeTab}
        onChange={handleTabClick}
        trailing={
          <>
            {localeTab === 'es' && !translating && (
              <button
                type="button"
                onClick={() => void runTranslate()}
                disabled={!translations.en.title.trim()}
                style={{
                  marginLeft: 'auto',
                  padding: '4px 12px',
                  fontSize: 12,
                  background: 'none',
                  border: '1px solid #aaa',
                  borderRadius: 4,
                  cursor: translations.en.title.trim() ? 'pointer' : 'not-allowed',
                  color: '#555',
                  alignSelf: 'center',
                }}
                title="Re-run AI translation from English"
              >
                ↺ Re-translate
              </button>
            )}
            {localeTab === 'es' && translating && (
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: 12,
                  color: '#666',
                  alignSelf: 'center',
                  fontStyle: 'italic',
                }}
              >
                ✦ Translating with AI…
              </span>
            )}
          </>
        }
      />

      {/* Translation error (non-blocking) */}
      {localeTab === 'es' && translateError && (
        <p style={{ color: '#b45309', fontSize: 13, marginBottom: 8, marginTop: -8 }}>
          {translateError}
        </p>
      )}

      <form onSubmit={onSubmit} style={{ maxWidth: 520 }}>
        {/* Tournament — shared field, always editable */}
        <label style={{ display: 'block', marginBottom: 12 }}>
          Tournament
          <select
            style={inputStyle()}
            value={tournamentId}
            onChange={(e) => setTournamentId(e.target.value)}
            required
          >
            <option value="" disabled>Select…</option>
            {tournaments.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </label>

        {/* Title — per-locale */}
        <label style={{ display: 'block', marginBottom: 12 }}>
          Title ({localeTab === 'en' ? 'English' : 'Spanish'})
          <input
            style={inputStyle()}
            className={showEsOverlay ? 'kff-translating' : undefined}
            value={showEsOverlay ? '' : translations[localeTab].title}
            onChange={(e) => setLocaleField('title', e.target.value)}
            disabled={showEsOverlay}
            required={localeTab === 'en'}
            placeholder={showEsOverlay ? '' : undefined}
          />
        </label>

        {/* Description — per-locale */}
        <label style={{ display: 'block', marginBottom: 12 }}>
          Description ({localeTab === 'en' ? 'English' : 'Spanish'})
          <textarea
            style={inputStyle({ minHeight: 100 })}
            className={showEsOverlay ? 'kff-translating' : undefined}
            value={showEsOverlay ? '' : (translations[localeTab].description ?? '')}
            onChange={(e) => setLocaleField('description', e.target.value)}
            disabled={showEsOverlay}
          />
        </label>

        {/* Shared fields — always editable regardless of tab */}
        <label style={{ display: 'block', marginBottom: 12 }}>
          Type
          <select
            style={inputStyle()}
            value={challengeType}
            onChange={(e) => setChallengeType(e.target.value)}
          >
            {CHALLENGE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <label style={{ display: 'block', marginBottom: 12 }}>
          Points
          <input
            type="number"
            min={0}
            style={inputStyle()}
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
            style={inputStyle()}
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
