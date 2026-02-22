import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthGate } from '@/features/auth/AuthGate';
import { OnboardingGate } from '@/features/onboarding/OnboardingGate';
import { TerminalCentricAppShell } from '@/components/layout/TerminalCentricAppShell';

export function App() {
  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            <AuthGate>
              <OnboardingGate>
                <TerminalCentricAppShell />
              </OnboardingGate>
            </AuthGate>
          }
        />
      </Routes>
    </Router>
  );
}
