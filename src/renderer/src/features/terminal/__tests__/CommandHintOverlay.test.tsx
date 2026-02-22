import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandHintOverlay } from '../CommandHintOverlay';
import { useSnippetStore } from '@/stores/snippet-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import type { Terminal } from 'ghostty-web';

interface FakeTerminal extends Partial<Terminal> {
  __handler?: (event: KeyboardEvent) => boolean;
}

function createKeyEvent(key: string): KeyboardEvent {
  return new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
}

function setupTerminal(): { terminal: Terminal; getHandler: () => (event: KeyboardEvent) => boolean } {
  const host = document.createElement('div');
  host.tabIndex = -1;
  const focusTarget = document.createElement('div');
  focusTarget.tabIndex = 0;
  host.appendChild(focusTarget);
  document.body.appendChild(host);
  focusTarget.focus();

  const fake: FakeTerminal = {
    element: host,
    write: vi.fn(),
    input: vi.fn(),
    focus: vi.fn(),
    attachCustomKeyEventHandler: vi.fn((handler: (event: KeyboardEvent) => boolean) => {
      fake.__handler = handler;
    }),
  };

  return {
    terminal: fake as Terminal,
    getHandler: () => {
      if (!fake.__handler) throw new Error('handler not attached');
      return fake.__handler;
    },
  };
}

function getWriteBuffer(terminal: Terminal): string {
  const calls = ((terminal.write as unknown) as ReturnType<typeof vi.fn>).mock.calls;
  return calls.map((call) => String(call[0])).join('');
}

describe('CommandHintOverlay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    useWorkspaceStore.setState({ activeWorkspace: null });
    useSnippetStore.setState({
      snippets: [
        {
          id: 'snip-1',
          workspaceId: 'ws-1',
          name: 'Docker Ps',
          command: 'docker ps',
          tags: [],
          createdAt: new Date().toISOString(),
        },
        {
          id: 'snip-2',
          workspaceId: 'ws-1',
          name: 'Docker Logs',
          command: 'docker logs',
          tags: [],
          createdAt: new Date().toISOString(),
        },
      ],
    });

    (window as any).sftpApi = {
      list: vi.fn().mockResolvedValue([]),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('navigates hints with arrows and applies active hint on Tab while preserving focus', async () => {
    const { terminal, getHandler } = setupTerminal();

    render(
      <CommandHintOverlay
        terminal={terminal}
        sessionId="session-1"
        currentRemotePath="/home"
      />
    );

    const handler = getHandler();

    for (const key of ['d', 'o', 'c', 'k']) {
      const result = handler(createKeyEvent(key));
      expect(result).toBe(false);
    }

    await vi.advanceTimersByTimeAsync(140);
    await Promise.resolve();

    const downResult = handler(createKeyEvent('ArrowDown'));
    expect(downResult).toBe(true);

    const tabResult = handler(createKeyEvent('Tab'));
    expect(tabResult).toBe(true);

    const inputCalls = ((terminal.input as unknown) as ReturnType<typeof vi.fn>).mock.calls;
    expect(inputCalls.some((call) => call[0] === 'er logs')).toBe(true);
    expect((terminal.focus as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
  });

  it('does not intercept Tab when there are no active suggestions', () => {
    const { terminal, getHandler } = setupTerminal();

    render(
      <CommandHintOverlay
        terminal={terminal}
        sessionId="session-2"
        currentRemotePath="/home"
      />
    );

    const handler = getHandler();
    const tabResult = handler(createKeyEvent('Tab'));

    expect(tabResult).toBe(false);
    expect((terminal.input as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });

  it('renders grouped hints (snippets/history/context) and applies active history item with keyboard navigation', async () => {
    localStorage.setItem(
      'archterm:terminal-history:session-3',
      JSON.stringify(['cd /hosts'])
    );
    useSnippetStore.setState({
      snippets: [
        {
          id: 'snip-cd',
          workspaceId: 'ws-1',
          name: 'Go Home',
          command: 'cd /home',
          tags: [],
          createdAt: new Date().toISOString(),
        },
      ],
    });
    (window as any).sftpApi = {
      list: vi.fn().mockResolvedValue([
        {
          name: 'home',
          path: '/home',
          type: 'directory',
          size: 0,
          permissions: '755',
          modifiedAt: new Date().toISOString(),
          owner: 'root',
        },
      ]),
    };

    const { terminal, getHandler } = setupTerminal();
    render(
      <CommandHintOverlay
        terminal={terminal}
        sessionId="session-3"
        currentRemotePath="/"
      />
    );
    const handler = getHandler();

    for (const key of ['c', 'd', ' ', '/', 'h', 'o']) {
      handler(createKeyEvent(key));
    }

    await vi.advanceTimersByTimeAsync(140);
    await Promise.resolve();

    const output = getWriteBuffer(terminal);
    expect(output).toContain('Snippets:');
    expect(output).toContain('History:');
    expect(output).toContain('Context:');
    expect(((window as any).sftpApi.list as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('session-3', '/');

    // active index 0 -> snippet, ArrowDown -> history
    expect(handler(createKeyEvent('ArrowDown'))).toBe(true);
    expect(handler(createKeyEvent('Tab'))).toBe(true);

    const inputCalls = ((terminal.input as unknown) as ReturnType<typeof vi.fn>).mock.calls;
    expect(inputCalls.some((call) => call[0] === 'sts')).toBe(true);
  });

  it('clears suggestions and stops intercepting keys when terminal loses focus', async () => {
    const { terminal, getHandler } = setupTerminal();
    render(
      <CommandHintOverlay
        terminal={terminal}
        sessionId="session-4"
        currentRemotePath="/home"
      />
    );
    const handler = getHandler();

    for (const key of ['d', 'o', 'c', 'k']) {
      handler(createKeyEvent(key));
    }

    await vi.advanceTimersByTimeAsync(140);
    await Promise.resolve();

    // Move focus outside terminal host.
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();
    document.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

    // With no terminal focus, key handling should not be intercepted.
    expect(handler(createKeyEvent('ArrowDown'))).toBe(false);
    expect(handler(createKeyEvent('Tab'))).toBe(false);
  });
});
