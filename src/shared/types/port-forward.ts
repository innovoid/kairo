export type PortForwardType = 'local' | 'remote';

export interface PortForwardConfig {
  id: string;
  type: PortForwardType;
  localPort: number;
  remoteHost: string;
  remotePort: number;
}
