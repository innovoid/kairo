import type { IpcMainInvokeEvent } from 'electron';
import { sshManager } from '../services/ssh-manager';
import type { SshSessionConfig } from '../../shared/types/ssh';
import type { SessionConnectConfig } from '../../shared/types/session';

export const sshIpcHandlers = {
  async connect(
    event: IpcMainInvokeEvent,
    sessionId: string,
    config: SessionConnectConfig
  ): Promise<void> {
    if (config.type === 'local') {
      // TODO: wire up localShellManager once Task 11 adds it
      // localShellManager.connect(sessionId, event.sender, config);
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
    sshManager.disconnect(sessionId);
  },

  send(_event: IpcMainInvokeEvent, sessionId: string, data: string): void {
    sshManager.send(sessionId, data);
  },

  resize(_event: IpcMainInvokeEvent, sessionId: string, cols: number, rows: number): void {
    sshManager.resize(sessionId, cols, rows);
  },
};
