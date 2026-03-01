import type { PortForwardConfig } from './port-forward';

export type SshAuthType = 'password' | 'key';

export interface SshSessionConfig {
  host: string;
  port: number;
  username: string;
  authType: SshAuthType;
  password?: string;
  privateKeyId?: string;
  portForwards?: PortForwardConfig[];
}

export type SshSessionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';
