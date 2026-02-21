import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthGate } from '@/features/auth/AuthGate';
import { WorkspaceGate } from '@/features/workspaces/WorkspaceGate';
import { TerminalCentricAppShell } from '@/components/layout/TerminalCentricAppShell';
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
                <TerminalCentricAppShell />
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
