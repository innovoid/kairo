# ArchTerm Termius Alternative — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform ArchTerm into a competitive open-source Termius alternative through three phased milestones: stabilization, terminal power features, and enterprise networking.

**Architecture:** Electron (main) + React (renderer) + Supabase (backend) + SQLite (local cache). IPC bridge via preload scripts. Zustand stores for state management. xterm.js for terminal emulation.

**Tech Stack:** Electron 40, React 18, TypeScript 5.9, Vite 7, xterm.js 6, ssh2, Supabase, Zustand 5, shadcn/ui, Tailwind CSS 4

---

## Phase 1 — Stabilization

### Task 1: Replace hardcoded encryption key with safeStorage

**Files:**
- Modify: `src/main/services/key-manager.ts:31-60`
- Modify: `src/main/db.ts:60-65` (add salt column to private_keys)
- Modify: `src/main/index.ts` (add safeStorage availability check)

**Step 1: Add salt column to private_keys table**

In `src/main/db.ts`, update the `private_keys` table schema:

```sql
create table if not exists private_keys (
  key_id text primary key,
  encrypted_blob text not null,
  iv text not null,
  auth_tag text not null,
  salt text
);
```

**Step 2: Rewrite encryptPrivateKey and decryptPrivateKey**

In `src/main/services/key-manager.ts`, replace the hardcoded key functions with safeStorage-backed key derivation:

```typescript
import { safeStorage } from 'electron';
import { pbkdf2Sync, randomBytes } from 'node:crypto';

const PBKDF2_ITERATIONS = 100_000;
const KEY_LENGTH = 32;

function deriveEncryptionKey(salt: Buffer): Buffer {
  // Use a machine-specific secret via safeStorage
  const secret = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString('archterm-key-material').toString('base64')
    : 'archterm-fallback-' + require('os').hostname();
  return pbkdf2Sync(secret, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
}

function encryptPrivateKey(keyData: string): { encrypted_blob: string; iv: string; auth_tag: string; salt: string } {
  const salt = randomBytes(32);
  const key = deriveEncryptionKey(salt);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(keyData, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    encrypted_blob: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    auth_tag: authTag.toString('base64'),
    salt: salt.toString('base64'),
  };
}

function decryptPrivateKey(encrypted_blob: string, iv: string, auth_tag: string, saltBase64?: string): string {
  let key: Buffer;
  if (saltBase64) {
    key = deriveEncryptionKey(Buffer.from(saltBase64, 'base64'));
  } else {
    // Legacy fallback for keys encrypted with old hardcoded key
    key = Buffer.alloc(32);
    Buffer.from('archterm-v1-secret-key-padding!!').copy(key);
  }
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(auth_tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(encrypted_blob, 'base64')), decipher.final()]).toString('utf8');
}
```

**Step 3: Update privateKeyQueries for salt**

In `src/main/db.ts`, update the `DbPrivateKey` interface and upsert:

```typescript
export interface DbPrivateKey {
  key_id: string;
  encrypted_blob: string;
  iv: string;
  auth_tag: string;
  salt: string | null;
}
```

Update upsert SQL to include salt column.

**Step 4: Add migration for existing keys**

Add a function `migratePrivateKeys()` in `key-manager.ts` that re-encrypts all existing keys (those with `salt IS NULL`) using the new scheme. Call it during `getDb()` initialization.

**Step 5: Update workspace-encryption.ts**

In `src/main/services/workspace-encryption.ts:139-146`, replace the hardcoded key usage with a call to `keyManager.getDecryptedKey()` instead of inline decryption.

**Step 6: Commit**

```bash
git add src/main/services/key-manager.ts src/main/db.ts src/main/services/workspace-encryption.ts
git commit -m "security: replace hardcoded encryption key with safeStorage-backed PBKDF2"
```

---

### Task 2: Move AI API keys to local-only storage

**Files:**
- Modify: `src/shared/types/settings.ts:6-22`
- Modify: `src/main/ipc/settings.ts:22-25,59-61,93-95`
- Modify: `src/main/db.ts` (add `api_keys_cache` table)
- Modify: `src/renderer/src/stores/settings-store.ts`
- Create: `src/main/services/api-key-store.ts`
- Modify: `src/preload/settings-api.ts`

**Step 1: Create local API key store**

Create `src/main/services/api-key-store.ts`:

```typescript
import { safeStorage } from 'electron';
import { getDb } from '../db';

// Table: api_keys (provider text primary key, encrypted_key text)
export const apiKeyStore = {
  get(provider: string): string | null {
    const db = getDb();
    const row = db.prepare('select encrypted_key from api_keys where provider = ?').get(provider) as { encrypted_key: string } | undefined;
    if (!row) return null;
    if (!safeStorage.isEncryptionAvailable()) return row.encrypted_key;
    return safeStorage.decryptString(Buffer.from(row.encrypted_key, 'base64'));
  },
  set(provider: string, key: string): void {
    const db = getDb();
    const encrypted = safeStorage.isEncryptionAvailable()
      ? safeStorage.encryptString(key).toString('base64')
      : key;
    db.prepare('insert or replace into api_keys (provider, encrypted_key) values (?, ?)').run(provider, encrypted);
  },
  delete(provider: string): void {
    const db = getDb();
    db.prepare('delete from api_keys where provider = ?').run(provider);
  },
};
```

