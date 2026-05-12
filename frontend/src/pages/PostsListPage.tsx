import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api';

interface PostRow {
  id: string;
  user_id: string;
  challenge_id: string;
  author_username: string;
  challenge_title: string;
  comment: string | null;
  approved: boolean;
  created_at: string;
  photo_count: number;
}

export function PostsListPage() {
  const [rows, setRows] = useState<PostRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await apiFetch('/api/v1/admin/posts?limit=100');
      if (!res.ok) {
        setError(`Failed to load posts (${res.status})`);
        return;
      }
      const data = (await res.json()) as PostRow[];
      if (!cancelled) setRows(data);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <p style={{ color: '#b91c1c' }}>{error}</p>;

  return (
    <div>
      <h1>Posts</h1>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>
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
              <td style={{ padding: 8 }}>
                <Link to={`/posts/${p.id}`}>{p.author_username}</Link>
              </td>
              <td style={{ padding: 8 }}>{p.challenge_title}</td>
              <td style={{ padding: 8 }}>{p.photo_count}</td>
              <td style={{ padding: 8 }}>{p.approved ? 'yes' : 'no'}</td>
              <td style={{ padding: 8 }}>{new Date(p.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
