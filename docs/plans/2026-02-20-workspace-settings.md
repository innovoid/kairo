# Workspace Settings Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Team sidebar icon with Workspace page containing General, Encryption, and Team tabs

**Architecture:** Update sidebar navigation, create WorkspacePage with tabbed interface, add IPC handlers for workspace update/delete/leave, move existing TeamPage to Team tab, build encryption UI using existing backend

**Tech Stack:** React, TypeScript, IPC handlers with Supabase, existing workspace-encryption.ts backend, shadcn/ui tabs

---

## Task 1: Add Workspace IPC Handlers

**Files:**
- Modify: `src/main/ipc/workspace.ts`

**Step 1: Add update, delete, leave handlers**

Add these methods to the `workspaceIpcHandlers` export:

```typescript
async updateWorkspace(event: IpcMainInvokeEvent, workspaceId: string, updates: { name: string }): Promise<Workspace> {
  const supabase = await getAuthedClient(event);
  const { data, error } = await supabase
    .from('workspaces')
    .update(updates)
    .eq('id', workspaceId)
    .select('id,name,created_by,created_at,updated_at')
    .single();

  if (error) throw error;
  return toWorkspace(data as WorkspaceRow);
},

async deleteWorkspace(event: IpcMainInvokeEvent, workspaceId: string): Promise<void> {
  const supabase = await getAuthedClient(event);

  // Verify user is owner before allowing deletion
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('created_by')
    .eq('id', workspaceId)
    .single();

  const { data: { user } } = await supabase.auth.getUser();

  if (workspace?.created_by !== user!.id) {
    throw new Error('Only workspace owner can delete workspace');
  }

  const { error } = await supabase
    .from('workspaces')
    .delete()
    .eq('id', workspaceId);

  if (error) throw error;
},

async leaveWorkspace(event: IpcMainInvokeEvent, workspaceId: string): Promise<void> {
  const supabase = await getAuthedClient(event);
  const { data: { user } } = await supabase.auth.getUser();

  // Check if user is the last owner
  const { data: owners } = await supabase
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', workspaceId)
    .eq('role', 'owner');

  if (owners && owners.length === 1 && owners[0].user_id === user!.id) {
    throw new Error('Cannot leave workspace as the last owner. Delete the workspace instead.');
  }

  const { error } = await supabase
    .from('workspace_members')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', user!.id);

  if (error) throw error;
},
```

**Step 2: Test compilation**

