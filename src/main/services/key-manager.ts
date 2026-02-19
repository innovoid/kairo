import { createDecipheriv, createCipheriv, randomBytes, createHash } from 'node:crypto';
import ssh2 from 'ssh2';
import { keyQueries, privateKeyQueries } from '../db';
import type { SshKey, ImportKeyInput, KeyType } from '../../shared/types/keys';

const { utils: sshUtils } = ssh2;

function toSshKey(row: ReturnType<typeof keyQueries.getById>): SshKey | null {
  if (!row) return null;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    keyType: row.key_type as KeyType,
    publicKey: row.public_key,
    fingerprint: row.fingerprint,
    hasEncryptedSync: row.has_encrypted_sync === 1,
    createdAt: new Date(row.synced_at ?? Date.now()).toISOString(),
  };
}

function detectKeyType(keyData: string): KeyType {
  if (!keyData) return 'other';
  const lower = keyData.toLowerCase();
  if (lower.includes('ssh-ed25519') || lower.includes('ed25519')) return 'ed25519';
  if (lower.includes('ecdsa')) return 'ecdsa';
  if (lower.includes('rsa')) return 'rsa';
  return 'other';
}

function encryptPrivateKey(keyData: string): { encrypted_blob: string; iv: string; auth_tag: string } {
  const keyBuf = Buffer.alloc(32);
  // Simple deterministic key derived from app secret + machine id approach
  Buffer.from('archterm-v1-secret-key-padding!!').copy(keyBuf);

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyBuf, iv);
  const encrypted = Buffer.concat([cipher.update(keyData, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encrypted_blob: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    auth_tag: authTag.toString('base64'),
  };
}

function decryptPrivateKey(encrypted_blob: string, iv: string, auth_tag: string): string {
  const keyBuf = Buffer.alloc(32);
  Buffer.from('archterm-v1-secret-key-padding!!').copy(keyBuf);

  const ivBuf = Buffer.from(iv, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', keyBuf, ivBuf);
  decipher.setAuthTag(Buffer.from(auth_tag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted_blob, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

function computeFingerprint(keyData: string): string {
  try {
    if (!keyData) return 'unknown';
    // Create a simple hash of the key data
    const hash = createHash('sha256').update(keyData).digest('base64');
    return `SHA256:${hash.replace(/=+$/, '')}`;
  } catch {
    return 'unknown';
  }
}

export const keyManager = {
  list(workspaceId: string): SshKey[] {
    return keyQueries
      .listByWorkspace(workspaceId)
      .map((row) => toSshKey(row))
      .filter((k): k is SshKey => k !== null);
  },

  async import(input: ImportKeyInput): Promise<SshKey> {
    const { workspaceId, name, pemOrOpenSsh, passphrase } = input;

    if (!pemOrOpenSsh || !pemOrOpenSsh.trim()) {
      throw new Error('Private key content is required');
    }

    let parsedKey: ReturnType<typeof sshUtils.parseKey> | null = null;

    try {
      // Try to parse the key with ssh2's parseKey (supports all formats)
      parsedKey = sshUtils.parseKey(pemOrOpenSsh, passphrase);

      if (!parsedKey) {
        throw new Error('Failed to parse private key. Check passphrase if encrypted.');
      }
    } catch (e) {
      throw new Error(`Invalid key format: ${(e as Error).message}`);
    }

    // Extract key type and create a simple public key representation
    const keyType = detectKeyType(pemOrOpenSsh);
    const sshKeyType = parsedKey.type || 'unknown';
    const publicKeyStr = `${sshKeyType} (${keyType.toUpperCase()} key)`;

    const fingerprint = computeFingerprint(pemOrOpenSsh);
    const id = crypto.randomUUID();

    // Store metadata in SQLite
    keyQueries.upsert({
      id,
      workspace_id: workspaceId,
      name,
      key_type: keyType,
      public_key: publicKeyStr,
      fingerprint,
      has_encrypted_sync: 0,
      synced_at: Date.now(),
    });

    // Encrypt and store private key (store original format)
    const { encrypted_blob, iv, auth_tag } = encryptPrivateKey(pemOrOpenSsh);
    privateKeyQueries.upsert({ key_id: id, encrypted_blob, iv, auth_tag });

    return {
      id,
      workspaceId,
      name,
      keyType,
      publicKey: publicKeyStr,
      fingerprint,
      hasEncryptedSync: false,
      createdAt: new Date().toISOString(),
    };
  },

  delete(id: string): void {
    keyQueries.delete(id);
  },

  exportPublic(id: string): string | null {
    const row = keyQueries.getById(id);
    return row?.public_key ?? null;
  },

  async getDecryptedKey(keyId: string): Promise<string | null> {
    const pk = privateKeyQueries.get(keyId);
    if (!pk) return null;
    return decryptPrivateKey(pk.encrypted_blob, pk.iv, pk.auth_tag);
  },
};
