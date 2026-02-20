# Nice-to-Have Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add polish features including Command Palette, AI Assistant Panel, empty states, and welcome screen to improve user experience

**Architecture:** Add command palette using existing cmdk, create AI assistant panel with chat interface, implement empty states for hosts/keys pages, add welcome screen for onboarding

**Tech Stack:** React, TypeScript, shadcn/ui (Command, Sheet, Card, Button), Vercel AI SDK (streamText), Zustand stores

---

## Task 1: Create Command Palette with Basic Actions

**Files:**
- Create: `src/renderer/src/features/command-palette/CommandPalette.tsx`
- Create: `src/renderer/src/features/command-palette/useCommandPalette.ts`
- Create: `src/renderer/src/features/command-palette/command-actions.ts`

**Step 1: Write the failing test**

```typescript
// src/renderer/src/features/command-palette/__tests__/CommandPalette.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CommandPalette } from '../CommandPalette';

vi.mock('../../../stores/host-store', () => ({
  useHostStore: vi.fn(() => ({
    hosts: [
      { id: 'host-1', label: 'Server 1', hostname: '192.168.1.1' },
      { id: 'host-2', label: 'Server 2', hostname: '192.168.1.2' },
    ],
  })),
}));

describe('CommandPalette', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when closed', () => {
    render(<CommandPalette open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should render when open', () => {
    render(<CommandPalette open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('should show host actions', async () => {
    render(<CommandPalette open={true} onOpenChange={vi.fn()} />);

    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'connect' } });

    await waitFor(() => {
      expect(screen.getByText(/Connect to Server 1/i)).toBeInTheDocument();
      expect(screen.getByText(/Connect to Server 2/i)).toBeInTheDocument();
    });
  });

  it('should show navigation actions', async () => {
    render(<CommandPalette open={true} onOpenChange={vi.fn()} />);

    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'settings' } });

    await waitFor(() => {
      expect(screen.getByText(/Open Settings/i)).toBeInTheDocument();
    });
  });

  it('should close when action selected', async () => {
    const mockOnOpenChange = vi.fn();
    render(<CommandPalette open={true} onOpenChange={mockOnOpenChange} />);

    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'settings' } });

    await waitFor(() => {
      const settingsAction = screen.getByText(/Open Settings/i);
      fireEvent.click(settingsAction);
    });

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- CommandPalette.test.tsx`
Expected: FAIL with "Cannot find module '../CommandPalette'"

**Step 3: Write minimal implementation**

```typescript
// src/renderer/src/features/command-palette/command-actions.ts
import type { Host } from '@shared/types/hosts';

export interface CommandAction {
  id: string;
  label: string;
  description?: string;
  shortcut?: string;
  group: 'hosts' | 'navigation' | 'tools';
  onExecute: () => void;
}

export function getHostActions(hosts: Host[], onConnect: (hostId: string) => void): CommandAction[] {
  return hosts.map((host) => ({
    id: `connect-${host.id}`,
    label: `Connect to ${host.label}`,
    description: host.hostname,
    group: 'hosts' as const,
    onExecute: () => onConnect(host.id),
  }));
}

export function getNavigationActions(navigate: (path: string) => void): CommandAction[] {
  return [
    {
      id: 'nav-settings',
      label: 'Open Settings',
      description: 'Configure application preferences',
      shortcut: '⌘,',
      group: 'navigation' as const,
      onExecute: () => navigate('/settings'),
    },
    {
      id: 'nav-profile',
      label: 'Open Profile',
      description: 'View and edit your profile',
      group: 'navigation' as const,
      onExecute: () => navigate('/profile'),
    },
    {
      id: 'nav-workspace',
      label: 'Workspace Settings',
      description: 'Manage workspace and team',
      group: 'navigation' as const,
      onExecute: () => navigate('/workspace'),
    },
  ];
}
```

```typescript
// src/renderer/src/features/command-palette/useCommandPalette.ts
import { useState, useEffect } from 'react';

export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return { open, setOpen };
}
```

