export type SessionType = 'ssh' | 'local';

/**
 * Persisted reconnect config stored in tab state.
 * Password is intentionally excluded — it is fetched from the host store at
 * connect/reconnect time and never held in memory beyond the call.
 */
export interface SessionConnectConfig {
  type?: SessionType;
  // SSH-specific
  host?: string;
  port?: number;
  username?: string;
  authType?: 'password' | 'key';
  privateKeyId?: string;
  hostId?: string;
  // Local-specific
  shell?: string;
  cwd?: string;
  promptStyle?: string;
}

/**
 * Full config passed to `ssh.connect` IPC — includes the ephemeral password
 * that must not be persisted anywhere.
 */
export interface SshConnectPayload extends SessionConnectConfig {
  password?: string;
}
