# ArchTerm User Profile & Workspace Features - Design Document

**Date:** 2026-02-20
**Status:** Approved
**Implementation Approach:** Sequential Vertical Slices (Approach 1)

## Overview

This document covers the design for completing ArchTerm's user profile, workspace management, and polish features. The existing codebase has authentication, workspace backend, and settings infrastructure. This design adds user profile management, workspace settings UI, account controls, and nice-to-have polish features.

## Architecture Principles

All features follow established patterns:
- **Main Process:** Supabase for user/workspace data, existing workspace-encryption backend for key sync
- **IPC Layer:** Event-based handlers with `withSupabase` middleware where needed
- **Renderer:** Zustand stores + React components with shadcn/ui
- **Data Flow:** User action → Store/Direct Supabase call → IPC (if needed) → Response

## Implementation Approach: Sequential Vertical Slices

Complete features as end-to-end slices (backend + IPC + UI + test):

1. **User Profile & Logout** (Week 1 - Critical)
2. **Workspace Settings Page** (Week 1 - High Priority)
3. **Settings Enhancements** (Week 2 - Medium Priority)
4. **Nice-to-Have Features** (Week 2-3 - Polish)

---

## Overall Structure Changes

### Sidebar Navigation

**Current:**
- 🖥️ Hosts
- 🔑 SSH Keys
- 👥 Team
- ⚙️ Settings (bottom)

**New:**
- 🖥️ Hosts
- 🔑 SSH Keys
- 🏢 Workspace (replaces Team - opens Workspace page with tabs)
- ⚙️ Settings (bottom)
- 👤 **User Profile button** (bottom, above Settings) - NEW

### User Menu Dropdown

**Triggered by:** Click user profile button in sidebar

**Menu Items:**
- Profile → Opens ProfilePage
- Account Settings → Opens Settings page, Account tab
- ────────── (separator)
- Log Out (red/destructive styling)

### Workspace Page Organization

Team functionality moves from sidebar to Workspace page:

**Workspace Page Tabs:**
- General - Workspace info, rename, delete/leave
- Encryption - Initialize/change passphrase, sync keys
- Team - Members, invites, roles (existing TeamPage moves here)

---

## Feature Group 1: User Profile & Logout

### Components

#### 1. User Profile Button (Sidebar)
**File:** `src/renderer/src/components/layout/Sidebar.tsx`

**Changes:**
- Add user profile button at bottom (above Settings)
- Small avatar circle with user initials (or generic icon)
- Click triggers UserMenu dropdown
- Update `SidebarProps` if needed

**Visual:**
```
┌──────────┐
│ [JD] 👤  │  ← User initials in colored circle
└──────────┘
```

#### 2. User Menu Dropdown
**File:** `src/renderer/src/components/layout/UserMenu.tsx` (NEW)

**Component:** Uses shadcn `DropdownMenu`