**Step 2: Add api_keys table to db.ts migrations**

```sql
create table if not exists api_keys (
  provider text primary key,
  encrypted_key text not null
);
```

**Step 3: Remove API key fields from UserSettings type**

In `src/shared/types/settings.ts`, remove `openaiApiKeyEncrypted`, `anthropicApiKeyEncrypted`, `geminiApiKeyEncrypted` from `UserSettings`. Add separate IPC channels for API key management.

**Step 4: Add IPC handlers for API keys**

New handlers: `apiKeys.get`, `apiKeys.set`, `apiKeys.delete`. These bypass Supabase entirely.

**Step 5: Remove API key columns from settings Supabase queries**

Clean up `src/main/ipc/settings.ts:59-61,93-95` to stop reading/writing API key columns.

**Step 6: Commit**

```bash
git commit -m "security: move AI API keys to local-only encrypted storage via safeStorage"
```

---

### Task 3: Add structured logger, remove console.log statements

**Files:**
- Modify: `package.json` (add `electron-log`)
- Create: `src/main/lib/logger.ts`
- Modify: `src/main/ipc/register.ts:65,68,70,73,86,89,95` (17 console.log/error statements)
- Modify: `src/main/ipc/hosts.ts:18,28,35,42,47,65,75,85,95,105,115`
- Modify: `src/main/ipc/keys.ts:25,29,43,45,61,63`
- Modify: `src/renderer/src/stores/host-store.ts:67,79,84,117`

**Step 1: Install electron-log**

```bash
npm install electron-log
```

**Step 2: Create logger wrapper**

Create `src/main/lib/logger.ts`:

```typescript
import log from 'electron-log/main';

log.transports.file.level = 'info';
log.transports.console.level = 'debug';

export const logger = {
  debug: log.debug.bind(log),
  info: log.info.bind(log),
  warn: log.warn.bind(log),
  error: log.error.bind(log),
};
```

**Step 3: Replace all console.log/error in main process**

In `src/main/ipc/register.ts`, replace:
- Line 65: `console.log(...)` → `logger.debug(...)`
- Line 68: `console.log(...)` → remove (too verbose)
- Line 70: `console.log(...)` → remove
- Line 73: `console.error(...)` → `logger.error(...)`
- Line 86: `console.log(...)` → `logger.debug(...)`
- Line 89: `console.log(...)` → remove
- Line 95: `console.error(...)` → `logger.error(...)`

Similarly for `hosts.ts`, `keys.ts`.

**Step 4: Replace console.log/error in renderer**

In `host-store.ts:67,79,84,117`, remove console.log statements or replace with conditional debug logging.

**Step 5: Commit**

```bash
git commit -m "chore: replace console.log with structured electron-log logger"
```

---

### Task 4: Fix workspace ID hack in host-store

**Files:**
- Modify: `src/renderer/src/stores/host-store.ts:86,118`
- Modify: `src/renderer/src/stores/workspace-store.ts` (export `getActiveWorkspaceId` helper)

**Step 1: Add selector to workspace store**

In `src/renderer/src/stores/workspace-store.ts`, add:

```typescript
export function getActiveWorkspaceId(): string | null {
  return useWorkspaceStore.getState().activeWorkspace?.id ?? null;
}
```

**Step 2: Replace window hack in host-store**

In `src/renderer/src/stores/host-store.ts:86` and `:118`, replace:

```typescript
// Before:
const workspaceId = (window as any).currentWorkspaceId;

// After:
import { getActiveWorkspaceId } from './workspace-store';
const workspaceId = getActiveWorkspaceId();
```

**Step 3: Commit**

```bash
git commit -m "fix: replace window.currentWorkspaceId hack with workspace store selector"
```

---

### Task 5: Wire up team invite dialog

**Files:**
- Create: `src/renderer/src/features/team/InviteMemberDialog.tsx`
- Modify: `src/renderer/src/features/team/TeamPage.tsx:73-76`

**Step 1: Create InviteMemberDialog component**

