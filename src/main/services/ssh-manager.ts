import ssh2 from 'ssh2';
import type { WebContents } from 'electron';
import type { SshSessionConfig } from '../../shared/types/ssh';
import type { KnownHostEntry } from '../../shared/types/known-hosts';
import type { HostKeyEvent } from '../../shared/types/host-key-events';
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

function getHostKeyEventsPath() {
  const sshDir = join(homedir(), '.ssh');
  if (!existsSync(sshDir)) mkdirSync(sshDir, { recursive: true, mode: 0o700 });
  return join(sshDir, 'archterm-host-key-events.json');
}

function getKnownHostsCandidates(host: string, port: number): string[] {
  const normalizedHost = host.trim();
  const candidates = new Set<string>([normalizedHost]);
  candidates.add(`[${normalizedHost}]:${port}`);
  return Array.from(candidates);
}

function matchesHashedKnownHost(token: string, candidate: string): boolean {
  const parts = token.split('|');
  if (parts.length !== 4 || parts[1] !== '1') return false;

  const salt = Buffer.from(parts[2], 'base64');
  const expectedDigest = Buffer.from(parts[3], 'base64').toString('base64');
  const actualDigest = crypto.createHmac('sha1', salt).update(candidate).digest('base64');
  return actualDigest === expectedDigest;
}

function matchesKnownHostToken(token: string, candidates: string[]): boolean {
  const trimmedToken = token.trim();
  if (!trimmedToken || trimmedToken.startsWith('!')) return false;

  if (trimmedToken.startsWith('|1|')) {
    return candidates.some((candidate) => matchesHashedKnownHost(trimmedToken, candidate));
  }

  return candidates.includes(trimmedToken);
}

function appendKnownHostEntry(path: string, hostIdentifier: string, keyType: string, key: string): void {
  const existing = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const prefix = existing.length > 0 && !existing.endsWith('\n') ? '\n' : '';
  appendFileSync(path, `${prefix}${hostIdentifier} ${keyType} ${key}\n`, { mode: 0o644 });
}

function safeFingerprint(base64Key: string): string {
  try {
    const decoded = Buffer.from(base64Key, 'base64');
    if (decoded.length === 0) return 'SHA256:invalid';
    return `SHA256:${crypto.createHash('sha256').update(decoded).digest('base64')}`;
  } catch {
    return 'SHA256:invalid';
  }
}

function knownHostEntryId(lineNumber: number, hostPattern: string, keyType: string, key: string): string {
  return crypto
    .createHash('sha256')
    .update(`${lineNumber}:${hostPattern}:${keyType}:${key}`)
    .digest('hex')
    .slice(0, 20);
}

function parseKnownHostLine(line: string): { hosts: string[]; keyType: string; key: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const parts = trimmed.split(/\s+/);
  if (parts.length < 3) return null;
  return { hosts: parts[0].split(','), keyType: parts[1], key: parts[2] };
}

function loadHostKeyEvents(): HostKeyEvent[] {
  const path = getHostKeyEventsPath();
  if (!existsSync(path)) return [];
  try {
    const raw = readFileSync(path, 'utf8').trim();
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is HostKeyEvent => (
      typeof item === 'object'
      && item !== null
      && typeof (item as HostKeyEvent).id === 'string'
      && typeof (item as HostKeyEvent).timestamp === 'string'
      && typeof (item as HostKeyEvent).displayHost === 'string'
    ));
  } catch {
    return [];
  }
}

function saveHostKeyEvents(events: HostKeyEvent[]): void {
  const path = getHostKeyEventsPath();
  writeFileSync(path, `${JSON.stringify(events, null, 2)}\n`, { mode: 0o600 });
}

function addHostKeyEvent(event: Omit<HostKeyEvent, 'id' | 'timestamp'>): void {
  const events = loadHostKeyEvents();
  const next: HostKeyEvent = {
    ...event,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };
  const trimmed = [next, ...events].slice(0, 500);
  saveHostKeyEvents(trimmed);
}

function toFingerprintFromKeyBuffer(keyBuffer: Buffer): string {
  return `SHA256:${crypto.createHash('sha256').update(keyBuffer).digest('base64')}`;
}

function listKnownHostEntries(): KnownHostEntry[] {
  const path = getKnownHostsPath();
  if (!existsSync(path)) return [];

  const lines = readFileSync(path, 'utf8').split('\n');
  const entries: KnownHostEntry[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const parsed = parseKnownHostLine(lines[i]);
    if (!parsed) continue;
    const lineNumber = i + 1;
    const fingerprint = safeFingerprint(parsed.key);

    for (const hostPattern of parsed.hosts) {
      const hashed = hostPattern.startsWith('|1|');
      entries.push({
        id: knownHostEntryId(lineNumber, hostPattern, parsed.keyType, parsed.key),
        hostPattern,
        displayHost: hashed ? '(hashed host)' : hostPattern,
        keyType: parsed.keyType,
        fingerprint,
        lineNumber,
        hashed,
      });
    }
  }

  return entries.sort((a, b) => a.displayHost.localeCompare(b.displayHost));
}

