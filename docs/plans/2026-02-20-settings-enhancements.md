# Settings Enhancements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Account Settings tab and Workspace Switcher to Settings page for improved user experience

**Architecture:** Extend existing Settings page with new Account tab, add WorkspaceSwitcher component reusable across settings and other pages, implement data export functionality via Supabase queries

**Tech Stack:** React, TypeScript, shadcn/ui (Tabs, Select, Button, Alert), Supabase client (direct queries, no new IPC)

---

## Task 1: Create WorkspaceSwitcher Component

**Files:**
- Create: `src/renderer/src/features/workspaces/WorkspaceSwitcher.tsx`
- Reference: `src/renderer/src/stores/workspace-store.ts` (existing)

**Step 1: Write the failing test**

```typescript
// src/renderer/src/features/workspaces/__tests__/WorkspaceSwitcher.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WorkspaceSwitcher } from '../WorkspaceSwitcher';

// Mock workspace-store
vi.mock('../../../stores/workspace-store', () => ({
  useWorkspaceStore: vi.fn(),
}));

describe('WorkspaceSwitcher', () => {
  const mockWorkspaces = [
    { id: 'ws-1', name: 'Personal Workspace', createdBy: 'user-1', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
    { id: 'ws-2', name: 'Team Alpha', createdBy: 'user-1', createdAt: '2026-01-02', updatedAt: '2026-01-02' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render current workspace name', () => {
    const { useWorkspaceStore } = require('../../../stores/workspace-store');
    useWorkspaceStore.mockReturnValue({
      workspaces: mockWorkspaces,
      activeWorkspace: mockWorkspaces[0],
      setActiveWorkspace: vi.fn(),
      fetchWorkspaces: vi.fn(),
    });

    render(<WorkspaceSwitcher />);
    expect(screen.getByText('Personal Workspace')).toBeInTheDocument();
  });

  it('should show workspace list when clicked', async () => {
    const { useWorkspaceStore } = require('../../../stores/workspace-store');
    useWorkspaceStore.mockReturnValue({
      workspaces: mockWorkspaces,
      activeWorkspace: mockWorkspaces[0],
      setActiveWorkspace: vi.fn(),
      fetchWorkspaces: vi.fn(),
    });

    render(<WorkspaceSwitcher />);

    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('Team Alpha')).toBeInTheDocument();
    });
  });

  it('should switch workspace when selection changes', async () => {
    const mockSetActiveWorkspace = vi.fn();
    const { useWorkspaceStore } = require('../../../stores/workspace-store');
    useWorkspaceStore.mockReturnValue({
      workspaces: mockWorkspaces,
      activeWorkspace: mockWorkspaces[0],
      setActiveWorkspace: mockSetActiveWorkspace,
      fetchWorkspaces: vi.fn(),
    });

    render(<WorkspaceSwitcher />);

    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    await waitFor(() => {
      const teamOption = screen.getByText('Team Alpha');
      fireEvent.click(teamOption);
    });

    expect(mockSetActiveWorkspace).toHaveBeenCalledWith('ws-2');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- WorkspaceSwitcher.test.tsx`
Expected: FAIL with "Cannot find module '../WorkspaceSwitcher'"

**Step 3: Write minimal implementation**

```typescript
// src/renderer/src/features/workspaces/WorkspaceSwitcher.tsx
import { useWorkspaceStore } from '../../stores/workspace-store';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';

export function WorkspaceSwitcher() {
  const { workspaces, activeWorkspace, setActiveWorkspace } = useWorkspaceStore();

  return (
    <Select
      value={activeWorkspace?.id ?? ''}
      onValueChange={setActiveWorkspace}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select workspace">
          {activeWorkspace?.name ?? 'Select workspace'}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {workspaces.map((workspace) => (
          <SelectItem key={workspace.id} value={workspace.id}>
            {workspace.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- WorkspaceSwitcher.test.tsx`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add src/renderer/src/features/workspaces/WorkspaceSwitcher.tsx src/renderer/src/features/workspaces/__tests__/WorkspaceSwitcher.test.tsx
