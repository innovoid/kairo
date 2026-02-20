import * as pty from 'node-pty';
import type { WebContents } from 'electron';
import { platform } from 'os';
import { logger } from '../lib/logger';
import { recordingManager } from './recording-manager';

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
      if (recordingManager.isRecording(sessionId)) {
        recordingManager.appendData(sessionId, data);
      }
    });

    ptyProcess.onExit(({ exitCode }) => {
      sessions.delete(sessionId);
      if (!sender.isDestroyed()) {
        sender.send('ssh:closed', sessionId);
      }
      logger.debug(`Local shell exited with code ${exitCode} for session ${sessionId}`);
    });

    // Signal connected immediately
    if (!sender.isDestroyed()) {
      sender.send('ssh:data', sessionId, '');
    }
  },

  disconnect(sessionId: string): void {
    const session = sessions.get(sessionId);
    if (session) {
      try { session.pty.kill(); } catch { /* already dead */ }
      sessions.delete(sessionId);
    }
  },

  send(sessionId: string, data: string): void {
    sessions.get(sessionId)?.pty.write(data);
  },

  resize(sessionId: string, cols: number, rows: number): void {
    sessions.get(sessionId)?.pty.resize(cols, rows);
  },

  has(sessionId: string): boolean {
    return sessions.has(sessionId);
  },
};
