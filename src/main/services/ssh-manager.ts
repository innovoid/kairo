import ssh2 from 'ssh2';
import type { WebContents } from 'electron';
import type { SshSessionConfig } from '../../shared/types/ssh';
import { privateKeyQueries } from '../db';
import { keyManager } from './key-manager';

const { Client } = ssh2;
type ConnectConfig = ssh2.ConnectConfig;
type ClientChannel = ssh2.ClientChannel;

interface Session {
  client: ssh2.Client;
  shell: ssh2.ClientChannel | null;
  hostId: string;
}

const sessions = new Map<string, Session>();

export const sshManager = {
  async connect(
    sessionId: string,
    config: SshSessionConfig & { hostId: string },
    sender: WebContents
  ): Promise<void> {
    // Disconnect existing session with same id
    sshManager.disconnect(sessionId);

    const client = new Client();
    sessions.set(sessionId, { client, shell: null, hostId: config.hostId });

    const connectConfig: ConnectConfig = {
      host: config.host,
      port: config.port,
      username: config.username,
      keepaliveInterval: 10000,
      readyTimeout: 20000,
    };

    if (config.authType === 'password' && config.password) {
      connectConfig.password = config.password;
    } else if (config.authType === 'key' && config.privateKeyId) {
      const decrypted = await keyManager.getDecryptedKey(config.privateKeyId);
      if (!decrypted) {
        sender.send('ssh:error', sessionId, 'Private key not found for this host');
        sessions.delete(sessionId);
        return;
      }
      connectConfig.privateKey = decrypted;
    }

    client.on('ready', () => {
      client.shell({ term: 'xterm-256color' }, (err, stream) => {
        if (err) {
          sender.send('ssh:error', sessionId, err.message);
          sessions.delete(sessionId);
          return;
        }

        const session = sessions.get(sessionId);
        if (session) session.shell = stream;

        stream.on('data', (data: Buffer) => {
          if (!sender.isDestroyed()) {
            sender.send('ssh:data', sessionId, data.toString('utf8'));
          }
        });

        stream.stderr.on('data', (data: Buffer) => {
          if (!sender.isDestroyed()) {
            sender.send('ssh:data', sessionId, data.toString('utf8'));
          }
        });

        stream.on('close', () => {
          sessions.delete(sessionId);
          if (!sender.isDestroyed()) {
            sender.send('ssh:closed', sessionId);
          }
        });

        sender.send('ssh:data', sessionId, '\r\nConnected.\r\n');
      });
    });

    client.on('error', (err) => {
      sessions.delete(sessionId);
      if (!sender.isDestroyed()) {
        sender.send('ssh:error', sessionId, err.message);
      }
    });

    client.on('close', () => {
      sessions.delete(sessionId);
      if (!sender.isDestroyed()) {
        sender.send('ssh:closed', sessionId);
      }
    });

    client.connect(connectConfig);
  },

  disconnect(sessionId: string): void {
    const session = sessions.get(sessionId);
    if (session) {
      try {
        session.shell?.close();
        session.client.end();
      } catch {
        // ignore
      }
      sessions.delete(sessionId);
    }
  },

  send(sessionId: string, data: string): void {
    const session = sessions.get(sessionId);
    session?.shell?.write(data);
  },

  resize(sessionId: string, cols: number, rows: number): void {
    const session = sessions.get(sessionId);
    session?.shell?.setWindow(rows, cols, 0, 0);
  },

  getSftpClient(sessionId: string): Client | undefined {
    return sessions.get(sessionId)?.client;
  },

  disconnectAll(): void {
    for (const [id] of sessions) {
      sshManager.disconnect(id);
    }
  },
};