function removeKnownHostEntry(entryId: string): boolean {
  const path = getKnownHostsPath();
  if (!existsSync(path)) return false;

  const lines = readFileSync(path, 'utf8').split('\n');
  let changed = false;

  const nextLines = lines.flatMap((line, index) => {
    const parsed = parseKnownHostLine(line);
    if (!parsed) return [line];

    const lineNumber = index + 1;
    const retainedHosts = parsed.hosts.filter((hostPattern) => {
      const id = knownHostEntryId(lineNumber, hostPattern, parsed.keyType, parsed.key);
      const shouldKeep = id !== entryId;
      if (!shouldKeep) changed = true;
      return shouldKeep;
    });

    if (retainedHosts.length === parsed.hosts.length) {
      return [line];
    }

    if (retainedHosts.length === 0) {
      return [];
    }

    const rebuilt = `${retainedHosts.join(',')} ${parsed.keyType} ${parsed.key}`;
    return [rebuilt];
  });

  if (changed) {
    const content = nextLines.join('\n').replace(/\n+$/, '\n');
    writeFileSync(path, content, { mode: 0o644 });
  }

  return changed;
}

function parsePort(value: string | number | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    return fallback;
  }
  return parsed;
}

function verifyHostKey(
  host: string,
  port: number,
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
  const knownHostCandidates = getKnownHostsCandidates(host, port);
  const displayHost = port === 22 ? host : `${host}:${port}`;
  const presentedFingerprint = toFingerprintFromKeyBuffer(keyBuffer);

  if (existsSync(knownHostsPath)) {
    const content = readFileSync(knownHostsPath, 'utf8');
    const lines = content.split('\n');
    let hasMatchingHostEntry = false;
    const matchingKnownFingerprints: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const parts = trimmed.split(/\s+/);
      if (parts.length < 3) continue;

      const lineHosts = parts[0].split(',');
      const hostMatches = lineHosts.some((token) => matchesKnownHostToken(token, knownHostCandidates));
      if (!hostMatches) continue;

      hasMatchingHostEntry = true;
      matchingKnownFingerprints.push(safeFingerprint(parts[2]));
      if (parts[2] === b64Key) {
        callback(true);
        return;
      }
    }

    if (hasMatchingHostEntry) {
      addHostKeyEvent({
        type: 'mismatch_blocked',
        host,
        port,
        displayHost,
        hostCandidates: knownHostCandidates,
        keyType,
        presentedFingerprint,
        knownFingerprints: Array.from(new Set(matchingKnownFingerprints)),
      });
      sender.send(
        'ssh:error',
        sessionId,
        `Host key mismatch for ${displayHost}. The fingerprint does not match known_hosts! Potential MITM attack.`
      );
      callback(false);
      return;
    }
  }

  dialog.showMessageBox({
    type: 'warning',
    buttons: ['Accept and Connect', 'Cancel'],
    defaultId: 0,
    cancelId: 1,
    title: 'Unknown Host Key',
    message: `The authenticity of host '${displayHost}' can't be established.`,
    detail: `${keyType} key fingerprint is ${presentedFingerprint}.\nAre you sure you want to continue connecting?`
  }).then(result => {
    if (result.response === 0) {
      const hostIdentifier = port === 22 ? host : `[${host}]:${port}`;
      appendKnownHostEntry(knownHostsPath, hostIdentifier, keyType, b64Key);
      addHostKeyEvent({
        type: 'unknown_accepted',
        host,
        port,
        displayHost,
        hostCandidates: knownHostCandidates,
        keyType,
        presentedFingerprint,
        knownFingerprints: [],
      });
    } else {
      addHostKeyEvent({
        type: 'unknown_rejected',
        host,
        port,
        displayHost,
        hostCandidates: knownHostCandidates,
        keyType,
        presentedFingerprint,
        knownFingerprints: [],
      });
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
        if (computed.Port) finalPort = parsePort(Array.isArray(computed.Port) ? computed.Port[0] : computed.Port, finalPort);
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
        verifyHostKey(finalHost, finalPort, keyHash, sessionId, sender, callback);
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
      const pPort = hostPortParts.length > 1 ? parsePort(hostPortParts[1], 22) : 22;

      const jumpConfig: ConnectConfig = {
        host: pHost,
        port: pPort,
        username: pUser,
        agent: process.env.SSH_AUTH_SOCK,
        hostVerifier: (keyHash: Buffer, callback: (accept: boolean) => void) => {
          verifyHostKey(pHost, pPort, keyHash, sessionId + '-jump', sender, callback);
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

  listKnownHosts(): KnownHostEntry[] {
    return listKnownHostEntries();
  },

  removeKnownHost(entryId: string): boolean {
    return removeKnownHostEntry(entryId);
  },

  listHostKeyEvents(limit = 100): HostKeyEvent[] {
    return loadHostKeyEvents().slice(0, Math.max(1, Math.min(limit, 500)));
  },

  clearHostKeyEvents(): void {
    saveHostKeyEvents([]);
  },

  disconnectAll(): void {
    for (const [id] of sessions) {
      sshManager.disconnect(id);
    }
  },
};