```typescript
// src/renderer/src/features/command-palette/CommandPalette.tsx
import { useHostStore } from '../../stores/host-store';
import { getHostActions, getNavigationActions, type CommandAction } from './command-actions';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../../components/ui/command';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const { hosts } = useHostStore();

  const handleConnect = (hostId: string) => {
    // TODO: Connect to host via session store
    console.log('Connect to', hostId);
    onOpenChange(false);
  };

  const handleNavigate = (path: string) => {
    // TODO: Navigate using router
    window.location.hash = path;
    onOpenChange(false);
  };

  const hostActions = getHostActions(hosts, handleConnect);
  const navActions = getNavigationActions(handleNavigate);

  const executeAction = (action: CommandAction) => {
    action.onExecute();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Hosts">
          {hostActions.map((action) => (
            <CommandItem
              key={action.id}
              onSelect={() => executeAction(action)}
            >
              <span>{action.label}</span>
              {action.description && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {action.description}
                </span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading="Navigation">
          {navActions.map((action) => (
            <CommandItem
              key={action.id}
              onSelect={() => executeAction(action)}
            >
              <span>{action.label}</span>
              {action.shortcut && (
                <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                  {action.shortcut}
                </kbd>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- CommandPalette.test.tsx`
Expected: PASS (5 tests)

**Step 5: Commit**

```bash
git add src/renderer/src/features/command-palette/
git commit -m "feat: add command palette with host and navigation actions

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Integrate Command Palette with AppShell

**Files:**
- Modify: `src/renderer/src/components/layout/AppShell.tsx`

**Step 1: Read current AppShell**

Run: `Read src/renderer/src/components/layout/AppShell.tsx`

**Step 2: Write the test**

```typescript
// Add to src/renderer/src/components/layout/__tests__/AppShell.test.tsx
it('should render command palette', () => {
  render(<AppShell />);
  // Command palette is hidden by default but component should be in DOM
  expect(document.querySelector('[role="dialog"]')).toBeTruthy();
});

it('should open command palette on Cmd+K', () => {
  render(<AppShell />);

  fireEvent.keyDown(document, { key: 'k', metaKey: true });

  expect(screen.getByRole('combobox')).toBeInTheDocument();
});
```

**Step 3: Run test to verify it fails**

Run: `npm test -- AppShell.test.tsx`
Expected: FAIL with "Unable to find element with [role='dialog']"

**Step 4: Update AppShell to include CommandPalette**

```typescript
// Add to AppShell.tsx
import { CommandPalette } from '../../features/command-palette/CommandPalette';
import { useCommandPalette } from '../../features/command-palette/useCommandPalette';

export function AppShell() {
  const { open, setOpen } = useCommandPalette();

  return (
    <>
      <div className="flex h-screen">
        {/* Existing sidebar, main area, etc. */}
      </div>
      <CommandPalette open={open} onOpenChange={setOpen} />
    </>
  );
}
```

**Step 5: Run test to verify it passes**

Run: `npm test -- AppShell.test.tsx`
Expected: PASS (all tests)

**Step 6: Commit**

```bash
git add src/renderer/src/components/layout/AppShell.tsx src/renderer/src/components/layout/__tests__/AppShell.test.tsx
git commit -m "feat: integrate command palette with AppShell and Cmd+K shortcut

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Create AI Assistant Panel Structure

**Files:**
- Create: `src/renderer/src/features/ai-assistant/AiPanel.tsx`
- Create: `src/renderer/src/stores/ai-store.ts`

**Step 1: Write the failing test for ai-store**

```typescript
// src/renderer/src/stores/__tests__/ai-store.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useAiStore } from '../ai-store';

describe('ai-store', () => {
  beforeEach(() => {
    useAiStore.setState({
      messages: [],
      isStreaming: false,
      provider: 'openai',
    });
  });

  it('should have initial state', () => {
    const state = useAiStore.getState();
    expect(state.messages).toEqual([]);
    expect(state.isStreaming).toBe(false);
    expect(state.provider).toBe('openai');
  });

  it('should add user message', () => {
    useAiStore.getState().addMessage({
      role: 'user',
      content: 'Hello AI',
      timestamp: Date.now(),
    });

    const { messages } = useAiStore.getState();
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toBe('Hello AI');
  });

  it('should add assistant message', () => {
    useAiStore.getState().addMessage({
      role: 'assistant',
      content: 'Hello user',
      timestamp: Date.now(),
    });

    const { messages } = useAiStore.getState();
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('assistant');
  });

  it('should clear history', () => {
    useAiStore.getState().addMessage({
      role: 'user',
      content: 'Test',
      timestamp: Date.now(),
    });

    useAiStore.getState().clearHistory();

    const { messages } = useAiStore.getState();
    expect(messages).toEqual([]);
  });

  it('should set streaming state', () => {
    useAiStore.getState().setStreaming(true);
    expect(useAiStore.getState().isStreaming).toBe(true);

    useAiStore.getState().setStreaming(false);
    expect(useAiStore.getState().isStreaming).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- ai-store.test.ts`
