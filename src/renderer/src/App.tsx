import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthGate } from '@/features/auth/AuthGate';
import { WorkspaceGate } from '@/features/workspaces/WorkspaceGate';
import { AppShell } from '@/components/layout/AppShell';
import { ProfilePage } from '@/features/profile/ProfilePage';
import { TerminalCentricPreview } from '@/pages/TerminalCentricPreview';
import { TerminalCentricLayoutDemo } from '@/examples/TerminalCentricLayoutDemo';

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
        <Route
          path="/preview"
          element={
            <AuthGate>
              <WorkspaceGate>
                <TerminalCentricPreview />
              </WorkspaceGate>
            </AuthGate>
          }
        />
        <Route
          path="/demo"
          element={<TerminalCentricLayoutDemo />}
        />
      </Routes>
    </Router>
  );
}
