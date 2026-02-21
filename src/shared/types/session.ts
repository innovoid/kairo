export type SessionType = 'ssh' | 'local';

export interface SessionConnectConfig {
  type?: SessionType;
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
  promptStyle?: string;
}