Expected: FAIL with "Cannot find module '../ai-store'"

**Step 3: Write ai-store implementation**

```typescript
// src/renderer/src/stores/ai-store.ts
import { create } from 'zustand';

export interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  command?: string; // For command suggestions
}

interface AiState {
  messages: AiMessage[];
  isStreaming: boolean;
  provider: 'openai' | 'anthropic' | 'gemini';
  addMessage: (message: AiMessage) => void;
  clearHistory: () => void;
  setStreaming: (streaming: boolean) => void;
  setProvider: (provider: 'openai' | 'anthropic' | 'gemini') => void;
}

export const useAiStore = create<AiState>((set) => ({
  messages: [],
  isStreaming: false,
  provider: 'openai',

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),

  clearHistory: () =>
    set({ messages: [] }),

  setStreaming: (streaming) =>
    set({ isStreaming: streaming }),

  setProvider: (provider) =>
    set({ provider }),
}));
```

**Step 4: Run test to verify it passes**

Run: `npm test -- ai-store.test.ts`
Expected: PASS (5 tests)

**Step 5: Write AiPanel test**

```typescript
// src/renderer/src/features/ai-assistant/__tests__/AiPanel.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AiPanel } from '../AiPanel';

vi.mock('../../../stores/ai-store', () => ({
  useAiStore: vi.fn(() => ({
    messages: [],
    isStreaming: false,
    provider: 'openai',
    addMessage: vi.fn(),
    clearHistory: vi.fn(),
  })),
}));

describe('AiPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render when open', () => {
    render(<AiPanel open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText(/AI Assistant/i)).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    render(<AiPanel open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByText(/AI Assistant/i)).not.toBeInTheDocument();
  });

  it('should render empty state when no messages', () => {
    render(<AiPanel open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText(/Ask me anything/i)).toBeInTheDocument();
  });

  it('should render chat input', () => {
    render(<AiPanel open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByPlaceholderText(/Type a message/i)).toBeInTheDocument();
  });
});
```

**Step 6: Write AiPanel implementation**

```typescript
// src/renderer/src/features/ai-assistant/AiPanel.tsx
import { useAiStore } from '../../stores/ai-store';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../../components/ui/sheet';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Send } from 'lucide-react';

interface AiPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AiPanel({ open, onOpenChange }: AiPanelProps) {
  const { messages } = useAiStore();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-96 flex flex-col">
        <SheetHeader>
          <SheetTitle>AI Assistant</SheetTitle>
          <SheetDescription>
            Ask questions about commands, get suggestions, and more
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 mt-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p>Ask me anything about your terminal or SSH connections</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground ml-8'
                      : 'bg-muted mr-8'
                  }`}
                >
                  {msg.content}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="flex gap-2 mt-4">
          <Input placeholder="Type a message..." />
          <Button size="icon">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

**Step 7: Run tests**

Run: `npm test -- ai-store.test.ts AiPanel.test.tsx`
Expected: PASS (all tests)

**Step 8: Commit**

```bash
git add src/renderer/src/features/ai-assistant/ src/renderer/src/stores/ai-store.ts src/renderer/src/stores/__tests__/ai-store.test.ts
git commit -m "feat: add AI assistant panel with basic chat interface

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Create Empty States for Hosts Page

**Files:**
- Create: `src/renderer/src/features/hosts/EmptyHostsState.tsx`
- Modify: `src/renderer/src/features/hosts/HostTree.tsx` (add empty state)

**Step 1: Write the failing test**

```typescript
// src/renderer/src/features/hosts/__tests__/EmptyHostsState.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyHostsState } from '../EmptyHostsState';

