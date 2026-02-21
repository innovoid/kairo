import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthGate } from '@/features/auth/AuthGate';
import { WorkspaceGate } from '@/features/workspaces/WorkspaceGate';
import { TerminalCentricAppShell } from '@/components/layout/TerminalCentricAppShell';

export function App() {
  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            <AuthGate>
              <WorkspaceGate>
                <TerminalCentricAppShell />
              </WorkspaceGate>
            </AuthGate>
          }
        />
      </Routes>
    </Router>
  );
}