git commit -m "feat: add WorkspaceSwitcher component for workspace selection

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Create Data Export Functionality

**Files:**
- Create: `src/renderer/src/features/settings/hooks/useDataExport.ts`

**Step 1: Write the failing test**

```typescript
// src/renderer/src/features/settings/__tests__/useDataExport.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDataExport } from '../hooks/useDataExport';
import { supabase } from '../../../lib/supabase';

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}));

describe('useDataExport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export user data as JSON', async () => {
    const mockUser = { id: 'user-1', email: 'test@example.com' };
    const mockHosts = [{ id: 'host-1', label: 'Server 1' }];
    const mockKeys = [{ id: 'key-1', name: 'My Key' }];
    const mockSettings = { theme: 'dark', terminalFont: 'JetBrains Mono' };

    (supabase.auth.getUser as any).mockResolvedValue({ data: { user: mockUser } });
    (supabase.from as any).mockImplementation((table: string) => ({
      select: () => ({
        data: table === 'hosts' ? mockHosts : table === 'ssh_keys' ? mockKeys : [mockSettings],
        error: null,
      }),
    }));

    const { result } = renderHook(() => useDataExport());

    const exportData = await result.current.exportData();

    expect(exportData).toEqual({
      user: { id: 'user-1', email: 'test@example.com' },
      hosts: mockHosts,
      sshKeys: mockKeys,
      settings: mockSettings,
      exportedAt: expect.any(String),
    });
  });

  it('should download data as JSON file', async () => {
    const mockCreateObjectURL = vi.fn(() => 'blob:mock-url');
    const mockRevokeObjectURL = vi.fn();
    global.URL.createObjectURL = mockCreateObjectURL;
    global.URL.revokeObjectURL = mockRevokeObjectURL;

    const mockClick = vi.fn();
    const mockLink = { click: mockClick, href: '', download: '', style: { display: '' } };
    vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as any);
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as any);

    const mockUser = { id: 'user-1', email: 'test@example.com' };
    (supabase.auth.getUser as any).mockResolvedValue({ data: { user: mockUser } });
    (supabase.from as any).mockImplementation(() => ({
      select: () => ({ data: [], error: null }),
    }));

    const { result } = renderHook(() => useDataExport());

    await result.current.downloadData();

    await waitFor(() => {
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalled();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- useDataExport.test.ts`
Expected: FAIL with "Cannot find module '../hooks/useDataExport'"

**Step 3: Write minimal implementation**

```typescript
// src/renderer/src/features/settings/hooks/useDataExport.ts
import { useState } from 'react';
import { supabase } from '../../../lib/supabase';

interface ExportData {
  user: {
    id: string;
    email: string;
  };
  hosts: any[];
  sshKeys: any[];
  settings: any;
  exportedAt: string;
}

export function useDataExport() {
  const [isExporting, setIsExporting] = useState(false);

  const exportData = async (): Promise<ExportData> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const [hostsResult, keysResult, settingsResult] = await Promise.all([
      supabase.from('hosts').select('*'),
      supabase.from('ssh_keys').select('*'),
      supabase.from('settings').select('*').eq('user_id', user.id).single(),
    ]);

    return {
      user: {
        id: user.id,
        email: user.email ?? '',
      },
      hosts: hostsResult.data ?? [],
      sshKeys: keysResult.data ?? [],
      settings: settingsResult.data ?? {},
      exportedAt: new Date().toISOString(),
    };
  };

  const downloadData = async () => {
    setIsExporting(true);
    try {
      const data = await exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `archterm-export-${new Date().toISOString().split('T')[0]}.json`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  return { exportData, downloadData, isExporting };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- useDataExport.test.ts`
Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add src/renderer/src/features/settings/hooks/useDataExport.ts src/renderer/src/features/settings/__tests__/useDataExport.test.ts
git commit -m "feat: add data export functionality for user data

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Create AccountSettingsTab Component