Run: `npm run build`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/main/ipc/workspace.ts
git commit -m "feat: add workspace update, delete, leave IPC handlers"
```

---

## Task 2: Update Workspace Preload API

**Files:**
- Modify: `src/preload/workspace-api.ts`

**Step 1: Add new API methods**

```typescript
const workspaceApi = {
  create: (input: CreateWorkspaceInput): Promise<Workspace> =>
    ipcRenderer.invoke('workspace.create', input),
  listMine: (): Promise<Workspace[]> =>
    ipcRenderer.invoke('workspace.listMine'),
  switchActive: (workspaceId: string): Promise<void> =>
    ipcRenderer.invoke('workspace.switchActive', workspaceId),
  getActiveContext: (): Promise<ActiveWorkspaceContext | null> =>
    ipcRenderer.invoke('workspace.getActiveContext'),
  ensurePersonalWorkspace: (): Promise<void> =>
    ipcRenderer.invoke('workspace.ensurePersonalWorkspace'),
  invite: (input: InviteWorkspaceMemberInput): Promise<WorkspaceInvite> =>
    ipcRenderer.invoke('workspace.invite', input),
  acceptInvite: (input: { token: string }): Promise<{ workspaceId: string; role: WorkspaceRole }> =>
    ipcRenderer.invoke('workspace.acceptInvite', input),
  revokeInvite: (workspaceInviteId: string): Promise<void> =>
    ipcRenderer.invoke('workspace.revokeInvite', workspaceInviteId),
  update: (workspaceId: string, updates: { name: string }): Promise<Workspace> =>
    ipcRenderer.invoke('workspace.updateWorkspace', workspaceId, updates),
  delete: (workspaceId: string): Promise<void> =>
    ipcRenderer.invoke('workspace.deleteWorkspace', workspaceId),
  leave: (workspaceId: string): Promise<void> =>
    ipcRenderer.invoke('workspace.leaveWorkspace', workspaceId),
  members: {
    list: (workspaceId: string): Promise<WorkspaceMember[]> =>
      ipcRenderer.invoke('workspace.members.list', workspaceId),
    updateRole: (input: UpdateWorkspaceMemberRoleInput): Promise<void> =>
      ipcRenderer.invoke('workspace.members.updateRole', input),
    remove: (workspaceId: string, userId: string): Promise<void> =>
      ipcRenderer.invoke('workspace.members.remove', workspaceId, userId),
  },
};
```

**Step 2: Register handlers in main process**

Update `src/main/ipc/register.ts`:

```typescript
// In registerWorkspaceIpcHandlers function, add:
register('workspace.updateWorkspace', withSupabase(workspaceIpcHandlers.updateWorkspace));
register('workspace.deleteWorkspace', withSupabase(workspaceIpcHandlers.deleteWorkspace));
register('workspace.leaveWorkspace', withSupabase(workspaceIpcHandlers.leaveWorkspace));
```

**Step 3: Test compilation**

Run: `npm run build`
Expected: No TypeScript errors

**Step 4: Commit**

```bash
git add src/preload/workspace-api.ts src/main/ipc/register.ts
git commit -m "feat: expose workspace update/delete/leave in preload API"
```

---

## Task 3: Update Sidebar for Workspace Icon

**Files:**
- Modify: `src/renderer/src/components/layout/Sidebar.tsx`

**Step 1: Replace Team icon with Workspace**

```tsx
import { SquareTerminal, Server, KeyRound, Briefcase, Settings } from 'lucide-react';

interface SidebarProps {
  onOpenSettings: () => void;
  onGoHome: () => void;
  onGoKeys: () => void;
  onGoWorkspace: () => void;  // Renamed from onGoTeam
  activeView: 'hosts' | 'keys' | 'workspace' | 'settings';  // Changed 'team' to 'workspace'
}

export function Sidebar({ onOpenSettings, onGoHome, onGoKeys, onGoWorkspace, activeView }: SidebarProps) {
  // ... existing code

  // Replace Team button with Workspace:
  <NavButton icon={Briefcase} label="Workspace" active={activeView === 'workspace'} onClick={onGoWorkspace} />
}
```

**Step 2: Update AppShell**

**File:** `src/renderer/src/components/layout/AppShell.tsx`

```tsx
// Update state and handlers:
const sidebarView =
  activeTab?.tabType === 'settings' ? 'settings' :
  activeTab?.tabType === 'keys' ? 'keys' :
  activeTab?.tabType === 'workspace' ? 'workspace' :
  'hosts';

function handleGoWorkspace() {
  openTab({ tabId: 'workspace', tabType: 'workspace', label: 'Workspace' });
}

// Update Sidebar props:
<Sidebar
  onOpenSettings={handleGoSettings}
  onGoHome={handleGoHome}
  onGoKeys={handleGoKeys}
  onGoWorkspace={handleGoWorkspace}
  activeView={sidebarView}
/>

