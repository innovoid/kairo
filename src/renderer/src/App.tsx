import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthGate } from '@/features/auth/AuthGate';
import { WorkspaceGate } from '@/features/workspaces/WorkspaceGate';
import { AppShell } from '@/components/layout/AppShell';
import { ProfilePage } from '@/features/profile/ProfilePage';

export function App() {
  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            <AuthGate>
              <WorkspaceGate>
                <AppShell />
              </WorkspaceGate>
            </AuthGate>
          }
        />
        <Route
          path="/profile"
          element={
            <AuthGate>
              <WorkspaceGate>
                <ProfilePage />
              </WorkspaceGate>
            </AuthGate>
          }
        />
      </Routes>
    </Router>
  );
}
