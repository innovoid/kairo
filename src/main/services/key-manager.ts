import { createDecipheriv, createCipheriv, randomBytes, createHash, pbkdf2Sync } from 'node:crypto';
import ssh2 from 'ssh2';
import type Database from 'better-sqlite3';
import { keyQueries, privateKeyQueries, getDb } from '../db';
import type { DbPrivateKey } from '../db';
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

const PBKDF2_ITERATIONS = 100_000;
const KEY_LENGTH = 32;
const SALT_LENGTH = 32;

// In-memory cache so getMasterSecret() only hits the DB once per app session.
let _cachedMasterSecret: Buffer | null = null;

/**
 * Returns a stable, per-device master secret used as the PBKDF2 input.
 *
 * On first call, generates a random 32-byte secret, encrypts it with Electron's
 * safeStorage (OS keychain / DPAPI / libsecret), and persists the encrypted blob
 * in the `app_secrets` SQLite table. On subsequent calls, retrieves the encrypted
 * blob and decrypts it — `safeStorage.decryptString` IS deterministic, unlike
 * `encryptString` which produces different ciphertext each time.
 *
 * When safeStorage is unavailable (non-Electron contexts or Linux without a secret
 * service), a random key is persisted in plaintext. This is weaker than the
 * safeStorage path but still unique per device.
 *
 * @param db - Injected DB instance to avoid re-entrant getDb() calls during migration.
 */
function getMasterSecret(db: Database.Database): Buffer {
  if (_cachedMasterSecret) return _cachedMasterSecret;

  const ROW_KEY = 'master_key_v1';
  const ROW_KEY_PLAIN = 'master_key_v1_plain';

  try {
    // Lazy import: safeStorage is only available in Electron main process
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { safeStorage } = require('electron') as typeof import('electron');

    if (safeStorage.isEncryptionAvailable()) {
      const row = db
        .prepare('select value from app_secrets where key = ?')
        .get(ROW_KEY) as { value: string } | undefined;

      if (row) {
        // Decrypt the persisted master key — deterministic operation
        const masterKeyB64 = safeStorage.decryptString(Buffer.from(row.value, 'base64'));
        _cachedMasterSecret = Buffer.from(masterKeyB64, 'base64');
        return _cachedMasterSecret;
      }

      // First run: generate and persist the master key
      const masterKey = randomBytes(KEY_LENGTH);
      const encryptedBlob = safeStorage.encryptString(masterKey.toString('base64'));
      db.prepare('insert into app_secrets (key, value) values (?, ?)').run(
        ROW_KEY,
        encryptedBlob.toString('base64'),
      );
      _cachedMasterSecret = masterKey;
      return _cachedMasterSecret;
    }
  } catch {
    // safeStorage unavailable (tests, headless, no secret service) — fall through
  }

  // Fallback: persist a random key in plaintext. Weaker than safeStorage but
  // still unique per device, unlike the old static hostname-based approach.
  const plainRow = db
    .prepare('select value from app_secrets where key = ?')
    .get(ROW_KEY_PLAIN) as { value: string } | undefined;

  if (plainRow) {
    _cachedMasterSecret = Buffer.from(plainRow.value, 'base64');
    return _cachedMasterSecret;
  }

  const masterKey = randomBytes(KEY_LENGTH);
  db.prepare('insert into app_secrets (key, value) values (?, ?)').run(
    ROW_KEY_PLAIN,
    masterKey.toString('base64'),
  );
  _cachedMasterSecret = masterKey;
  return _cachedMasterSecret;
}

/**
 * Derives an AES-256-GCM key from a stable master secret + per-key random salt.
 * NOTE: pbkdf2Sync blocks the main thread (~50ms at 100k iterations). This is
 * acceptable since key operations are infrequent (import/decrypt, not per-request).
 */
function deriveEncryptionKey(salt: Buffer, db?: Database.Database): Buffer {
  const dbInstance = db ?? getDb();
  const masterSecret = getMasterSecret(dbInstance);
  return pbkdf2Sync(masterSecret, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
}

/**
 * Returns the legacy hardcoded key buffer for backward compatibility with
 * keys that were encrypted before the safeStorage migration (salt IS NULL).
 */
function getLegacyKey(): Buffer {
  const keyBuf = Buffer.alloc(32);
  Buffer.from('archterm-v1-secret-key-padding!!').copy(keyBuf);
  return keyBuf;
}

function encryptPrivateKey(keyData: string): { encrypted_blob: string; iv: string; auth_tag: string; salt: string } {
  const salt = randomBytes(32);
  const keyBuf = deriveEncryptionKey(salt);

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyBuf, iv);
  const encrypted = Buffer.concat([cipher.update(keyData, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encrypted_blob: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    auth_tag: authTag.toString('base64'),
    salt: salt.toString('base64'),
  };
}

function decryptPrivateKey(
  encrypted_blob: string,
  iv: string,
  auth_tag: string,
  saltBase64?: string | null,
): string {
  let keyBuf: Buffer;
  if (saltBase64) {
    // New scheme: derive key from safeStorage + salt
    keyBuf = deriveEncryptionKey(Buffer.from(saltBase64, 'base64'));
  } else {
    // Legacy fallback: use the old hardcoded key
    keyBuf = getLegacyKey();
  }

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
    const { encrypted_blob, iv, auth_tag, salt } = encryptPrivateKey(pemOrOpenSsh);
    privateKeyQueries.upsert({ key_id: id, encrypted_blob, iv, auth_tag, salt });

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
    return decryptPrivateKey(pk.encrypted_blob, pk.iv, pk.auth_tag, pk.salt);
  },
};

/**
 * Migrates legacy private keys (encrypted with the old hardcoded key) to the
 * new safeStorage-backed PBKDF2 scheme. Idempotent: only processes keys where
 * salt IS NULL. Safe to call multiple times.
 *
 * Accepts the already-initialized `db` instance to avoid re-entrant getDb()
 * calls when invoked during database initialization.
 */
export function migratePrivateKeys(db: Database.Database): void {

  const legacyKeys = db
    .prepare('select * from private_keys where salt is null')
    .all() as DbPrivateKey[];

  if (legacyKeys.length === 0) return;

  const updateStmt = db.prepare(
    'update private_keys set encrypted_blob = @encrypted_blob, iv = @iv, auth_tag = @auth_tag, salt = @salt where key_id = @key_id',
  );

  const migrateAll = db.transaction(() => {
    for (const pk of legacyKeys) {
      try {
        // Decrypt with legacy hardcoded key
        const plaintext = decryptPrivateKey(pk.encrypted_blob, pk.iv, pk.auth_tag, null);

        // Re-encrypt with new safeStorage-backed scheme
        const { encrypted_blob, iv, auth_tag, salt } = encryptPrivateKey(plaintext);

        updateStmt.run({
          key_id: pk.key_id,
          encrypted_blob,
          iv,
          auth_tag,
          salt,
        });
      } catch (err) {
        console.error(`Failed to migrate private key ${pk.key_id}:`, err);
        // Skip this key — it will remain as legacy and be retried next time
      }
    }
  });

  migrateAll();
}