// In tab rendering, replace team with workspace:
{activeTab?.tabType === 'workspace' && <WorkspacePage workspaceId={workspaceId} />}
```

**Step 3: Test manually**

Run: `npm run dev`
Expected: Sidebar shows Workspace icon instead of Team

**Step 4: Commit**

```bash
git add src/renderer/src/components/layout/Sidebar.tsx src/renderer/src/components/layout/AppShell.tsx
git commit -m "feat: replace Team with Workspace in sidebar"
```

---

## Task 4: Create WorkspacePage with Tabs

**Files:**
- Create: `src/renderer/src/features/workspace/WorkspacePage.tsx`

**Step 1: Create WorkspacePage component**

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GeneralTab } from './GeneralTab';
import { EncryptionTab } from './EncryptionTab';
import { TeamTab } from './TeamTab';

export function WorkspacePage({ workspaceId }: { workspaceId: string }) {
  return (
    <div className="flex flex-col flex-1 h-full bg-background overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        <Tabs defaultValue="general" orientation="vertical" className="flex flex-1 overflow-hidden">
          {/* Nav wrapper */}
          <div className="w-44 shrink-0 border-r bg-muted/10 flex flex-col">
            <TabsList className="flex flex-col w-full rounded-none bg-transparent p-2 gap-0.5 justify-start">
              <TabsTrigger value="general" className="w-full justify-start px-3 py-1.5 text-sm">
                General
              </TabsTrigger>
              <TabsTrigger value="encryption" className="w-full justify-start px-3 py-1.5 text-sm">
                Encryption
              </TabsTrigger>
              <TabsTrigger value="team" className="w-full justify-start px-3 py-1.5 text-sm">
                Team
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto">
            <TabsContent value="general" className="p-6 m-0">
              <GeneralTab workspaceId={workspaceId} />
            </TabsContent>
            <TabsContent value="encryption" className="p-6 m-0">
              <EncryptionTab workspaceId={workspaceId} />
            </TabsContent>
            <TabsContent value="team" className="p-6 m-0">
              <TeamTab workspaceId={workspaceId} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
```

**Step 2: Test compilation**

Run: `npm run build`
Expected: Build fails (tabs not created yet - expected)

**Step 3: Commit**

```bash
git add src/renderer/src/features/workspace/WorkspacePage.tsx
git commit -m "feat: create WorkspacePage shell with tab structure"
```

---

## Task 5: Create GeneralTab Component

**Files:**
- Create: `src/renderer/src/features/workspace/GeneralTab.tsx`

**Step 1: Create GeneralTab component**

```tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ActiveWorkspaceContext } from '@shared/types/workspace';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

export function GeneralTab({ workspaceId }: { workspaceId: string }) {
  const navigate = useNavigate();
  const [context, setContext] = useState<ActiveWorkspaceContext | null>(null);
  const [workspaceName, setWorkspaceName] = useState('');
  const [confirmName, setConfirmName] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    window.workspaceApi.getActiveContext().then((ctx) => {
      setContext(ctx);
      setWorkspaceName(ctx?.workspace.name || '');
    });
  }, []);

  async function handleRename() {
    if (!workspaceName.trim()) {
      toast.error('Workspace name cannot be empty');
      return;
    }

    setLoading(true);
    try {
      await window.workspaceApi.update(workspaceId, { name: workspaceName });
      toast.success('Workspace renamed');
      // Refresh context
      const ctx = await window.workspaceApi.getActiveContext();
      setContext(ctx);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (confirmName !== context?.workspace.name) {
      toast.error('Workspace name does not match');
      return;
    }

    setLoading(true);
    try {
      await window.workspaceApi.delete(workspaceId);
      toast.success('Workspace deleted');

      // Switch to personal workspace
      const workspaces = await window.workspaceApi.listMine();
      const personalWs = workspaces.find(w => w.name.includes('Personal') || workspaces[0]);
      if (personalWs) {
        await window.workspaceApi.switchActive(personalWs.id);
      }

      // Redirect to hosts
      navigate('/');
      window.location.reload();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLoading(false);
      setShowDeleteDialog(false);
    }
  }

  async function handleLeave() {
    setLoading(true);
    try {
      await window.workspaceApi.leave(workspaceId);
      toast.success('Left workspace');

      // Switch to personal workspace
      const workspaces = await window.workspaceApi.listMine();
      const personalWs = workspaces.find(w => w.name.includes('Personal') || workspaces[0]);
      if (personalWs) {
        await window.workspaceApi.switchActive(personalWs.id);
      }

      navigate('/');
      window.location.reload();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (!context) {
    return <div>Loading...</div>;
  }

  const { workspace, role } = context;
  const isOwner = role === 'owner';
  const canEdit = isOwner || role === 'admin';

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h2 className="text-base font-semibold mb-1">Workspace Settings</h2>
        <p className="text-sm text-muted-foreground">
          Manage your workspace information and membership
        </p>
      </div>
      <Separator />

      {/* Workspace Information */}
      <Card>
        <CardHeader>
          <CardTitle>Workspace Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="workspace-name">Name</Label>
            <div className="flex gap-2">
              <Input
                id="workspace-name"
                value={workspaceName}
                onChange={e => setWorkspaceName(e.target.value)}
                disabled={!canEdit}
              />
              <Button
                onClick={handleRename}
                disabled={!canEdit || loading || workspaceName === workspace.name}
              >
                Save
              </Button>
            </div>
          </div>
          <div>
            <Label>Created by</Label>
            <p className="text-sm">{workspace.createdBy}</p>
          </div>
          <div>
            <Label>Created on</Label>
            <p className="text-sm">{new Date(workspace.createdAt).toLocaleDateString()}</p>
          </div>
          <div>
            <Label>Your role</Label>
            <Badge variant={isOwner ? 'default' : 'secondary'}>{role}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          {isOwner ? (
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Delete this workspace and all its data permanently. This cannot be undone.
              </p>
              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
                disabled={loading}
              >
                Delete Workspace
              </Button>
            </div>
          ) : (
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Leave this workspace. You can be re-invited later.
              </p>
              <Button
                variant="destructive"
                onClick={handleLeave}
                disabled={loading}
              >
                Leave Workspace
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the workspace "{workspace.name}" and all its hosts, keys, and members.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="confirm-name">Type the workspace name to confirm</Label>
            <Input
              id="confirm-name"
              value={confirmName}
              onChange={e => setConfirmName(e.target.value)}
              placeholder={workspace.name}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={confirmName !== workspace.name || loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Workspace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

**Step 2: Test manually**

Run: `npm run dev`
Expected: General tab shows workspace info with rename/delete/leave options

**Step 3: Commit**

```bash
git add src/renderer/src/features/workspace/GeneralTab.tsx
git commit -m "feat: add GeneralTab with rename/delete/leave functionality"
```

---

## Task 6: Create EncryptionTab Component

**Files:**
- Create: `src/renderer/src/features/workspace/EncryptionTab.tsx`

**Step 1: Create EncryptionTab component**

```tsx
import { useState, useEffect } from 'react';
import type { SshKey } from '@shared/types/keys';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

