import { AuthGate } from '@/features/auth/AuthGate';
import { WorkspaceGate } from '@/features/workspaces/WorkspaceGate';
import { AppShell } from '@/components/layout/AppShell';

export function App() {
  return (
    <AuthGate>
      <WorkspaceGate>
        <AppShell />
      </WorkspaceGate>
    </AuthGate>
  );
}
