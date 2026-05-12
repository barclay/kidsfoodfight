import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { getToken } from './api';
import { Layout } from './Layout';
import { LoginPage } from './pages/LoginPage';
import { PostEditPage } from './pages/PostEditPage';
import { PostsListPage } from './pages/PostsListPage';
import { TeamEditPage } from './pages/TeamEditPage';
import { TournamentFormPage } from './pages/TournamentFormPage';
import { TournamentsListPage } from './pages/TournamentsListPage';
import { UserEditPage } from './pages/UserEditPage';
import { UsersListPage } from './pages/UsersListPage';

function RequireAuth() {
  const location = useLocation();
  if (!getToken()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <Layout>
            <LoginPage />
          </Layout>
        }
      />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/users" replace />} />
          <Route path="/users" element={<UsersListPage />} />
          <Route path="/users/:userId" element={<UserEditPage />} />
          <Route path="/teams/:teamId" element={<TeamEditPage />} />
          <Route path="/posts" element={<PostsListPage />} />
          <Route path="/posts/:postId" element={<PostEditPage />} />
          <Route path="/tournaments" element={<TournamentsListPage />} />
          <Route path="/tournaments/create" element={<TournamentFormPage />} />
          <Route path="/tournaments/:tournamentId" element={<TournamentFormPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/users" replace />} />
    </Routes>
  );
}
