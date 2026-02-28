import ssh2 from 'ssh2';
import type { WebContents } from 'electron';
import type { SshSessionConfig } from '../../shared/types/ssh';
import { privateKeyQueries } from '../db';
import { keyManager } from './key-manager';
import { recordingManager } from './recording-manager';
import { sessionEventBus } from './session-event-bus';
import { clearAgentVisibilitySession, filterAgentArtifactsForRenderer } from './agent-command-visibility';
import { clearSftpCache } from './sftp-manager';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { readFileSync, writeFileSync, existsSync, appendFileSync, mkdirSync } from 'node:fs';
import crypto from 'node:crypto';
import net from 'node:net';
import SSHConfig from 'ssh-config';
import { dialog } from 'electron';
import { logger } from '../lib/logger';

const { Client } = ssh2;
type ConnectConfig = ssh2.ConnectConfig;
type ClientChannel = ssh2.ClientChannel;

interface Session {
  client: ssh2.Client;
  shell: ssh2.ClientChannel | null;
  hostId: string;
  portForwardServers?: net.Server[];
}

const sessions = new Map<string, Session>();

function getKnownHostsPath() {
  const sshDir = join(homedir(), '.ssh');
  if (!existsSync(sshDir)) mkdirSync(sshDir, { recursive: true, mode: 0o700 });
  return join(sshDir, 'known_hosts');
}

function verifyHostKey(
  host: string,
  keyBuffer: Buffer,
  sessionId: string,
  sender: WebContents,
  callback: (accept: boolean) => void
): void {
  let keyType = 'ssh-rsa';
  if (keyBuffer.length > 4) {
    const len = keyBuffer.readUInt32BE(0);
    if (keyBuffer.length >= 4 + len) {
      keyType = keyBuffer.toString('utf8', 4, 4 + len);
    }
  }

  const b64Key = keyBuffer.toString('base64');
  const knownHostsPath = getKnownHostsPath();

  if (existsSync(knownHostsPath)) {
    const content = readFileSync(knownHostsPath, 'utf8');
    const lines = content.split('\n');
    for (const line of lines) {
      const parts = line.trim().split(' ');
      if (parts.length >= 3) {
        const lineHosts = parts[0].split(',');
        if (lineHosts.includes(host)) {
          if (parts[2] === b64Key) {
            callback(true);
            return;
          } else {
            sender.send('ssh:error', sessionId, `Host key mismatch for ${host}. The fingerprint does not match known_hosts! Potential MITM attack.`);
            callback(false);
            return;
          }
        }
      }
    }
  }

  const fingerprint = crypto.createHash('sha256').update(keyBuffer).digest('base64');

  dialog.showMessageBox({
    type: 'warning',
    buttons: ['Accept and Connect', 'Cancel'],
    defaultId: 0,
    cancelId: 1,
    title: 'Unknown Host Key',
    message: `The authenticity of host '${host}' can't be established.`,
    detail: `${keyType} key fingerprint is SHA256:${fingerprint}.\nAre you sure you want to continue connecting?`
  }).then(result => {
    if (result.response === 0) {
      appendFileSync(knownHostsPath, `\n${host} ${keyType} ${b64Key}\n`, { mode: 0o644 });
    }
    callback(result.response === 0);
  });
}