```tsx
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { WorkspaceRole } from '@shared/types/workspace';

interface InviteMemberDialogProps {
  workspaceId: string;
  onInvited: () => void;
}

export function InviteMemberDialog({ workspaceId, onInvited }: InviteMemberDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<WorkspaceRole>('member');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setIsLoading(true);
    try {
      await window.workspaceApi.invite({ workspaceId, email: email.trim(), role });
      toast.success(`Invitation sent to ${email}`);
      setEmail('');
      setRole('member');
      setOpen(false);
      onInvited();
    } catch (error) {
      toast.error((error as Error).message || 'Failed to send invitation');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1.5" />
          Invite Member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@example.com" required />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as WorkspaceRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? 'Sending...' : 'Send Invitation'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Replace button in TeamPage**

In `src/renderer/src/features/team/TeamPage.tsx:73-76`, replace the dead `<Button>` with `<InviteMemberDialog workspaceId={workspaceId} onInvited={loadMembers} />`.

**Step 3: Commit**

```bash
git commit -m "feat: wire up team invite member dialog"
```

---

### Task 6: Wire up create workspace dialog

**Files:**
- Create: `src/renderer/src/features/workspaces/CreateWorkspaceDialog.tsx`
- Modify: `src/renderer/src/features/workspaces/WorkspaceSwitcher.tsx:28-32`

**Step 1: Create CreateWorkspaceDialog component**

```tsx
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface CreateWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function CreateWorkspaceDialog({ open, onOpenChange, onCreated }: CreateWorkspaceDialogProps) {
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setIsLoading(true);
    try {
      await window.workspaceApi.create({ name: name.trim() });
      toast.success(`Workspace "${name}" created`);
      setName('');
      onOpenChange(false);
      onCreated();
    } catch (error) {
      toast.error((error as Error).message || 'Failed to create workspace');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Workspace</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ws-name">Name</Label>
            <Input id="ws-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="My Workspace" required />
          </div>
          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? 'Creating...' : 'Create'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Wire into WorkspaceSwitcher**

In `src/renderer/src/features/workspaces/WorkspaceSwitcher.tsx`, replace the `handleCreateWorkspace` function at line 28-32:

```tsx
const [createDialogOpen, setCreateDialogOpen] = useState(false);

const handleCreateWorkspace = () => {
  setCreateDialogOpen(true);
  setOpen(false);
};
```

Add `<CreateWorkspaceDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} onCreated={() => { fetchWorkspaces(); window.location.reload(); }} />` after the `</Popover>`.

**Step 3: Commit**

```bash
git commit -m "feat: wire up create workspace dialog in WorkspaceSwitcher"
```

---

### Task 7: Implement delete_user_account Supabase migration

**Files:**
- Create: `supabase/migrations/20260220_delete_user_account.sql`

**Step 1: Write the migration**

```sql
create or replace function public.delete_user_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  owned_workspace_ids uuid[];
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Get workspaces where user is the sole owner
  select array_agg(wm.workspace_id) into owned_workspace_ids
  from workspace_members wm
  where wm.user_id = current_user_id
    and wm.role = 'owner'
    and not exists (
      select 1 from workspace_members wm2
      where wm2.workspace_id = wm.workspace_id
        and wm2.role = 'owner'
        and wm2.user_id != current_user_id
    );

  -- Delete solely-owned workspaces (cascades to members, hosts, keys, etc.)
  if owned_workspace_ids is not null then
    delete from workspaces where id = any(owned_workspace_ids);
  end if;

  -- Remove from remaining workspaces
  delete from workspace_members where user_id = current_user_id;

  -- Revoke any pending invites sent by this user
  update workspace_invites set revoked_at = now()
  where invited_by = current_user_id and accepted_at is null and revoked_at is null;

  -- Delete settings
  delete from settings where user_id = current_user_id;

  -- Delete user workspace settings
  delete from user_workspace_settings where user_id = current_user_id;

  -- Delete from public.users
  delete from users where id = current_user_id;

  -- Delete auth user (requires service role, handled by Supabase admin API or edge function)
  -- For now, mark profile as deleted
end;
$$;
```

**Step 2: Commit**

```bash
git commit -m "feat: implement delete_user_account RPC with cascade cleanup"
```

---

### Task 8: Add React error boundaries for terminal and SFTP

**Files:**
- Create: `src/renderer/src/components/ErrorBoundary.tsx`
- Modify: `src/renderer/src/components/layout/MainArea.tsx:25-28`

**Step 1: Create ErrorBoundary component**

```tsx
import { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackLabel?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
          <AlertTriangle className="h-8 w-8" />
          <p className="text-sm font-medium">{this.props.fallbackLabel ?? 'Something went wrong'}</p>
          <p className="text-xs">{this.state.error?.message}</p>
          <Button size="sm" variant="outline" onClick={() => this.setState({ hasError: false, error: null })}>
            Retry
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

**Step 2: Wrap terminal and SFTP tabs in MainArea**

In `src/renderer/src/components/layout/MainArea.tsx:25-28`:

```tsx
{tab.tabType === 'terminal' ? (
  <ErrorBoundary fallbackLabel="Terminal crashed">
    <TerminalTab tab={tab} />
  </ErrorBoundary>
) : (
  <ErrorBoundary fallbackLabel="SFTP crashed">
    <SftpTab tab={tab} />
  </ErrorBoundary>
)}
```

**Step 3: Commit**

```bash
git commit -m "feat: add React error boundaries for terminal and SFTP crash isolation"
```

---

### Task 9: Improve SSH error messages

**Files:**
- Modify: `src/renderer/src/features/terminal/TerminalTab.tsx:39-43`
- Modify: `src/main/services/ssh-manager.ts:85-90`

**Step 1: Add error classification in ssh-manager**

In `src/main/services/ssh-manager.ts:85-90`, enhance the error handler:

```typescript
client.on('error', (err) => {
  sessions.delete(sessionId);
  if (!sender.isDestroyed()) {
    let userMessage = err.message;
    if (err.message.includes('All configured authentication methods failed')) {
      userMessage = 'Authentication failed. Check your username, password, or SSH key.';
    } else if (err.message.includes('ECONNREFUSED')) {
      userMessage = `Connection refused by ${config.host}:${config.port}. Is the SSH server running?`;
    } else if (err.message.includes('ETIMEDOUT') || err.message.includes('Timed out')) {
      userMessage = `Connection timed out to ${config.host}:${config.port}. Check the hostname and your network.`;
    } else if (err.message.includes('ENOTFOUND') || err.message.includes('getaddrinfo')) {
      userMessage = `Host not found: ${config.host}. Check the hostname or DNS.`;
    } else if (err.message.includes('EHOSTUNREACH')) {
      userMessage = `Host unreachable: ${config.host}. Check your network connection.`;
    }
    sender.send('ssh:error', sessionId, userMessage);
  }
});
```

**Step 2: Add toast notification for SSH errors**

In `src/renderer/src/features/terminal/TerminalTab.tsx:39-43`, add a toast import and show toast on error:

```typescript
import { toast } from 'sonner';

// In the onError callback:
const offError = window.sshApi.onError((sessionId, error) => {
  if (sessionId === tab.sessionId) {
    updateTabStatus(tab.tabId, 'error');
    terminal.current?.write(`\r\n\x1b[31mError: ${error}\x1b[0m\r\n`);
    toast.error(error);
  }
});
```

**Step 3: Commit**

```bash
git commit -m "fix: surface descriptive SSH error messages as toasts"
```

---

## Phase 2 — Terminal Power

### Task 10: Abstract SessionBackend interface

**Files:**
- Create: `src/shared/types/session.ts`
- Modify: `src/main/services/ssh-manager.ts`
- Modify: `src/main/ipc/ssh.ts`
- Modify: `src/preload/ssh-api.ts`

**Step 1: Define SessionBackend types**

Create `src/shared/types/session.ts`:

```typescript
export type SessionType = 'ssh' | 'local';

export interface SessionConnectConfig {
  type: SessionType;
  // SSH-specific
  host?: string;
  port?: number;
  username?: string;
  authType?: 'password' | 'key';
  password?: string;
  privateKeyId?: string;
  hostId?: string;
  // Local-specific
  shell?: string;
  cwd?: string;
}
```

**Step 2: Add session type routing in IPC**

In `src/main/ipc/ssh.ts`, the `connect` handler should check `config.type` and route to either `sshManager.connect()` or `localShellManager.connect()`.

**Step 3: Update preload API**

In `src/preload/ssh-api.ts`, rename the API to `sessionApi` (keeping `sshApi` as alias for backward compat) and update the connect signature to accept `SessionConnectConfig`.

**Step 4: Commit**

```bash
git commit -m "refactor: abstract SessionBackend interface for SSH and local shell"
```

---

### Task 11: Add local shell support via node-pty

**Files:**
- Modify: `package.json` (add `node-pty`)
- Create: `src/main/services/local-shell-manager.ts`
- Modify: `src/main/ipc/ssh.ts` (add local connect path)
- Modify: `src/renderer/src/components/layout/Sidebar.tsx` (add local terminal button)
- Modify: `src/renderer/src/features/terminal/useTerminal.ts:48-49` (route input to correct backend)

**Step 1: Install node-pty**

```bash
npm install node-pty
```

**Step 2: Create local-shell-manager.ts**

```typescript
import * as pty from 'node-pty';
import type { WebContents } from 'electron';
import { platform } from 'os';

interface LocalSession {
  pty: pty.IPty;
}

const sessions = new Map<string, LocalSession>();

export const localShellManager = {
  connect(sessionId: string, sender: WebContents, options?: { shell?: string; cwd?: string }): void {
    localShellManager.disconnect(sessionId);

    const defaultShell = platform() === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/zsh';
    const shell = options?.shell || defaultShell;
    const cwd = options?.cwd || process.env.HOME || '/';

    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd,
      env: process.env as Record<string, string>,
    });

    sessions.set(sessionId, { pty: ptyProcess });

    ptyProcess.onData((data) => {
      if (!sender.isDestroyed()) {
        sender.send('ssh:data', sessionId, data);
      }
    });

    ptyProcess.onExit(() => {
      sessions.delete(sessionId);
      if (!sender.isDestroyed()) {
        sender.send('ssh:closed', sessionId);
      }
    });

    // Signal connected
    sender.send('ssh:data', sessionId, '');
  },

  disconnect(sessionId: string): void {
    const session = sessions.get(sessionId);
    if (session) {
      session.pty.kill();
      sessions.delete(sessionId);
    }
  },

  send(sessionId: string, data: string): void {
    sessions.get(sessionId)?.pty.write(data);
  },

  resize(sessionId: string, cols: number, rows: number): void {
    sessions.get(sessionId)?.pty.resize(cols, rows);
  },
};
```

**Step 3: Route in IPC handler**

In `src/main/ipc/ssh.ts`, update the connect handler to check `config.type === 'local'` and route to `localShellManager.connect()`. Similarly for send, resize, disconnect — check which manager owns the session.

**Step 4: Add Local Terminal button to Sidebar**

In `src/renderer/src/components/layout/Sidebar.tsx`, add a `TerminalSquare` icon button that opens a local terminal tab:

```tsx
import { TerminalSquare } from 'lucide-react';

