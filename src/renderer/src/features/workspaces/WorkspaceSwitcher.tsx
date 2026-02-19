import { useState, useEffect } from 'react';
import { useWorkspaceStore } from '../../stores/workspace-store';
import { AvatarInitials } from '../../components/ui/avatar-initials';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../components/ui/popover';
import { Button } from '../../components/ui/button';
import { Check, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';

export function WorkspaceSwitcher() {
  const { workspaces, activeWorkspace, setActiveWorkspace, fetchWorkspaces } = useWorkspaceStore();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const handleSwitchWorkspace = async (workspaceId: string) => {
    await setActiveWorkspace(workspaceId);
    setOpen(false);
    // Reload the page to refresh all workspace-dependent data
    window.location.reload();
  };

  const handleCreateWorkspace = () => {
    // TODO: Open create workspace dialog
    console.log('Create new workspace');
    setOpen(false);
  };

  const workspaceName = activeWorkspace?.name || 'Workspace';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center justify-center h-10 w-10 rounded-md transition-colors hover:bg-accent">
          <AvatarInitials name={workspaceName} size="sm" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" side="right" align="start" sideOffset={8}>
        <div className="space-y-1">
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
            Workspaces
          </div>
          {workspaces.map((workspace) => (
            <button
              key={workspace.id}
              onClick={() => handleSwitchWorkspace(workspace.id)}
              className={cn(
                'w-full flex items-center gap-3 px-2 py-2 rounded-md text-sm transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
                workspace.id === activeWorkspace?.id && 'bg-accent'
              )}
            >
              <AvatarInitials name={workspace.name} size="sm" />
              <span className="flex-1 text-left truncate">{workspace.name}</span>
              {workspace.id === activeWorkspace?.id && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </button>
          ))}
          <div className="border-t my-1" />
          <Button
            variant="ghost"
            className="w-full justify-start text-sm"
            onClick={handleCreateWorkspace}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Workspace
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