**Structure:**
```tsx
<DropdownMenu>
  <DropdownMenuTrigger>
    {/* Profile button from Sidebar */}
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuLabel>
      <div className="flex flex-col">
        <span className="font-medium">{user.name}</span>
        <span className="text-xs text-muted-foreground">{user.email}</span>
      </div>
    </DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuItem onClick={openProfile}>
      <User className="mr-2 h-4 w-4" />
      Profile
    </DropdownMenuItem>
    <DropdownMenuItem onClick={openAccountSettings}>
      <Settings className="mr-2 h-4 w-4" />
      Account Settings
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem onClick={handleLogout} className="text-destructive">
      <LogOut className="mr-2 h-4 w-4" />
      Log Out
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

**Data Source:**
- Get user from Supabase: `supabase.auth.getUser()`
- User object has: `email`, `user_metadata.name`

#### 3. Profile Page
**File:** `src/renderer/src/features/profile/ProfilePage.tsx` (NEW)

**Layout:** Full page (not a tab, replaces main content)

**Sections:**

**A. Profile Information Card**
- Display name (editable)
- Email (read-only, from auth.users)
- Avatar placeholder (initials for now, upload future)
- Save button (disabled until changes made)

**B. Change Password**
- Current password input
- New password input (with strength indicator)
- Confirm new password input
- Change Password button
- Shows validation errors inline

**C. Danger Zone**
- Red border card
- Delete Account button
- Opens confirmation dialog:
  - Warning message
  - Password confirmation input
  - "Delete My Account" button (disabled until password entered)

**Actions:**

**Update Profile:**
```tsx
async function handleUpdateProfile() {
  const { error } = await supabase.auth.updateUser({
    data: { name: newName }
  });
  if (error) {
    toast.error(error.message);
  } else {
    toast.success('Profile updated');
  }
}
```

**Change Password:**
```tsx
async function handleChangePassword() {
  const { error } = await supabase.auth.updateUser({
    password: newPassword
  });
  if (error) {
    toast.error(error.message);
  } else {
    toast.success('Password changed successfully');
    // Optionally log out and require re-login
  }
}
```

**Delete Account:**
```tsx
async function handleDeleteAccount() {
  // First delete user data via RPC
  const { error } = await supabase.rpc('delete_user_account');
  if (error) {
    toast.error('Failed to delete account');
  } else {
    // Then sign out
    await supabase.auth.signOut();
    window.authApi.setAccessToken(null);
    // Redirect handled by AuthGate
  }
}
```

#### 4. Account Settings Tab
**File:** `src/renderer/src/features/settings/SettingsPage.tsx` (MODIFY)

**Add Tab:** "Account" (5th tab after Terminal, Appearance, AI)

**Tab Content:**

**Profile Management Section:**
- Summary card showing name, email, avatar
- "Edit Profile" button → Opens ProfilePage
- Last updated timestamp

**Security Section:**
- Active sessions indicator: "You're logged in on this device"
- "Change Password" button → Opens ProfilePage with focus on password section
- 2FA placeholder: "Two-factor authentication (Coming soon)"

**Data & Privacy Section:**
- "Export Data" button:
  - Downloads JSON file with all user data
  - Includes: hosts (no passwords), SSH keys (public only), settings, workspaces
- "Delete Account" link → Opens ProfilePage danger zone

**Export Data Implementation:**
```tsx
async function handleExportData() {
  const hosts = await window.hostsApi.list(workspaceId);
  const keys = await window.keysApi.list(workspaceId);
  const settings = await window.settingsApi.get();
  const workspaces = await window.workspaceApi.listMine();

  const data = {
    exported_at: new Date().toISOString(),
    hosts: hosts.map(h => ({ ...h, password: undefined })),
    keys: keys.map(k => ({ name: k.name, publicKey: k.publicKey })),
    settings,
    workspaces
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `archterm-export-${Date.now()}.json`;
  a.click();
}
```

### Backend Requirements

#### Supabase RPC Function
**File:** Create new migration `supabase/migrations/20260220_user_deletion.sql`

```sql
-- Function to delete all user data before account deletion
CREATE OR REPLACE FUNCTION delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Delete user-specific data
  DELETE FROM user_workspace_settings WHERE user_id = current_user_id;
  DELETE FROM workspace_members WHERE user_id = current_user_id;
  DELETE FROM settings WHERE user_id = current_user_id;

  -- Workspaces where user is the only owner should also be deleted
  -- This is handled by cascading deletes in the schema

  -- Note: Actual auth.users deletion happens via Supabase admin API
  -- or automatically when the user signs out
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION delete_user_account() TO authenticated;
```

### Logout Flow

**Triggered by:** User clicks "Log Out" in UserMenu

**Steps:**
1. Call `supabase.auth.signOut()` in renderer
2. Clear access token: `window.authApi.setAccessToken(null)`
3. Clear any local Zustand state (optional, AuthGate will handle)
4. AuthGate detects no session
5. Redirects to LoginPage

**Implementation:**
```tsx
async function handleLogout() {
  try {
    await supabase.auth.signOut();
    await window.authApi.setAccessToken(null);
    // AuthGate will detect session loss and redirect to login
  } catch (error) {
    toast.error('Failed to log out');
  }
}
```

### Error Handling

**Profile Update Errors:**
- Network error: "Could not connect, please try again"
- Validation error: Show specific field errors
- Generic error: Show error message from Supabase

**Password Change Errors:**
- Current password incorrect: "Current password is incorrect"
- Weak password: "Password must be at least 8 characters"
- Passwords don't match: "Passwords do not match"

**Account Deletion Errors:**
- Wrong password: "Incorrect password"
- Network error: "Could not delete account, try again"
- Already deleted: Log out anyway

---

## Feature Group 2: Workspace Settings Page

### Sidebar Changes

**File:** `src/renderer/src/components/layout/Sidebar.tsx`

**Changes:**
- Replace `<Users>` icon with `<Building2>` or `<Briefcase>` icon
- Change label from "Team" to "Workspace"
- Update `activeView` type: `'hosts' | 'keys' | 'workspace' | 'settings'`
- Update `onGoTeam` prop to `onGoWorkspace`

**File:** `src/renderer/src/components/layout/AppShell.tsx`

**Changes:**
- Update handlers to route to Workspace page instead of Team
- Handle new 'workspace' tab type

### Workspace Page Structure

**File:** `src/renderer/src/features/workspace/WorkspacePage.tsx` (NEW)

**Layout:** Vertical tabs (like Settings page)

**Props:**
```tsx
interface WorkspacePageProps {
  workspaceId: string;
  activeTab: 'general' | 'encryption' | 'team';
  onTabChange: (tab: string) => void;
}
```

**Tabs:**
1. General - Workspace info and management
2. Encryption - Passphrase and key sync
3. Team - Members and invites (moved from TeamPage)

### Tab 1: General

**File:** `src/renderer/src/features/workspace/GeneralTab.tsx` (NEW)

**Sections:**

**A. Workspace Information**
```tsx
<Card>
  <CardHeader>
    <CardTitle>Workspace Information</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="space-y-3">
      <div>
        <Label>Name</Label>
        <div className="flex gap-2">
          <Input
            value={workspaceName}
            onChange={e => setWorkspaceName(e.target.value)}
            disabled={role !== 'owner' && role !== 'admin'}
          />
          <Button
            onClick={handleRename}
            disabled={role !== 'owner' && role !== 'admin'}
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
        <p className="text-sm">{formatDate(workspace.createdAt)}</p>
      </div>
      <div>
        <Label>Your role</Label>
        <Badge>{role}</Badge>
      </div>
    </div>
  </CardContent>
</Card>
```

**B. Danger Zone**
```tsx
<Card className="border-destructive">
  <CardHeader>
    <CardTitle>Danger Zone</CardTitle>
  </CardHeader>
  <CardContent className="space-y-3">
    {role === 'owner' ? (
      <div>
        <p className="text-sm text-muted-foreground mb-2">
          Delete this workspace and all its data permanently.
        </p>
        <Button
          variant="destructive"
          onClick={openDeleteDialog}
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
        >
          Leave Workspace
        </Button>
      </div>
    )}
  </CardContent>
</Card>
```

**Actions:**

**Rename Workspace:**
```tsx
async function handleRename() {
  const { error } = await supabase
    .from('workspaces')
    .update({ name: workspaceName })
    .eq('id', workspaceId);

  if (error) {
    toast.error('Failed to rename workspace');
  } else {
    toast.success('Workspace renamed');
    // Refresh workspace context
  }
}
```

**Delete Workspace:**
```tsx
async function handleDelete() {
  // Confirmation dialog: user must type workspace name
  const { error } = await supabase
    .from('workspaces')
    .delete()
    .eq('id', workspaceId);

  if (error) {
    toast.error('Failed to delete workspace');
  } else {
    toast.success('Workspace deleted');
    // Switch to personal workspace
    await window.workspaceApi.switchActive(personalWorkspaceId);
    // Redirect to hosts page
  }
}
```

**Leave Workspace:**
```tsx
async function handleLeave() {
  const { error } = await supabase
    .from('workspace_members')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId);

  if (error) {
    toast.error('Failed to leave workspace');
  } else {
    toast.success('Left workspace');
    // Switch to personal workspace
    await window.workspaceApi.switchActive(personalWorkspaceId);
  }
}
```

### Tab 2: Encryption

**File:** `src/renderer/src/features/workspace/EncryptionTab.tsx` (NEW)

**Uses existing backend:** `src/main/services/workspace-encryption.ts`

**Sections:**

**A. Encryption Status**
```tsx
<Card>
  <CardHeader>
    <CardTitle>Encryption Status</CardTitle>
  </CardHeader>
  <CardContent>
    {isEncryptionEnabled ? (
      <div className="flex items-center gap-2">
        <CheckCircle className="h-5 w-5 text-green-500" />
        <span>Encryption active • {syncedKeysCount} keys synced</span>
      </div>
    ) : (
      <div className="flex items-center gap-2">
        <XCircle className="h-5 w-5 text-muted-foreground" />
        <span>Not initialized</span>
      </div>
    )}
  </CardContent>
