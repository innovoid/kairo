import { localShellManager } from './local-shell-manager';
import { sshManager } from './ssh-manager';
import { sessionEventBus } from './session-event-bus';
import { registerAgentMarker, unregisterAgentMarker } from './agent-command-visibility';

export interface ExecuteShellCommandOptions {
  timeoutMs?: number;
  onOutput?: (chunk: string) => void;
}

export interface ExecuteShellCommandResult {
  output: string;
  exitCode: number;
}

function assertSessionExists(sessionId: string): void {
  if (!localShellManager.has(sessionId) && !sshManager.has(sessionId)) {
    throw new Error(`No active session found for ${sessionId}`);
  }
}

function sendToSession(sessionId: string, data: string): void {
  if (localShellManager.has(sessionId)) {
    localShellManager.send(sessionId, data);
    return;
  }
  sshManager.send(sessionId, data);
}

function escapeForDoubleQuotes(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function buildWrappedCommand(command: string, marker: string): string {
  const safeMarker = escapeForDoubleQuotes(marker);
  // Execute command, emit deterministic marker with exit code.
  return `{ ${command} ; } ; __archterm_status=$?; printf "\\n${safeMarker}:%s\\n" "$__archterm_status"\n`;
}

export function executeShellCommand(
  sessionId: string,
  command: string,
  options: ExecuteShellCommandOptions = {}
): Promise<ExecuteShellCommandResult> {
  const { timeoutMs = 120_000, onOutput } = options;
  assertSessionExists(sessionId);

  const marker = `__ARCHTERM_AGENT_EXIT_${crypto.randomUUID().replace(/-/g, '')}__`;
  const markerPattern = new RegExp(`${marker}:(\\d+)`);
  registerAgentMarker(sessionId, marker);

  return new Promise((resolve, reject) => {
    let settled = false;
    let output = '';

    const cleanup = () => {
      offData();
      offClosed();
      offError();
      offInterrupted();
      clearTimeout(timeoutHandle);
      unregisterAgentMarker(sessionId, marker);
    };

    const finish = (result: ExecuteShellCommandResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    const offData = sessionEventBus.onData((eventSessionId, chunk) => {
      if (eventSessionId !== sessionId) return;
      output += chunk;
      onOutput?.(chunk);

      const markerMatch = output.match(markerPattern);
      if (!markerMatch) return;

      const exitCode = Number(markerMatch[1]);
      const cleanedOutput = output
        .replace(new RegExp(`\\r?\\n?${marker}:\\d+\\r?\\n?`), '')
        .trimEnd();

      finish({ output: cleanedOutput, exitCode: Number.isFinite(exitCode) ? exitCode : 1 });
    });

    const offClosed = sessionEventBus.onClosed((eventSessionId) => {
      if (eventSessionId !== sessionId) return;
      fail(new Error('Session closed while command was running'));
    });

    const offError = sessionEventBus.onError((eventSessionId, error) => {
      if (eventSessionId !== sessionId) return;
      fail(new Error(error));
    });

    const offInterrupted = sessionEventBus.onInterrupted((eventSessionId) => {
      if (eventSessionId !== sessionId) return;
      fail(new Error('Command interrupted by user (Ctrl+C)'));
    });

    const timeoutHandle = setTimeout(() => {
      fail(new Error(`Command timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    try {
      sendToSession(sessionId, buildWrappedCommand(command, marker));
    } catch (error) {
      fail(error as Error);
    }
  });
}