<NavButton icon={TerminalSquare} label="Local Terminal" active={false} onClick={() => {
  const sessionId = `local-${Date.now()}`;
  openTab({
    tabId: sessionId,
    tabType: 'terminal',
    label: 'Local',
    sessionId,
    status: 'connecting',
  });
  window.sshApi.connect(sessionId, { type: 'local' } as any);
}} />
```

**Step 5: Commit**

```bash
git commit -m "feat: add local shell support via node-pty"
```

---

### Task 12: Add terminal search via @xterm/addon-search

**Files:**
- Modify: `package.json` (add `@xterm/addon-search`)
- Modify: `src/renderer/src/features/terminal/useTerminal.ts` (load search addon)
- Create: `src/renderer/src/features/terminal/TerminalSearchBar.tsx`
- Modify: `src/renderer/src/features/terminal/TerminalTab.tsx` (render search bar)

**Step 1: Install addon**

```bash
npm install @xterm/addon-search
```

**Step 2: Load search addon in useTerminal**

In `src/renderer/src/features/terminal/useTerminal.ts`, add:

```typescript
import { SearchAddon } from '@xterm/addon-search';

// Inside the useEffect, after creating terminal:
const searchAddon = new SearchAddon();
terminal.loadAddon(searchAddon);
```

Return `searchAddon` ref from the hook.

**Step 3: Create TerminalSearchBar component**

Floating search bar triggered by `Cmd+F`:

```tsx
interface TerminalSearchBarProps {
  searchAddon: SearchAddon | null;
  onClose: () => void;
}

