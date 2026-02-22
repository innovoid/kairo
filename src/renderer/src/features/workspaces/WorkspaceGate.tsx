import { useEffect, useState } from 'react';
import type { Workspace } from '@shared/types/workspace';
import { isE2EMode } from '@/lib/e2e';

interface WorkspaceGateProps {
  children: React.ReactNode;
}

export function WorkspaceGate({ children }: WorkspaceGateProps) {
  if (isE2EMode()) {
    return <>{children}</>;
  }

  const [workspace, setWorkspace] = useState<Workspace | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.workspaceApi
      .ensurePersonalWorkspace()
      .then((ws) => setWorkspace(ws as Workspace))
      .catch((e) => {
        setError((e as Error).message);
        setWorkspace(null);
      });
  }, []);

  if (workspace === undefined) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Setting up workspace...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-destructive text-sm">Failed to load workspace: {error}</div>
      </div>
    );
  }

  return <>{children}</>;
}
