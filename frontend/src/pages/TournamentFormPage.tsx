import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { LocaleTabBar, type AppLocale } from '../components/LocaleTabBar';
import { apiFetch } from '../api';

interface TournamentLocalePayload {
  name: string;
  description: string | null;
}

interface TournamentDetail {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  length_days: number;
  created_at: string;
  translations: Record<AppLocale, TournamentLocalePayload>;
}

function isoToLocalDatetimeValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const emptyLocale = (): TournamentLocalePayload => ({ name: '', description: '' });

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
    body: JSON.stringify({ content_type: 'tournament', en_fields: filled }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as TranslateResponse;
  return data.es_fields;
}

// ── Component ─────────────────────────────────────────────────────────────

export function TournamentFormPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const loc = useLocation();
  const navigate = useNavigate();
  const isCreate = loc.pathname.endsWith('/tournaments/create');

  const [localeTab, setLocaleTab] = useState<AppLocale>('en');
  const [translations, setTranslations] = useState<Record<AppLocale, TournamentLocalePayload>>({
    en: emptyLocale(),
    es: emptyLocale(),
  });
  const [startLocal, setStartLocal] = useState('');
  const [lengthDays, setLengthDays] = useState(7);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(!isCreate);

  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const translateAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    ensureShimmerKeyframes();
  }, []);

  // ── Init start date ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isCreate) return;
    setStartLocal(isoToLocalDatetimeValue(new Date().toISOString()));
  }, [isCreate]);

  // ── Load existing tournament ────────────────────────────────────────────
  useEffect(() => {
    if (isCreate || !tournamentId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`/api/v1/admin/tournaments/${tournamentId}`);
        if (!res.ok) { if (!cancelled) setLoadError('Tournament not found'); return; }
        const t = (await res.json()) as TournamentDetail;
        if (cancelled) return;
        setTranslations({
          en: {
            name: t.translations.en?.name ?? t.name,
            description: t.translations.en?.description ?? t.description ?? '',
          },
          es: {
            name: t.translations.es?.name ?? '',
            description: t.translations.es?.description ?? '',
          },
        });
        setStartLocal(isoToLocalDatetimeValue(t.start_date));
        setLengthDays(t.length_days);
        setLoadError(null);
        setError(null);
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isCreate, tournamentId]);

  // ── Setters ──────────────────────────────────────────────────────────────
  function setLocaleField<K extends keyof TournamentLocalePayload>(field: K, value: string) {
    setTranslations((prev) => ({
      ...prev,
      [localeTab]: { ...prev[localeTab], [field]: value },
    }));
  }

  // ── Auto-translate ───────────────────────────────────────────────────────
  const runTranslate = useCallback(async () => {
    const enName = translations.en.name.trim();
    if (!enName) return;
    translateAbortRef.current?.abort();
    const ctrl = new AbortController();
    translateAbortRef.current = ctrl;
    setTranslating(true);
    setTranslateError(null);
    const enFields: Record<string, string> = { name: enName };
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
          name: result.name ?? prev.es.name,
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
      const esEmpty = !translations.es.name.trim() && !translations.es.description?.trim();
      const enHasContent = !!translations.en.name.trim();
      if (esEmpty && enHasContent) {
        void runTranslate();
      }
    }
  }

  // ── Submit ───────────────────────────────────────────────────────────────
  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    if (!translations.en.name.trim()) { setError('English name is required.'); return; }
    const startIso = new Date(startLocal).toISOString();
    const payload = {
      translations: {
        en: {
          name: translations.en.name.trim(),
          description: translations.en.description?.trim() || null,
        },
        es: {
          name: translations.es.name.trim(),
          description: translations.es.description?.trim() || null,
        },
      },
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
      navigate(`/tournaments/${((await res.json()) as TournamentDetail).id}`);
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
        <Link to={isCreate ? '/tournaments' : `/tournaments/${tournamentId}`}>
          {isCreate ? '← Tournaments' : '← Tournament'}
        </Link>
      </p>
      {!isCreate && tournamentId ? (
        <p>
          <Link to={`/challenges?tournamentId=${encodeURIComponent(tournamentId)}`}>
            Challenges for this tournament
          </Link>
        </p>
      ) : null}
      <h1>{isCreate ? 'New tournament' : 'Edit tournament'}</h1>

      <LocaleTabBar
        ariaLabel="Tournament language"
        value={localeTab}
        onChange={handleTabClick}
        trailing={
          <>
            {localeTab === 'es' && !translating && (
              <button
                type="button"
                onClick={() => void runTranslate()}
                disabled={!translations.en.name.trim()}
                style={{
                  marginLeft: 'auto',
                  padding: '4px 12px',
                  fontSize: 12,
                  background: 'none',
                  border: '1px solid #aaa',
                  borderRadius: 4,
                  cursor: translations.en.name.trim() ? 'pointer' : 'not-allowed',
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
        {/* Per-locale fields */}
        <label style={{ display: 'block', marginBottom: 12 }}>
          Name ({localeTab === 'en' ? 'English' : 'Spanish'})
          <input
            style={inputStyle()}
            className={showEsOverlay ? 'kff-translating' : undefined}
            value={showEsOverlay ? '' : translations[localeTab].name}
            onChange={(e) => setLocaleField('name', e.target.value)}
            disabled={showEsOverlay}
            required={localeTab === 'en'}
          />
        </label>
        <label style={{ display: 'block', marginBottom: 12 }}>
          Description ({localeTab === 'en' ? 'English' : 'Spanish'})
          <textarea
            style={inputStyle({ minHeight: 80 })}
            className={showEsOverlay ? 'kff-translating' : undefined}
            value={showEsOverlay ? '' : (translations[localeTab].description ?? '')}
            onChange={(e) => setLocaleField('description', e.target.value)}
            disabled={showEsOverlay}
          />
        </label>

        {/* Shared fields */}
        <label style={{ display: 'block', marginBottom: 12 }}>
          Start (local)
          <input
            type="datetime-local"
            style={inputStyle()}
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
            style={inputStyle()}
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
