import * as pty from 'node-pty';
import type { WebContents } from 'electron';
import { platform, userInfo } from 'os';
import { existsSync } from 'fs';
import { logger } from '../lib/logger';
import { sessionEventBus } from './session-event-bus';
import { clearAgentVisibilitySession, filterAgentArtifactsForRenderer } from './agent-command-visibility';

interface LocalSession {
  pty: pty.IPty;
}

const sessions = new Map<string, LocalSession>();

function detectShell(): string {
  // Try process.env.SHELL first (works when launched from terminal)
  if (process.env.SHELL && existsSync(process.env.SHELL)) {
    return process.env.SHELL;
  }

  // Try to get from os.userInfo() (more reliable on macOS GUI apps)
  try {
    const info = userInfo();
    if (info.shell && existsSync(info.shell)) {
      return info.shell;
    }
  } catch {
    // userInfo may fail in some environments
  }

  // Fall back to common shell locations
  const commonShells = [
    '/bin/zsh',
    '/usr/bin/zsh',
    '/bin/bash',
    '/usr/bin/bash',
    '/usr/local/bin/zsh',
    '/usr/local/bin/bash',
  ];

  for (const shellPath of commonShells) {
    if (existsSync(shellPath)) {
      return shellPath;
    }
  }

  // Last resort
  return '/bin/sh';
}

function getShellEnvironment(promptStyle?: string): Record<string, string> {
  // Filter out undefined and null values from process.env
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && value !== null) {
      env[key] = value;
    }
  }

  // Ensure PATH includes common locations on macOS/Linux
  if (platform() !== 'win32') {
    const paths = [
      '/usr/local/bin',
      '/usr/bin',
      '/bin',
      '/usr/sbin',
      '/sbin',
    ];

    if (env.PATH) {
      // Add missing paths to existing PATH
      const existingPaths = env.PATH.split(':');
      for (const p of paths) {
        if (!existingPaths.includes(p)) {
          existingPaths.unshift(p);
        }
      }
      env.PATH = existingPaths.join(':');
    } else {
      // No PATH set, use defaults
      env.PATH = paths.join(':');
    }

    // Ensure HOME is set
    if (!env.HOME) {
      try {
        env.HOME = userInfo().homedir;
      } catch {
        env.HOME = '/tmp';
      }
    }

    // Set TERM if not already set
    if (!env.TERM) {
      env.TERM = 'xterm-256color';
    }

    // Set locale variables for proper character rendering
    if (!env.LANG && !env.LC_ALL) {
      env.LANG = 'en_US.UTF-8';
      env.LC_ALL = 'en_US.UTF-8';
    }

    // Set custom prompt based on user preference
    if (promptStyle) {
      const shell = env.SHELL || detectShell();
      const isZsh = shell.includes('zsh');
      const isBash = shell.includes('bash');

      if (promptStyle === 'minimal') {
        // Just $ or %
        if (isZsh) {
          env.PROMPT = '$ ';
        } else if (isBash) {
          env.PS1 = '$ ';
        }
      } else if (promptStyle === 'directory') {
        // Current directory + $ or %
        if (isZsh) {
          env.PROMPT = '%1~ $ ';
        } else if (isBash) {
          env.PS1 = '\\W $ ';
        }
      }
      // 'default' means don't override - use shell's default
    }
  }

  return env;
}

export const localShellManager = {
  connect(sessionId: string, sender: WebContents, options?: { shell?: string; cwd?: string; promptStyle?: string }): void {
    localShellManager.disconnect(sessionId);

    const defaultShell = platform() === 'win32' ? 'powershell.exe' : detectShell();
    const shell = options?.shell || defaultShell;
    const cwd = options?.cwd || process.env.HOME || process.env.USERPROFILE || '/';

    // Verify shell exists before spawning
    if (platform() !== 'win32' && !existsSync(shell)) {
      const errorMsg = `Shell not found: ${shell}`;
      logger.error(errorMsg);
      if (!sender.isDestroyed()) {
        sender.send('ssh:error', sessionId, errorMsg);
      }
      return;
    }

    // Verify cwd exists
    if (!existsSync(cwd)) {
      const errorMsg = `Working directory not found: ${cwd}`;
      logger.error(errorMsg);
      if (!sender.isDestroyed()) {
        sender.send('ssh:error', sessionId, errorMsg);
      }
      return;
    }

    logger.debug(`Spawning local shell: ${shell} in ${cwd}`);

    let ptyProcess: pty.IPty;
    try {
      const env = getShellEnvironment(options?.promptStyle);
      logger.debug(`Environment keys: ${Object.keys(env).length}, PATH: ${env.PATH?.substring(0, 100)}, HOME: ${env.HOME}, PROMPT: ${env.PROMPT || env.PS1 || 'default'}`);

      ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd,
        env,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to spawn local shell: ${errorMsg}`);
      if (!sender.isDestroyed()) {
        sender.send('ssh:error', sessionId, `Failed to start local shell: ${errorMsg}`);
      }
      return;
    }

    sessions.set(sessionId, { pty: ptyProcess });

    ptyProcess.onData((data) => {
      // Important: filter for renderer first. executeShellCommand listens on
      // sessionEventBus and may unregister markers synchronously when the
      // marker appears in this same chunk.
      const rendererData = filterAgentArtifactsForRenderer(sessionId, data);
      if (!sender.isDestroyed()) {
        if (rendererData) {
          sender.send('ssh:data', sessionId, rendererData);
        }
      }
      sessionEventBus.emitData(sessionId, data);
    });

    ptyProcess.onExit(({ exitCode }) => {
      sessions.delete(sessionId);
      clearAgentVisibilitySession(sessionId);
      sessionEventBus.emitClosed(sessionId);
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
      clearAgentVisibilitySession(sessionId);
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
