import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { getToken } from './api';
import { Layout } from './Layout';
import { LoginPage } from './pages/LoginPage';
import { ChallengeViewPage } from './pages/ChallengeViewPage';
import { PostEditPage } from './pages/PostEditPage';
import { PostViewPage } from './pages/PostViewPage';
import { PostsListPage } from './pages/PostsListPage';
import { TeamCreatePage } from './pages/TeamCreatePage';
import { TeamEditPage } from './pages/TeamEditPage';
import { TeamViewPage } from './pages/TeamViewPage';
import { TeamsListPage } from './pages/TeamsListPage';
import { ChallengeFormPage } from './pages/ChallengeFormPage';
import { ChallengesListPage } from './pages/ChallengesListPage';
import { TournamentFormPage } from './pages/TournamentFormPage';
import { TournamentViewPage } from './pages/TournamentViewPage';
import { TournamentsListPage } from './pages/TournamentsListPage';
import { UserEditPage } from './pages/UserEditPage';
import { UserViewPage } from './pages/UserViewPage';
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
          <Route path="/users/:userId/edit" element={<UserEditPage />} />
          <Route path="/users/:userId" element={<UserViewPage />} />
          <Route path="/teams" element={<TeamsListPage />} />
          <Route path="/teams/create" element={<TeamCreatePage />} />
          <Route path="/teams/:teamId/edit" element={<TeamEditPage />} />
          <Route path="/teams/:teamId" element={<TeamViewPage />} />
          <Route path="/posts" element={<PostsListPage />} />
          <Route path="/posts/:postId/edit" element={<PostEditPage />} />
          <Route path="/posts/:postId" element={<PostViewPage />} />
          <Route path="/tournaments" element={<TournamentsListPage />} />
          <Route path="/tournaments/create" element={<TournamentFormPage />} />
          <Route path="/tournaments/:tournamentId/edit" element={<TournamentFormPage />} />
          <Route path="/tournaments/:tournamentId" element={<TournamentViewPage />} />
          <Route path="/challenges" element={<ChallengesListPage />} />
          <Route path="/challenges/create" element={<ChallengeFormPage />} />
          <Route path="/challenges/:challengeId/edit" element={<ChallengeFormPage />} />
          <Route path="/challenges/:challengeId" element={<ChallengeViewPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/users" replace />} />
    </Routes>
  );
}
