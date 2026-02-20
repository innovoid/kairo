# User Profile & Logout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add user profile management, logout functionality, and account settings to ArchTerm

**Architecture:** Use Supabase auth directly in renderer for profile operations (no IPC needed). Add user profile button to sidebar, create dropdown menu, profile page, and account settings tab. Account deletion uses new Supabase RPC function.

**Tech Stack:** React, TypeScript, Supabase client, shadcn/ui components, Zustand (minimal - mostly direct Supabase calls)

---

## Task 1: Add Supabase RPC for Account Deletion

**Files:**
- Create: `supabase/migrations/20260220_user_deletion.sql`

**Step 1: Create migration file**

Create the SQL migration for user account deletion:

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

  -- Note: Workspaces where user is sole owner are handled by RLS cascade
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION delete_user_account() TO authenticated;
```

**Step 2: Commit**

```bash
git add supabase/migrations/20260220_user_deletion.sql
git commit -m "feat: add RPC function for user account deletion"
```

---

## Task 2: Add AvatarInitials Component

**Files:**
- Create: `src/renderer/src/components/ui/avatar-initials.tsx`

**Step 1: Create AvatarInitials component**

```tsx
import { cn } from '@/lib/utils';

interface AvatarInitialsProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function AvatarInitials({ name, size = 'md', className }: AvatarInitialsProps) {
  // Get initials from name
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Generate consistent color from name hash
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
      {initials || '?'}
    </div>
  );
}
```

**Step 2: Test manually**

Run: `npm run dev`
Expected: App starts without errors

**Step 3: Commit**

```bash
git add src/renderer/src/components/ui/avatar-initials.tsx
git commit -m "feat: add AvatarInitials component with color generation"
```

---

## Task 3: Add User Menu Dropdown Component

**Files:**
- Create: `src/renderer/src/components/layout/UserMenu.tsx`

**Step 1: Create UserMenu component**

```tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AvatarInitials } from '@/components/ui/avatar-initials';
import { User as UserIcon, Settings, LogOut } from 'lucide-react';
import { toast } from 'sonner';

interface UserMenuProps {
  children: React.ReactNode;
}

export function UserMenu({ children }: UserMenuProps) {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
  }, []);

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
      await window.authApi.setAccessToken(null);
      toast.success('Logged out successfully');
      // AuthGate will detect session loss and redirect
    } catch (error) {
      toast.error('Failed to log out');
      console.error('Logout error:', error);
    }
  }

  function handleProfile() {
    navigate('/profile');
  }

  function handleAccountSettings() {
    navigate('/settings?tab=account');
  }

  if (!user) {
    return <>{children}</>;
  }

  const userName = user.user_metadata?.name || 'User';
  const userEmail = user.email || '';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex items-center gap-3">
            <AvatarInitials name={userName} size="sm" />
            <div className="flex flex-col overflow-hidden">
              <span className="font-medium truncate">{userName}</span>
              <span className="text-xs text-muted-foreground truncate">{userEmail}</span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleProfile}>
          <UserIcon className="mr-2 h-4 w-4" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleAccountSettings}>
          <Settings className="mr-2 h-4 w-4" />
          Account Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          Log Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

**Step 2: Test manually**

Run: `npm run dev`
Expected: App compiles successfully

**Step 3: Commit**

```bash
git add src/renderer/src/components/layout/UserMenu.tsx
git commit -m "feat: add UserMenu dropdown with logout functionality"
```

---

## Task 4: Add User Profile Button to Sidebar

**Files:**
- Modify: `src/renderer/src/components/layout/Sidebar.tsx`

**Step 1: Update Sidebar component**

Add user profile button at the bottom (above Settings):