**Files:**
- Create: `src/renderer/src/features/settings/AccountSettingsTab.tsx`
- Modify: `src/renderer/src/features/settings/SettingsPage.tsx` (add Account tab)

**Step 1: Write the failing test**

```typescript
// src/renderer/src/features/settings/__tests__/AccountSettingsTab.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AccountSettingsTab } from '../AccountSettingsTab';

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
  },
}));

vi.mock('../hooks/useDataExport', () => ({
  useDataExport: () => ({
    downloadData: vi.fn(),
    isExporting: false,
  }),
}));

describe('AccountSettingsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render user profile summary', async () => {
    const { supabase } = require('../../../lib/supabase');
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { email: 'test@example.com', user_metadata: { full_name: 'Test User' } } },
    });

    render(<AccountSettingsTab />);

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });
  });

  it('should render data export section', () => {
    const { supabase } = require('../../../lib/supabase');
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { email: 'test@example.com' } },
    });

    render(<AccountSettingsTab />);

    expect(screen.getByText(/Export Your Data/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export Data/i })).toBeInTheDocument();
  });

  it('should trigger data export when button clicked', async () => {
    const mockDownloadData = vi.fn();
    vi.mocked(require('../hooks/useDataExport').useDataExport).mockReturnValue({
      downloadData: mockDownloadData,
      isExporting: false,
    });

    const { supabase } = require('../../../lib/supabase');
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { email: 'test@example.com' } },
    });

    render(<AccountSettingsTab />);

    const exportButton = screen.getByRole('button', { name: /Export Data/i });
    fireEvent.click(exportButton);

    expect(mockDownloadData).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- AccountSettingsTab.test.tsx`
Expected: FAIL with "Cannot find module '../AccountSettingsTab'"

**Step 3: Write minimal implementation**

```typescript
// src/renderer/src/features/settings/AccountSettingsTab.tsx
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useDataExport } from './hooks/useDataExport';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Download, User, Mail } from 'lucide-react';

export function AccountSettingsTab() {
  const [user, setUser] = useState<any>(null);
  const { downloadData, isExporting } = useDataExport();

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    loadUser();
  }, []);

  return (
    <div className="space-y-6">
      {/* Profile Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Summary</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <User className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Name</p>
              <p className="text-sm text-muted-foreground">
                {user?.user_metadata?.full_name ?? 'Not set'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Mail className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Email</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Export */}
      <Card>
        <CardHeader>
          <CardTitle>Export Your Data</CardTitle>
          <CardDescription>
            Download all your hosts, SSH keys, and settings as JSON
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              This export includes all your workspace data, but does not include private SSH keys.
            </AlertDescription>
          </Alert>
          <Button onClick={downloadData} disabled={isExporting}>
            <Download className="w-4 h-4 mr-2" />
            {isExporting ? 'Exporting...' : 'Export Data'}
          </Button>
        </CardContent>
      </Card>

      {/* Manage Account */}
      <Card>
        <CardHeader>
          <CardTitle>Manage Account</CardTitle>
          <CardDescription>Update your profile and security settings</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <a href="#/profile">Go to Profile Settings</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- AccountSettingsTab.test.tsx`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add src/renderer/src/features/settings/AccountSettingsTab.tsx src/renderer/src/features/settings/__tests__/AccountSettingsTab.test.tsx
git commit -m "feat: add AccountSettingsTab with profile summary and data export

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Add Account Tab to SettingsPage

**Files:**
- Modify: `src/renderer/src/features/settings/SettingsPage.tsx`

**Step 1: Read current SettingsPage**

Run: `Read src/renderer/src/features/settings/SettingsPage.tsx`

**Step 2: Write the test**

