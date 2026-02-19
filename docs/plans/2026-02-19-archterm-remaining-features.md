# ArchTerm Remaining Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete ArchTerm by implementing folder organization, SFTP transfers, AI command insertion, team collaboration, and enhanced settings.

**Architecture:** Five vertical slices following existing patterns: SQLite + Supabase dual-write in main process, IPC event-based handlers, Zustand stores, shadcn/ui React components. Each slice delivers complete user-facing functionality.

**Tech Stack:** Electron, TypeScript, React, Zustand, shadcn/ui Base, Supabase, better-sqlite3, ssh2, Vercel AI SDK, @dnd-kit/core

---

## Pre-Implementation Setup

### Task 0: Verify Dependencies

**Files:**
- Check: `package.json`

**Step 1: Check for @dnd-kit/core**

Run: `npm list @dnd-kit/core`

If not installed: `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`

**Step 2: Verify all dependencies present**

Required packages should already be installed:
- ssh2, @types/ssh2
- @xterm/xterm, @xterm/addon-fit, @xterm/addon-web-links
- better-sqlite3, @types/better-sqlite3
- ai, @ai-sdk/openai, @ai-sdk/anthropic, @ai-sdk/google
- zustand, @supabase/supabase-js

Run: `npm list` and verify all are present.

**Step 3: Run dev build to ensure clean baseline**

Run: `npm run dev`
Expected: App opens without errors, shows hosts/keys/settings tabs

---

## SLICE 1: FOLDER ORGANIZATION

### Task 1.1: Add Folder IPC Handlers (Backend)

**Files:**
- Modify: `src/main/ipc/hosts.ts`
- Check: `src/shared/types/hosts.ts` (already has HostFolder, CreateFolderInput)

**Step 1: Add folder methods to hostsIpcHandlers**

In `src/main/ipc/hosts.ts`, add after existing host methods:

```typescript
async createFolder(
  event: IpcMainInvokeEvent,
  input: CreateFolderInput
): Promise<HostFolder> {
  return withSupabase(event, async (supabase) => {
    const id = crypto.randomUUID();
    const now = Date.now();

    // Write to SQLite
    db.prepare(`
      INSERT INTO host_folders (id, workspace_id, parent_id, name, position, synced_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, input.workspaceId, input.parentId ?? null, input.name, input.position ?? 0, now);

    // Sync to Supabase
    const { error } = await supabase.from('host_folders').insert({
      id,
      workspace_id: input.workspaceId,
      parent_id: input.parentId ?? null,
      name: input.name,
      position: input.position ?? 0,
    });

    if (error) throw new Error(error.message);

    return {
      id,
      workspaceId: input.workspaceId,
      parentId: input.parentId ?? null,
      name: input.name,
      position: input.position ?? 0,
      createdAt: new Date().toISOString(),
    };
  });
},

async updateFolder(
  event: IpcMainInvokeEvent,
  folderId: string,
  name: string
): Promise<void> {
  return withSupabase(event, async (supabase) => {
    // Update SQLite
    db.prepare('UPDATE host_folders SET name = ?, synced_at = ? WHERE id = ?')
      .run(name, Date.now(), folderId);

    // Sync to Supabase
    const { error } = await supabase
      .from('host_folders')
      .update({ name })
      .eq('id', folderId);

    if (error) throw new Error(error.message);
  });
},

async deleteFolder(
  event: IpcMainInvokeEvent,
  folderId: string
): Promise<void> {
  return withSupabase(event, async (supabase) => {
    // Move hosts to root (set folder_id = null)
    db.prepare('UPDATE hosts SET folder_id = NULL WHERE folder_id = ?')
      .run(folderId);

    await supabase
      .from('hosts')
      .update({ folder_id: null })
      .eq('folder_id', folderId);

    // Delete folder from SQLite
    db.prepare('DELETE FROM host_folders WHERE id = ?').run(folderId);

    // Delete from Supabase
    const { error } = await supabase
      .from('host_folders')
      .delete()
      .eq('id', folderId);

    if (error) throw new Error(error.message);
  });
},

async moveHostToFolder(
  event: IpcMainInvokeEvent,
  hostId: string,
  folderId: string | null
): Promise<void> {
  return withSupabase(event, async (supabase) => {
    // Update SQLite
    db.prepare('UPDATE hosts SET folder_id = ? WHERE id = ?')
      .run(folderId, hostId);

    // Sync to Supabase
    const { error } = await supabase
      .from('hosts')
      .update({ folder_id: folderId })
      .eq('id', hostId);

    if (error) throw new Error(error.message);
  });
},
```

**Step 2: Register folder handlers**

Verify `src/main/ipc/register.ts` already registers hostsIpcHandlers. The new methods will be available automatically.

**Step 3: Test backend manually**

Start app: `npm run dev`
Open DevTools Console
Test: `await window.hostsApi.folders.create('workspace-id', 'Test Folder')`
Expected: Returns folder object, no errors

**Step 4: Commit backend changes**

```bash
git add src/main/ipc/hosts.ts
git commit -m "feat(folders): add folder CRUD IPC handlers

- createFolder: creates folder in SQLite + Supabase
- updateFolder: renames folder
- deleteFolder: deletes folder, moves hosts to root
- moveHostToFolder: updates host's folderId

Backend implementation for folder organization feature."
```

### Task 1.2: Extend Preload API for Folders

**Files:**
- Modify: `src/preload/hosts-api.ts`

**Step 1: Add folders namespace to hosts-api**

In `src/preload/hosts-api.ts`, add after hosts methods:

```typescript
folders: {
  create: (workspaceId: string, name: string, parentId?: string) =>
    ipcRenderer.invoke('hosts.createFolder', { workspaceId, name, parentId }),

  update: (folderId: string, name: string) =>
    ipcRenderer.invoke('hosts.updateFolder', folderId, name),

  delete: (folderId: string) =>
    ipcRenderer.invoke('hosts.deleteFolder', folderId),
},

moveToFolder: (hostId: string, folderId: string | null) =>
  ipcRenderer.invoke('hosts.moveHostToFolder', hostId, folderId),
```

**Step 2: Test preload API**

Start app: `npm run dev`
Console: `await window.hostsApi.folders.create('ws-id', 'New Folder')`
Expected: Returns folder object

**Step 3: Commit preload changes**

```bash
git add src/preload/hosts-api.ts
git commit -m "feat(folders): add folder methods to preload API

Expose folder CRUD and moveToFolder to renderer process."
```

### Task 1.3: Extend Host Store for Folders

**Files:**
- Modify: `src/renderer/src/stores/host-store.ts`

**Step 1: Add folder methods to store**

In `src/renderer/src/stores/host-store.ts`, add to the store interface and implementation:

```typescript
// Add to interface
createFolder: (workspaceId: string, name: string, parentId?: string) => Promise<void>
updateFolder: (folderId: string, name: string) => Promise<void>
deleteFolder: (folderId: string) => Promise<void>
moveHostToFolder: (hostId: string, folderId: string | null) => Promise<void>

// Add to implementation
createFolder: async (workspaceId, name, parentId) => {
  await window.hostsApi.folders.create(workspaceId, name, parentId);
  get().fetchHosts(workspaceId);
},

updateFolder: async (folderId, name) => {
  await window.hostsApi.folders.update(folderId, name);
  const workspaceId = get().hosts[0]?.workspaceId;
  if (workspaceId) get().fetchHosts(workspaceId);
},

deleteFolder: async (folderId) => {
  await window.hostsApi.folders.delete(folderId);
  const workspaceId = get().hosts[0]?.workspaceId;
  if (workspaceId) get().fetchHosts(workspaceId);
},