export function TerminalSearchBar({ searchAddon, onClose }: TerminalSearchBarProps) {
  const [query, setQuery] = useState('');
  const [useRegex, setUseRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);

  function findNext() {
    searchAddon?.findNext(query, { regex: useRegex, caseSensitive });
  }
  function findPrev() {
    searchAddon?.findPrevious(query, { regex: useRegex, caseSensitive });
  }

  // Render: input + next/prev buttons + regex toggle + case toggle + close
}
```

**Step 4: Integrate into TerminalTab**

Add keyboard listener for `Cmd+F` → show search bar. `Escape` → hide.

**Step 5: Commit**

```bash
git commit -m "feat: add terminal search via @xterm/addon-search"
```

---

### Task 13: Add split panes for terminals

**Files:**
- Create: `src/renderer/src/features/terminal/SplitPaneLayout.tsx`
- Create: `src/shared/types/pane.ts`
- Modify: `src/renderer/src/stores/session-store.ts` (add pane tree to tab)
- Modify: `src/renderer/src/components/layout/MainArea.tsx` (render split layout)

**Step 1: Define pane types**

Create `src/shared/types/pane.ts`:

```typescript
export type PaneNode = TerminalPane | SplitPane;

export interface TerminalPane {
  type: 'terminal';
  sessionId: string;
}

export interface SplitPane {
  type: 'split';
  direction: 'horizontal' | 'vertical';
  children: PaneNode[];
  sizes: number[];
}
```

**Step 2: Create SplitPaneLayout component**

Recursive component that renders either a terminal or a nested `ResizablePanelGroup`:

```tsx
export function SplitPaneLayout({ pane, onSplit, onClosePane }: SplitPaneLayoutProps) {
  if (pane.type === 'terminal') {
    return <TerminalTab tab={/* build tab from sessionId */} />;
  }
  return (
    <ResizablePanelGroup direction={pane.direction}>
      {pane.children.map((child, i) => (
        <Fragment key={i}>
          {i > 0 && <ResizableHandle />}
          <ResizablePanel defaultSize={pane.sizes[i]}>
            <SplitPaneLayout pane={child} onSplit={onSplit} onClosePane={onClosePane} />
          </ResizablePanel>
        </Fragment>
      ))}
    </ResizablePanelGroup>
  );
}
```

**Step 3: Add keyboard shortcuts**

`Cmd+D` → horizontal split (create new SSH/local session, add to pane tree)
`Cmd+Shift+D` → vertical split
`Cmd+W` → close current pane

**Step 4: Commit**

```bash
git commit -m "feat: add split pane terminal layout"
```

---

### Task 14: Add snippets system (database + UI + quick-insert)

**Files:**
- Create: `supabase/migrations/20260220_snippets.sql`
- Modify: `src/main/db.ts` (add snippets table)
- Create: `src/main/ipc/snippets.ts`
- Create: `src/preload/snippets-api.ts`
- Create: `src/shared/types/snippets.ts`
- Create: `src/renderer/src/stores/snippet-store.ts`
- Create: `src/renderer/src/features/snippets/SnippetsPage.tsx`
- Create: `src/renderer/src/features/snippets/SnippetPickerOverlay.tsx`
- Modify: `src/renderer/src/components/layout/Sidebar.tsx` (add snippets nav)
- Modify: `src/renderer/src/stores/session-store.ts` (add 'snippets' tab type)
- Modify: `src/main/ipc/register.ts` (register snippet handlers)

**Step 1: Create Supabase migration**

```sql
create table snippets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  name text not null,
  command text not null,
  description text,
  tags text[] default '{}',
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table snippets enable row level security;

