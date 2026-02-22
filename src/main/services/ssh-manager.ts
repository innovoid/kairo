import ssh2 from 'ssh2';
import type { WebContents } from 'electron';
import type { SshSessionConfig } from '../../shared/types/ssh';
import { privateKeyQueries } from '../db';
import { keyManager } from './key-manager';
import { recordingManager } from './recording-manager';
import { sessionEventBus } from './session-event-bus';

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
          const dataStr = data.toString('utf8');
          sessionEventBus.emitData(sessionId, dataStr);
          if (!sender.isDestroyed()) {
            sender.send('ssh:data', sessionId, dataStr);
          }
          if (recordingManager.isRecording(sessionId)) {
            recordingManager.appendData(sessionId, dataStr);
          }
        });

        stream.stderr.on('data', (data: Buffer) => {
          const dataStr = data.toString('utf8');
          sessionEventBus.emitData(sessionId, dataStr);
          if (!sender.isDestroyed()) {
            sender.send('ssh:data', sessionId, dataStr);
          }
          if (recordingManager.isRecording(sessionId)) {
            recordingManager.appendData(sessionId, dataStr);
          }
        });

        stream.on('close', () => {
          sessions.delete(sessionId);
          sessionEventBus.emitClosed(sessionId);
          if (!sender.isDestroyed()) {
            sender.send('ssh:closed', sessionId);
          }
        });

        sender.send('ssh:data', sessionId, '\r\nConnected.\r\n');
      });
    });

    client.on('error', (err) => {
      sessions.delete(sessionId);
      sessionEventBus.emitError(sessionId, err.message);
      if (!sender.isDestroyed()) {
        let userMessage = err.message;
        if (err.message.includes('All configured authentication methods failed')) {
          userMessage = 'Authentication failed. Check your username, password, or SSH key.';
        } else if (err.message.includes('ECONNREFUSED')) {
          userMessage = `Connection refused by ${config.host}:${config.port}. Is the SSH server running?`;
        } else if (err.message.includes('ETIMEDOUT') || err.message.includes('Timed out')) {
          userMessage = `Connection timed out to ${config.host}:${config.port}. Check the hostname and your network.`;
        } else if (err.message.includes('ENOTFOUND') || err.message.includes('getaddrinfo')) {
          userMessage = `Host not found: ${config.host}. Check the hostname or DNS.`;
        } else if (err.message.includes('EHOSTUNREACH')) {
          userMessage = `Host unreachable: ${config.host}. Check your network connection.`;
        }
        sender.send('ssh:error', sessionId, userMessage);
      }
    });

    client.on('close', () => {
      sessions.delete(sessionId);
      sessionEventBus.emitClosed(sessionId);
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

  has(sessionId: string): boolean {
    return sessions.has(sessionId);
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
