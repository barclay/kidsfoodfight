import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiFetch } from '../api';

interface PostDetail {
  id: string;
  user_id: string;
  challenge_id: string;
  author_username: string;
  challenge_title: string;
  comment: string | null;
  approved: boolean;
  created_at: string;
  photo_urls: string[];
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
      </p>
      <h1>Edit post</h1>
      <p>
        Author: {post.author_username} · Challenge: {post.challenge_title}
      </p>
      {post.photo_urls.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {post.photo_urls.map((url) => (
            <a key={url} href={url} target="_blank" rel="noreferrer">
              <img src={url} alt="" style={{ maxWidth: 160, maxHeight: 160, objectFit: 'cover' }} />
            </a>
          ))}
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