export function EncryptionTab({ workspaceId }: { workspaceId: string }) {
  const [keys, setKeys] = useState<SshKey[]>([]);
  const [isEncryptionEnabled, setIsEncryptionEnabled] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmNewPass, setConfirmNewPass] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadKeys();
    checkEncryption();
  }, [workspaceId]);

  async function loadKeys() {
    const keysList = await window.keysApi.list(workspaceId);
    setKeys(keysList);
  }

  async function checkEncryption() {
    const enabled = await window.keysApi.isWorkspaceEncryptionInitialized(workspaceId);
    setIsEncryptionEnabled(enabled);
  }

  async function handleInitialize(e: React.FormEvent) {
    e.preventDefault();
    if (passphrase !== confirmPassphrase) {
      toast.error('Passphrases do not match');
      return;
    }

    setLoading(true);
    try {
      const success = await window.keysApi.initializeWorkspaceEncryption(workspaceId, passphrase);
      if (success) {
        toast.success('Encryption enabled successfully');
        setIsEncryptionEnabled(true);
        setPassphrase('');
        setConfirmPassphrase('');
      }
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleChangePassphrase(e: React.FormEvent) {
    e.preventDefault();
    if (newPass !== confirmNewPass) {
      toast.error('New passphrases do not match');
      return;
    }

    setLoading(true);
    try {
      const success = await window.keysApi.changeWorkspacePassphrase(
        workspaceId,
        currentPass,
        newPass
      );
      if (success) {
        toast.success('Passphrase changed successfully');
        setCurrentPass('');
        setNewPass('');
        setConfirmNewPass('');
      }
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSyncKey(keyId: string) {
    const pass = prompt('Enter workspace passphrase:');
    if (!pass) return;

    setLoading(true);
    try {
      const success = await window.keysApi.syncKeyToCloud(workspaceId, keyId, pass);
      if (success) {
        toast.success('Key synced to cloud');
        await loadKeys();
      }
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const syncedKeysCount = keys.filter(k => k.hasEncryptedSync).length;
  const passphraseStrength = passphrase.length >= 12 ? 100 : passphrase.length >= 8 ? 60 : passphrase.length >= 4 ? 30 : 0;

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h2 className="text-base font-semibold mb-1">Encryption</h2>
        <p className="text-sm text-muted-foreground">
          Securely sync your SSH keys to the cloud
        </p>
      </div>
      <Separator />

      {/* Encryption Status */}
      <Card>
        <CardHeader>
          <CardTitle>Encryption Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {isEncryptionEnabled ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span>Encryption active • {syncedKeysCount} keys synced</span>
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-muted-foreground" />
                <span>Not initialized</span>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Initialize Encryption */}
      {!isEncryptionEnabled && (
        <Card>
          <CardHeader>
            <CardTitle>Enable Encryption</CardTitle>
            <CardDescription>
              Set a passphrase to securely sync your SSH keys to the cloud
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInitialize} className="space-y-3">
              <div>
                <Label htmlFor="passphrase">Passphrase</Label>
                <Input
                  id="passphrase"
                  type="password"
                  value={passphrase}
                  onChange={e => setPassphrase(e.target.value)}
                  required
                />
                {passphrase && (
                  <div className="mt-2">
                    <Progress value={passphraseStrength} className="h-1" />
                    <p className="text-xs text-muted-foreground mt-1">
                      {passphraseStrength >= 100 ? 'Strong' : passphraseStrength >= 60 ? 'Good' : 'Weak'}
                    </p>
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor="confirm-passphrase">Confirm Passphrase</Label>
                <Input
                  id="confirm-passphrase"
                  type="password"
                  value={confirmPassphrase}
                  onChange={e => setConfirmPassphrase(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={loading || !passphrase || passphrase !== confirmPassphrase}>
                Enable Encryption
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Change Passphrase */}
      {isEncryptionEnabled && (
        <Card>
          <CardHeader>
            <CardTitle>Change Passphrase</CardTitle>
            <CardDescription>
              This will re-encrypt all synced keys with the new passphrase
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassphrase} className="space-y-3">
              <div>
                <Label htmlFor="current-pass">Current Passphrase</Label>
                <Input
                  id="current-pass"
                  type="password"
                  value={currentPass}
                  onChange={e => setCurrentPass(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="new-pass">New Passphrase</Label>
                <Input
                  id="new-pass"
                  type="password"
                  value={newPass}
                  onChange={e => setNewPass(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="confirm-new-pass">Confirm New Passphrase</Label>
                <Input
                  id="confirm-new-pass"
                  type="password"
                  value={confirmNewPass}
                  onChange={e => setConfirmNewPass(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={loading}>
                Change Passphrase
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Encrypted Keys */}
      {isEncryptionEnabled && keys.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Encrypted Keys</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {keys.map(key => (
                <div key={key.id} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{key.name}</p>
                    <p className="text-xs text-muted-foreground">{key.fingerprint}</p>
                  </div>
                  {key.hasEncryptedSync ? (
                    <Badge variant="default">Synced</Badge>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => handleSyncKey(key.id)}>
                      Sync to Cloud
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

**Step 2: Test manually**

Run: `npm run dev`
Expected: Encryption tab shows status and passphrase management

**Step 3: Commit**

```bash
git add src/renderer/src/features/workspace/EncryptionTab.tsx
git commit -m "feat: add EncryptionTab with passphrase management"
```

---

## Task 7: Move TeamPage to TeamTab

**Files:**
- Modify: `src/renderer/src/features/team/TeamPage.tsx` → Rename to `src/renderer/src/features/workspace/TeamTab.tsx`

**Step 1: Copy and rename TeamPage**

```bash
cp src/renderer/src/features/team/TeamPage.tsx src/renderer/src/features/workspace/TeamTab.tsx
```

**Step 2: Update TeamTab export**

In `TeamTab.tsx`, change:

```tsx
export function TeamPage({ workspaceId }: { workspaceId: string }) {
```

to:

```tsx
export function TeamTab({ workspaceId }: { workspaceId: string }) {
```

**Step 3: Remove the top-level container div**

TeamTab is now rendered inside WorkspacePage's tab content, so remove the outer `<div className="flex flex-1 h-full overflow-hidden">` wrapper.

Keep only the inner content starting from `<div className="flex-1 overflow-y-auto">`.

**Step 4: Test manually**

Run: `npm run dev`
Expected: Team tab shows members list

**Step 5: Commit**

```bash
git add src/renderer/src/features/workspace/TeamTab.tsx
git commit -m "feat: create TeamTab from existing TeamPage"
```

---

## Task 8: Update Session Store Tab Type

**Files:**
- Modify: `src/renderer/src/stores/session-store.ts`

**Step 1: Add 'workspace' tab type**

Update the TabType to include 'workspace':

```typescript
export type TabType = 'hosts' | 'keys' | 'team' | 'workspace' | 'settings' | 'terminal' | 'sftp';
```

Change 'team' to 'workspace' or add 'workspace' if needed for compatibility.

**Step 2: Test compilation**

Run: `npm run build`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/renderer/src/stores/session-store.ts
git commit -m "feat: add workspace tab type to session store"
```

---

## Task 9: Final Integration & Testing

**Step 1: Test complete workspace flow**

Run: `npm run dev`

Test checklist:
- [ ] Workspace icon appears in sidebar
- [ ] Click Workspace → WorkspacePage opens
- [ ] General tab shows workspace info
- [ ] Can rename workspace (owner/admin only)
- [ ] Delete workspace works (owner only, confirms name)
- [ ] Leave workspace works (non-owners)
- [ ] Encryption tab shows status
- [ ] Can initialize encryption
- [ ] Can change passphrase
- [ ] Can sync keys to cloud
- [ ] Team tab shows members
- [ ] All navigation works

**Step 2: Fix any issues found**

Address bugs discovered during testing.

**Step 3: Final commit**

```bash
git add -A
git commit -m "test: verify all workspace settings features work"
```

---

## Testing Checklist

- [ ] Workspace icon in sidebar
- [ ] WorkspacePage opens with tabs
- [ ] General tab loads workspace info
- [ ] Rename workspace saves correctly
- [ ] Delete workspace requires name confirmation
- [ ] Delete switches to personal workspace
- [ ] Leave workspace works for non-owners
- [ ] Cannot leave as last owner
- [ ] Encryption status shows correctly
- [ ] Initialize encryption creates passphrase
- [ ] Change passphrase re-encrypts keys
- [ ] Sync key to cloud works
- [ ] Team tab shows members (existing functionality)
- [ ] All IPC handlers work correctly

---

## Completion Criteria

✅ Workspace IPC handlers (update, delete, leave)
✅ Workspace preload API methods
✅ Sidebar shows Workspace icon
✅ WorkspacePage with tab navigation
✅ GeneralTab with rename/delete/leave
✅ EncryptionTab with passphrase management
✅ TeamTab (moved from TeamPage)
✅ All tabs render correctly
✅ All permissions enforced (owner/admin/member)
✅ Navigation between tabs works
✅ No console errors
✅ All features tested manually

---

## Notes

- Existing workspace-encryption.ts backend used (no changes needed)
- Team functionality preserved, just moved to new location
- RLS handles permission enforcement
- Delete workspace cascades to all related data
- Leave workspace prevents last owner from leaving
- Encryption is workspace-wide (all members share passphrase)
