import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthenticatedStorageImage } from '../AuthenticatedStorageImage';
import { apiFetch } from '../api';

interface PostRow {
  id: string;
  user_id: string;
  challenge_id: string;
  author_display_name: string;
  challenge_title: string;
  comment: string | null;
  approved: boolean;
  created_at: string;
  photo_count: number;
  like_count: number;
  list_preview_storage_url?: string | null;
}

interface AdminUserOption {
  id: string;
  display_name: string;
  email: string;
}

interface AdminChallengeOption {
  id: string;
  tournament_id: string | null;
  tournament_name: string;
  title: string;
  day: number;
}

interface AdminTournamentOption {
  id: string;
  name: string;
}

type SortColumn = 'created_at' | 'author' | 'challenge' | 'photos' | 'approved';
type SortDir = 'asc' | 'desc';

const DEFAULT_SORT_DIR: Record<SortColumn, SortDir> = {
  created_at: 'desc',
  author: 'asc',
  challenge: 'asc',
  photos: 'desc',
  approved: 'asc',
};

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

const actionBtn: CSSProperties = {
  padding: '6px 10px',
  fontSize: 13,
  fontWeight: 600,
  borderRadius: 6,
  cursor: 'pointer',
  border: '1px solid #d1d5db',
  whiteSpace: 'nowrap',
};

