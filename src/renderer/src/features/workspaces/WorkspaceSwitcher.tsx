import { useEffect, useState } from 'react';
import type { Workspace, ActiveWorkspaceContext } from '@shared/types/workspace';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, ChevronsUpDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WorkspaceSwitcherProps {
  onWorkspaceChange?: (workspace: Workspace) => void;
}

export function WorkspaceSwitcher({ onWorkspaceChange }: WorkspaceSwitcherProps) {
  const [context, setContext] = useState<ActiveWorkspaceContext | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);

  useEffect(() => {
    loadWorkspaces();
  }, []);

  async function loadWorkspaces(): Promise<Workspace[]> {
    try {
      const [ctx, wsList] = await Promise.all([
        window.workspaceApi.getActiveContext() as Promise<ActiveWorkspaceContext | null>,
        window.workspaceApi.listMine() as Promise<Workspace[]>,
      ]);
      setContext(ctx);
      setWorkspaces(wsList ?? []);
      return wsList ?? [];
    } catch (e) {
      console.error('Failed to load workspaces:', e);
      return [];
    }
  }

  async function switchWorkspace(id: string) {
    try {
      await window.workspaceApi.switchActive(id);
      const fresh = await loadWorkspaces();
      const ws = fresh.find((w) => w.id === id);
      if (ws) onWorkspaceChange?.(ws);
    } catch (e) {
      console.error('Failed to switch workspace:', e);
    }
  }

  async function createWorkspace() {
    const name = window.prompt('New workspace name:');
    if (!name?.trim()) return;
    try {
      await window.workspaceApi.create({ name: name.trim() });
      await loadWorkspaces();
    } catch (e) {
      console.error('Failed to create workspace:', e);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'flex w-full items-center justify-between px-2 h-8 rounded-md text-sm',
          'hover:bg-accent transition-colors outline-none',
        )}
      >
        <span className="truncate font-medium">
          {context?.workspace.name ?? 'Select workspace'}
        </span>
        <ChevronsUpDown className="h-3 w-3 text-muted-foreground shrink-0 ml-1" />
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-52" side="bottom" align="start">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {workspaces.length === 0 ? (
            <DropdownMenuItem disabled>No workspaces found</DropdownMenuItem>
          ) : (
            workspaces.map((ws) => (
              <DropdownMenuItem key={ws.id} onClick={() => switchWorkspace(ws.id)}>
                <Check
                  className={cn(
                    'h-3.5 w-3.5 mr-2 shrink-0',
                    context?.workspace.id === ws.id ? 'opacity-100' : 'opacity-0',
                  )}
                />
                <span className="truncate">{ws.name}</span>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={createWorkspace}>
          <Plus className="h-4 w-4 mr-2" />
          New workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
