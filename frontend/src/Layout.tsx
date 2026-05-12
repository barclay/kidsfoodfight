import type { ReactNode } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { getToken, setToken } from './api';

const navStyle: React.CSSProperties = {
  display: 'flex',
  gap: '1rem',
  alignItems: 'center',
  padding: '0.75rem 1rem',
  borderBottom: '1px solid #e5e7eb',
  background: '#fafafa',
};

const linkStyle: React.CSSProperties = { color: '#111', textDecoration: 'none' };

export function Layout({ children }: { children?: ReactNode }) {
  const navigate = useNavigate();

  function logout() {
    setToken(null);
    navigate('/login');
  }

  if (!getToken()) {
    return <>{children}</>;
  }

  return (
    <>
      <nav style={navStyle}>
        <strong>KFF Admin</strong>
        <Link to="/users" style={linkStyle}>
          Users
        </Link>
        <Link to="/posts" style={linkStyle}>
          Posts
        </Link>
        <Link to="/tournaments" style={linkStyle}>
          Tournaments
        </Link>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={logout}>
          Log out
        </button>
      </nav>
      <main style={{ padding: '1rem', maxWidth: 960, margin: '0 auto' }}>{children ?? <Outlet />}</main>
    </>
  );
}