export const sshManager = {
  async connect(
    sessionId: string,
    config: SshSessionConfig & { hostId: string },
    sender: WebContents
  ): Promise<void> {
    sshManager.disconnect(sessionId);

    const client = new Client();
    sessions.set(sessionId, { client, shell: null, hostId: config.hostId });

    let finalHost = config.host;
    let finalPort = config.port;
    let finalUser = config.username;
    let proxyClient: ssh2.Client | null = null;
    let identityFile: string | null = null;
    let proxyJumpHost: string | null = null;

    const sshConfigPath = join(homedir(), '.ssh', 'config');
    if (existsSync(sshConfigPath)) {
      try {
        const parsedConfig = SSHConfig.parse(readFileSync(sshConfigPath, 'utf8'));
        const computed = parsedConfig.compute(config.host);
        if (computed.HostName) finalHost = Array.isArray(computed.HostName) ? computed.HostName[0] : computed.HostName;
        if (computed.Port) finalPort = parseInt(Array.isArray(computed.Port) ? computed.Port[0] : computed.Port, 10);
        if (computed.User) finalUser = Array.isArray(computed.User) ? computed.User[0] : computed.User;
        if (computed.IdentityFile) {
          const files = Array.isArray(computed.IdentityFile) ? computed.IdentityFile : [computed.IdentityFile];
          if (files.length > 0) {
            identityFile = files[0];
            if (identityFile.startsWith('~/')) {
              identityFile = join(homedir(), identityFile.slice(2));
            }
          }
        }
        if (computed.ProxyJump) proxyJumpHost = Array.isArray(computed.ProxyJump) ? computed.ProxyJump[0] : computed.ProxyJump;
      } catch (e) {
        logger.warn('Failed to parse ~/.ssh/config:', e);
        sender.send('ssh:data', sessionId, '\r\n\x1b[33m⚠ Warning: could not parse ~/.ssh/config — using direct connection\x1b[0m\r\n');
      }
    }

    const connectConfig: ConnectConfig = {
      host: finalHost,
      port: finalPort,
      username: finalUser,
      keepaliveInterval: 10000,   // Send keepalive every 10 s
      keepaliveCountMax: 5,        // Tolerate up to 5 missed keepalives (~50 s) before dropping
      readyTimeout: 20000,
      hostVerifier: (keyHash: Buffer, callback: (accept: boolean) => void) => {
        verifyHostKey(finalHost, keyHash, sessionId, sender, callback);
      }
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
    } else if (identityFile && existsSync(identityFile)) {
      try { connectConfig.privateKey = readFileSync(identityFile); } catch(e) {}
    } else if (process.env.SSH_AUTH_SOCK) {
      connectConfig.agent = process.env.SSH_AUTH_SOCK;
    }

    const setupClientEvents = (sshClient: ssh2.Client, isProxy: boolean) => {
      sshClient.on('error', (err) => {
        if (!isProxy) {
          sessions.delete(sessionId);
          clearAgentVisibilitySession(sessionId);
          sessionEventBus.emitError(sessionId, err.message);
        }
        if (!sender.isDestroyed()) {
          let userMessage = err.message;
          if (err.message.includes('All configured authentication methods failed')) {
            userMessage = 'Authentication failed. Check your username, password, or SSH key.';
          } else if (err.message.includes('ECONNREFUSED')) {
            userMessage = `Connection refused by ${isProxy ? proxyJumpHost : finalHost}. Is the SSH server running?`;
          } else if (err.message.includes('ETIMEDOUT') || err.message.includes('Timed out')) {
            userMessage = `Connection timed out to ${isProxy ? proxyJumpHost : finalHost}. Check the hostname and your network.`;
          } else if (err.message.includes('ENOTFOUND') || err.message.includes('getaddrinfo')) {
            userMessage = `Host not found: ${isProxy ? proxyJumpHost : finalHost}. Check the hostname or DNS.`;
          } else if (err.message.includes('EHOSTUNREACH')) {
            userMessage = `Host unreachable: ${isProxy ? proxyJumpHost : finalHost}. Check your network connection.`;
          }
          sender.send('ssh:error', sessionId, userMessage);
        }
      });

      sshClient.on('close', () => {
        if (!isProxy) {
          sessions.delete(sessionId);
          clearAgentVisibilitySession(sessionId);
          sessionEventBus.emitClosed(sessionId);
          if (!sender.isDestroyed()) {
            sender.send('ssh:closed', sessionId);
          }
        }
      });
    };

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
          const rendererData = filterAgentArtifactsForRenderer(sessionId, dataStr);
          if (!sender.isDestroyed() && rendererData) {
            sender.send('ssh:data', sessionId, rendererData);
          }
          if (recordingManager.isRecording(sessionId)) {
            recordingManager.appendData(sessionId, dataStr);
          }
        });

        stream.stderr.on('data', (data: Buffer) => {
          const dataStr = data.toString('utf8');
          sessionEventBus.emitData(sessionId, dataStr);
          const rendererData = filterAgentArtifactsForRenderer(sessionId, dataStr);
          if (!sender.isDestroyed() && rendererData) {
            sender.send('ssh:data', sessionId, rendererData);
          }
          if (recordingManager.isRecording(sessionId)) {
            recordingManager.appendData(sessionId, dataStr);
          }
        });

        stream.on('close', () => {
          sessions.delete(sessionId);
          clearAgentVisibilitySession(sessionId);
          sessionEventBus.emitClosed(sessionId);
          if (!sender.isDestroyed()) {
            sender.send('ssh:closed', sessionId);
          }
        });

        sender.send('ssh:data', sessionId, '\r\nConnected.\r\n');

        if (config.portForwards && session) {
          session.portForwardServers = [];
          
          client.on('tcp connection', (details, accept, reject) => {
            const pf = config.portForwards?.find(p => p.type === 'remote' && p.remotePort === details.destPort);
            if (!pf) {
              reject();
              return;
            }
            const socket = net.connect(pf.localPort, '127.0.0.1', () => {
              const stream = accept();
              socket.pipe(stream).pipe(socket);
            });
            socket.on('error', () => reject());
          });

          for (const pf of config.portForwards) {
            try {
              if (pf.type === 'local') {
                const server = net.createServer((socket) => {
                  client.forwardOut('127.0.0.1', pf.localPort, pf.remoteHost, pf.remotePort, (err, stream) => {
                    if (err) {
                      socket.end();
                      return;
                    }
                    socket.pipe(stream).pipe(socket);
                    stream.on('error', () => socket.destroy());
                    socket.on('error', () => stream.destroy());
                  });
                });
                server.listen(pf.localPort, '127.0.0.1');
                (server as any).on('error', (err: any) => {
                  if (!sender.isDestroyed()) {
                    sender.send('ssh:data', sessionId, `\r\n\x1b[31mFailed to start local port forwarding on ${pf.localPort}: ${err.message}\x1b[0m\r\n`);
                  }
                });
                session.portForwardServers.push(server);
              } else if (pf.type === 'remote') {
                client.forwardIn('0.0.0.0', pf.remotePort, (err) => {
                  if (err && !sender.isDestroyed()) {
                    sender.send('ssh:data', sessionId, `\r\n\x1b[31mFailed to start remote port forwarding on ${pf.remotePort}: ${err.message}\x1b[0m\r\n`);
                  }
                });
              }
            } catch (e: any) {
              if (!sender.isDestroyed()) {
                sender.send('ssh:data', sessionId, `\r\n\x1b[31mPort forwarding error: ${e.message}\x1b[0m\r\n`);
              }
            }
          }
        }
      });
    });

    setupClientEvents(client, false);

    if (proxyJumpHost) {
      // Basic ProxyJump (e.g., user@host:port)
      const proxyParts = proxyJumpHost.split('@');
      let pUser = finalUser;
      let pHostAndPort = proxyJumpHost;
      if (proxyParts.length > 1) {
        pUser = proxyParts[0];
        pHostAndPort = proxyParts[1];
      }
      const hostPortParts = pHostAndPort.split(':');
      const pHost = hostPortParts[0];
      const pPort = hostPortParts.length > 1 ? parseInt(hostPortParts[1], 10) : 22;

      const jumpConfig: ConnectConfig = {
        host: pHost,
        port: pPort,
        username: pUser,
        agent: process.env.SSH_AUTH_SOCK,
        hostVerifier: (keyHash: Buffer, callback: (accept: boolean) => void) => {
          verifyHostKey(pHost, keyHash, sessionId + '-jump', sender, callback);
        }
      };
      
      proxyClient = new Client();
      setupClientEvents(proxyClient, true);
      proxyClient.on('ready', () => {
        proxyClient!.forwardOut(
          '127.0.0.1', 0,
          finalHost, finalPort,
          (err, stream) => {
            if (err) {
              sender.send('ssh:error', sessionId, `ProxyJump failed: ${err.message}`);
              return;
            }
            connectConfig.sock = stream;
            client.connect(connectConfig);
          }
        );
      });
      proxyClient.connect(jumpConfig);
    } else {
      client.connect(connectConfig);
    }
  },

  disconnect(sessionId: string): void {
    const session = sessions.get(sessionId);
    if (session) {
      try {
        if (session.portForwardServers) {
          for (const server of session.portForwardServers) {
            try { (server as any).close(); } catch {}
          }
        }
        session.shell?.close();
        session.client.end();
      } catch {
        // ignore
      }
      sessions.delete(sessionId);
      clearAgentVisibilitySession(sessionId);
      clearSftpCache(sessionId);
    }
  },

  send(sessionId: string, data: string): void {
    const session = sessions.get(sessionId);
    if (!session) return;
    // Ctrl+C (ETX, 0x03) — signal any in-flight agent command to abort immediately.
    if (data.includes('\x03')) {
      sessionEventBus.emitInterrupted(sessionId);
    }
    session.shell?.write(data);
  },

  resize(sessionId: string, cols: number, rows: number): void {
    const session = sessions.get(sessionId);
    session?.shell?.setWindow(rows, cols, 0, 0);
  },

  has(sessionId: string): boolean {
    return sessions.has(sessionId);
  },

  getSftpClient(sessionId: string): ssh2.Client | undefined {
    return sessions.get(sessionId)?.client;
  },

  disconnectAll(): void {
    for (const [id] of sessions) {
      sshManager.disconnect(id);
    }
  },
};