</Card>
```

**B. Initialize Encryption (if not enabled)**
```tsx
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
        <Label>Passphrase</Label>
        <Input
          type="password"
          value={passphrase}
          onChange={e => setPassphrase(e.target.value)}
        />
        {/* Password strength indicator */}
      </div>
      <div>
        <Label>Confirm Passphrase</Label>
        <Input
          type="password"
          value={confirmPassphrase}
          onChange={e => setConfirmPassphrase(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={!canSubmit}>
        Enable Encryption
      </Button>
    </form>
  </CardContent>
</Card>
```

**C. Change Passphrase (if enabled)**
```tsx
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
        <Label>Current Passphrase</Label>
        <Input type="password" value={currentPass} onChange={e => setCurrentPass(e.target.value)} />
      </div>
      <div>
        <Label>New Passphrase</Label>
        <Input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} />
      </div>
      <div>
        <Label>Confirm New Passphrase</Label>
        <Input type="password" value={confirmNewPass} onChange={e => setConfirmNewPass(e.target.value)} />
      </div>
      <Button type="submit">Change Passphrase</Button>
    </form>
  </CardContent>
</Card>
```

**D. Encrypted Keys Management**
```tsx
<Card>
  <CardHeader>
    <CardTitle>Encrypted Keys</CardTitle>
  </CardHeader>
  <CardContent>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Key Name</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {keys.map(key => (
          <TableRow key={key.id}>
            <TableCell>{key.name}</TableCell>
            <TableCell>
              {key.hasEncryptedSync ? (
                <Badge variant="success">Synced</Badge>
              ) : (
                <Badge variant="secondary">Local only</Badge>
              )}
            </TableCell>
            <TableCell>
              {!key.hasEncryptedSync ? (
                <Button size="sm" onClick={() => syncKey(key.id)}>
                  Sync to Cloud
                </Button>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost">...</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => downloadKey(key.id)}>
                      Download from Cloud
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => deleteFromCloud(key.id)}>
                      Remove from Cloud
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </CardContent>
</Card>
```

**Actions:**

**Initialize Encryption:**
```tsx
async function handleInitialize() {
  if (passphrase !== confirmPassphrase) {
    toast.error('Passphrases do not match');
    return;
  }

  const success = await window.keysApi.initializeWorkspaceEncryption(
    workspaceId,
    passphrase
  );

  if (success) {
    toast.success('Encryption enabled');
    setIsEncryptionEnabled(true);
  } else {
    toast.error('Failed to enable encryption');
  }
}
```

**Change Passphrase:**
```tsx
async function handleChangePassphrase() {
  const success = await window.keysApi.changeWorkspacePassphrase(
    workspaceId,
    currentPass,
    newPass
  );

  if (success) {
    toast.success('Passphrase changed successfully');
  } else {
    toast.error('Failed to change passphrase');
  }
}
```

**Sync Key to Cloud:**
```tsx
async function syncKey(keyId: string) {
  // Prompt for passphrase first
  const passphrase = await promptPassphrase();

  const success = await window.keysApi.syncKeyToCloud(
    workspaceId,
    keyId,
    passphrase
  );

  if (success) {
    toast.success('Key synced to cloud');
  } else {
    toast.error('Failed to sync key');
  }
}
```

### Tab 3: Team

**File:** Move existing `src/renderer/src/features/team/TeamPage.tsx` to `src/renderer/src/features/workspace/TeamTab.tsx`

**No functional changes needed** - just rename and integrate into Workspace page tabs

**Content:**
- Members list with roles (Owner/Admin/Member)
- Invite members section (email + role selector)
- Pending invites list
- Remove member actions
- Update role actions

### IPC/API Requirements

**Workspace Operations:**

**New handlers needed in** `src/main/ipc/workspace.ts`:

```typescript
async updateWorkspace(event: IpcMainInvokeEvent, workspaceId: string, updates: { name: string }): Promise<Workspace> {
  const supabase = await getAuthedClient(event);
  const { data, error } = await supabase
    .from('workspaces')
    .update(updates)
    .eq('id', workspaceId)
    .select()
    .single();

  if (error) throw error;
  return toWorkspace(data);
}

async deleteWorkspace(event: IpcMainInvokeEvent, workspaceId: string): Promise<void> {
  const supabase = await getAuthedClient(event);
  // Verify user is owner first
  const { error } = await supabase
    .from('workspaces')
    .delete()
    .eq('id', workspaceId);

  if (error) throw error;
}

async leaveWorkspace(event: IpcMainInvokeEvent, workspaceId: string): Promise<void> {
  const supabase = await getAuthedClient(event);
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('workspace_members')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', user!.id);

  if (error) throw error;
}
```

**Preload API in** `src/preload/workspace-api.ts`:

```typescript
const workspaceApi = {
  // ... existing methods
  update: (workspaceId: string, updates: { name: string }) =>
    ipcRenderer.invoke('workspace.update', workspaceId, updates),
  delete: (workspaceId: string) =>
    ipcRenderer.invoke('workspace.delete', workspaceId),
  leave: (workspaceId: string) =>
    ipcRenderer.invoke('workspace.leave', workspaceId),
};
```

**Encryption operations** - Already exist, no changes needed:
- ✅ `keys.isWorkspaceEncryptionInitialized()`
- ✅ `keys.initializeWorkspaceEncryption()`
- ✅ `keys.changeWorkspacePassphrase()`
- ✅ `keys.syncKeyToCloud()`
- ✅ `keys.downloadKeyFromCloud()`
- ✅ `keys.deleteKeyFromCloud()`

### Permission Checks

**General Tab:**
- View info: All members
- Rename: Owner/Admin only (enforce in UI + backend RLS)
- Delete: Owner only
- Leave: All members except last owner

**Encryption Tab:**
- View status: All members
- Initialize/change: All members (workspace-wide passphrase)
- Sync keys: All members (can only sync own keys)

**Team Tab:**
- View members: All members
- Invite: Owner/Admin only
- Change roles: Owner only
- Remove members: Owner only

---

## Feature Group 3: Settings Enhancements

### Workspace Switcher Component

**File:** `src/renderer/src/components/workspace/WorkspaceSwitcher.tsx` (NEW)

**Used in:**
- Settings > Account tab
- Workspace page header (optional)

**Component:**
```tsx
export function WorkspaceSwitcher({ currentWorkspaceId }: { currentWorkspaceId: string }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.workspaceApi.listMine().then(setWorkspaces).finally(() => setLoading(false));
  }, []);

  async function handleSwitch(workspaceId: string) {
    await window.workspaceApi.switchActive(workspaceId);
    // Refresh entire app state
    window.location.reload();
  }

  return (
    <Select value={currentWorkspaceId} onValueChange={handleSwitch}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {workspaces.map(ws => (
          <SelectItem key={ws.id} value={ws.id}>
            <div className="flex items-center gap-2">
              <span>{ws.name}</span>
              <Badge variant="secondary">{getRoleForWorkspace(ws.id)}</Badge>
            </div>
          </SelectItem>
        ))}
        <SelectSeparator />
        <SelectItem value="__create__" onClick={openCreateWorkspaceDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Create Workspace
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
```

### Account Settings Tab Layout

**In:** `src/renderer/src/features/settings/SettingsPage.tsx`

**New Tab Structure:**
```tsx
<TabsContent value="account" className="p-6 m-0">
  <AccountTab />
</TabsContent>
```

**AccountTab Component:**
```tsx
function AccountTab() {
  const { settings } = useSettingsStore();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  return (
    <div className="max-w-lg space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-base font-semibold mb-1">Account</h2>
        <p className="text-sm text-muted-foreground">
          Manage your profile, security, and data
        </p>
      </div>
      <Separator />

      {/* Profile Section */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <AvatarInitials name={user?.user_metadata.name} size="lg" />
            <div className="flex-1">
              <p className="font-medium">{user?.user_metadata.name}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Last updated: {formatDate(settings?.updatedAt)}
              </p>
            </div>
            <Button variant="outline" onClick={openProfile}>
              Edit Profile
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Security Section */}
      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Active Sessions</Label>
            <p className="text-sm text-muted-foreground">
              You're logged in on this device
            </p>
          </div>
          <Button variant="outline" onClick={openPasswordChange}>
            Change Password
          </Button>
          <div>
            <Label>Two-Factor Authentication</Label>
            <p className="text-sm text-muted-foreground">
              Coming soon
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Data & Privacy Section */}
      <Card>
        <CardHeader>
          <CardTitle>Data & Privacy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Export Your Data</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Download all your hosts, keys, and settings
            </p>
            <Button variant="outline" onClick={handleExportData}>
              Export Data
            </Button>
          </div>
          <Separator />
          <div>
            <Label>Delete Account</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Permanently delete your account and all data
            </p>
            <Button variant="link" onClick={openDeleteAccount} className="text-destructive p-0">
              Delete my account
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Workspace Switcher Section */}
      <Card>
        <CardHeader>
          <CardTitle>Active Workspace</CardTitle>
        </CardHeader>
        <CardContent>
          <WorkspaceSwitcher currentWorkspaceId={workspaceId} />
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Feature Group 4: Nice-to-Have Features

### 1. Command Palette

**File:** `src/renderer/src/features/command-palette/CommandPalette.tsx` (NEW)

**Trigger:**
- Keyboard: Cmd+K (Mac) / Ctrl+K (Windows/Linux)
- Global listener in AppShell

**Component Structure:**
```tsx
import { Command } from 'cmdk'; // Already installed

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const hosts = useHostStore(s => s.hosts);
  const keys = useKeyStore(s => s.keys);
  const [search, setSearch] = useState('');

  const filteredHosts = hosts.filter(h =>
    h.label.toLowerCase().includes(search.toLowerCase()) ||
    h.hostname.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Command.Dialog open={open} onOpenChange={onOpenChange}>
      <Command.Input
        placeholder="Search hosts, keys, or run commands..."
        value={search}
        onValueChange={setSearch}
      />
      <Command.List>
        <Command.Empty>No results found.</Command.Empty>

        <Command.Group heading="Quick Actions">
          <Command.Item onSelect={() => openHostForm()}>
            <Plus className="mr-2 h-4 w-4" />
            Add Host
          </Command.Item>
          <Command.Item onSelect={() => openKeyImport()}>
            <KeyRound className="mr-2 h-4 w-4" />
            Import SSH Key
          </Command.Item>
          <Command.Item onSelect={() => openSettings()}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Command.Item>
        </Command.Group>

        <Command.Group heading="Hosts">
          {filteredHosts.slice(0, 5).map(host => (
            <Command.Item key={host.id} onSelect={() => connectToHost(host)}>
              <Server className="mr-2 h-4 w-4" />
              <span>{host.label}</span>
              <span className="text-xs text-muted-foreground ml-2">
                {host.hostname}
              </span>
            </Command.Item>
          ))}
        </Command.Group>

        <Command.Group heading="SSH Keys">
          {keys.slice(0, 3).map(key => (
            <Command.Item key={key.id}>
              <KeyRound className="mr-2 h-4 w-4" />
              {key.name}
            </Command.Item>
          ))}
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
```

**Integration in AppShell:**
```tsx
export function AppShell() {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      {/* ... existing layout */}
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
      />
    </>
  );
}
```

### 2. AI Assistant Panel

**File:** `src/renderer/src/features/ai/AiPanel.tsx` (NEW)

**Location:** Right sidebar drawer (collapsible, similar to import panels)

**State Management:**
```tsx
interface AiState {
  messages: AiMessage[];
  isStreaming: boolean;
  provider: 'openai' | 'anthropic' | 'gemini';
  addMessage: (message: AiMessage) => void;
  sendMessage: (content: string) => Promise<void>;
  clearHistory: () => void;
}

export const useAiStore = create<AiState>((set, get) => ({
  messages: [],
  isStreaming: false,
  provider: 'openai',
  // ... implementation
}));
```

**Component Structure:**
```tsx
export function AiPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { messages, sendMessage, isStreaming, provider } = useAiStore();
  const [input, setInput] = useState('');

  async function handleSend() {
    if (!input.trim()) return;
    await sendMessage(input);
    setInput('');
  }

  return (
    <div className="flex flex-col w-96 h-full border-l bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="font-semibold">AI Assistant</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <ChatMessage key={i} message={msg} />
        ))}
        {isStreaming && <LoadingDots />}
      </div>

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Ask AI or describe a command..."
          />
          <Button onClick={handleSend} disabled={isStreaming}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <ProviderSelector />
      </div>
    </div>
  );
}
```

**ChatMessage Component:**
```tsx
function ChatMessage({ message }: { message: AiMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      <div className={cn(
        'rounded-lg p-3 max-w-[80%]',
        isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
      )}>
        {message.isCommand ? (
          <CommandSuggestion command={message.content} />
        ) : (
          <div className="prose prose-sm">
            {/* Render markdown */}
            {message.content}
          </div>
        )}
      </div>
    </div>
  );
}
```

**CommandSuggestion Component:**
```tsx
function CommandSuggestion({ command }: { command: string }) {
  function insertIntoTerminal() {
    const activeTab = useSessionStore.getState().activeTabId;
    if (activeTab) {
      window.sshApi.send(activeTab, command + '\n');
      toast.success('Command inserted into terminal');
    }
  }

  return (
    <div className="bg-card border rounded p-3">
      <pre className="text-sm font-mono mb-2">{command}</pre>
      <div className="flex gap-2">
        <Button size="sm" onClick={insertIntoTerminal}>
          <Terminal className="mr-1 h-3 w-3" />
          Insert into Terminal
        </Button>
        <Button size="sm" variant="outline">
          Explain
        </Button>
      </div>
    </div>
  );
}
```

**Backend Integration:**
Uses existing `src/main/services/ai-proxy.ts` - no changes needed

### 3. Better Empty States

**Empty Hosts Grid:**
```tsx
// In HostsGrid.tsx
{hosts.length === 0 && (
  <div className="flex flex-col items-center justify-center h-full py-20">
    <Server className="h-16 w-16 text-muted-foreground/20 mb-4" />
    <h3 className="text-lg font-semibold mb-2">No SSH hosts yet</h3>
    <p className="text-sm text-muted-foreground mb-6 max-w-sm text-center">
      Add your first host to get started with remote connections
    </p>
    <Button onClick={onAddHost}>
      <Plus className="mr-2 h-4 w-4" />
      Add Host
    </Button>
  </div>
)}
```

**Empty Keys Page:**
```tsx
// In KeysPage.tsx
{keys.length === 0 && (
  <div className="flex flex-col items-center justify-center h-full py-20">
    <KeyRound className="h-16 w-16 text-muted-foreground/20 mb-4" />
    <h3 className="text-lg font-semibold mb-2">No SSH keys imported</h3>
    <p className="text-sm text-muted-foreground mb-6 max-w-sm text-center">
      Import a private key to authenticate with your hosts
    </p>
    <Button onClick={onOpenImport}>
      <Plus className="mr-2 h-4 w-4" />
      Import Key
    </Button>
  </div>
)}
```

**Welcome Screen (First Login):**
```tsx
// New component: WelcomeScreen.tsx
export function WelcomeScreen({ onDismiss }: { onDismiss: () => void }) {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: "Welcome to ArchTerm!",
      description: "A modern SSH client for developers",
      icon: <Terminal className="h-12 w-12" />
    },
    {
      title: "Add Your First Host",
      description: "Connect to remote servers via SSH",
      icon: <Server className="h-12 w-12" />
    },
    {
      title: "Import SSH Keys",
      description: "Manage your authentication keys securely",
      icon: <KeyRound className="h-12 w-12" />
    },
    {
      title: "Start Connecting",
      description: "You're all set to start working remotely",
      icon: <CheckCircle className="h-12 w-12" />
    }
  ];

  return (
    <Dialog open={true}>
      <DialogContent>
        <div className="flex flex-col items-center text-center py-6">
          <div className="mb-6 text-primary">
            {steps[step].icon}
          </div>
          <h2 className="text-2xl font-bold mb-2">{steps[step].title}</h2>
          <p className="text-muted-foreground mb-6">{steps[step].description}</p>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            )}
            {step < steps.length - 1 ? (
              <Button onClick={() => setStep(step + 1)}>
                Next
              </Button>
            ) : (
              <Button onClick={onDismiss}>
                Get Started
              </Button>
            )}
          </div>
          <div className="flex gap-2 mt-6">
            {steps.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-2 w-2 rounded-full",
                  i === step ? "bg-primary" : "bg-muted"
                )}
              />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### 4. User Avatar Component

**File:** `src/renderer/src/components/ui/avatar-initials.tsx` (NEW)

**Component:**
```tsx
import { cn } from '@/lib/utils';

interface AvatarInitialsProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function AvatarInitials({ name, size = 'md', className }: AvatarInitialsProps) {
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Generate consistent color from name
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const hue = hash % 360;
  const backgroundColor = `hsl(${hue}, 70%, 50%)`;

  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-16 w-16 text-lg'
  };

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-semibold text-white shrink-0',
        sizeClasses[size],
        className
      )}
      style={{ backgroundColor }}
    >
      {initials}
    </div>
  );
}
```

**Usage:**
- Sidebar profile button: `<AvatarInitials name={userName} size="sm" />`
- User menu dropdown: `<AvatarInitials name={userName} size="md" />`
- Profile page: `<AvatarInitials name={userName} size="lg" />`
- Team members list: `<AvatarInitials name={memberName} size="sm" />`

---

## Implementation Order (Sequential Vertical Slices)

### Week 1: Critical Features

**Slice 1: User Profile & Logout (Days 1-2)**
1. Add user profile button to Sidebar
2. Create UserMenu dropdown component
3. Implement logout flow (clear token, redirect)
4. Create ProfilePage component
5. Add Account Settings tab to Settings
6. Create Supabase RPC function for account deletion
7. Test all profile operations

**Slice 2: Workspace Settings Page (Days 3-5)**
1. Update Sidebar (replace Team with Workspace icon)
2. Create WorkspacePage with tab structure
3. Build GeneralTab (rename, delete, leave)
4. Build EncryptionTab (passphrase management)
5. Move TeamPage to TeamTab (refactor imports)
6. Add IPC handlers (update, delete, leave)
7. Test all workspace operations

### Week 2: Enhancements & Polish

**Slice 3: Settings Enhancements (Days 1-2)**
1. Create WorkspaceSwitcher component
2. Build AccountTab content
3. Implement data export functionality
4. Add workspace switcher to Account tab
5. Test account settings features

**Slice 4: User Avatar (Day 3)**
1. Create AvatarInitials component
2. Add to Sidebar profile button
3. Add to UserMenu dropdown
4. Add to ProfilePage
5. Add to Team members list

**Slice 5: Command Palette (Day 4)**
1. Create CommandPalette component
2. Add global keyboard listener
3. Implement host search
4. Add quick actions
5. Test keyboard shortcuts

**Slice 6: Empty States (Day 5)**
1. Update HostsGrid empty state
2. Update KeysPage empty state
3. Create WelcomeScreen component
4. Add first-login detection
5. Test all empty states

### Week 3: Nice-to-Haves (If Time Permits)

**Slice 7: AI Assistant Panel (Days 1-3)**
1. Create useAiStore
2. Build AiPanel component
3. Create ChatMessage component
4. Build CommandSuggestion component
5. Add ProviderSelector
6. Integrate with existing ai-proxy backend
7. Test AI interactions

---

## What's Out of Scope

Features explicitly not included in this design:

- **Avatar Upload:** Future feature, Phase 1 only shows initials
- **Two-Factor Authentication:** Placeholder only, no implementation
- **Session Management:** Beyond basic "logged in on this device"
- **Advanced AI Features:** Voice commands, terminal auto-fix
- **Mobile App:** Desktop only
- **Workspace Templates:** Create workspace from template
- **Workspace Billing:** Paid features, usage tracking
- **Audit Logs:** Who did what when
- **RBAC Permissions:** Beyond Owner/Admin/Member roles
- **Workspace Favorites:** Star workspaces for quick access

---

## Testing Strategy

**Unit Tests:**
- Test all new components with React Testing Library
- Test Zustand store actions
- Test utility functions (avatar color generation, export data)

**Integration Tests:**
- Test complete user flows:
  - Sign up → Create workspace → Add host → Connect
  - Import key → Sync to cloud → Download on new device
  - Change workspace passphrase → Verify keys still work
  - Delete account → Verify all data removed

**Manual Testing Checklist:**
- ✅ Can log out and log back in
- ✅ Profile updates persist
- ✅ Password change works
- ✅ Account deletion removes all data
- ✅ Workspace rename reflects everywhere
- ✅ Delete workspace removes hosts/keys
- ✅ Leave workspace removes membership
- ✅ Encryption initialization works
- ✅ Passphrase change re-encrypts keys
- ✅ Key sync to cloud succeeds
- ✅ Command palette opens with Cmd+K
- ✅ Empty states show correct prompts
- ✅ Avatar shows correct initials and colors
- ✅ Data export downloads JSON

---

## Database Migrations Required

**File:** `supabase/migrations/20260220_user_deletion.sql`
- Add `delete_user_account()` RPC function

**File:** `supabase/migrations/20260220_workspace_management.sql`
- No schema changes needed (tables exist)
- May need RLS policy updates for delete/leave operations

---

## Success Criteria

**Feature Group 1 (User Profile & Logout):**
- ✅ Users can log out from any screen
- ✅ Profile page shows correct user info
- ✅ Name updates save to Supabase
- ✅ Password changes work and require current password
- ✅ Account deletion removes all user data
- ✅ Account Settings tab provides quick access

**Feature Group 2 (Workspace Settings):**
- ✅ Workspace page accessible from sidebar
- ✅ General tab shows workspace info
- ✅ Owners can rename and delete workspaces
- ✅ Members can leave workspaces
- ✅ Encryption tab initializes passphrase
- ✅ Passphrase changes re-encrypt keys
- ✅ Keys sync to/from cloud successfully
- ✅ Team tab shows all members

**Feature Group 3 (Settings Enhancements):**
- ✅ Account tab provides profile summary
- ✅ Data export downloads complete JSON
- ✅ Workspace switcher shows all workspaces
- ✅ Switching workspaces updates UI

**Feature Group 4 (Nice-to-Haves):**
- ✅ Command palette opens with Cmd+K
- ✅ Palette searches hosts and keys
- ✅ Empty states show helpful prompts
- ✅ Avatar displays correct initials
- ✅ (Optional) AI panel provides command suggestions

---

## End of Design Document

This design is approved and ready for implementation via the writing-plans skill.
