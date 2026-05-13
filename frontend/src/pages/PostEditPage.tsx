import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AuthenticatedStorageImage } from '../AuthenticatedStorageImage';
import { apiFetch, openAuthenticatedMediaInNewTab } from '../api';

interface AdminPostPhoto {
  storage_url: string;
  thumbnail_storage_url?: string | null;
  description: string | null;
}

interface PostDetail {
  id: string;
  user_id: string;
  challenge_id: string;
  author_display_name: string;
  challenge_title: string;
  comment: string | null;
  approved: boolean;
  created_at: string;
  photos: AdminPostPhoto[];
}

export function PostEditPage() {
  const { postId } = useParams<{ postId: string }>();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [comment, setComment] = useState('');
  const [approved, setApproved] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!postId) return;
    let cancelled = false;
    (async () => {
      const res = await apiFetch(`/api/v1/admin/posts/${postId}`);
      if (!res.ok) {
        setError('Post not found');
        return;
      }
      const p = (await res.json()) as PostDetail;
      if (cancelled) return;
      setPost(p);
      setComment(p.comment ?? '');
      setApproved(p.approved);
    })();
    return () => {
      cancelled = true;
    };
  }, [postId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    const res = await apiFetch(`/api/v1/admin/posts/${postId}`, {
      method: 'PATCH',
      body: JSON.stringify({ comment: comment || null, approved }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { detail?: string };
      setError(j.detail ?? `Save failed (${res.status})`);
      return;
    }
    const p = (await res.json()) as PostDetail;
    setPost(p);
    setMessage('Saved.');
  }

  if (error && !post) return <p style={{ color: '#b91c1c' }}>{error}</p>;
  if (!post) return <p>Loading…</p>;

  return (
    <div>
      <p>
        <Link to="/posts">← Posts</Link>
        {postId ? (
          <>
            {' · '}
            <Link to={`/posts/${postId}`}>View</Link>
          </>
        ) : null}
      </p>
      <h1>Edit post</h1>
      <p>
        Author: {post.author_display_name} · Challenge: {post.challenge_title}
      </p>
      {post.photos.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 16 }}>
          {post.photos.map((ph) => {
            const previewKey = ph.thumbnail_storage_url ?? ph.storage_url;
            return (
              <div key={ph.storage_url} style={{ border: '1px solid #e5e7eb', padding: 12, borderRadius: 8 }}>
                <button
                  type="button"
                  onClick={() => void openAuthenticatedMediaInNewTab(ph.storage_url)}
                  style={{
                    padding: 0,
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    borderRadius: 8,
                  }}
                  title="Open full-size image in new tab"
                >
                  <AuthenticatedStorageImage
                    storageUrl={previewKey}
                    alt=""
                    style={{ maxWidth: 200, maxHeight: 200, objectFit: 'contain', display: 'block' }}
                  />
                </button>
              <p style={{ fontSize: 12, color: '#6b7280', marginTop: 8, wordBreak: 'break-all' }}>
                {ph.storage_url}
                {ph.thumbnail_storage_url ? (
                  <>
                    <br />
                    <span style={{ color: '#9ca3af' }}>thumb: {ph.thumbnail_storage_url}</span>
                  </>
                ) : null}
              </p>
              {ph.description ? (
                <p style={{ fontSize: 14, marginTop: 8 }}>
                  <strong>Auto description</strong>: {ph.description}
                </p>
              ) : (
                <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 8 }}>No auto-description yet.</p>
              )}
            </div>
            );
          })}
        </div>
      ) : (
        <p>No photos</p>
      )}
      <form onSubmit={onSubmit} style={{ maxWidth: 560 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} />
          Approved (visible to players)
        </label>
        <label style={{ display: 'block', marginBottom: 12 }}>
          Comment
          <textarea
            style={{ display: 'block', width: '100%', marginTop: 4, padding: 8, minHeight: 120 }}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </label>
        {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
        {message ? <p style={{ color: '#15803d' }}>{message}</p> : null}
        <button type="submit" style={{ padding: '8px 16px' }}>
          Save
        </button>
      </form>
    </div>
  );
}