```typescript
// Add to src/renderer/src/features/settings/__tests__/SettingsPage.test.tsx
it('should render Account tab', () => {
  render(<SettingsPage />);

  const accountTab = screen.getByRole('tab', { name: /Account/i });
  expect(accountTab).toBeInTheDocument();
});

it('should show AccountSettingsTab when Account tab clicked', async () => {
  render(<SettingsPage />);

  const accountTab = screen.getByRole('tab', { name: /Account/i });
  fireEvent.click(accountTab);

  await waitFor(() => {
    expect(screen.getByText(/Profile Summary/i)).toBeInTheDocument();
  });
});
```

**Step 3: Run test to verify it fails**

Run: `npm test -- SettingsPage.test.tsx`
Expected: FAIL with "Unable to find role 'tab' with name /Account/i"

**Step 4: Update SettingsPage to add Account tab**

Update `src/renderer/src/features/settings/SettingsPage.tsx`:

```typescript
import { AccountSettingsTab } from './AccountSettingsTab';

// Inside the Tabs component, add new TabsTrigger and TabsContent:

<TabsList className="grid w-full grid-cols-4"> {/* Change from grid-cols-3 to grid-cols-4 */}
  <TabsTrigger value="account">Account</TabsTrigger>
  <TabsTrigger value="appearance">Appearance</TabsTrigger>
  <TabsTrigger value="terminal">Terminal</TabsTrigger>
  <TabsTrigger value="ai">AI</TabsTrigger>
</TabsList>

<TabsContent value="account">
  <AccountSettingsTab />
</TabsContent>

{/* Keep existing TabsContent for appearance, terminal, ai */}
```

**Step 5: Run test to verify it passes**

Run: `npm test -- SettingsPage.test.tsx`
Expected: PASS (all tests including new ones)

**Step 6: Commit**