function SortTh({
  label,
  column,
  sortColumn,
  sortDir,
  onSort,
  align = 'left',
}: {
  label: string;
  column: SortColumn;
  sortColumn: SortColumn;
  sortDir: SortDir;
  onSort: (c: SortColumn) => void;
  align?: 'left' | 'right';
}) {
  const active = sortColumn === column;
  return (
    <th style={{ padding: 8, textAlign: align }}>
      <button
        type="button"
        onClick={() => onSort(column)}
        style={{
          font: 'inherit',
          fontWeight: 700,
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          padding: 0,
          textAlign: align,
          color: 'inherit',
          display: align === 'right' ? 'flex' : 'inline',
          justifyContent: align === 'right' ? 'flex-end' : undefined,
          width: align === 'right' ? '100%' : undefined,
        }}
      >
        {label}
        {active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
      </button>
    </th>
  );
}

export function PostsListPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<PostRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [purgeMessage, setPurgeMessage] = useState<string | null>(null);
  const [purging, setPurging] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [userOptions, setUserOptions] = useState<AdminUserOption[]>([]);
  const [challengeOptions, setChallengeOptions] = useState<AdminChallengeOption[]>([]);
  const [tournamentOptions, setTournamentOptions] = useState<AdminTournamentOption[]>([]);
  const [filterUserId, setFilterUserId] = useState('');
  const [filterTournamentId, setFilterTournamentId] = useState('');
  const [filterChallengeId, setFilterChallengeId] = useState('');
  const [approvedFilter, setApprovedFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [sort, setSort] = useState<{ column: SortColumn; dir: SortDir }>({
    column: 'created_at',
    dir: 'desc',
  });
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState<number>(50);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [ur, cr, tr] = await Promise.all([
        apiFetch('/api/v1/admin/users?limit=200'),
        apiFetch('/api/v1/admin/challenges?limit=200'),
        apiFetch('/api/v1/admin/tournaments?limit=100'),
      ]);
      if (cancelled) return;
      if (ur.ok) {
        const list = (await ur.json()) as AdminUserOption[];
        setUserOptions(
          [...list].sort((a, b) => a.display_name.localeCompare(b.display_name, undefined, { sensitivity: 'base' })),
        );
      }
      if (cr.ok) {
        const list = (await cr.json()) as AdminChallengeOption[];
        setChallengeOptions(
          [...list].sort((a, b) => {
            const tn = a.tournament_name.localeCompare(b.tournament_name, undefined, { sensitivity: 'base' });
            if (tn !== 0) return tn;
            if (a.day !== b.day) return a.day - b.day;
            return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
          }),
        );
      }
      if (tr.ok) {
        const list = (await tr.json()) as AdminTournamentOption[];
        setTournamentOptions(list);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const challengeOptionsForTournament = useMemo(() => {
    if (!filterTournamentId) return challengeOptions;
    return challengeOptions.filter((c) => c.tournament_id === filterTournamentId);
  }, [challengeOptions, filterTournamentId]);

  const duplicateAuthorNames = useMemo(() => {
    const counts = new Map<string, number>();
    for (const u of userOptions) {
      counts.set(u.display_name, (counts.get(u.display_name) ?? 0) + 1);
    }
    return new Set([...counts.entries()].filter(([, n]) => n > 1).map(([name]) => name));
  }, [userOptions]);

  const onHeaderSort = useCallback((column: SortColumn) => {
    setPageIndex(0);
    setSort((s) => {
      if (s.column === column) {
        return { column, dir: s.dir === 'asc' ? 'desc' : 'asc' };
      }
      return { column, dir: DEFAULT_SORT_DIR[column] };
    });
  }, []);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const skip = pageIndex * pageSize;
      const params = new URLSearchParams();
      params.set('skip', String(skip));
      params.set('limit', String(pageSize));
      if (filterUserId) params.set('user_id', filterUserId);
      if (filterTournamentId) params.set('tournament_id', filterTournamentId);
      if (filterChallengeId) params.set('challenge_id', filterChallengeId);
      if (approvedFilter === 'yes') params.set('approved', 'true');
      if (approvedFilter === 'no') params.set('approved', 'false');
      params.set('sort_by', sort.column);
      params.set('sort_dir', sort.dir);
      const res = await apiFetch(`/api/v1/admin/posts?${params.toString()}`);
      if (!res.ok) {
        setError(`Failed to load posts (${res.status})`);
        return;
      }
      const body = (await res.json()) as { items: PostRow[]; total: number };
      const total = body.total;
      const maxPageIndex = total === 0 ? 0 : Math.floor((total - 1) / pageSize);
      if (pageIndex > maxPageIndex) {
        setPageIndex(maxPageIndex);
        return;
      }
      setRows(body.items);
      setTotalCount(total);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [
    pageIndex,
    pageSize,
    filterUserId,
    filterTournamentId,
    filterChallengeId,
    approvedFilter,
    sort.column,
    sort.dir,
  ]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  async function approvePost(postId: string) {
    setApprovingId(postId);
    setError(null);
    try {
      const res = await apiFetch(`/api/v1/admin/posts/${postId}`, {
        method: 'PATCH',
        body: JSON.stringify({ approved: true }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { detail?: string };
        setError(typeof j.detail === 'string' ? j.detail : `Approve failed (${res.status})`);
        return;
      }
      setRows((prev) => prev.map((r) => (r.id === postId ? { ...r, approved: true } : r)));
    } finally {
      setApprovingId(null);
    }
  }

  async function deletePost(postId: string) {
    if (!window.confirm('Delete this post? This cannot be undone.')) {
      return;
    }
    setDeletingId(postId);
    setError(null);
    try {
      const res = await apiFetch(`/api/v1/admin/posts/${postId}`, { method: 'DELETE' });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { detail?: string };
        setError(typeof j.detail === 'string' ? j.detail : `Delete failed (${res.status})`);
        return;
      }
      await loadPosts();
    } finally {
      setDeletingId(null);
    }
  }

  async function deleteAllPosts() {
    if (
      !window.confirm(
        'Delete ALL posts from the database? This cannot be undone. (Post files on disk are not removed.)',
      )
    ) {
      return;
    }
    setPurgeMessage(null);
    setPurging(true);
    setError(null);
    try {
      const res = await apiFetch('/api/v1/admin/posts', { method: 'DELETE' });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { detail?: string };
        setError(typeof j.detail === 'string' ? j.detail : `Delete failed (${res.status})`);
        return;
      }
      const body = (await res.json()) as { deleted: number };
      setPurgeMessage(`Removed ${body.deleted} post(s).`);
      await loadPosts();
    } finally {
      setPurging(false);
    }
  }

  if (error && rows.length === 0 && !loading) return <p style={{ color: '#b91c1c' }}>{error}</p>;

  return (
    <div>
      <h1>Posts</h1>
      {error ? <p style={{ color: '#b91c1c', marginBottom: 8 }}>{error}</p> : null}
      {purgeMessage ? <p style={{ color: '#15803d', marginBottom: 8 }}>{purgeMessage}</p> : null}

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 16,
          alignItems: 'flex-end',
        }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 220 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Author</span>
          <select
            value={filterUserId}
            onChange={(e) => {
              setPageIndex(0);
              setFilterUserId(e.target.value);
            }}
            style={{ padding: '8px 10px', fontSize: 14, borderRadius: 6, border: '1px solid #ccc' }}
          >
            <option value="">All authors</option>
            {userOptions.map((u) => (
              <option key={u.id} value={u.id} title={u.email}>
                {u.display_name}
                {duplicateAuthorNames.has(u.display_name) ? ` (${u.email})` : ''}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 220 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Tournament</span>
          <select
            value={filterTournamentId}
            onChange={(e) => {
              const tid = e.target.value;
              setPageIndex(0);
              setFilterTournamentId(tid);
              setFilterChallengeId((prev) => {
                if (!tid || !prev) return prev;
                const ok = challengeOptions.some((c) => c.id === prev && c.tournament_id === tid);
                return ok ? prev : '';
              });
            }}
            style={{ padding: '8px 10px', fontSize: 14, borderRadius: 6, border: '1px solid #ccc' }}
          >
            <option value="">All tournaments</option>
            {tournamentOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 280 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Challenge</span>
          <select
            value={filterChallengeId}
            onChange={(e) => {
              setPageIndex(0);
              setFilterChallengeId(e.target.value);
            }}
            style={{ padding: '8px 10px', fontSize: 14, borderRadius: 6, border: '1px solid #ccc', maxWidth: 420 }}
          >
            <option value="">All challenges</option>
            {challengeOptionsForTournament.map((c) => (
              <option key={c.id} value={c.id} title={`${c.tournament_name} · day ${c.day} · ${c.title}`}>
                {filterTournamentId ? `D${c.day} · ${c.title}` : `${c.tournament_name} · D${c.day} · ${c.title}`}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 140 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Approved</span>
          <select
            value={approvedFilter}
            onChange={(e) => {
              setPageIndex(0);
              setApprovedFilter(e.target.value as 'all' | 'yes' | 'no');
            }}
            style={{ padding: '8px 10px', fontSize: 14, borderRadius: 6, border: '1px solid #ccc' }}
          >
            <option value="all">All</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>
        {loading ? <span style={{ fontSize: 13, color: '#6b7280', paddingBottom: 8 }}>Loading…</span> : null}
      </div>

      {!loading && totalCount === 0 ? (
        <p style={{ color: '#6b7280', marginBottom: 16 }}>No posts match these filters.</p>
      ) : null}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>
            <th style={{ padding: 8, width: 132 }}>Preview</th>
            <SortTh
              label="Author"
              column="author"
              sortColumn={sort.column}
              sortDir={sort.dir}
              onSort={onHeaderSort}
            />
            <SortTh
              label="Challenge"
              column="challenge"
              sortColumn={sort.column}
              sortDir={sort.dir}
              onSort={onHeaderSort}
            />
            <SortTh
              label="Photos"
              column="photos"
              sortColumn={sort.column}
              sortDir={sort.dir}
              onSort={onHeaderSort}
            />
            <th style={{ padding: 8, textAlign: 'right', width: 72 }}>Likes</th>
            <SortTh
              label="Approved"
              column="approved"
              sortColumn={sort.column}
              sortDir={sort.dir}
              onSort={onHeaderSort}
            />
            <SortTh
              label="Created"
              column="created_at"
              sortColumn={sort.column}
              sortDir={sort.dir}
              onSort={onHeaderSort}
            />
            <th style={{ padding: 8, textAlign: 'right', width: 1, whiteSpace: 'nowrap' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr
              key={p.id}
              className="admin-table-click-row"
              onClick={() => navigate(`/posts/${p.id}`)}
            >
              <td style={{ padding: 8, verticalAlign: 'middle' }}>
                {p.list_preview_storage_url ? (
                  <AuthenticatedStorageImage
                    storageUrl={p.list_preview_storage_url}
                    alt=""
                    width={120}
                    height={120}
                    style={{
                      width: 120,
                      height: 120,
                      objectFit: 'contain',
                      display: 'block',
                      background: '#f3f4f6',
                      borderRadius: 6,
                    }}
                  />
                ) : (
                  <span style={{ color: '#9ca3af', fontSize: 13 }}>—</span>
                )}
              </td>
              <td style={{ padding: 8 }}>{p.author_display_name}</td>
              <td style={{ padding: 8 }}>{p.challenge_title}</td>
              <td style={{ padding: 8 }}>{p.photo_count}</td>
              <td style={{ padding: 8, textAlign: 'right' }}>{p.like_count}</td>
              <td style={{ padding: 8, verticalAlign: 'middle' }}>{p.approved ? 'yes' : 'no'}</td>
              <td style={{ padding: 8 }}>{new Date(p.created_at).toLocaleString()}</td>
              <td
                onClick={(e) => e.stopPropagation()}
                style={{
                  padding: 8,
                  verticalAlign: 'middle',
                  textAlign: 'right',
                  whiteSpace: 'nowrap',
                }}
              >
                <div
                  style={{
                    display: 'inline-flex',
                    flexWrap: 'nowrap',
                    justifyContent: 'flex-end',
                    gap: 6,
                    alignItems: 'center',
                  }}
                >
                  <button
                    type="button"
                    disabled={p.approved || approvingId === p.id}
                    onClick={() => void approvePost(p.id)}
                    style={{
                      ...actionBtn,
                      background: p.approved ? '#f3f4f6' : approvingId === p.id ? '#fdba74' : '#ff9128',
                      color: '#1f2937',
                      borderColor: p.approved ? '#d1d5db' : '#ea580c',
                      cursor: p.approved ? 'default' : approvingId === p.id ? 'wait' : 'pointer',
                    }}
                  >
                    {p.approved ? 'Approved' : approvingId === p.id ? 'Approving…' : 'Approve'}
                  </button>
                  <Link
                    to={`/posts/${p.id}/edit`}
                    style={{
                      ...actionBtn,
                      display: 'inline-block',
                      background: '#111',
                      color: '#fff',
                      borderColor: '#111',
                      textDecoration: 'none',
                      textAlign: 'center',
                    }}
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    disabled={deletingId === p.id}
                    onClick={() => void deletePost(p.id)}
                    style={{
                      ...actionBtn,
                      background: deletingId === p.id ? '#fee2e2' : '#fff',
                      color: '#b91c1c',
                      borderColor: '#fecaca',
                      cursor: deletingId === p.id ? 'wait' : 'pointer',
                    }}
                  >
                    {deletingId === p.id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {totalCount > 0 ? (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 12,
            marginTop: 16,
            fontSize: 14,
            color: '#374151',
          }}
        >
          <span>
            Showing {pageIndex * pageSize + 1}–{Math.min((pageIndex + 1) * pageSize, totalCount)} of {totalCount}
            {' · '}
            Page {pageIndex + 1} of {Math.ceil(totalCount / pageSize)}
          </span>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Per page</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPageIndex(0);
              }}
              style={{ padding: '6px 10px', fontSize: 14, borderRadius: 6, border: '1px solid #ccc' }}
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={pageIndex <= 0 || loading}
            onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
            style={{
              padding: '6px 14px',
              fontSize: 14,
              borderRadius: 6,
              border: '1px solid #ccc',
              background: pageIndex <= 0 || loading ? '#f3f4f6' : '#fff',
              cursor: pageIndex <= 0 || loading ? 'not-allowed' : 'pointer',
            }}
          >
            Previous
          </button>
          <button
            type="button"
            disabled={loading || (pageIndex + 1) * pageSize >= totalCount}
            onClick={() => setPageIndex((p) => p + 1)}
            style={{
              padding: '6px 14px',
              fontSize: 14,
              borderRadius: 6,
              border: '1px solid #ccc',
              background: loading || (pageIndex + 1) * pageSize >= totalCount ? '#f3f4f6' : '#fff',
              cursor: loading || (pageIndex + 1) * pageSize >= totalCount ? 'not-allowed' : 'pointer',
            }}
          >
            Next
          </button>
        </div>
      ) : null}

      <section style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Development</h2>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12, maxWidth: 520 }}>
          Deletes every post row (cascade removes post photos from the DB). Uploaded image files under{' '}
          <code>data/uploads/</code> are not deleted from disk.
        </p>
        <button
          type="button"
          disabled={purging || totalCount === 0}
          onClick={deleteAllPosts}
          style={{
            padding: '10px 16px',
            background: totalCount === 0 ? '#e5e7eb' : '#fef2f2',
            color: totalCount === 0 ? '#9ca3af' : '#b91c1c',
            border: `1px solid ${totalCount === 0 ? '#d1d5db' : '#fecaca'}`,
            borderRadius: 6,
            cursor: totalCount === 0 || purging ? 'not-allowed' : 'pointer',
          }}
        >
          {purging ? 'Deleting…' : 'Delete all posts'}
        </button>
      </section>
    </div>
  );
}
