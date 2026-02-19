export type SshAuthType = 'password' | 'key';

export interface SshSessionConfig {
  host: string;
  port: number;
  username: string;
  authType: SshAuthType;
  password?: string;
  privateKeyId?: string;
}

export type SshSessionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';
