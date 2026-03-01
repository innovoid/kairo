import type { IpcMainInvokeEvent } from 'electron';
import { sshManager } from '../services/ssh-manager';
import { localShellManager } from '../services/local-shell-manager';
import type { SshSessionConfig } from '../../shared/types/ssh';
import type { SessionConnectConfig } from '../../shared/types/session';
import type { KnownHostEntry } from '../../shared/types/known-hosts';
import type { HostKeyEvent } from '../../shared/types/host-key-events';

export const sshIpcHandlers = {
  async connect(
    event: IpcMainInvokeEvent,
    sessionId: string,
    config: SessionConnectConfig
  ): Promise<void> {
    if (config.type === 'local') {
      localShellManager.connect(sessionId, event.sender, config);
      return;
    }
    // Default to SSH path if type is 'ssh' or not specified
    await sshManager.connect(
      sessionId,
      config as SshSessionConfig & { hostId: string },
      event.sender
    );
  },

  disconnect(_event: IpcMainInvokeEvent, sessionId: string): void {
    if (localShellManager.has(sessionId)) {
      localShellManager.disconnect(sessionId);
    } else {
      sshManager.disconnect(sessionId);
    }
  },

  send(_event: IpcMainInvokeEvent, sessionId: string, data: string): void {
    if (localShellManager.has(sessionId)) {
      localShellManager.send(sessionId, data);
    } else {
      sshManager.send(sessionId, data);
    }
  },

  resize(_event: IpcMainInvokeEvent, sessionId: string, cols: number, rows: number): void {
    if (localShellManager.has(sessionId)) {
      localShellManager.resize(sessionId, cols, rows);
    } else {
      sshManager.resize(sessionId, cols, rows);
    }
  },

  listKnownHosts(): KnownHostEntry[] {
    return sshManager.listKnownHosts();
  },

  removeKnownHost(_event: IpcMainInvokeEvent, entryId: string): boolean {
    return sshManager.removeKnownHost(entryId);
  },

  listHostKeyEvents(_event: IpcMainInvokeEvent, limit?: number): HostKeyEvent[] {
    return sshManager.listHostKeyEvents(limit);
  },

  clearHostKeyEvents(): void {
    sshManager.clearHostKeyEvents();
  },
};