describe('EmptyHostsState', () => {
  it('should render empty state illustration', () => {
    render(<EmptyHostsState onAddHost={vi.fn()} />);
    expect(screen.getByText(/No hosts yet/i)).toBeInTheDocument();
  });

  it('should render helpful message', () => {
    render(<EmptyHostsState onAddHost={vi.fn()} />);
    expect(screen.getByText(/Get started by adding your first SSH host/i)).toBeInTheDocument();
  });

  it('should render add host button', () => {
    render(<EmptyHostsState onAddHost={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Add Host/i })).toBeInTheDocument();
  });

  it('should call onAddHost when button clicked', () => {
    const mockOnAddHost = vi.fn();
    render(<EmptyHostsState onAddHost={mockOnAddHost} />);

    const button = screen.getByRole('button', { name: /Add Host/i });
    fireEvent.click(button);

    expect(mockOnAddHost).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- EmptyHostsState.test.tsx`
Expected: FAIL with "Cannot find module '../EmptyHostsState'"

**Step 3: Write minimal implementation**

```typescript
// src/renderer/src/features/hosts/EmptyHostsState.tsx
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Server, Plus } from 'lucide-react';

interface EmptyHostsStateProps {
  onAddHost: () => void;
}

export function EmptyHostsState({ onAddHost }: EmptyHostsStateProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-muted p-6 mb-4">
          <Server className="w-12 h-12 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No hosts yet</h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-sm">
          Get started by adding your first SSH host. You can organize hosts into folders
          and connect with a single click.
        </p>
        <Button onClick={onAddHost}>
          <Plus className="w-4 h-4 mr-2" />
          Add Host
        </Button>
      </CardContent>
    </Card>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- EmptyHostsState.test.tsx`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add src/renderer/src/features/hosts/EmptyHostsState.tsx src/renderer/src/features/hosts/__tests__/EmptyHostsState.test.tsx
git commit -m "feat: add empty state for hosts page with helpful onboarding

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Create Empty States for SSH Keys Page

**Files:**
- Create: `src/renderer/src/features/keys/EmptyKeysState.tsx`
- Modify: `src/renderer/src/features/keys/KeyManager.tsx` (add empty state)

**Step 1: Write the failing test**

```typescript
// src/renderer/src/features/keys/__tests__/EmptyKeysState.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyKeysState } from '../EmptyKeysState';

describe('EmptyKeysState', () => {
  it('should render empty state illustration', () => {
    render(<EmptyKeysState onImportKey={vi.fn()} />);
    expect(screen.getByText(/No SSH keys/i)).toBeInTheDocument();
  });

  it('should render helpful message', () => {
    render(<EmptyKeysState onImportKey={vi.fn()} />);
    expect(screen.getByText(/Import your SSH private keys/i)).toBeInTheDocument();
  });

  it('should render import key button', () => {
    render(<EmptyKeysState onImportKey={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Import Key/i })).toBeInTheDocument();
  });

  it('should call onImportKey when button clicked', () => {
    const mockOnImportKey = vi.fn();
    render(<EmptyKeysState onImportKey={mockOnImportKey} />);

    const button = screen.getByRole('button', { name: /Import Key/i });
    fireEvent.click(button);

    expect(mockOnImportKey).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- EmptyKeysState.test.tsx`
Expected: FAIL with "Cannot find module '../EmptyKeysState'"

**Step 3: Write minimal implementation**

```typescript
// src/renderer/src/features/keys/EmptyKeysState.tsx
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Key, Upload } from 'lucide-react';

interface EmptyKeysStateProps {
  onImportKey: () => void;
}

export function EmptyKeysState({ onImportKey }: EmptyKeysStateProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-muted p-6 mb-4">
          <Key className="w-12 h-12 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No SSH keys</h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-sm">
          Import your SSH private keys (PEM or OpenSSH format) to use key-based
          authentication with your hosts.
        </p>
        <Button onClick={onImportKey}>
          <Upload className="w-4 h-4 mr-2" />
          Import Key
        </Button>
      </CardContent>
    </Card>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- EmptyKeysState.test.tsx`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add src/renderer/src/features/keys/EmptyKeysState.tsx src/renderer/src/features/keys/__tests__/EmptyKeysState.test.tsx
git commit -m "feat: add empty state for SSH keys page with import guidance

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Create Welcome Screen for New Users

**Files:**
- Create: `src/renderer/src/features/onboarding/WelcomeScreen.tsx`
- Create: `src/renderer/src/components/layout/WelcomeGate.tsx`

**Step 1: Write the failing test**

```typescript
// src/renderer/src/features/onboarding/__tests__/WelcomeScreen.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WelcomeScreen } from '../WelcomeScreen';

describe('WelcomeScreen', () => {
  it('should render welcome message', () => {
    render(<WelcomeScreen onComplete={vi.fn()} />);
    expect(screen.getByText(/Welcome to ArchTerm/i)).toBeInTheDocument();
  });

  it('should render feature highlights', () => {
    render(<WelcomeScreen onComplete={vi.fn()} />);
    expect(screen.getByText(/SSH Terminal/i)).toBeInTheDocument();
    expect(screen.getByText(/SFTP File Browser/i)).toBeInTheDocument();
    expect(screen.getByText(/Team Collaboration/i)).toBeInTheDocument();
  });

  it('should render get started button', () => {
    render(<WelcomeScreen onComplete={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Get Started/i })).toBeInTheDocument();
  });

  it('should call onComplete when button clicked', () => {
    const mockOnComplete = vi.fn();
    render(<WelcomeScreen onComplete={mockOnComplete} />);

    const button = screen.getByRole('button', { name: /Get Started/i });
    fireEvent.click(button);

    expect(mockOnComplete).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- WelcomeScreen.test.tsx`
Expected: FAIL with "Cannot find module '../WelcomeScreen'"

**Step 3: Write minimal implementation**

```typescript
// src/renderer/src/features/onboarding/WelcomeScreen.tsx
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Terminal, FolderOpen, Users, Key } from 'lucide-react';

interface WelcomeScreenProps {
  onComplete: () => void;
}

export function WelcomeScreen({ onComplete }: WelcomeScreenProps) {
  const features = [
    {
      icon: Terminal,
      title: 'SSH Terminal',
      description: 'Full-featured terminal with xterm.js and multiple themes',
    },
    {
      icon: FolderOpen,
      title: 'SFTP File Browser',
      description: 'Upload, download, and manage remote files with ease',
    },
    {
      icon: Users,
      title: 'Team Collaboration',
      description: 'Share hosts and SSH keys with your workspace team',
    },
    {
      icon: Key,
      title: 'Secure Key Management',
      description: 'Import and manage SSH keys with optional encryption',
    },
  ];

  return (
    <div className="flex items-center justify-center min-h-screen p-8 bg-gradient-to-br from-background to-muted">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Terminal className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-3xl">Welcome to ArchTerm</CardTitle>
          <CardDescription className="text-base">
            Your modern SSH client with team collaboration and AI assistance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 mb-8">
            {features.map((feature) => (
              <div key={feature.title} className="flex gap-3 p-4 rounded-lg border bg-card">
                <feature.icon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-medium mb-1">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
          <Button onClick={onComplete} className="w-full" size="lg">
            Get Started
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- WelcomeScreen.test.tsx`
Expected: PASS (4 tests)

**Step 5: Write WelcomeGate component**

```typescript
// src/renderer/src/components/layout/WelcomeGate.tsx
import { useEffect, useState } from 'react';
import { WelcomeScreen } from '../../features/onboarding/WelcomeScreen';

const WELCOME_COMPLETED_KEY = 'archterm:welcome-completed';

interface WelcomeGateProps {
  children: React.ReactNode;
}

export function WelcomeGate({ children }: WelcomeGateProps) {
  const [showWelcome, setShowWelcome] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const completed = localStorage.getItem(WELCOME_COMPLETED_KEY);
    setShowWelcome(!completed);
    setLoading(false);
  }, []);

  const handleComplete = () => {
    localStorage.setItem(WELCOME_COMPLETED_KEY, 'true');
    setShowWelcome(false);
  };

  if (loading) {
    return null; // Or loading spinner
  }

  if (showWelcome) {
    return <WelcomeScreen onComplete={handleComplete} />;
  }

  return <>{children}</>;
}
```

**Step 6: Commit**

```bash
git add src/renderer/src/features/onboarding/ src/renderer/src/components/layout/WelcomeGate.tsx
git commit -m "feat: add welcome screen for new user onboarding

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Add AI Chat Message with Command Detection

**Files:**
- Create: `src/renderer/src/features/ai-assistant/ChatMessage.tsx`
- Create: `src/renderer/src/features/ai-assistant/CommandSuggestion.tsx`

**Step 1: Write the failing test**

```typescript
// src/renderer/src/features/ai-assistant/__tests__/ChatMessage.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatMessage } from '../ChatMessage';

describe('ChatMessage', () => {
  it('should render user message', () => {
    render(<ChatMessage role="user" content="Hello" timestamp={Date.now()} />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('should render assistant message', () => {
    render(<ChatMessage role="assistant" content="Hi there" timestamp={Date.now()} />);
    expect(screen.getByText('Hi there')).toBeInTheDocument();
  });

  it('should render command suggestion when command provided', () => {
    render(
      <ChatMessage
        role="assistant"
        content="Try this command"
        command="ls -la"
        timestamp={Date.now()}
      />
    );
    expect(screen.getByText('ls -la')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- ChatMessage.test.tsx`
Expected: FAIL with "Cannot find module '../ChatMessage'"

**Step 3: Write minimal implementation**

```typescript
// src/renderer/src/features/ai-assistant/CommandSuggestion.tsx
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Copy, Terminal } from 'lucide-react';

interface CommandSuggestionProps {
  command: string;
  onInsert?: (command: string) => void;
}

export function CommandSuggestion({ command, onInsert }: CommandSuggestionProps) {
  const handleCopy = () => {
    navigator.clipboard.writeText(command);
  };

  const handleInsert = () => {
    if (onInsert) {
      onInsert(command);
    }
  };

  return (
    <Card className="p-3 bg-muted/50 border-primary/20">
      <div className="flex items-center justify-between gap-2">
        <code className="flex-1 text-sm font-mono bg-background px-2 py-1 rounded">
          {command}
        </code>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={handleCopy}>
            <Copy className="w-3 h-3" />
          </Button>
          {onInsert && (
            <Button size="sm" variant="ghost" onClick={handleInsert}>
              <Terminal className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
```

```typescript
// src/renderer/src/features/ai-assistant/ChatMessage.tsx
import { CommandSuggestion } from './CommandSuggestion';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  command?: string;
  timestamp: number;
  onInsertCommand?: (command: string) => void;
}

export function ChatMessage({ role, content, command, onInsertCommand }: ChatMessageProps) {
  return (
    <div className={`space-y-2 ${role === 'user' ? 'ml-8' : 'mr-8'}`}>
      <div
        className={`p-3 rounded-lg ${
          role === 'user'
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted'
        }`}
      >
        <p className="text-sm whitespace-pre-wrap">{content}</p>
      </div>
      {command && (
        <CommandSuggestion command={command} onInsert={onInsertCommand} />
      )}
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- ChatMessage.test.tsx`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add src/renderer/src/features/ai-assistant/ChatMessage.tsx src/renderer/src/features/ai-assistant/CommandSuggestion.tsx src/renderer/src/features/ai-assistant/__tests__/ChatMessage.test.tsx
git commit -m "feat: add chat message component with command suggestions

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Update AiPanel to Use ChatMessage Components

**Files:**
- Modify: `src/renderer/src/features/ai-assistant/AiPanel.tsx`

**Step 1: Update AiPanel to use ChatMessage**

```typescript
// Update AiPanel.tsx
import { ChatMessage } from './ChatMessage';

// Inside the ScrollArea, replace the message rendering:

<ScrollArea className="flex-1 mt-4">
  {messages.length === 0 ? (
    <div className="flex items-center justify-center h-full text-muted-foreground p-4">
      <div className="text-center">
        <p className="mb-2">Ask me anything about your terminal or SSH connections</p>
        <p className="text-xs">Try: "How do I list large files?" or "Explain this command"</p>
      </div>
    </div>
  ) : (
    <div className="space-y-4 p-4">
      {messages.map((msg, idx) => (
        <ChatMessage
          key={idx}
          role={msg.role}
          content={msg.content}
          command={msg.command}
          timestamp={msg.timestamp}
          onInsertCommand={(cmd) => {
            // TODO: Insert into active terminal
            console.log('Insert command:', cmd);
          }}
        />
      ))}
    </div>
  )}
</ScrollArea>
```

**Step 2: Update AiPanel test to verify ChatMessage usage**

```typescript
// Add to AiPanel.test.tsx
it('should render messages using ChatMessage component', () => {
  const messages = [
    { role: 'user', content: 'Hello', timestamp: Date.now() },
    { role: 'assistant', content: 'Hi', timestamp: Date.now() },
  ];

  const { useAiStore } = require('../../../stores/ai-store');
  useAiStore.mockReturnValue({
    messages,
    isStreaming: false,
    provider: 'openai',
  });

  render(<AiPanel open={true} onOpenChange={vi.fn()} />);

  expect(screen.getByText('Hello')).toBeInTheDocument();
  expect(screen.getByText('Hi')).toBeInTheDocument();
});
```

**Step 3: Run test**

Run: `npm test -- AiPanel.test.tsx`
Expected: PASS (all tests including new one)

**Step 4: Commit**

```bash
git add src/renderer/src/features/ai-assistant/AiPanel.tsx src/renderer/src/features/ai-assistant/__tests__/AiPanel.test.tsx
git commit -m "refactor: use ChatMessage component in AiPanel for better UX

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Integration and Documentation

**Files:**
- Create: `src/renderer/src/features/__tests__/nice-to-have-features.integration.test.tsx`
- Create: `docs/features/nice-to-have-features.md`

**Step 1: Write integration test**

```typescript
// src/renderer/src/features/__tests__/nice-to-have-features.integration.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AppShell } from '../../components/layout/AppShell';

vi.mock('../../stores/host-store');
vi.mock('../../stores/ai-store');
vi.mock('../../lib/supabase');

describe('Nice-to-Have Features Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should open command palette with Cmd+K', () => {
    render(<AppShell />);

    fireEvent.keyDown(document, { key: 'k', metaKey: true });

    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('should show empty hosts state when no hosts', () => {
    const { useHostStore } = require('../../stores/host-store');
    useHostStore.mockReturnValue({
      hosts: [],
      folders: [],
    });

    render(<AppShell />);

    expect(screen.getByText(/No hosts yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Host/i })).toBeInTheDocument();
  });

  it('should toggle AI panel', () => {
    render(<AppShell />);

    // Find and click AI panel toggle button
    const aiToggle = screen.getByRole('button', { name: /AI Assistant/i });
    fireEvent.click(aiToggle);

    expect(screen.getByText(/Ask me anything/i)).toBeInTheDocument();
  });
});
```

**Step 2: Run integration test**

Run: `npm test -- nice-to-have-features.integration.test.tsx`
Expected: PASS

**Step 3: Write feature documentation**

```markdown
<!-- docs/features/nice-to-have-features.md -->
# Nice-to-Have Features

## Overview

Polish features that enhance user experience including command palette, AI assistant, empty states, and welcome screen.

## Features

### Command Palette (Cmd+K)

**Shortcut:** ⌘K (Mac) / Ctrl+K (Windows/Linux)

**Actions:**
- **Hosts:** Quick connect to any host
- **Navigation:** Jump to Settings, Profile, Workspace pages
- **Tools:** Future: disconnect all, refresh, etc.

**Usage:**
1. Press ⌘K to open
2. Type to filter actions
3. Use arrow keys to navigate
4. Press Enter to execute
5. Press Esc to close

**Implementation:**
- Uses shadcn/ui Command component (cmdk)
- Fuzzy search across all actions
- Keyboard-first interface
- Extensible action system

### AI Assistant Panel

**Location:** Right sidebar sheet (collapsible)

**Features:**
- Chat interface with AI
- Command suggestions with "Insert into terminal" button
- Command explanation ("Explain this command")
- Natural language to bash conversion
- Persistent chat history per session

**Providers:**
- OpenAI (GPT-4)
- Anthropic (Claude)
- Google (Gemini)

**Usage:**
1. Click AI icon in toolbar
2. Type question or natural language command
3. AI responds with explanation and command suggestion
4. Click "Insert" to add command to active terminal
5. Click "Copy" to copy to clipboard

**Security:**
- API keys stored encrypted in settings
- Never sends private SSH key data
- Only sends terminal context when explicitly requested

### Empty States

**Purpose:** Guide new users with helpful onboarding

**Locations:**
- **Hosts Page:** Shows when no hosts configured
  - Illustration with server icon
  - "Get started by adding your first SSH host"
  - Quick "Add Host" button

- **SSH Keys Page:** Shows when no keys imported
  - Illustration with key icon
  - "Import your SSH private keys to use key-based auth"
  - Quick "Import Key" button

**Design:**
- Dashed border cards
- Icon illustrations
- Concise, helpful copy
- Primary action button
- Avoids overwhelming new users

### Welcome Screen

**Shown:** First time app is launched (before any workspace data)

**Content:**
- ArchTerm logo and welcome message
- 4 feature highlights in grid:
  - SSH Terminal with themes
  - SFTP File Browser
  - Team Collaboration
  - Secure Key Management
- "Get Started" button

**Behavior:**
- Shown once per user (localStorage flag)
- Dismissible
- Full-screen takeover
- Beautiful gradient background
- Smooth transition to main app

**Skip:**
- Can be manually dismissed
- Automatically dismissed after "Get Started"
- Flag: `archterm:welcome-completed`

## Technical Details

### Command Palette

**Component:** `CommandPalette.tsx`
**Hook:** `useCommandPalette.ts` (Cmd+K listener)
**Actions:** `command-actions.ts` (extensible action definitions)

**Action Definition:**
```typescript
interface CommandAction {
  id: string;
  label: string;
  description?: string;
  shortcut?: string;
  group: 'hosts' | 'navigation' | 'tools';
  onExecute: () => void;
}
```

**Adding New Actions:**
1. Define action in `command-actions.ts`
2. Add to appropriate group
3. Provide `onExecute` callback
4. Optional: Add keyboard shortcut

### AI Assistant

**State:** `ai-store.ts` (Zustand)
```typescript
interface AiState {
  messages: AiMessage[];
  isStreaming: boolean;
  provider: 'openai' | 'anthropic' | 'gemini';
  addMessage: (message: AiMessage) => void;
  clearHistory: () => void;
}
```

**Components:**
- `AiPanel.tsx` - Main panel with chat UI
- `ChatMessage.tsx` - Individual message bubble
- `CommandSuggestion.tsx` - Command card with insert/copy buttons

**Future Enhancements:**
- Stream AI responses (currently placeholder)
- Connect to active terminal session
- Terminal output context
- Command history analysis
- Error explanation

### Empty States

**Pattern:**
```typescript
{hosts.length === 0 ? (
  <EmptyHostsState onAddHost={handleAddHost} />
) : (
  <HostTree hosts={hosts} />
)}
```

**Components:**
- `EmptyHostsState.tsx`
- `EmptyKeysState.tsx`

**Reusable Structure:**
- Dashed Card wrapper
- Icon illustration (rounded circle bg)
- Heading (lg, semibold)
- Description (sm, muted, max-w-sm)
- Primary action Button

### Welcome Screen

**Gate Component:** `WelcomeGate.tsx`
```typescript
<WelcomeGate>
  <AppShell />
</WelcomeGate>
```

**localStorage Key:** `archterm:welcome-completed`

**Reset for Testing:**
```javascript
localStorage.removeItem('archterm:welcome-completed');
```

## Testing

- Command palette keyboard shortcuts
- AI panel open/close
- Empty states conditional rendering
- Welcome screen localStorage behavior
- Integration test covering all features

## Future Enhancements

### Command Palette
- Recent commands history
- Workspace switching
- Quick host editing
- Bulk actions (disconnect all)

### AI Assistant
- Voice input/output
- Terminal auto-fix (error detection)
- Security audit suggestions
- Performance optimization tips

### Empty States
- Quick start wizard
- Import from other SSH clients
- Template hosts (AWS, DigitalOcean, etc.)

### Welcome Screen
- Interactive tutorial
- Video walkthrough
- Feature tour with highlights
- Skip tour option
```

**Step 4: Commit**

```bash
git add src/renderer/src/features/__tests__/nice-to-have-features.integration.test.tsx docs/features/nice-to-have-features.md
git commit -m "docs: add integration test and documentation for nice-to-have features

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Verification

1. `npm test` — All tests pass (unit + integration)
2. `npm run dev` — Launch app
3. Press ⌘K → Command palette opens with host and nav actions
4. Click AI icon → AI panel opens from right side
5. Navigate to empty hosts page → See helpful empty state
6. Navigate to empty keys page → See helpful empty state
7. Clear localStorage and restart → Welcome screen appears
8. Click "Get Started" → Main app appears, welcome not shown again

---

## Dependencies

**Required packages (already installed):**
- cmdk (shadcn/ui Command component)
- lucide-react (icons)
- shadcn/ui: Sheet, Card, ScrollArea, Input, Button
- Zustand for ai-store

**Requires from previous plans:**
- Host store with hosts list
- Key store with keys list
- Settings store for AI provider configuration

---

## Notes

- Command palette is keyboard-first for power users
- AI panel is placeholder for now (no actual AI integration yet)
- Empty states follow consistent design pattern
- Welcome screen uses localStorage (no backend)
- All features are non-blocking enhancements
- Features degrade gracefully if dependencies missing
- Integration test ensures features work together
