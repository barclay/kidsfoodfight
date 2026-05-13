import { useEffect, useState } from 'react';
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

export function PostViewPage() {
  const { postId } = useParams<{ postId: string }>();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!postId) return;
    let cancelled = false;
    (async () => {
      const res = await apiFetch(`/api/v1/admin/posts/${postId}`);
      if (!res.ok) {
        if (!cancelled) setError('Post not found');
        return;
      }
      const p = (await res.json()) as PostDetail;
      if (!cancelled) {
        setPost(p);
        setError(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [postId]);

  if (error && !post) return <p style={{ color: '#b91c1c' }}>{error}</p>;
  if (!post) return <p>Loading…</p>;

  return (
    <div>
      <p>
        <Link to="/posts">← Posts</Link>
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>Post</h1>
        <Link
          to={`/posts/${post.id}/edit`}
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
      <dl style={{ marginTop: 16, maxWidth: 640 }}>
        <dt style={{ fontWeight: 600, marginTop: 8 }}>Author</dt>
        <dd style={{ margin: 0 }}>{post.author_display_name}</dd>
        <dt style={{ fontWeight: 600, marginTop: 8 }}>Challenge</dt>
        <dd style={{ margin: 0 }}>{post.challenge_title}</dd>
        <dt style={{ fontWeight: 600, marginTop: 8 }}>Approved</dt>
        <dd style={{ margin: 0 }}>{post.approved ? 'yes' : 'no'}</dd>
        <dt style={{ fontWeight: 600, marginTop: 8 }}>Created</dt>
        <dd style={{ margin: 0 }}>{new Date(post.created_at).toLocaleString()}</dd>
        {post.comment ? (
          <>
            <dt style={{ fontWeight: 600, marginTop: 8 }}>Comment</dt>
            <dd style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{post.comment}</dd>
          </>
        ) : null}
      </dl>

      {post.photos.length > 0 ? (
        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 16 }}>Photos</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
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
                      style={{ maxWidth: 320, maxHeight: 320, objectFit: 'contain', display: 'block' }}
                    />
                  </button>
                  <p style={{ fontSize: 12, color: '#6b7280', marginTop: 8, wordBreak: 'break-all' }}>
                    {ph.storage_url}
                  </p>
                  {ph.description ? (
                    <p style={{ fontSize: 14, marginTop: 8 }}>
                      <strong>Auto description</strong>: {ph.description}
                    </p>
                  ) : (
                    <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 8 }}>No auto-description.</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <p style={{ marginTop: 16, color: '#666' }}>No photos.</p>
      )}
    </div>
  );
}