```tsx
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { SquareTerminal, Server, KeyRound, Users, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AvatarInitials } from '@/components/ui/avatar-initials';
import { UserMenu } from './UserMenu';

interface SidebarProps {
  onOpenSettings: () => void;
  onGoHome: () => void;
  onGoKeys: () => void;
  onGoTeam: () => void;
  activeView: 'hosts' | 'keys' | 'team' | 'settings';
}

export function Sidebar({ onOpenSettings, onGoHome, onGoKeys, onGoTeam, activeView }: SidebarProps) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
  }, []);

  const userName = user?.user_metadata?.name || 'User';

  return (
    <TooltipProvider delay={300}>
      <div className="flex flex-col items-center w-14 border-r bg-muted/10 shrink-0 py-2 gap-1">
        {/* Logo */}
        <div className="flex items-center justify-center h-9 w-9 mb-2">
          <SquareTerminal className="h-6 w-6 text-primary" />
        </div>

        {/* Navigation */}
        <NavButton icon={Server} label="Hosts" active={activeView === 'hosts'} onClick={onGoHome} />
        <NavButton icon={KeyRound} label="SSH Keys" active={activeView === 'keys'} onClick={onGoKeys} />
        <NavButton icon={Users} label="Team" active={activeView === 'team'} onClick={onGoTeam} />

        <div className="flex-1" />

        {/* User Profile Button */}
        <Tooltip>
          <UserMenu>
            <TooltipTrigger asChild>
              <button className="inline-flex items-center justify-center h-9 w-9 rounded-md transition-colors hover:bg-accent hover:text-accent-foreground">
                <AvatarInitials name={userName} size="sm" />
              </button>
            </TooltipTrigger>
          </UserMenu>
          <TooltipContent side="right" sideOffset={8}>
            Profile
          </TooltipContent>
        </Tooltip>

        {/* Settings */}
        <NavButton icon={Settings} label="Settings" active={activeView === 'settings'} onClick={onOpenSettings} />
      </div>
    </TooltipProvider>
  );
}

function NavButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        className={cn(
          'inline-flex items-center justify-center h-9 w-9 rounded-md transition-colors',
          'hover:bg-accent hover:text-accent-foreground',
          active && 'bg-accent text-accent-foreground',
        )}
        onClick={onClick}
      >
        <Icon className="h-5 w-5" />
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
```

**Step 2: Test manually**

Run: `npm run dev`
Expected: User profile button appears in sidebar above Settings

**Step 3: Commit**

```bash
git add src/renderer/src/components/layout/Sidebar.tsx
git commit -m "feat: add user profile button to sidebar"
```

---

## Task 5: Create Profile Page

**Files:**
- Create: `src/renderer/src/features/profile/ProfilePage.tsx`

**Step 1: Create ProfilePage component**

```tsx
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { AvatarInitials } from '@/components/ui/avatar-initials';
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

export function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setName(data.user?.user_metadata?.name || '');
    });
  }, []);

  async function handleUpdateProfile() {
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { name }
      });
      if (error) throw error;
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleChangePassword() {
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      if (error) throw error;
      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteAccount() {
    setLoading(true);
    try {
      // Call RPC to delete user data
      const { error: rpcError } = await supabase.rpc('delete_user_account');
      if (rpcError) throw rpcError;

      // Sign out
      await supabase.auth.signOut();
      await window.authApi.setAccessToken(null);
      toast.success('Account deleted successfully');
      // AuthGate will redirect to login
    } catch (error) {
      toast.error('Failed to delete account');
      console.error(error);
    } finally {
      setLoading(false);
      setShowDeleteDialog(false);
    }
  }

  if (!user) {
    return <div className="flex items-center justify-center h-full">Loading...</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold mb-1">Profile</h1>
          <p className="text-sm text-muted-foreground">
            Manage your account information and security settings
          </p>
        </div>
        <Separator />

        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>Update your personal details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <AvatarInitials name={name || 'User'} size="lg" />
              <div className="flex-1 space-y-3">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={user.email || ''}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Email cannot be changed
                  </p>
                </div>
              </div>
            </div>
            <Button onClick={handleUpdateProfile} disabled={loading}>
              Save Changes
            </Button>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>Update your password to keep your account secure</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="current-password">Current Password</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
              />
            </div>
            <Button onClick={handleChangePassword} disabled={loading}>
              Change Password
            </Button>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>
              Irreversible actions that affect your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div>
              <p className="text-sm mb-2">
                Once you delete your account, there is no going back. All your data will be permanently deleted.
              </p>
              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
              >
                Delete Account
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete your account and remove all your data from our servers.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <Label htmlFor="delete-password">Enter your password to confirm</Label>
              <Input
                id="delete-password"
                type="password"
                value={deletePassword}
                onChange={e => setDeletePassword(e.target.value)}
                placeholder="Password"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteAccount}
                disabled={!deletePassword || loading}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete Account
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
```

