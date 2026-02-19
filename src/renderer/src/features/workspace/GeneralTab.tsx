import { useEffect, useState } from 'react';
import type { ActiveWorkspaceContext } from '@shared/types/workspace';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface GeneralTabProps {
  workspaceId: string;
}

export function GeneralTab({ workspaceId }: GeneralTabProps) {
  const [context, setContext] = useState<ActiveWorkspaceContext | null>(null);
  const [workspaceName, setWorkspaceName] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  // Load workspace context on mount
  useEffect(() => {
    const loadContext = async () => {
      try {
        setIsLoading(true);
        const data = (await window.workspaceApi.getActiveContext()) as ActiveWorkspaceContext | null;
        setContext(data);
        if (data?.workspace.name) {
          setWorkspaceName(data.workspace.name);
        }
      } catch (error) {
        console.error('Failed to load workspace context:', error);
        toast.error('Failed to load workspace information');
      } finally {
        setIsLoading(false);
      }
    };

    loadContext();
  }, []);

  const handleRename = async () => {
    if (!workspaceName.trim()) {
      toast.error('Workspace name cannot be empty');
      return;
    }

    if (workspaceName === context?.workspace.name) {
      setIsEditing(false);
      return;
    }

    try {
      setIsSaving(true);
      await window.workspaceApi.update(workspaceId, { name: workspaceName });
      setContext((prev) =>
        prev
          ? {
              ...prev,
              workspace: { ...prev.workspace, name: workspaceName },
            }
          : null
      );
      setIsEditing(false);
      toast.success('Workspace renamed successfully');
    } catch (error) {
      console.error('Failed to rename workspace:', error);
      toast.error((error as Error).message || 'Failed to rename workspace');
      setWorkspaceName(context?.workspace.name || '');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await window.workspaceApi.delete(workspaceId);
      toast.success('Workspace deleted successfully');
      // Switch to personal workspace
      try {
        const personalWs = await window.workspaceApi.ensurePersonalWorkspace();
        if (personalWs) {
          await window.workspaceApi.switchActive((personalWs as { id: string }).id);
        }
      } catch {
        console.warn('Failed to switch to personal workspace');
      }
    } catch (error) {
      console.error('Failed to delete workspace:', error);
      toast.error((error as Error).message || 'Failed to delete workspace');
    } finally {
      setIsDeleting(false);
      setDeleteConfirmName('');
    }
  };

  const handleLeave = async () => {
    try {
      setIsLeaving(true);
      await window.workspaceApi.leave(workspaceId);
      toast.success('Left workspace successfully');
      // Switch to personal workspace
      try {
        const personalWs = await window.workspaceApi.ensurePersonalWorkspace();
        if (personalWs) {
          await window.workspaceApi.switchActive((personalWs as { id: string }).id);
        }
      } catch {
        console.warn('Failed to switch to personal workspace');
      }
    } catch (error) {
      console.error('Failed to leave workspace:', error);
      toast.error((error as Error).message || 'Failed to leave workspace');
    } finally {
      setIsLeaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-6">
        <div className="h-8 bg-muted animate-pulse rounded" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!context) {
    return (
      <div className="max-w-2xl space-y-6">
        <Alert>
          <AlertDescription>Failed to load workspace information</AlertDescription>
        </Alert>
      </div>
    );
  }

  const isOwner = context.role === 'owner';
  const isDefaultPersonal = context.isDefaultPersonal;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-base font-semibold mb-1">Workspace Settings</h2>
        <p className="text-sm text-muted-foreground">
          Manage your workspace name and membership.
        </p>
      </div>

      <Separator />

      {/* Workspace Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workspace Information</CardTitle>
          <CardDescription>View and manage workspace details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Workspace Name */}
          <div className="space-y-2">
            <Label htmlFor="workspace-name">Workspace Name</Label>
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <Input
                    id="workspace-name"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    placeholder="Enter workspace name"
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    onClick={handleRename}
                    disabled={isSaving}
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setWorkspaceName(context.workspace.name);
                      setIsEditing(false);
                    }}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Input
                    id="workspace-name"
                    value={workspaceName}
                    readOnly
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsEditing(true)}
                  >
                    Edit
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Created By */}
          <div className="space-y-2">
            <Label>Created By</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-muted-foreground">
                {context.workspace.createdBy}
              </span>
            </div>
          </div>

          {/* Created On */}
          <div className="space-y-2">
            <Label>Created On</Label>
            <div className="text-sm text-muted-foreground">
              {new Date(context.workspace.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}{' '}
              at{' '}
              {new Date(context.workspace.createdAt).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>

          {/* Role */}
          <div className="space-y-2">
            <Label>Your Role</Label>
            <div className="flex items-center gap-2">
              <Badge variant={isOwner ? 'default' : 'secondary'}>
                {context.role.charAt(0).toUpperCase() + context.role.slice(1)}
              </Badge>
              {isDefaultPersonal && (
                <Badge variant="outline" className="text-xs">
                  Personal
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50 bg-destructive/5">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            {isOwner
              ? 'Irreversible actions that affect your entire workspace'
              : 'Leave this workspace'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Delete (Owner Only) */}
          {isOwner && (
            <AlertDialog>
              <AlertDialogTrigger render={(props) => (
                <Button {...props} variant="destructive" className="w-full">
                  Delete Workspace
                </Button>
              )} />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Workspace</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. Please type the workspace name{' '}
                    <span className="font-mono font-semibold">{context.workspace.name}</span> to
                    confirm deletion.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-4">
                  <Input
                    placeholder={`Type "${context.workspace.name}" to confirm`}
                    value={deleteConfirmName}
                    onChange={(e) => setDeleteConfirmName(e.target.value)}
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    disabled={deleteConfirmName !== context.workspace.name || isDeleting}
                    onClick={handleDelete}
                  >
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {/* Leave (Members) */}
          {!isOwner && (
            <AlertDialog>
              <AlertDialogTrigger render={(props) => (
                <Button {...props} variant="outline" className="w-full text-destructive border-destructive">
                  Leave Workspace
                </Button>
              )} />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Leave Workspace</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to leave <span className="font-semibold">{context.workspace.name}</span>? You can request
                    to join again later if needed.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    disabled={isLeaving}
                    onClick={handleLeave}
                  >
                    {isLeaving ? 'Leaving...' : 'Leave Workspace'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