create policy "members can read workspace snippets" on snippets
  for select using (
    exists (select 1 from workspace_members wm where wm.workspace_id = snippets.workspace_id and wm.user_id = auth.uid())
  );

create policy "members can insert workspace snippets" on snippets
  for insert with check (
    exists (select 1 from workspace_members wm where wm.workspace_id = snippets.workspace_id and wm.user_id = auth.uid())
  );

create policy "members can update workspace snippets" on snippets
  for update using (
    exists (select 1 from workspace_members wm where wm.workspace_id = snippets.workspace_id and wm.user_id = auth.uid())
  );

create policy "members can delete workspace snippets" on snippets
  for delete using (
    exists (select 1 from workspace_members wm where wm.workspace_id = snippets.workspace_id and wm.user_id = auth.uid())
  );
```

**Step 2: Add local SQLite table**

```sql
create table if not exists snippets (
  id text primary key,
  workspace_id text not null,
  name text not null,
  command text not null,
  description text,
  tags text default '[]',
  created_by text,
  synced_at integer
);
```

**Step 3: Create types, IPC handlers, preload API, store, and UI**

Follow the same pattern as hosts: Supabase for remote, SQLite for cache, Zustand store for state, shadcn components for UI.

**Step 4: Add snippet picker overlay**

`Cmd+Shift+S` from terminal opens a `cmdk`-style overlay listing snippets. Selecting one types the command into the active terminal. If the command contains `{{variable}}` placeholders, prompt with an inline input dialog before inserting.

**Step 5: Commit**

```bash
git commit -m "feat: add snippets system with CRUD, sync, and terminal quick-insert"
```

---

### Task 15: Add broadcast input to multiple sessions

**Files:**
- Create: `src/renderer/src/features/terminal/BroadcastManager.tsx`
- Modify: `src/renderer/src/features/terminal/TerminalToolbar.tsx` (add broadcast toggle)
- Modify: `src/renderer/src/features/terminal/useTerminal.ts` (replicate input when broadcasting)
- Create: `src/renderer/src/stores/broadcast-store.ts`

**Step 1: Create broadcast store**

```typescript
import { create } from 'zustand';