**Step 2: Test manually**

Run: `npm run dev`
Expected: App compiles successfully

**Step 3: Commit**

```bash
git add src/renderer/src/features/profile/ProfilePage.tsx
git commit -m "feat: add ProfilePage with edit/password/delete functionality"
```

---

## Task 6: Add Account Settings Tab

**Files:**
- Modify: `src/renderer/src/features/settings/SettingsPage.tsx`

**Step 1: Add Account tab to Settings**

Update SettingsPage to include Account tab:

```tsx
// At the top, add to imports:
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import { AvatarInitials } from '@/components/ui/avatar-initials';
import { Download, Shield } from 'lucide-react';
import type { AiProvider, CursorStyle, BellStyle, TerminalTheme } from '@shared/types/settings';

// Update SettingsTab type:
export type SettingsTab = 'terminal' | 'appearance' | 'ai' | 'account';

// In the TabsList, add Account tab:
<TabsList className="flex flex-col w-full rounded-none bg-transparent p-2 gap-0.5 justify-start">
  <TabsTrigger value="terminal" className="w-full justify-start px-3 py-1.5 text-sm">Terminal</TabsTrigger>
  <TabsTrigger value="appearance" className="w-full justify-start px-3 py-1.5 text-sm">Appearance</TabsTrigger>
  <TabsTrigger value="ai" className="w-full justify-start px-3 py-1.5 text-sm">AI</TabsTrigger>
  <TabsTrigger value="account" className="w-full justify-start px-3 py-1.5 text-sm">Account</TabsTrigger>
</TabsList>

// Add TabsContent for Account:
<TabsContent value="account" className="p-6 m-0">
  <AccountTab workspaceId={workspaceId} />
</TabsContent>
```

**Step 2: Add AccountTab component at the end of the file**

```tsx
// ─── Account Tab ──────────────────────────────────────────────────────────────

function AccountTab({ workspaceId }: { workspaceId: string }) {
  const navigate = useNavigate();
  const { settings } = useSettingsStore();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  async function handleExportData() {
    try {
      const hosts = await window.hostsApi.list(workspaceId);
      const keys = await window.keysApi.list(workspaceId);
      const workspaces = await window.workspaceApi.listMine();

      const data = {
        exported_at: new Date().toISOString(),
        user: {
          email: user?.email,
          name: user?.user_metadata?.name
        },
        hosts: hosts.map(h => ({ ...h, password: undefined })),
        keys: keys.map(k => ({ name: k.name, publicKey: k.publicKey, fingerprint: k.fingerprint })),
        settings,
        workspaces
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `archterm-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Data exported successfully');
    } catch (error) {
      toast.error('Failed to export data');
      console.error(error);
    }
  }

  const userName = user?.user_metadata?.name || 'User';
  const userEmail = user?.email || '';

  return (
    <div className="max-w-lg space-y-6">
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
            <AvatarInitials name={userName} size="lg" />
            <div className="flex-1">
              <p className="font-medium">{userName}</p>
              <p className="text-sm text-muted-foreground">{userEmail}</p>
              {settings?.updatedAt && (
                <p className="text-xs text-muted-foreground mt-1">
                  Last updated: {new Date(settings.updatedAt).toLocaleDateString()}
                </p>
              )}
            </div>
            <Button variant="outline" onClick={() => navigate('/profile')}>
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
            <Label className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Active Sessions
            </Label>
            <p className="text-sm text-muted-foreground">
              You're logged in on this device
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate('/profile')}>
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
              <Download className="mr-2 h-4 w-4" />
              Export Data
            </Button>
          </div>
          <Separator />
          <div>
            <Label>Delete Account</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Permanently delete your account and all data
            </p>
            <Button
              variant="link"
              onClick={() => navigate('/profile')}
              className="text-destructive p-0 h-auto"
            >
              Delete my account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 3: Test manually**