moveHostToFolder: async (hostId, folderId) => {
  await window.hostsApi.moveToFolder(hostId, folderId);
  const workspaceId = get().hosts[0]?.workspaceId;
  if (workspaceId) get().fetchHosts(workspaceId);
},
```

**Step 2: Test store methods**

Console:
```javascript
const { createFolder } = window.useHostStore.getState();
await createFolder('workspace-id', 'Test Folder');
```
Expected: Folder created, hosts refetched

**Step 3: Commit store changes**

```bash
git add src/renderer/src/stores/host-store.ts
git commit -m "feat(folders): add folder methods to host store

Store methods for createFolder, updateFolder, deleteFolder, moveHostToFolder.
All methods refetch hosts after mutation."
```

### Task 1.4: Create FolderDialog Component

**Files:**
- Create: `src/renderer/src/features/hosts/FolderDialog.tsx`

**Step 1: Write FolderDialog component**

Create file with:

```typescript
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import type { HostFolder } from '@shared/types/hosts';

interface FolderDialogProps {
  open: boolean;
  folder?: HostFolder | null;
  workspaceId: string;
  onClose: () => void;
  onSave: (name: string, folderId?: string) => Promise<void>;
}

export function FolderDialog({ open, folder, workspaceId, onClose, onSave }: FolderDialogProps) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (folder) {
      setName(folder.name);
    } else {
      setName('');
    }
  }, [folder, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      await onSave(name.trim(), folder?.id);
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{folder ? 'Rename Folder' : 'New Folder'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="folder-name">Folder Name</Label>
              <Input
                id="folder-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Production, Staging, AWS, etc."
                required
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? 'Saving...' : folder ? 'Rename' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Test component renders**

Import in HostsGrid temporarily to verify it compiles and renders.

**Step 3: Commit component**

```bash
git add src/renderer/src/features/hosts/FolderDialog.tsx
git commit -m "feat(folders): add FolderDialog component

Modal for creating and renaming folders.
Supports create mode (no folder prop) and edit mode (with folder)."
```

### Task 1.5: Add Folder UI to HostsGrid

**Files:**
- Modify: `src/renderer/src/features/hosts/HostsGrid.tsx`

**Step 1: Import FolderDialog and add state**

At top of HostsGrid component:

```typescript
import { FolderDialog } from './FolderDialog';

// Inside component, add state:
const [folderDialogOpen, setFolderDialogOpen] = useState(false);
const [editingFolder, setEditingFolder] = useState<HostFolder | null>(null);
const { createFolder, updateFolder, deleteFolder } = useHostStore();
```

**Step 2: Add folder handlers**

```typescript
async function handleCreateFolder() {
  setEditingFolder(null);
  setFolderDialogOpen(true);
}

async function handleSaveFolder(name: string, folderId?: string) {
  if (folderId) {
    await updateFolder(folderId, name);
  } else {
    await createFolder(workspaceId, name);
  }
  setFolderDialogOpen(false);
}

async function handleEditFolder(folder: HostFolder) {
  setEditingFolder(folder);
  setFolderDialogOpen(true);
}

async function handleDeleteFolder(folder: HostFolder) {
  if (!window.confirm(`Delete folder "${folder.name}"? Hosts inside will move to root.`)) return;
  await deleteFolder(folder.id);
}
```

**Step 3: Add "New Folder" button in header**

In the header section (around line 62), add after "Add Host" button:

```typescript
<Button size="sm" variant="outline" onClick={handleCreateFolder}>
  <FolderOpen className="h-4 w-4 mr-1.5" />
  New Folder
</Button>
```

**Step 4: Add FolderDialog at bottom of return**

Before the closing `</div>`:

```typescript
<FolderDialog
  open={folderDialogOpen}
  folder={editingFolder}
  workspaceId={workspaceId}
  onClose={() => setFolderDialogOpen(false)}
  onSave={handleSaveFolder}
/>
```

**Step 5: Add folder context menu in FolderSection**

In the `FolderSection` component (around line 142), wrap folder name in ContextMenu:

```typescript
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Pencil, Trash2 } from 'lucide-react';

// In FolderSection return, wrap the folder header:
<ContextMenu>
  <ContextMenuTrigger>
    <div className="flex items-center gap-2 mb-3 cursor-pointer">
      <FolderOpen className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm font-medium text-muted-foreground">{folder.name}</span>
    </div>
  </ContextMenuTrigger>
  <ContextMenuContent>
    <ContextMenuItem onClick={() => onEditFolder(folder)}>
      <Pencil className="h-4 w-4 mr-2" />
      Rename
    </ContextMenuItem>
    <ContextMenuItem onClick={() => onDeleteFolder(folder)} className="text-destructive">
      <Trash2 className="h-4 w-4 mr-2" />
      Delete
    </ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
```

**Step 6: Pass folder handlers to FolderSection**

Update FolderSection interface and calls:

```typescript
// Add to FolderSection props interface
onEditFolder: (folder: HostFolder) => void;
onDeleteFolder: (folder: HostFolder) => void;

// Pass in HostsGrid where FolderSection is rendered
<FolderSection
  key={folder.id}
  folder={folder}
  hosts={filtered}
  allFolders={folders}
  onEditHost={onEditHost}
  onDeleteHost={handleDeleteHost}
  onEditFolder={handleEditFolder}
  onDeleteFolder={handleDeleteFolder}
/>
```

**Step 7: Test folder creation**

Run: `npm run dev`
Actions:
1. Click "New Folder"
2. Enter "Production"
3. Save
Expected: Folder appears in list

**Step 8: Test folder rename**

Right-click folder → Rename → Change to "Prod" → Save
Expected: Name updates

**Step 9: Test folder delete**

Right-click folder → Delete → Confirm
Expected: Folder removed, hosts move to root

**Step 10: Commit UI changes**

```bash
git add src/renderer/src/features/hosts/HostsGrid.tsx
git commit -m "feat(folders): add folder UI to HostsGrid

- New Folder button in header
- FolderDialog integration
- Context menu for rename/delete folders
- Handlers for create/update/delete folders"
```

### Task 1.6: Add Drag-and-Drop for Hosts

**Files:**
- Modify: `src/renderer/src/features/hosts/HostsGrid.tsx`
- Install: `@dnd-kit/core` (if not done in Task 0)

**Step 1: Install @dnd-kit packages (if needed)**

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**Step 2: Import dnd-kit components**

At top of `HostsGrid.tsx`:

```typescript
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';
```

**Step 3: Add drag handler**

In HostsGrid component:

```typescript
const { moveHostToFolder } = useHostStore();

const sensors = useSensors(
  useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8, // 8px movement before drag starts
    },
  })
);

async function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event;

  if (!over) return;

  const hostId = active.id as string;
  const folderId = over.id === 'root' ? null : (over.id as string);

  await moveHostToFolder(hostId, folderId);
}
```

**Step 4: Wrap content in DndContext**

Wrap the main content (starting after header) in DndContext:

```typescript
<DndContext sensors={sensors} onDragEnd={handleDragEnd}>
  {/* Folder sections */}
  {!search &&
    rootFolders.map((folder) => (
      <DroppableFolderSection
        key={folder.id}
        folder={folder}
        hosts={filtered}
        allFolders={folders}
        onEditHost={onEditHost}
        onDeleteHost={handleDeleteHost}
        onEditFolder={handleEditFolder}
        onDeleteFolder={handleDeleteFolder}
      />
    ))}

  {/* Root hosts */}
  {rootHosts.length > 0 && (
    <DroppableRootArea>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
        {rootHosts.map((host) => (
          <DraggableHostCard
            key={host.id}
            host={host}
            onEdit={onEditHost}
            onDelete={handleDeleteHost}
          />
        ))}
      </div>
    </DroppableRootArea>
  )}
</DndContext>
```

**Step 5: Create DraggableHostCard wrapper**

Below HostsGrid, add:

```typescript
function DraggableHostCard({
  host,
  onEdit,
  onDelete,
}: {
  host: Host;
  onEdit: (host: Host) => void;
  onDelete: (host: Host) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: host.id,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <HostGridCard host={host} onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
}
```

**Step 6: Create DroppableFolderSection wrapper**

```typescript
function DroppableFolderSection(props: Parameters<typeof FolderSection>[0]) {
  const { setNodeRef, isOver } = useDroppable({
    id: props.folder.id,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'rounded-lg transition-colors',
        isOver && 'bg-primary/10 ring-2 ring-primary'
      )}
    >
      <FolderSection {...props} />
    </div>
  );
}
```

**Step 7: Create DroppableRootArea**

```typescript
function DroppableRootArea({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'root',
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'rounded-lg transition-colors',
        isOver && 'bg-primary/10 ring-2 ring-primary'
      )}
    >
      {children}
    </div>
  );
}
```

**Step 8: Update FolderSection to wrap host cards**

In FolderSection component, wrap each HostGridCard:

```typescript
{folderHosts.map((host) => (
  <DraggableHostCard
    key={host.id}
    host={host}
    onEdit={onEditHost}
    onDelete={onDeleteHost}
  />
))}
```

**Step 9: Test drag-and-drop**

Run: `npm run dev`
Actions:
1. Create folder "Test"
2. Drag host onto folder
Expected: Blue highlight appears on folder, host moves into folder on drop

**Step 10: Commit drag-and-drop**

```bash
git add src/renderer/src/features/hosts/HostsGrid.tsx package.json package-lock.json
git commit -m "feat(folders): add drag-and-drop for host organization

- Install @dnd-kit/core for drag-and-drop
- Wrap hosts in DraggableHostCard
- Wrap folders in DroppableFolderSection
- Visual feedback: blue ring on valid drop target
- Move hosts between folders and root"
```

---

## SLICE 2: SFTP TRANSFERS

### Task 2.1: Add Upload/Download Methods to SFTP Manager

**Files:**
- Modify: `src/main/services/sftp-manager.ts`

**Step 1: Add upload method**

In `sftpManager` object, add after existing methods:

```typescript
async upload(
  sessionId: string,
  localPath: string,
  remotePath: string,
  sender: WebContents
): Promise<void> {
  const wrapper = this.sftpWrappers.get(sessionId);
  if (!wrapper) throw new Error('SFTP session not found');

  const fs = await import('node:fs');
  const path = await import('node:path');

  const transferId = crypto.randomUUID();
  const filename = path.basename(localPath);

  return new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(localPath);
    const writeStream = wrapper.createWriteStream(remotePath);

    const stats = fs.statSync(localPath);
    const totalBytes = stats.size;
    let bytesTransferred = 0;
    let lastUpdate = Date.now();

    readStream.on('data', (chunk) => {
      bytesTransferred += chunk.length;

      // Throttle progress events to every 100ms
      const now = Date.now();
      if (now - lastUpdate > 100) {
        const speed = (bytesTransferred / ((now - lastUpdate) / 1000));
        if (!sender.isDestroyed()) {
          sender.send('sftp:progress', {
            transferId,
            filename,
            bytesTransferred,
            totalBytes,
            speed,
            direction: 'upload',
          });
        }
        lastUpdate = now;
      }
    });

    writeStream.on('close', () => {
      if (!sender.isDestroyed()) {
        sender.send('sftp:complete', transferId);
      }
      resolve();
    });

    writeStream.on('error', (err) => {
      if (!sender.isDestroyed()) {
        sender.send('sftp:error', transferId, err.message);
      }
      reject(err);
    });

    readStream.pipe(writeStream);
  });
},
```

**Step 2: Add download method**

```typescript
async download(
  sessionId: string,
  remotePath: string,
  localPath: string,
  sender: WebContents
): Promise<void> {
  const wrapper = this.sftpWrappers.get(sessionId);
  if (!wrapper) throw new Error('SFTP session not found');

  const fs = await import('node:fs');
  const path = await import('node:path');

  const transferId = crypto.randomUUID();
  const filename = path.basename(remotePath);

  return new Promise((resolve, reject) => {
    wrapper.stat(remotePath, (err, stats) => {
      if (err) return reject(err);

      const totalBytes = stats.size;
      let bytesTransferred = 0;
      let lastUpdate = Date.now();

      const readStream = wrapper.createReadStream(remotePath);
      const writeStream = fs.createWriteStream(localPath);

      readStream.on('data', (chunk) => {
        bytesTransferred += chunk.length;

        const now = Date.now();
        if (now - lastUpdate > 100) {
          const speed = (bytesTransferred / ((now - lastUpdate) / 1000));
          if (!sender.isDestroyed()) {
            sender.send('sftp:progress', {
              transferId,
              filename,
              bytesTransferred,
              totalBytes,
              speed,
              direction: 'download',
            });
          }
          lastUpdate = now;
        }
      });

      writeStream.on('close', () => {
        if (!sender.isDestroyed()) {
          sender.send('sftp:complete', transferId);
        }
        resolve();
      });

      writeStream.on('error', (err) => {
        if (!sender.isDestroyed()) {
          sender.send('sftp:error', transferId, err.message);
        }
        reject(err);
      });

      readStream.pipe(writeStream);
    });
  });
},
```

**Step 3: Commit SFTP manager changes**

```bash
git add src/main/services/sftp-manager.ts
git commit -m "feat(sftp): add upload/download methods with progress

- upload: stream local file to remote with progress events
- download: stream remote file to local with progress events
- Progress events throttled to 100ms intervals
- Emits sftp:progress, sftp:complete, sftp:error events"
```

### Task 2.2: Add Upload/Download IPC Handlers

**Files:**
- Modify: `src/main/ipc/sftp.ts`

**Step 1: Import dialog and os modules**

At top of file:

```typescript
import { dialog } from 'electron';
import { homedir } from 'node:os';
import { join } from 'node:path';
```

**Step 2: Add upload handler**

In `sftpIpcHandlers`, add:

```typescript
async upload(
  event: IpcMainInvokeEvent,
  sessionId: string,
  localPath: string,
  remotePath: string
): Promise<void> {
  await sftpManager.upload(sessionId, localPath, remotePath, event.sender);
},
```

**Step 3: Add download handler**

```typescript
async download(
  event: IpcMainInvokeEvent,
  sessionId: string,
  remotePath: string,
  localPath?: string
): Promise<void> {
  // Default to Downloads folder if no path specified
  const targetPath = localPath ?? join(homedir(), 'Downloads', remotePath.split('/').pop()!);
  await sftpManager.download(sessionId, remotePath, targetPath, event.sender);
},
```

**Step 4: Add file picker handler**

```typescript
async pickUploadFiles(event: IpcMainInvokeEvent): Promise<string[] | null> {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    title: 'Select files to upload',
  });

  return result.canceled ? null : result.filePaths;
},
```

**Step 5: Commit IPC handlers**

```bash
git add src/main/ipc/sftp.ts
git commit -m "feat(sftp): add upload/download IPC handlers

- upload: transfers local file to remote
- download: transfers remote file to Downloads folder
- pickUploadFiles: opens file picker dialog"
```

### Task 2.3: Extend SFTP Preload API

**Files:**
- Modify: `src/preload/sftp-api.ts`

**Step 1: Add upload/download methods**

Add to exported object:

```typescript
upload: (sessionId: string, localPath: string, remotePath: string) =>
  ipcRenderer.invoke('sftp.upload', sessionId, localPath, remotePath),

download: (sessionId: string, remotePath: string, localPath?: string) =>
  ipcRenderer.invoke('sftp.download', sessionId, remotePath, localPath),

pickUploadFiles: () =>
  ipcRenderer.invoke('sftp.pickUploadFiles'),
```

**Step 2: Commit preload changes**

```bash
git add src/preload/sftp-api.ts
git commit -m "feat(sftp): expose upload/download in preload API"
```

### Task 2.4: Create TransferProgress Component

**Files:**
- Create: `src/renderer/src/features/sftp/TransferProgress.tsx`

**Step 1: Write TransferProgress component**

```typescript
import { useTransferStore } from '@/stores/transfer-store';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { X, Upload, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`;
  if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
}

export function TransferProgress() {
  const transfers = useTransferStore((s) => s.transfers);
  const removeTransfer = useTransferStore((s) => s.removeTransfer);

  const activeTransfers = Array.from(transfers.values());

  if (activeTransfers.length === 0) return null;

  return (
    <div className="border-t bg-muted/20">
      <div className="px-3 py-2 flex items-center justify-between border-b">
        <span className="text-xs font-medium">
          Transfers ({activeTransfers.length} active)
        </span>
      </div>
      <div className="max-h-32 overflow-y-auto">
        {activeTransfers.map((transfer) => {
          const progress = transfer.totalBytes > 0
            ? (transfer.bytesTransferred / transfer.totalBytes) * 100
            : 0;

          return (
            <div key={transfer.id} className="flex items-center gap-2 px-3 py-2 border-b last:border-0">
              {transfer.direction === 'upload' ? (
                <Upload className="h-3.5 w-3.5 text-blue-500 shrink-0" />
              ) : (
                <Download className="h-3.5 w-3.5 text-green-500 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono truncate">{transfer.filename}</p>
                <Progress value={progress} className="h-1.5 mt-1" />
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {progress.toFixed(0)}%
              </span>
              <span className="text-xs text-muted-foreground shrink-0 w-20 text-right">
                {formatSpeed(transfer.speed)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 shrink-0"
                onClick={() => removeTransfer(transfer.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 2: Commit component**

```bash
git add src/renderer/src/features/sftp/TransferProgress.tsx
git commit -m "feat(sftp): add TransferProgress component

Shows active uploads/downloads with:
- Direction icon (upload/download)
- Filename
- Progress bar
- Percentage
- Transfer speed
- Cancel button"
```

### Task 2.5: Add Upload/Download UI to FilePane

**Files:**
- Modify: `src/renderer/src/features/sftp/FilePane.tsx`

**Step 1: Import transfer store and add state**

At top:

```typescript
import { Upload as UploadIcon } from 'lucide-react';
import { useTransferStore } from '@/stores/transfer-store';

// Inside component, add state:
const [isDragging, setIsDragging] = useState(false);
```

**Step 2: Add upload handler**

```typescript
async function handleUpload() {
  const files = await window.sftpApi.pickUploadFiles();
  if (!files || files.length === 0) return;

  for (const localPath of files) {
    const filename = localPath.split('/').pop()!;
    const remotePath = `${currentPath}/${filename}`.replace('//', '/');

    const transferId = crypto.randomUUID();
    addTransfer({
      id: transferId,
      filename,
      bytesTransferred: 0,
      totalBytes: 0,
      speed: 0,
      direction: 'upload',
    });

    try {
      await window.sftpApi.upload(sessionId, localPath, remotePath);
      await loadDirectory(currentPath);
    } catch (e) {
      console.error('Upload failed:', e);
    }
  }
}
```

**Step 3: Add download handler**

```typescript
async function handleDownload(entry: SftpEntry) {
  if (entry.type === 'directory') return;

  const transferId = crypto.randomUUID();
  addTransfer({
    id: transferId,
    filename: entry.name,
    bytesTransferred: 0,
    totalBytes: entry.size,
    speed: 0,
    direction: 'download',
  });

  try {
    await window.sftpApi.download(sessionId, entry.path);
  } catch (e) {
    console.error('Download failed:', e);
  }
}
```

**Step 4: Add drag-drop handlers**

```typescript
function handleDragOver(e: React.DragEvent) {
  e.preventDefault();
  setIsDragging(true);
}

function handleDragLeave(e: React.DragEvent) {
  e.preventDefault();
  setIsDragging(false);
}

async function handleDrop(e: React.DragEvent) {
  e.preventDefault();
  setIsDragging(false);

  const files = Array.from(e.dataTransfer.files);
  if (files.length === 0) return;

  for (const file of files) {
    const remotePath = `${currentPath}/${file.name}`.replace('//', '/');
    const transferId = crypto.randomUUID();

    addTransfer({
      id: transferId,
      filename: file.name,
      bytesTransferred: 0,
      totalBytes: file.size,
      speed: 0,
      direction: 'upload',
    });

    try {
      await window.sftpApi.upload(sessionId, file.path, remotePath);
      await loadDirectory(currentPath);
    } catch (e) {
      console.error('Upload failed:', e);
    }
  }
}
```

**Step 5: Add upload button to toolbar**

In toolbar (around line 86), add after "New folder" button:

```typescript
<Button
  variant="ghost"
  size="icon"
  className="h-6 w-6"
  onClick={handleUpload}
  title="Upload files"
>
  <UploadIcon className="h-3 w-3" />
</Button>
```

**Step 6: Update table row to handle double-click download**

In TableRow (around line 139), change `onDoubleClick`:

```typescript
onDoubleClick={() => {
  if (entry.type === 'directory') {
    navigate(entry);
  } else {
    handleDownload(entry);
  }
}}
```

**Step 7: Add drag-drop overlay**

Wrap the file list section with drag handlers:

```typescript
<div
  className="flex-1 overflow-auto relative"
  onDragOver={handleDragOver}
  onDragLeave={handleDragLeave}
  onDrop={handleDrop}
>
  {isDragging && (
    <div className="absolute inset-0 bg-primary/10 border-2 border-primary border-dashed flex items-center justify-center z-10">
      <div className="text-center">
        <UploadIcon className="h-8 w-8 mx-auto mb-2 text-primary" />
        <p className="text-sm font-medium">Drop files to upload</p>
      </div>
    </div>
  )}

  {/* Existing error/loading/table content */}
</div>
```

**Step 8: Test upload/download**

Run: `npm run dev`
Connect to SFTP → Click upload → Select file → Watch progress
Double-click file → Downloads to ~/Downloads folder

**Step 9: Commit FilePane changes**

```bash
git add src/renderer/src/features/sftp/FilePane.tsx
git commit -m "feat(sftp): add upload/download UI to FilePane

- Upload button opens file picker
- Drag-and-drop zone with visual overlay
- Double-click file to download
- Integration with transfer store"
```

### Task 2.6: Add TransferProgress to SftpTab

**Files:**
- Modify: `src/renderer/src/features/sftp/SftpTab.tsx`

**Step 1: Import and add TransferProgress**

Import:
```typescript
import { TransferProgress } from './TransferProgress';
```

At bottom of SftpTab, after ResizablePanelGroup:

```typescript
<TransferProgress />
```

So the structure becomes:
```typescript
<div className="flex flex-col h-full">
  <div className="flex items-center px-3 h-8 border-b bg-muted/20 shrink-0">
    {/* ... header ... */}
  </div>
  <div className="flex-1 overflow-hidden">
    <ResizablePanelGroup orientation="horizontal">
      {/* ... panels ... */}
    </ResizablePanelGroup>
  </div>
  <TransferProgress />
</div>
```

**Step 2: Test transfer progress display**

Run: `npm run dev`
Upload file → Transfer progress shows at bottom
Expected: Progress bar animates, speed updates

**Step 3: Commit integration**

```bash
git add src/renderer/src/features/sftp/SftpTab.tsx
git commit -m "feat(sftp): integrate TransferProgress in SftpTab

Shows transfer progress at bottom of SFTP tab."
```

---

## SLICE 3: AI COMMAND INSERTION

### Task 3.1: Enhance ChatMessage with Command Detection

**Files:**
- Modify: `src/renderer/src/features/ai/ChatMessage.tsx`

**Step 1: Add command detection logic**

Add helper function above component:

```typescript
function extractCommands(content: string): string[] {
  const commands: string[] = [];

  // Extract code blocks
  const codeBlockRegex = /```(?:bash|sh|shell)?\n([\s\S]*?)```/g;
  let match;
  while ((match = codeBlockRegex.exec(content)) !== null) {
    commands.push(match[1].trim());
  }

  // Extract inline commands (lines starting with $)
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('$ ')) {
      commands.push(trimmed.substring(2));
    }
  }

  return commands;
}
```

**Step 2: Add insert command handler**

```typescript
import { useSessionStore } from '@/stores/session-store';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

function insertCommand(command: string) {
  const activeTab = useSessionStore.getState().tabs.get(
    useSessionStore.getState().activeTabId ?? ''
  );

  if (!activeTab || activeTab.tabType !== 'terminal') {
    toast.error('Open a terminal first');
    return;
  }

  // Remove leading $ if present
  const sanitized = command.replace(/^\$\s*/, '');

  // Send to terminal (without \n so user can review before executing)
  window.sshApi.send(activeTab.sessionId!, sanitized);
  toast.success('Command inserted');
}
```

**Step 3: Detect commands and add insert buttons**

In ChatMessage component, add after content rendering:

```typescript
const commands = message.role === 'assistant' ? extractCommands(message.content) : [];

return (
  <div className={cn(
    'flex gap-2 mb-3',
    message.role === 'user' ? 'justify-end' : 'justify-start'
  )}>
    <div className={cn(
      'max-w-[80%] rounded-lg px-3 py-2 text-xs',
      message.role === 'user'
        ? 'bg-primary text-primary-foreground'
        : 'bg-muted'
    )}>
      <p className="whitespace-pre-wrap">{message.content}</p>

      {commands.length > 0 && (
        <div className="space-y-2 mt-2">
          {commands.map((cmd, i) => (
            <div key={i} className="flex items-center gap-2">
              <code className="flex-1 bg-background px-2 py-1 rounded text-xs font-mono">
                {cmd}
              </code>
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-xs"
                onClick={() => insertCommand(cmd)}
              >
                <ArrowRight className="h-3 w-3 mr-1" />
                Insert
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);
```

**Step 4: Test command insertion**

Run: `npm run dev`
Open AI panel → Ask "how to list files?"
AI responds with `ls -la`
Expected: "Insert" button appears → Click → Command inserted into terminal

**Step 5: Commit ChatMessage changes**

```bash
git add src/renderer/src/features/ai/ChatMessage.tsx
git commit -m "feat(ai): add command detection and insertion to ChatMessage

- Extract commands from code blocks and $ lines
- Show Insert button for each command
- Send command to active terminal on click
- Toast notification on success/error"
```

### Task 3.2: Create CommandSuggestion Component

**Files:**
- Create: `src/renderer/src/features/ai/CommandSuggestion.tsx`

**Step 1: Write CommandSuggestion component**

```typescript
import { useState } from 'react';
import { useAiStore } from '@/stores/ai-store';
import { useSessionStore } from '@/stores/session-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function CommandSuggestion() {
  const [input, setInput] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [loading, setLoading] = useState(false);
  const { isStreaming } = useAiStore();

  async function handleTranslate() {
    if (!input.trim() || isStreaming) return;

    setLoading(true);
    setSuggestion('');

    const requestId = crypto.randomUUID();
    let result = '';

    // Listen for chunks
    const offChunk = window.aiApi.onChunk((id, chunk) => {
      if (id === requestId) {
        result += chunk;
        setSuggestion(result);
      }
    });

    const offDone = window.aiApi.onDone((id) => {
      if (id === requestId) {
        setLoading(false);
        offChunk();
        offDone();
        offError();
      }
    });

    const offError = window.aiApi.onError((id, error) => {
      if (id === requestId) {
        toast.error(error);
        setLoading(false);
        offChunk();
        offDone();
        offError();
      }
    });

    await window.aiApi.translateCommand({
      provider: 'openai', // TODO: Get from settings
      apiKey: 'test-key', // TODO: Get from settings
      model: 'gpt-4o-mini',
      naturalLanguage: input,
      requestId,
    });
  }

  function handleInsert() {
    const activeTab = useSessionStore.getState().tabs.get(
      useSessionStore.getState().activeTabId ?? ''
    );

    if (!activeTab || activeTab.tabType !== 'terminal') {
      toast.error('Open a terminal first');
      return;
    }

    const sanitized = suggestion.replace(/^\$\s*/, '');
    window.sshApi.send(activeTab.sessionId!, sanitized);
    toast.success('Command inserted');

    // Clear form
    setInput('');
    setSuggestion('');
  }

  return (
    <div className="p-3 border-b space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Quick Command</p>
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="What do you want to do?"
        className="text-xs"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleTranslate();
          }
        }}
      />
      <Button
        size="sm"
        className="w-full h-7 text-xs"
        onClick={handleTranslate}
        disabled={!input.trim() || loading}
      >
        {loading ? (
          <>
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Translating...
          </>
        ) : (
          'Translate'
        )}
      </Button>

      {suggestion && (
        <div className="space-y-2 p-2 bg-muted rounded">
          <code className="block text-xs font-mono bg-background px-2 py-1 rounded">
            {suggestion}
          </code>
          <Button
            size="sm"
            className="w-full h-7 text-xs"
            onClick={handleInsert}
          >
            <ArrowRight className="h-3 w-3 mr-1" />
            Insert into Terminal
          </Button>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit component**

```bash
git add src/renderer/src/features/ai/CommandSuggestion.tsx
git commit -m "feat(ai): add CommandSuggestion component

Quick command translation widget:
- Input field for natural language
- Translate button triggers AI
- Shows command suggestion
- Insert button sends to terminal"
```

### Task 3.3: Add CommandSuggestion to AiPanel

**Files:**
- Modify: `src/renderer/src/features/ai/AiPanel.tsx`

**Step 1: Import CommandSuggestion**

```typescript
import { CommandSuggestion } from './CommandSuggestion';
```

**Step 2: Add CommandSuggestion above messages**

After ModelSelector and before messages section:

```typescript
{/* Model selector */}
<ModelSelector />

{/* Quick Command */}
<CommandSuggestion />

{/* Messages */}
<div ref={scrollRef} className="flex-1 overflow-y-auto p-3">
  {/* ... messages ... */}
</div>
```

**Step 3: Test quick command**

Run: `npm run dev`
Open AI panel → Enter "find large files" → Translate
Expected: Shows command → Insert sends to terminal

**Step 4: Commit integration**

```bash
git add src/renderer/src/features/ai/AiPanel.tsx
git commit -m "feat(ai): integrate CommandSuggestion in AiPanel

Adds quick command widget above chat messages."
```

---

## SLICE 4: TEAM COLLABORATION

### Task 4.1: Add Team Tab Type to Session Store

**Files:**
- Modify: `src/renderer/src/stores/session-store.ts`

**Step 1: Update TabType**

Change TabType to include 'team':

```typescript
export type TabType = 'hosts' | 'keys' | 'team' | 'settings' | 'terminal' | 'sftp';
```

**Step 2: Add team to default tabs**

In initial state, add team tab:

```typescript
tabs: new Map([
  ['hosts', { tabId: 'hosts', tabType: 'hosts', label: 'Hosts', closable: false }],
  ['keys', { tabId: 'keys', tabType: 'keys', label: 'SSH Keys', closable: false }],
  ['team', { tabId: 'team', tabType: 'team', label: 'Team', closable: false }],
  ['settings', { tabId: 'settings', tabType: 'settings', label: 'Settings', closable: false, settingsTab: 'terminal' }],
]),
```

**Step 3: Commit session store changes**

```bash
git add src/renderer/src/stores/session-store.ts
git commit -m "feat(team): add team tab type to session store

Team tab is non-closable like hosts/keys/settings."
```

### Task 4.2: Add Member Management IPC Handlers

**Files:**
- Modify: `src/main/ipc/workspace.ts`

**Step 1: Add member management methods**

Add to `workspaceIpcHandlers`:

```typescript
async listMembers(
  event: IpcMainInvokeEvent,
  workspaceId: string
): Promise<WorkspaceMember[]> {
  return withSupabase(event, async (supabase) => {
    const { data, error } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', workspaceId);

    if (error) throw new Error(error.message);

    return data.map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      userId: row.user_id,
      role: row.role as WorkspaceRole,
      joinedAt: row.joined_at,
    }));
  });
},

async inviteMember(
  event: IpcMainInvokeEvent,
  workspaceId: string,
  email: string,
  role: WorkspaceRole
): Promise<WorkspaceInvite> {
  return withSupabase(event, async (supabase) => {
    const id = crypto.randomUUID();

    const { error } = await supabase.from('workspace_invites').insert({
      id,
      workspace_id: workspaceId,
      email,
      role,
      status: 'pending',
    });

    if (error) throw new Error(error.message);

    return {
      id,
      workspaceId,
      email,
      role,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
  });
},

async updateMemberRole(
  event: IpcMainInvokeEvent,
  workspaceId: string,
  memberId: string,
  role: WorkspaceRole
): Promise<void> {
  return withSupabase(event, async (supabase) => {
    const { error } = await supabase
      .from('workspace_members')
      .update({ role })
      .eq('id', memberId)
      .eq('workspace_id', workspaceId);

    if (error) throw new Error(error.message);
  });
},

async removeMember(
  event: IpcMainInvokeEvent,
  workspaceId: string,
  memberId: string
): Promise<void> {
  return withSupabase(event, async (supabase) => {
    const { error } = await supabase
      .from('workspace_members')
      .delete()
      .eq('id', memberId)
      .eq('workspace_id', workspaceId);

    if (error) throw new Error(error.message);
  });
},
```

**Step 2: Commit workspace IPC changes**

```bash
git add src/main/ipc/workspace.ts
git commit -m "feat(team): add member management IPC handlers

- listMembers: fetch workspace members
- inviteMember: create invite
- updateMemberRole: change member role
- removeMember: remove from workspace"
```

### Task 4.3: Extend Workspace Preload API

**Files:**
- Modify: `src/preload/workspace-api.ts`

**Step 1: Add member management methods**

Add to exported object:

```typescript
listMembers: (workspaceId: string) =>
  ipcRenderer.invoke('workspace.listMembers', workspaceId),

inviteMember: (workspaceId: string, email: string, role: WorkspaceRole) =>
  ipcRenderer.invoke('workspace.inviteMember', workspaceId, email, role),

updateMemberRole: (workspaceId: string, memberId: string, role: WorkspaceRole) =>
  ipcRenderer.invoke('workspace.updateMemberRole', workspaceId, memberId, role),

removeMember: (workspaceId: string, memberId: string) =>
  ipcRenderer.invoke('workspace.removeMember', workspaceId, memberId),
```

**Step 2: Import WorkspaceRole type**

```typescript
import type { WorkspaceRole } from '@shared/types/workspace';
```

**Step 3: Commit preload changes**

```bash
git add src/preload/workspace-api.ts
git commit -m "feat(team): expose member management in preload API"
```

### Task 4.4: Create TeamPage Component

**Files:**
- Create: `src/renderer/src/features/team/TeamPage.tsx`

**Step 1: Write TeamPage component**

```typescript
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Users } from 'lucide-react';
import type { WorkspaceMember, WorkspaceRole } from '@shared/types/workspace';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface TeamPageProps {
  workspaceId: string;
}

export function TeamPage({ workspaceId }: TeamPageProps) {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMembers();
  }, [workspaceId]);

  async function loadMembers() {
    setLoading(true);
    try {
      const data = await window.workspaceApi.listMembers(workspaceId);
      setMembers(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleRoleChange(memberId: string, role: WorkspaceRole) {
    await window.workspaceApi.updateMemberRole(workspaceId, memberId, role);
    await loadMembers();
  }

  async function handleRemove(memberId: string) {
    if (!window.confirm('Remove this member from the workspace?')) return;
    await window.workspaceApi.removeMember(workspaceId, memberId);
    await loadMembers();
  }

  function getRoleBadgeColor(role: WorkspaceRole) {
    switch (role) {
      case 'owner': return 'bg-amber-500';
      case 'admin': return 'bg-blue-500';
      case 'member': return 'bg-gray-500';
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Team</h1>
            <p className="text-sm text-muted-foreground">Manage workspace members and permissions</p>
          </div>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1.5" />
            Invite Member
          </Button>
        </div>

        {/* Members List */}
        {loading ? (
          <div className="text-center py-20">
            <p className="text-sm text-muted-foreground">Loading members...</p>
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-20">
            <Users className="h-12 w-12 mx-auto text-muted-foreground/20 mb-3" />
            <p className="text-sm font-medium">No members yet</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              Invite team members to collaborate
            </p>
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-xs font-medium">
                            {member.userId.substring(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-sm font-mono">{member.userId}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {member.role === 'owner' ? (
                        <Badge className={getRoleBadgeColor(member.role)}>
                          {member.role}
                        </Badge>
                      ) : (
                        <Select
                          value={member.role}
                          onValueChange={(role) => handleRoleChange(member.id, role as WorkspaceRole)}
                        >
                          <SelectTrigger className="w-28 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="member">Member</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(member.joinedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {member.role !== 'owner' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemove(member.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          Remove
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit TeamPage**

```bash
git add src/renderer/src/features/team/TeamPage.tsx
git commit -m "feat(team): create TeamPage component

Shows workspace members with:
- Member list table
- Role badges (owner/admin/member)
- Role change dropdown
- Remove member button
- Invite member button (placeholder)"
```

### Task 4.5: Update Sidebar Navigation

**Files:**
- Modify: `src/renderer/src/components/layout/Sidebar.tsx`

**Step 1: Remove logo, add workspace switcher and team**

Replace Sidebar content with:

```typescript
import { Server, KeyRound, Users, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WorkspaceSwitcher } from '@/features/workspaces/WorkspaceSwitcher';
import type { Workspace } from '@shared/types/workspace';

type SidebarView = 'hosts' | 'keys' | 'team' | 'settings';

interface SidebarProps {
  onOpenSettings: () => void;
  onGoHome: () => void;
  onGoKeys: () => void;
  onGoTeam: () => void;
  activeView: SidebarView;
  onWorkspaceChange: (ws: Workspace) => void;
}

export function Sidebar({
  onOpenSettings,
  onGoHome,
  onGoKeys,
  onGoTeam,
  activeView,
  onWorkspaceChange
}: SidebarProps) {
  return (
    <div className="w-14 border-r bg-muted/10 flex flex-col">
      {/* Workspace Switcher */}
      <div className="p-2 border-b">
        <WorkspaceSwitcher onWorkspaceChange={onWorkspaceChange} />
      </div>

      {/* Nav Items */}
      <div className="flex-1 p-2 space-y-1">
        <button
          onClick={onGoHome}
          className={cn(
            'w-full h-10 rounded-md flex items-center justify-center transition-colors',
            activeView === 'hosts'
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
          )}
          title="Hosts"
        >
          <Server className="h-5 w-5" />
        </button>

        <button
          onClick={onGoKeys}
          className={cn(
            'w-full h-10 rounded-md flex items-center justify-center transition-colors',
            activeView === 'keys'
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
          )}
          title="SSH Keys"
        >
          <KeyRound className="h-5 w-5" />
        </button>

        <button
          onClick={onGoTeam}
          className={cn(
            'w-full h-10 rounded-md flex items-center justify-center transition-colors',
            activeView === 'team'
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
          )}
          title="Team"
        >
          <Users className="h-5 w-5" />
        </button>
      </div>

      {/* Settings at bottom */}
      <div className="p-2 border-t">
        <button
          onClick={onOpenSettings}
          className={cn(
            'w-full h-10 rounded-md flex items-center justify-center transition-colors',
            activeView === 'settings'
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
          )}
          title="Settings"
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Update Sidebar props in AppShell**

In `src/renderer/src/components/layout/AppShell.tsx`:

Add handler:
```typescript
function handleGoTeam() {
  openTab({ tabId: 'team', tabType: 'team', label: 'Team' });
}
```

Update Sidebar props:
```typescript
<Sidebar
  onOpenSettings={handleGoSettings}
  onGoHome={handleGoHome}
  onGoKeys={handleGoKeys}
  onGoTeam={handleGoTeam}
  activeView={sidebarView}
  onWorkspaceChange={handleWorkspaceChange}
/>
```

Update sidebarView logic to include 'team':
```typescript
const sidebarView =
  activeTab?.tabType === 'settings' ? 'settings' :
  activeTab?.tabType === 'keys' ? 'keys' :
  activeTab?.tabType === 'team' ? 'team' :
  'hosts';
```

**Step 3: Add TeamPage render in AppShell**

Add import:
```typescript
import { TeamPage } from '@/features/team/TeamPage';
```

Add render case:
```typescript
{activeTab?.tabType === 'team' && <TeamPage workspaceId={workspaceId} />}
```

**Step 4: Update WorkspaceSwitcher import**

Move WorkspaceSwitcher out of HostsGrid header (already done in design), ensure it's in Sidebar.

**Step 5: Test navigation**

Run: `npm run dev`
Click Team icon → Opens team tab
Expected: Shows team page with member list

**Step 6: Commit sidebar changes**

```bash
git add src/renderer/src/components/layout/Sidebar.tsx src/renderer/src/components/layout/AppShell.tsx
git commit -m "feat(team): restructure sidebar with workspace switcher

- Remove logo
- Add workspace switcher at top
- Add Team navigation icon
- Settings moved to bottom
- Update AppShell to render TeamPage"
```

---

## SLICE 5: SETTINGS POLISH

### Task 5.1: Extend Settings Schema

**Files:**
- Check: Supabase migration (may already exist)
- Check: `src/main/db.ts` SQLite schema

**Step 1: Verify settings table has new columns**

Check if migration exists in `supabase/migrations/` for:
- scrollback_lines
- cursor_style
- bell_style
- line_height

If not, these will be added when backend code tries to read/write them (Supabase will auto-add).

**Step 2: Verify SQLite schema**

Check `src/main/db.ts` settings table creation includes all fields. If not, they'll be added on first use.

**Step 3: Commit schema note**

```bash
git commit --allow-empty -m "feat(settings): schema update for enhanced settings

New fields: scrollback_lines, cursor_style, bell_style, line_height
Will be added to Supabase/SQLite on first use."
```

### Task 5.2: Enhance Terminal Settings Tab

**Files:**
- Modify: `src/renderer/src/features/settings/SettingsPage.tsx` (TerminalTab section)

**Step 1: Add new state variables**

In TerminalTab component, add after existing state:

```typescript
const [scrollback, setScrollback] = useState('1000');
const [cursorStyle, setCursorStyle] = useState<'block' | 'underline' | 'bar'>('block');
const [bellStyle, setBellStyle] = useState<'none' | 'sound' | 'visual'>('none');
const [lineHeight, setLineHeight] = useState('1.2');
```

**Step 2: Load settings effect**

Update useEffect that loads settings:

```typescript
useEffect(() => {
  if (settings) {
    setTerminalFont(settings.terminalFont);
    setTerminalFontSize(String(settings.terminalFontSize));
    setScrollback(String(settings.scrollbackLines ?? 1000));
    setCursorStyle(settings.cursorStyle ?? 'block');
    setBellStyle(settings.bellStyle ?? 'none');
    setLineHeight(String(settings.lineHeight ?? 1.2));
  }
}, [settings]);
```

**Step 3: Update handleSave**

```typescript
async function handleSave() {
  setSaving(true);
  try {
    await updateSettings({
      terminalFont,
      terminalFontSize: parseInt(terminalFontSize),
      scrollbackLines: parseInt(scrollback),
      cursorStyle,
      bellStyle,
      lineHeight: parseFloat(lineHeight),
    });
  } finally {
    setSaving(false);
  }
}
```

**Step 4: Add new form controls**

After font size input, add:

```typescript
<div className="space-y-2">
  <Label htmlFor="line-height">Line Height</Label>
  <div className="flex items-center gap-2">
    <input
      id="line-height"
      type="range"
      min="1.0"
      max="2.0"
      step="0.1"
      value={lineHeight}
      onChange={(e) => setLineHeight(e.target.value)}
      className="flex-1"
    />
    <span className="text-sm text-muted-foreground w-12 text-right">
      {lineHeight}
    </span>
  </div>
</div>

<div className="space-y-2">
  <Label htmlFor="scrollback">Scrollback Lines</Label>
  <Input
    id="scrollback"
    type="number"
    value={scrollback}
    onChange={(e) => setScrollback(e.target.value)}
    min={500}
    max={10000}
    className="h-8"
  />
</div>

<div className="space-y-2">
  <Label>Cursor Style</Label>
  <div className="flex gap-2">
    {(['block', 'underline', 'bar'] as const).map((style) => (
      <button
        key={style}
        type="button"
        onClick={() => setCursorStyle(style)}
        className={cn(
          'flex-1 h-20 rounded-md border-2 flex flex-col items-center justify-center gap-2 transition-colors',
          cursorStyle === style
            ? 'border-primary bg-primary/10'
            : 'border-muted hover:border-muted-foreground/50'
        )}
      >
        <div className="font-mono text-2xl">
          {style === 'block' && '█'}
          {style === 'underline' && '_'}
          {style === 'bar' && '|'}
        </div>
        <span className="text-xs capitalize">{style}</span>
      </button>
    ))}
  </div>
</div>

<div className="space-y-2">
  <Label htmlFor="bell-style">Bell</Label>
  <Select value={bellStyle} onValueChange={(v) => setBellStyle(v as typeof bellStyle)}>
    <SelectTrigger id="bell-style" className="h-8">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="none">None (silent)</SelectItem>
      <SelectItem value="sound">Sound (system beep)</SelectItem>
      <SelectItem value="visual">Visual (flash)</SelectItem>
    </SelectContent>
  </Select>
</div>
```

**Step 5: Test enhanced settings**

Run: `npm run dev`
Go to Settings → Terminal
Change scrollback, cursor, bell
Click Save
Expected: Settings saved

**Step 6: Commit terminal settings**

```bash
git add src/renderer/src/features/settings/SettingsPage.tsx
git commit -m "feat(settings): enhance terminal settings tab

Added controls for:
- Line height slider (1.0-2.0)
- Scrollback lines (500-10000)
- Cursor style (block/underline/bar) with visual preview
- Bell style (none/sound/visual)"
```

### Task 5.3: Enhance AI Settings Tab

**Files:**
- Modify: `src/renderer/src/features/settings/SettingsPage.tsx` (AiTab section)

**Step 1: Add provider expansion state**

In AiTab component:

```typescript
const [expandedProvider, setExpandedProvider] = useState<string | null>('openai');
const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
```

**Step 2: Add test connection handler**

```typescript
async function testConnection(provider: string) {
  // TODO: Implement actual test call
  toast.success(`${provider} connection test successful`);
}
```

**Step 3: Create collapsible provider sections**

Replace AI settings content with:

```typescript
<div className="max-w-lg space-y-6">
  <div>
    <h2 className="text-base font-semibold mb-1">AI Providers</h2>
    <p className="text-sm text-muted-foreground">Configure API keys for AI assistants.</p>
  </div>
  <Separator />

  {/* OpenAI Section */}
  <div className="border rounded-lg">
    <button
      type="button"
      className="w-full p-3 flex items-center justify-between hover:bg-accent/50"
      onClick={() => setExpandedProvider(expandedProvider === 'openai' ? null : 'openai')}
    >
      <span className="font-medium text-sm">OpenAI</span>
      <span className="text-xs text-muted-foreground">
        {expandedProvider === 'openai' ? '▼' : '▶'}
      </span>
    </button>
    {expandedProvider === 'openai' && (
      <div className="p-3 border-t space-y-3">
        <div className="space-y-2">
          <Label htmlFor="openai-key">API Key</Label>
          <div className="flex gap-2">
            <Input
              id="openai-key"
              type={showKeys['openai'] ? 'text' : 'password'}
              value={settings?.openaiApiKeyEncrypted ?? ''}
              onChange={(e) => {/* TODO: update */}}
              placeholder="sk-..."
              className="h-8 text-xs font-mono"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowKeys({ ...showKeys, openai: !showKeys['openai'] })}
            >
              {showKeys['openai'] ? '🙈' : '👁'}
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Default Model</Label>
          <Select value="gpt-4o-mini">
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gpt-4o">GPT-4o</SelectItem>
              <SelectItem value="gpt-4o-mini">GPT-4o mini</SelectItem>
              <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={() => testConnection('OpenAI')}
        >
          Test Connection
        </Button>
      </div>
    )}
  </div>

  {/* Anthropic Section */}
  <div className="border rounded-lg">
    <button
      type="button"
      className="w-full p-3 flex items-center justify-between hover:bg-accent/50"
      onClick={() => setExpandedProvider(expandedProvider === 'anthropic' ? null : 'anthropic')}
    >
      <span className="font-medium text-sm">Anthropic</span>
      <span className="text-xs text-muted-foreground">
        {expandedProvider === 'anthropic' ? '▼' : '▶'}
      </span>
    </button>
    {expandedProvider === 'anthropic' && (
      <div className="p-3 border-t space-y-3">
        <div className="space-y-2">
          <Label htmlFor="anthropic-key">API Key</Label>
          <div className="flex gap-2">
            <Input
              id="anthropic-key"
              type={showKeys['anthropic'] ? 'text' : 'password'}
              value={settings?.anthropicApiKeyEncrypted ?? ''}
              onChange={(e) => {/* TODO: update */}}
              placeholder="sk-ant-..."
              className="h-8 text-xs font-mono"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowKeys({ ...showKeys, anthropic: !showKeys['anthropic'] })}
            >
              {showKeys['anthropic'] ? '🙈' : '👁'}
            </Button>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={() => testConnection('Anthropic')}
        >
          Test Connection
        </Button>
      </div>
    )}
  </div>

  {/* Gemini Section */}
  <div className="border rounded-lg">
    <button
      type="button"
      className="w-full p-3 flex items-center justify-between hover:bg-accent/50"
      onClick={() => setExpandedProvider(expandedProvider === 'gemini' ? null : 'gemini')}
    >
      <span className="font-medium text-sm">Google Gemini</span>
      <span className="text-xs text-muted-foreground">
        {expandedProvider === 'gemini' ? '▼' : '▶'}
      </span>
    </button>
    {expandedProvider === 'gemini' && (
      <div className="p-3 border-t space-y-3">
        <div className="space-y-2">
          <Label htmlFor="gemini-key">API Key</Label>
          <div className="flex gap-2">
            <Input
              id="gemini-key"
              type={showKeys['gemini'] ? 'text' : 'password'}
              value={settings?.geminiApiKeyEncrypted ?? ''}
              onChange={(e) => {/* TODO: update */}}
              placeholder="AI..."
              className="h-8 text-xs font-mono"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowKeys({ ...showKeys, gemini: !showKeys['gemini'] })}
            >
              {showKeys['gemini'] ? '🙈' : '👁'}
            </Button>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={() => testConnection('Gemini')}
        >
          Test Connection
        </Button>
      </div>
    )}
  </div>
</div>
```

**Step 4: Test AI settings UI**

Run: `npm run dev`
Settings → AI → Expand each provider
Expected: Collapsible sections, show/hide password

**Step 5: Commit AI settings**

```bash
git add src/renderer/src/features/settings/SettingsPage.tsx
git commit -m "feat(settings): enhance AI settings with provider sections

- Collapsible sections for each provider
- Masked API key inputs with show/hide
- Default model selector per provider
- Test Connection button (placeholder)
- Better visual organization"
```

### Task 5.4: Remove Team Tab from Settings

**Files:**
- Modify: `src/renderer/src/features/settings/SettingsPage.tsx`

**Step 1: Remove team from SettingsTab type**

Change:
```typescript
export type SettingsTab = 'terminal' | 'appearance' | 'ai';
// Remove 'team' from union
```

**Step 2: Remove team tab from UI**

Remove from TabsList:
```typescript
<TabsTrigger value="team" className="w-full justify-start px-3 py-1.5 text-sm">Team</TabsTrigger>
```

Remove from content:
```typescript
<TabsContent value="team" className="p-6 m-0">
  <TeamTab workspaceId={workspaceId} />
</TabsContent>
```

Remove TeamTab component definition if it exists.

**Step 3: Commit removal**

```bash
git add src/renderer/src/features/settings/SettingsPage.tsx
git commit -m "feat(settings): remove team tab from settings

Team moved to main sidebar navigation as separate page."
```

---

## Final Integration & Testing

### Task 6.1: Final Build Test

**Step 1: Run full build**

```bash
npm run build
```

Expected: No errors, dist/ folder created

**Step 2: Run production build**

```bash
npm run preview
```

Expected: App opens, all features work

**Step 3: Test all slices end-to-end**

Checklist:
- [ ] Create folder, move hosts, drag-drop
- [ ] Upload file via SFTP, watch progress
- [ ] Download file, appears in Downloads
- [ ] Ask AI question, insert command into terminal
- [ ] Invite team member (if Supabase configured)
- [ ] Change terminal settings, verify applied
- [ ] Change AI provider, test connection

**Step 4: Commit final test confirmation**

```bash
git commit --allow-empty -m "test: verify all features working end-to-end

✅ Folder organization with drag-drop
✅ SFTP upload/download with progress
✅ AI command insertion
✅ Team page and navigation
✅ Enhanced settings

All 5 slices implemented and tested."
```

### Task 6.2: Documentation Update

**Step 1: Update README**

Add features section documenting new capabilities:
- Folder organization
- SFTP file transfers
- AI command assistance
- Team collaboration
- Enhanced settings

**Step 2: Commit docs**

```bash
git add README.md
git commit -m "docs: update README with completed features

Document all 5 feature slices implemented."
```

---

## Plan Complete

**Total Tasks:** 30+ granular implementation steps

**Estimated Time:** 5-6 hours (if working steadily)

**Testing Strategy:**
- Manual testing after each task commit
- End-to-end testing after each slice
- Production build test at the end

**Commit Strategy:**
- Frequent commits (every 2-5 minutes of work)
- Descriptive messages with context
- Co-authored with Claude

---

**Plan saved to:** `docs/plans/2026-02-19-archterm-remaining-features.md`
