import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
  list_preview_storage_url?: string | null;
}

export function PostsListPage() {
  const [rows, setRows] = useState<PostRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [purgeMessage, setPurgeMessage] = useState<string | null>(null);
  const [purging, setPurging] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const loadPosts = useCallback(async () => {
    const res = await apiFetch('/api/v1/admin/posts?limit=100');
    if (!res.ok) {
      setError(`Failed to load posts (${res.status})`);
      return;
    }
    const data = (await res.json()) as PostRow[];
    setRows(data);
    setError(null);
  }, []);

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

  if (error && rows.length === 0) return <p style={{ color: '#b91c1c' }}>{error}</p>;

  return (
    <div>
      <h1>Posts</h1>
      {error ? <p style={{ color: '#b91c1c', marginBottom: 8 }}>{error}</p> : null}
      {purgeMessage ? <p style={{ color: '#15803d', marginBottom: 8 }}>{purgeMessage}</p> : null}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>
            <th style={{ padding: 8, width: 132 }}>Preview</th>
            <th style={{ padding: 8 }}>Author</th>
            <th style={{ padding: 8 }}>Challenge</th>
            <th style={{ padding: 8 }}>Photos</th>
            <th style={{ padding: 8 }}>Approved</th>
            <th style={{ padding: 8 }}>Created</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: 8, verticalAlign: 'middle' }}>
                {p.list_preview_storage_url ? (
                  <Link to={`/posts/${p.id}`} style={{ display: 'block' }}>
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
                  </Link>
                ) : (
                  <span style={{ color: '#9ca3af', fontSize: 13 }}>—</span>
                )}
              </td>
              <td style={{ padding: 8 }}>
                <Link to={`/posts/${p.id}`}>{p.author_display_name}</Link>
              </td>
              <td style={{ padding: 8 }}>{p.challenge_title}</td>
              <td style={{ padding: 8 }}>{p.photo_count}</td>
              <td style={{ padding: 8, verticalAlign: 'middle' }}>
                {p.approved ? (
                  'yes'
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
                    <span>no</span>
                    <button
                      type="button"
                      disabled={approvingId === p.id}
                      onClick={() => void approvePost(p.id)}
                      style={{
                        padding: '4px 10px',
                        fontSize: 13,
                        fontWeight: 600,
                        background: approvingId === p.id ? '#fdba74' : '#ff9128',
                        color: '#1f2937',
                        border: '1px solid #ea580c',
                        borderRadius: 6,
                        cursor: approvingId === p.id ? 'wait' : 'pointer',
                      }}
                    >
                      {approvingId === p.id ? 'Approving…' : 'Approve'}
                    </button>
                  </div>
                )}
              </td>
              <td style={{ padding: 8 }}>{new Date(p.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Development</h2>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12, maxWidth: 520 }}>
          Deletes every post row (cascade removes post photos from the DB). Uploaded image files under{' '}
          <code>data/uploads/</code> are not deleted from disk.
        </p>
        <button
          type="button"
          disabled={purging || rows.length === 0}
          onClick={deleteAllPosts}
          style={{
            padding: '10px 16px',
            background: rows.length === 0 ? '#e5e7eb' : '#fef2f2',
            color: rows.length === 0 ? '#9ca3af' : '#b91c1c',
            border: `1px solid ${rows.length === 0 ? '#d1d5db' : '#fecaca'}`,
            borderRadius: 6,
            cursor: rows.length === 0 || purging ? 'not-allowed' : 'pointer',
          }}
        >
          {purging ? 'Deleting…' : 'Delete all posts'}
        </button>
      </section>
    </div>
  );
}