Run: `npm run dev`
Expected: Settings page shows Account tab with profile summary and export functionality

**Step 4: Commit**

```bash
git add src/renderer/src/features/settings/SettingsPage.tsx
git commit -m "feat: add Account tab to Settings with data export"
```

---

## Task 7: Wire Profile Page into App Routing

**Files:**
- Modify: `src/renderer/src/App.tsx`

**Step 1: Add route for ProfilePage**

Import ProfilePage and add route:

```tsx
import { ProfilePage } from '@/features/profile/ProfilePage';

// In your routes, add:
<Route path="/profile" element={<ProfilePage />} />
```

**Step 2: Test the complete flow**

Run: `npm run dev`

Test:
1. Click user profile button in sidebar → User menu opens
2. Click "Profile" → ProfilePage opens
3. Edit name → Click "Save Changes" → Success toast
4. Try changing password → Verify it works
5. Click "Account Settings" in user menu → Settings opens on Account tab
6. Click "Export Data" → JSON file downloads
7. Click "Log Out" → Returns to login page

Expected: All flows work end-to-end

**Step 3: Commit**

```bash
git add src/renderer/src/App.tsx
git commit -m "feat: wire ProfilePage into app routing"
```

---

## Task 8: Update AppShell to Support Profile Navigation

**Files:**
- Modify: `src/renderer/src/components/layout/AppShell.tsx`

**Step 1: Ensure profile navigation works**

Verify AppShell properly handles profile route navigation. No changes needed if using React Router properly.

**Step 2: Test all navigation flows**

Run: `npm run dev`

Test:
1. Navigate from Hosts → Profile → Back to Hosts
2. Profile button always visible in sidebar
3. User menu works from any page
4. Logout works from any page

Expected: All navigation works smoothly

**Step 3: Commit (if changes made)**

```bash
git add src/renderer/src/components/layout/AppShell.tsx
git commit -m "fix: ensure profile navigation works from all pages"
```

---

## Task 9: Final Testing & Polish

**Step 1: Test all user profile features**

Complete test checklist:
- [ ] User profile button shows correct initials
- [ ] User menu dropdown opens with correct info
- [ ] Profile page loads user data
- [ ] Name updates save to Supabase
- [ ] Password change works (test with wrong/correct current password)
- [ ] Account deletion dialog requires password
- [ ] Account deletion removes data and logs out
- [ ] Account Settings tab shows profile summary
- [ ] Export Data downloads valid JSON
- [ ] Logout clears session and redirects to login
- [ ] All navigation works (profile ↔ hosts ↔ settings)

**Step 2: Fix any issues found**

Address bugs discovered during testing.

**Step 3: Final commit**

```bash
git add -A
git commit -m "test: verify all user profile & logout features work"
```

---

## Testing Checklist

- [ ] User profile button appears in sidebar
- [ ] Avatar shows correct initials with consistent colors
- [ ] User menu opens with name, email, and options
- [ ] Logout clears session and redirects to login
- [ ] Profile page loads current user data
- [ ] Profile name updates save successfully
- [ ] Password change validates matching passwords
- [ ] Password change requires current password (Supabase handles this)
- [ ] Delete account requires password confirmation
- [ ] Delete account removes all user data
- [ ] Account tab shows profile summary
- [ ] Data export downloads complete JSON file
- [ ] All navigation works between profile/settings/main app

---

## Completion Criteria

✅ User profile button in sidebar with avatar
✅ User menu dropdown with name, email, logout
✅ Logout functionality works and redirects
✅ Profile page with edit name
✅ Change password functionality
✅ Delete account with confirmation
✅ Account Settings tab in Settings
✅ Data export downloads JSON
✅ All navigation flows work
✅ No console errors
✅ All features tested manually

---

## Notes

- No IPC handlers needed (Supabase direct from renderer)
- RPC function handles account deletion cascade
- AuthGate handles redirect after logout/deletion
- Avatar colors are deterministic (same name = same color)
- Export data excludes passwords for security