```bash
git add src/renderer/src/features/settings/SettingsPage.tsx src/renderer/src/features/settings/__tests__/SettingsPage.test.tsx
git commit -m "feat: add Account tab to SettingsPage

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Add WorkspaceSwitcher to Settings Header

**Files:**
- Modify: `src/renderer/src/features/settings/SettingsPage.tsx`

**Step 1: Write the test**

```typescript
// Add to src/renderer/src/features/settings/__tests__/SettingsPage.test.tsx
it('should render workspace switcher in header', () => {
  render(<SettingsPage />);

  // Assuming workspace switcher shows current workspace name
  expect(screen.getByRole('combobox')).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- SettingsPage.test.tsx`
Expected: FAIL with "Unable to find accessible element with role 'combobox'"

**Step 3: Update SettingsPage to add WorkspaceSwitcher**

Update `src/renderer/src/features/settings/SettingsPage.tsx`:

```typescript
import { WorkspaceSwitcher } from '../workspaces/WorkspaceSwitcher';

// Add WorkspaceSwitcher to header section:

<div className="flex items-center justify-between mb-6">
  <div>
    <h1 className="text-3xl font-bold">Settings</h1>
    <p className="text-muted-foreground">Manage your application preferences</p>
  </div>
  <div className="w-64">
    <WorkspaceSwitcher />
  </div>
</div>
```

**Step 4: Run test to verify it passes**

Run: `npm test -- SettingsPage.test.tsx`
Expected: PASS (all tests)

**Step 5: Commit**

```bash
git add src/renderer/src/features/settings/SettingsPage.tsx src/renderer/src/features/settings/__tests__/SettingsPage.test.tsx
git commit -m "feat: add WorkspaceSwitcher to Settings page header

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Create hooks Directory and Export useDataExport

**Files:**
- Create: `src/renderer/src/features/settings/hooks/index.ts`

**Step 1: Create index file**

```typescript
// src/renderer/src/features/settings/hooks/index.ts
export { useDataExport } from './useDataExport';
```

**Step 2: Update imports in AccountSettingsTab**

Update `src/renderer/src/features/settings/AccountSettingsTab.tsx`:

```typescript
// Change from:
// import { useDataExport } from './hooks/useDataExport';

// To:
import { useDataExport } from './hooks';
```

**Step 3: Run tests to verify nothing broke**

Run: `npm test -- AccountSettingsTab.test.tsx`
Expected: PASS (all tests)

**Step 4: Commit**

```bash
git add src/renderer/src/features/settings/hooks/index.ts src/renderer/src/features/settings/AccountSettingsTab.tsx
git commit -m "refactor: add hooks index file for cleaner imports

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Add WorkspaceSwitcher to ProfilePage (Optional Enhancement)

**Files:**
- Modify: `src/renderer/src/features/profile/ProfilePage.tsx` (if exists)

**Step 1: Check if ProfilePage exists**

Run: `ls src/renderer/src/features/profile/`

**Step 2: If ProfilePage exists, add WorkspaceSwitcher**

Only if the file exists from previous plan implementation:

```typescript
// Add to ProfilePage.tsx header section
import { WorkspaceSwitcher } from '../workspaces/WorkspaceSwitcher';

// Add to header:
<div className="flex items-center justify-between mb-6">
  <div>
    <h1 className="text-3xl font-bold">Profile</h1>
  </div>
  <div className="w-64">
    <WorkspaceSwitcher />
  </div>
</div>
```

**Step 3: Commit if changes made**

```bash
git add src/renderer/src/features/profile/ProfilePage.tsx
git commit -m "feat: add WorkspaceSwitcher to ProfilePage header

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Update WorkspaceStore to Include fetchWorkspaces

**Files:**
- Modify: `src/renderer/src/stores/workspace-store.ts`

**Step 1: Read current workspace-store**

Run: `Read src/renderer/src/stores/workspace-store.ts`

**Step 2: Add fetchWorkspaces method if missing**

If `fetchWorkspaces` method doesn't exist, add it:

```typescript
// Add to workspace-store.ts
fetchWorkspaces: async () => {
  const workspaces = await window.workspaceApi.listWorkspaces();
  set({ workspaces });
},
```

**Step 3: Update WorkspaceSwitcher to call fetchWorkspaces on mount**

Update `src/renderer/src/features/workspaces/WorkspaceSwitcher.tsx`:

```typescript
import { useEffect } from 'react';

export function WorkspaceSwitcher() {
  const { workspaces, activeWorkspace, setActiveWorkspace, fetchWorkspaces } = useWorkspaceStore();

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  // ... rest of component
}
```

**Step 4: Run tests**

Run: `npm test -- WorkspaceSwitcher.test.tsx`
Expected: PASS (all tests)

**Step 5: Commit**

```bash
git add src/renderer/src/stores/workspace-store.ts src/renderer/src/features/workspaces/WorkspaceSwitcher.tsx
git commit -m "feat: add fetchWorkspaces to workspace store and auto-fetch in switcher

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Integration Testing and Documentation

**Files:**
- Create: `src/renderer/src/features/settings/__tests__/AccountSettings.integration.test.tsx`
- Create: `docs/features/settings-enhancements.md`

**Step 1: Write integration test**

```typescript
// src/renderer/src/features/settings/__tests__/AccountSettings.integration.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsPage } from '../SettingsPage';

vi.mock('../../../lib/supabase');
vi.mock('../../../stores/workspace-store');

describe('Account Settings Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should complete full account settings flow', async () => {
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      user_metadata: { full_name: 'Test User' }
    };

    const { supabase } = require('../../../lib/supabase');
    supabase.auth.getUser.mockResolvedValue({ data: { user: mockUser } });

    const { useWorkspaceStore } = require('../../../stores/workspace-store');
    useWorkspaceStore.mockReturnValue({
      workspaces: [{ id: 'ws-1', name: 'My Workspace' }],
      activeWorkspace: { id: 'ws-1', name: 'My Workspace' },
      setActiveWorkspace: vi.fn(),
      fetchWorkspaces: vi.fn(),
    });

    render(<SettingsPage />);

    // Click Account tab
    const accountTab = screen.getByRole('tab', { name: /Account/i });
    fireEvent.click(accountTab);

    // Verify profile summary displayed
    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    // Verify workspace switcher present
    expect(screen.getByText('My Workspace')).toBeInTheDocument();

    // Verify data export available
    expect(screen.getByRole('button', { name: /Export Data/i })).toBeInTheDocument();
  });
});
```

**Step 2: Run integration test**

Run: `npm test -- AccountSettings.integration.test.tsx`
Expected: PASS

**Step 3: Write feature documentation**

```markdown
<!-- docs/features/settings-enhancements.md -->
# Settings Enhancements