interface BroadcastState {
  enabled: boolean;
  targetSessionIds: Set<string>;
  toggle: () => void;
  setTargets: (ids: string[]) => void;
}
```

**Step 2: Add broadcast button to TerminalToolbar**

Toggle button with `Radio` icon. When clicked, opens a dialog listing all connected sessions with checkboxes.

**Step 3: Modify useTerminal input handler**

When broadcast is enabled and this pane is focused, replicate `terminal.onData` to all target sessions:

```typescript
const disposeOnData = terminal.onData((data) => {
  window.sshApi.send(sessionId, data);
  const { enabled, targetSessionIds } = useBroadcastStore.getState();
  if (enabled) {
    for (const targetId of targetSessionIds) {
      if (targetId !== sessionId) {
        window.sshApi.send(targetId, data);
      }
    }
  }
});
```

**Step 4: Add visual indicator**

When a session is a broadcast target, add a colored left border (`border-l-2 border-blue-500`) to its terminal container.

**Step 5: Commit**

```bash
git commit -m "feat: add broadcast input to multiple terminal sessions"
```

---

### Task 16: Add terminal recording and replay

**Files:**
- Create: `src/main/services/recording-manager.ts`
- Create: `src/main/ipc/recording.ts`
- Create: `src/preload/recording-api.ts`
- Create: `src/renderer/src/features/terminal/RecordingControls.tsx`
- Create: `src/renderer/src/features/terminal/ReplayPlayer.tsx`
- Modify: `src/renderer/src/features/terminal/TerminalToolbar.tsx` (add record button)
- Modify: `src/renderer/src/components/layout/StatusBar.tsx` (recording indicator)

**Step 1: Create recording-manager.ts**

Records terminal I/O in asciicast v2 format:

```typescript
import { writeFileSync, mkdirSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';

interface Recording {
  sessionId: string;
  startTime: number;
  events: Array<[number, string, string]>; // [relative_time, type, data]
  header: { version: 2; width: number; height: number; timestamp: number };
}

const activeRecordings = new Map<string, Recording>();

export const recordingManager = {
  start(sessionId: string, cols: number, rows: number): void { ... },
  appendData(sessionId: string, data: string): void { ... },
  stop(sessionId: string): string { /* returns file path */ ... },
  list(): Array<{ filename: string; path: string; timestamp: number }> { ... },
  read(path: string): string { /* returns asciicast JSON */ ... },
};
```

Storage: `~/.config/archterm/recordings/YYYY-MM-DD_HH-mm-ss.cast`

**Step 2: Wire IPC, preload, and UI**

Standard pattern: IPC handlers → preload API → React components.

**Step 3: Add record button to TerminalToolbar**

Circle icon (red when recording). Start/stop recording via `window.recordingApi.start(sessionId)` / `.stop(sessionId)`.

**Step 4: Add recording indicator to StatusBar**

When any session is recording, show a red dot + "Recording" in the status bar.

**Step 5: Commit**

```bash
git commit -m "feat: add terminal recording in asciicast v2 format with replay"
```

---

### Task 17: Add additional xterm addons (ligatures, unicode, serialize, images)

**Files:**
- Modify: `package.json`
- Modify: `src/renderer/src/features/terminal/useTerminal.ts`

**Step 1: Install addons**

```bash
npm install @xterm/addon-unicode11 @xterm/addon-serialize @xterm/addon-image
```

Note: `@xterm/addon-ligatures` requires canvas support — install only if available.

**Step 2: Load addons in useTerminal**

```typescript
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { SerializeAddon } from '@xterm/addon-serialize';
import { ImageAddon } from '@xterm/addon-image';

// After creating terminal:
const unicode11 = new Unicode11Addon();
terminal.loadAddon(unicode11);
terminal.unicode.activeVersion = '11';

const serializeAddon = new SerializeAddon();
terminal.loadAddon(serializeAddon);

const imageAddon = new ImageAddon();
terminal.loadAddon(imageAddon);
```

**Step 3: Add copy-on-select setting**

In `useTerminal.ts`, add:

```typescript
if (settings?.copyOnSelect) {
  terminal.onSelectionChange(() => {
    const selection = terminal.getSelection();
    if (selection) navigator.clipboard.writeText(selection);
  });
}
```

Add `copyOnSelect` to `UserSettings` type and settings UI.

**Step 4: Add multi-line paste warning**

Before writing pasted content containing newlines, show a confirmation dialog.

**Step 5: Commit**

```bash
git commit -m "feat: add unicode11, serialize, image addons and copy-on-select"
```

---

## Phase 3 — Network & Sync Power

### Task 18: Add local port forwarding

**Files:**
- Modify: `src/main/services/ssh-manager.ts` (add forwardOut method)
- Create: `src/main/services/port-forward-manager.ts`
- Create: `src/main/ipc/port-forward.ts`
- Create: `src/preload/port-forward-api.ts`
- Create: `src/shared/types/port-forward.ts`
- Create: `src/renderer/src/features/terminal/PortForwardPanel.tsx`
- Modify: `src/main/ipc/register.ts` (register handlers)

**Step 1: Create port-forward types**

```typescript
export interface PortForwardRule {
  id: string;
  type: 'local' | 'remote' | 'dynamic';
  localPort: number;
  remoteHost: string;
  remotePort: number;
  status: 'active' | 'error' | 'stopped';
  bytesIn: number;
  bytesOut: number;
}
```

**Step 2: Create port-forward-manager**

Uses Node.js `net.createServer()` for local forwarding that tunnels through `ssh2Client.forwardOut()`.

**Step 3: Create UI panel**

Table of active forwards with add/remove, traffic counters, status indicators.

**Step 4: Commit**

```bash
git commit -m "feat: add local/remote port forwarding through SSH tunnels"
```

---

### Task 19: Add jump host / ProxyJump support

**Files:**
- Modify: `src/shared/types/hosts.ts` (add `jumpHostId` field)
- Modify: `supabase/migrations/20260219_archterm.sql` or create new migration (add column)
- Modify: `src/main/services/ssh-manager.ts:20-99` (chain connections)
- Modify: `src/renderer/src/features/hosts/HostForm.tsx` (add jump host dropdown)

**Step 1: Add jumpHostId to hosts schema**

Migration: `alter table hosts add column jump_host_id uuid references hosts(id);`

SQLite: `alter table hosts add column jump_host_id text;`

**Step 2: Implement chained connection**

In `ssh-manager.ts`, if `config.jumpHostId` is set:
1. Look up jump host config
2. Connect to jump host first
3. Use `jumpClient.forwardOut()` to create a stream to the final destination
4. Create the final SSH client over that stream

**Step 3: Add jump host selector in HostForm**

Dropdown showing other hosts in the workspace. Shows hop chain preview.

**Step 4: Commit**

```bash
git commit -m "feat: add jump host / ProxyJump chained SSH connections"
```

---

### Task 20: Implement dual-pane SFTP

**Files:**
- Create: `src/main/services/local-fs-manager.ts`
- Create: `src/main/ipc/local-fs.ts`
- Create: `src/preload/local-fs-api.ts`
- Modify: `src/renderer/src/features/sftp/SftpTab.tsx:26-35`
- Modify: `src/renderer/src/features/sftp/FilePane.tsx` (add `source` prop)
- Modify: `src/main/ipc/register.ts`

**Step 1: Create local-fs-manager**

Node.js `fs` APIs for: `readdir`, `stat`, `mkdir`, `rename`, `unlink`, `readFile`, `writeFile`.

**Step 2: Create IPC + preload**

`localFs.list(path)`, `localFs.mkdir(path)`, `localFs.delete(path)`, `localFs.rename(from, to)`.

**Step 3: Update FilePane**

Add `source: 'local' | 'remote'` prop. When `source === 'local'`, use `localFsApi` instead of `sftpApi`.

**Step 4: Update SftpTab**

Replace the placeholder local panel (line 31-34) with a real `<FilePane source="local" />`.

**Step 5: Add drag-and-drop between panes**

Drag from local → remote triggers upload. Drag from remote → local triggers download.

**Step 6: Commit**

```bash
git commit -m "feat: implement dual-pane SFTP with local filesystem browser"
```

---

### Task 21: Add audit logs

**Files:**
- Create: `supabase/migrations/20260220_audit_logs.sql`
- Create: `src/main/services/audit-logger.ts`
- Create: `src/renderer/src/features/audit/ActivityPage.tsx`
- Modify: `src/main/ipc/register.ts` (register audit handlers)
- Modify: `src/renderer/src/components/layout/Sidebar.tsx` (add activity nav)

**Step 1: Create migration**

```sql
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  user_id uuid references auth.users(id),
  action text not null,
  resource_type text,
  resource_id uuid,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

alter table audit_logs enable row level security;

create policy "workspace members can read audit logs" on audit_logs
  for select using (
    exists (select 1 from workspace_members wm where wm.workspace_id = audit_logs.workspace_id and wm.user_id = auth.uid())
  );

create index idx_audit_logs_workspace on audit_logs(workspace_id, created_at desc);
```

**Step 2: Create audit-logger service**

```typescript
export const auditLogger = {
  async log(supabase: SupabaseClient, entry: { workspaceId: string; action: string; resourceType?: string; resourceId?: string; metadata?: Record<string, unknown> }): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('audit_logs').insert({
      workspace_id: entry.workspaceId,
      user_id: user?.id,
      action: entry.action,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId,
      metadata: entry.metadata ?? {},
    });
  },
};
```

**Step 3: Instrument key operations**

Add `auditLogger.log()` calls in: host create/update/delete, key import/delete, member invite/remove/role-change, workspace create/delete.

**Step 4: Create ActivityPage**

Filterable table of audit events with user avatar, action description, timestamp.

**Step 5: Commit**

```bash
git commit -m "feat: add audit logging for security-relevant workspace events"
```

---

### Task 22: Add auto-reconnect and connection health monitoring

**Files:**
- Modify: `src/main/services/ssh-manager.ts` (add reconnect logic)
- Modify: `src/renderer/src/components/layout/StatusBar.tsx` (connection health)
- Modify: `src/renderer/src/features/terminal/TerminalTab.tsx` (reconnect UI)
- Modify: `src/shared/types/settings.ts` (add autoReconnect setting)

**Step 1: Add reconnect logic to ssh-manager**

When a connection drops (not user-initiated), attempt reconnection with exponential backoff:

```typescript
async function attemptReconnect(sessionId: string, config: SshSessionConfig, sender: WebContents, attempt = 0): Promise<void> {
  const maxRetries = 5;
  if (attempt >= maxRetries) {
    sender.send('ssh:error', sessionId, 'Auto-reconnect failed after maximum retries');
    return;
  }
  const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
  sender.send('ssh:reconnecting', sessionId, { attempt: attempt + 1, maxRetries, delay });
  await new Promise(resolve => setTimeout(resolve, delay));
  try {
    await sshManager.connect(sessionId, config, sender);
  } catch {
    await attemptReconnect(sessionId, config, sender, attempt + 1);
  }
}
```

**Step 2: Add reconnecting status to terminal UI**

Handle `ssh:reconnecting` event in TerminalTab to show "Reconnecting (attempt 2/5)..." message.

**Step 3: Add connection latency to StatusBar**

Track keepalive round-trip time, display in status bar next to connection count.

**Step 4: Commit**

```bash
git commit -m "feat: add auto-reconnect with exponential backoff and connection health"
```

---

## Verification Checklist

### Phase 1 Done When:
- [ ] No hardcoded encryption key in codebase
- [ ] AI API keys stored locally only (not in Supabase)
- [ ] Zero `console.log` in production code
- [ ] Team invite dialog works end-to-end
- [ ] Create workspace dialog works end-to-end
- [ ] `delete_user_account` RPC exists and cascades properly
- [ ] Error boundaries wrap terminal and SFTP
- [ ] SSH errors show user-friendly toasts

### Phase 2 Done When:
- [ ] Local shell opens and works on macOS
- [ ] Terminal search finds text in scrollback
- [ ] Split panes render and each pane has independent session
- [ ] Snippets can be created and inserted into terminal
- [ ] Broadcast sends input to multiple selected sessions
- [ ] Recording produces valid `.cast` file

### Phase 3 Done When:
- [ ] Local port forward tunnels traffic through SSH
- [ ] Jump host chains connect successfully
- [ ] Dual-pane SFTP shows both local and remote files
- [ ] Audit logs capture host/key/member operations
- [ ] Auto-reconnect fires on unexpected disconnect