## Overview

Enhanced Settings page with Account tab and Workspace Switcher for improved user experience.

## Features

### Account Settings Tab

**Location:** Settings > Account

**Components:**
- Profile Summary: Display user's name and email
- Data Export: Download all workspace data as JSON
- Manage Account: Quick link to Profile Settings

**Usage:**
1. Open Settings page
2. Click "Account" tab
3. View profile information
4. Click "Export Data" to download all your data

### Workspace Switcher

**Locations:**
- Settings page header
- Profile page header (optional)

**Functionality:**
- Shows current workspace name
- Dropdown to select different workspace
- Auto-fetches workspaces on mount
- Switches active workspace context

**Usage:**
1. Click workspace dropdown in Settings header
2. Select desired workspace
3. All settings now apply to selected workspace

### Data Export

**Format:** JSON file named `archterm-export-YYYY-MM-DD.json`

**Includes:**
- User profile (id, email)
- All hosts and folders
- SSH key metadata (not private keys)
- Settings and preferences
- Export timestamp

**Security:**
- Private SSH keys are NOT included in export
- Only metadata and public keys exported
- Encrypted data remains encrypted

## Technical Details

### Components

1. **WorkspaceSwitcher** (`features/workspaces/WorkspaceSwitcher.tsx`)
   - Reusable Select component
   - Uses workspace-store for state
   - Auto-fetches workspaces on mount

2. **AccountSettingsTab** (`features/settings/AccountSettingsTab.tsx`)
   - Profile summary card
   - Data export card with download button
   - Manage account navigation

3. **useDataExport Hook** (`features/settings/hooks/useDataExport.ts`)
   - Fetches all user data from Supabase
   - Formats as JSON
   - Triggers browser download

### State Management

Uses existing `workspace-store.ts`:
- `workspaces`: Array of all workspaces
- `activeWorkspace`: Currently selected workspace
- `setActiveWorkspace(id)`: Switch workspace
- `fetchWorkspaces()`: Reload workspace list

### Testing

- Unit tests for WorkspaceSwitcher
- Unit tests for AccountSettingsTab
- Unit tests for useDataExport hook
- Integration test for full Account settings flow

## Future Enhancements

- Add data import functionality
- Support selective export (hosts only, keys only)
- Schedule automatic exports
- Export to different formats (CSV, XML)
```

**Step 4: Commit**

```bash
git add src/renderer/src/features/settings/__tests__/AccountSettings.integration.test.tsx docs/features/settings-enhancements.md
git commit -m "docs: add integration test and documentation for settings enhancements

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Verification

1. `npm test` — All tests pass (unit + integration)
2. `npm run dev` — Open Settings page
3. Click "Account" tab → Profile summary visible, data export button works
4. Workspace switcher in header → Can switch between workspaces
5. Click "Export Data" → JSON file downloads with all data
6. Verify exported JSON structure matches schema
7. Private SSH keys NOT in export (security check)

---

## Dependencies

**Requires from previous plans:**
- User Profile & Logout plan (ProfilePage component)
- Workspace Settings plan (workspace-store with setActiveWorkspace)

**Required packages (already installed):**
- shadcn/ui: Select, Card, Alert, Button
- Supabase client for data queries
- Zustand for state management

---

## Notes

- WorkspaceSwitcher is reusable across multiple pages
- Data export does NOT include private SSH keys for security
- Account tab provides overview with link to full Profile page
- Integration test ensures all features work together
- Documentation explains both user and technical perspectives
