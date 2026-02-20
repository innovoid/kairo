import { createHash, pbkdf2Sync, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { keyQueries } from '../db';
import { keyManager } from './key-manager';
import { logger } from '../lib/logger';

const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 32;
const SALT_LENGTH = 32;

/**
 * Derives an encryption key from a passphrase using PBKDF2
 */
function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return pbkdf2Sync(passphrase, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
}

/**
 * Creates a verification hash for a passphrase (to verify without storing the passphrase)
 */
function createVerificationHash(passphrase: string, salt: Buffer): string {
  const key = deriveKey(passphrase, salt);
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Encrypts data using AES-256-GCM
 */
function encrypt(data: string, key: Buffer): { encrypted: string; iv: string; authTag: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encrypted: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

/**
 * Decrypts data using AES-256-GCM
 */
function decrypt(encrypted: string, iv: string, authTag: string, key: Buffer): string {
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

export const workspaceEncryption = {
  /**
   * Initialize encryption for a workspace (first time setup)
   * Returns the salt to be stored in the database
   */
  async initializeWorkspace(
    supabase: SupabaseClient,
    workspaceId: string,
    passphrase: string,
  ): Promise<void> {
    // Generate a random salt for this workspace
    const salt = randomBytes(SALT_LENGTH);
    const saltBase64 = salt.toString('base64');

    // Create verification hash
    const verificationHash = createVerificationHash(passphrase, salt);

    // Store salt and verification hash in database
    const { error } = await supabase.rpc('init_workspace_encryption', {
      p_workspace_id: workspaceId,
      p_salt: saltBase64,
      p_verification_hash: verificationHash,
    });

    if (error) throw new Error(`Failed to initialize workspace encryption: ${error.message}`);
  },

  /**
   * Verify a passphrase against the stored verification hash
   */
  async verifyPassphrase(
    supabase: SupabaseClient,
    workspaceId: string,
    passphrase: string,
  ): Promise<boolean> {
    const { data, error } = await supabase
      .from('workspace_encryption')
      .select('salt, verification_hash')
      .eq('workspace_id', workspaceId)
      .single();

    if (error || !data) return false;

    const salt = Buffer.from(data.salt, 'base64');
    const computedHash = createVerificationHash(passphrase, salt);

    return computedHash === data.verification_hash;
  },

  /**
   * Check if workspace has encryption initialized
   */
  async isInitialized(supabase: SupabaseClient, workspaceId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('workspace_encryption')
      .select('workspace_id')
      .eq('workspace_id', workspaceId)
      .single();

    return !error && !!data;
  },

  /**
   * Encrypt and upload a private key to Supabase Storage
   */
  async syncKeyToCloud(
    supabase: SupabaseClient,
    workspaceId: string,
    keyId: string,
    passphrase: string,
  ): Promise<void> {
    // Check if encryption is initialized
    const initialized = await this.isInitialized(supabase, workspaceId);
    if (!initialized) {
      await this.initializeWorkspace(supabase, workspaceId, passphrase);
    } else {
      // Verify passphrase
      const valid = await this.verifyPassphrase(supabase, workspaceId, passphrase);
      if (!valid) throw new Error('Invalid workspace passphrase');
    }

    // Get private key from local storage and decrypt via keyManager
    const privateKeyData = await keyManager.getDecryptedKey(keyId);
    if (!privateKeyData) throw new Error('Private key not found in local storage');

    // Get workspace salt
    const { data: encData, error: encError } = await supabase
      .from('workspace_encryption')
      .select('salt')
      .eq('workspace_id', workspaceId)
      .single();

    if (encError || !encData) throw new Error('Workspace encryption not initialized');

    // Derive encryption key from workspace passphrase
    const salt = Buffer.from(encData.salt, 'base64');
    const encryptionKey = deriveKey(passphrase, salt);

    // Encrypt with workspace passphrase
    const { encrypted, iv, authTag } = encrypt(privateKeyData, encryptionKey);

    // Create encrypted payload
    const payload = JSON.stringify({ encrypted, iv, authTag });

    // Upload to Supabase Storage
    const storagePath = `${workspaceId}/${keyId}.enc`;
    const { error: uploadError } = await supabase.storage
      .from('encrypted-keys')
      .upload(storagePath, payload, {
        contentType: 'application/octet-stream',
        upsert: true,
      });

    if (uploadError) throw new Error(`Failed to upload encrypted key: ${uploadError.message}`);

    // Update key metadata to mark as synced
    keyQueries.upsert({
      ...keyQueries.getById(keyId)!,
      has_encrypted_sync: 1,
      synced_at: Date.now(),
    });

    // Sync metadata to Supabase
    const keyMetadata = keyQueries.getById(keyId);
    if (keyMetadata) {
      await supabase.from('ssh_keys').upsert({
        id: keyMetadata.id,
        workspace_id: keyMetadata.workspace_id,
        name: keyMetadata.name,
        key_type: keyMetadata.key_type,
        public_key: keyMetadata.public_key,
        fingerprint: keyMetadata.fingerprint,
        has_encrypted_sync: true,
      });
    }
  },

  /**
   * Download and decrypt a key from Supabase Storage
   */
  async downloadKeyFromCloud(
    supabase: SupabaseClient,
    workspaceId: string,
    keyId: string,
    passphrase: string,
  ): Promise<string> {
    // Verify passphrase
    const valid = await this.verifyPassphrase(supabase, workspaceId, passphrase);
    if (!valid) throw new Error('Invalid workspace passphrase');

    // Download from Supabase Storage
    const storagePath = `${workspaceId}/${keyId}.enc`;
    const { data: blob, error: downloadError } = await supabase.storage
      .from('encrypted-keys')
      .download(storagePath);

    if (downloadError) throw new Error(`Failed to download encrypted key: ${downloadError.message}`);

    // Parse encrypted payload
    const payloadText = await blob.text();
    const { encrypted, iv, authTag } = JSON.parse(payloadText);

    // Get workspace salt
    const { data: encData, error: encError } = await supabase
      .from('workspace_encryption')
      .select('salt')
      .eq('workspace_id', workspaceId)
      .single();

    if (encError || !encData) throw new Error('Workspace encryption not initialized');

    // Derive decryption key from workspace passphrase
    const salt = Buffer.from(encData.salt, 'base64');
    const decryptionKey = deriveKey(passphrase, salt);

    // Decrypt
    return decrypt(encrypted, iv, authTag, decryptionKey);
  },

  /**
   * Delete encrypted key from cloud
   */
  async deleteKeyFromCloud(
    supabase: SupabaseClient,
    workspaceId: string,
    keyId: string,
  ): Promise<void> {
    const storagePath = `${workspaceId}/${keyId}.enc`;
    const { error } = await supabase.storage.from('encrypted-keys').remove([storagePath]);

    if (error) logger.error('Failed to delete encrypted key from cloud:', error);
  },

  /**
   * Change workspace passphrase (re-encrypt all keys)
   */
  async changePassphrase(
    supabase: SupabaseClient,
    workspaceId: string,
    oldPassphrase: string,
    newPassphrase: string,
  ): Promise<void> {
    // Verify old passphrase
    const valid = await this.verifyPassphrase(supabase, workspaceId, oldPassphrase);
    if (!valid) throw new Error('Invalid current passphrase');

    // Get all keys with encrypted sync
    const keys = keyQueries
      .listByWorkspace(workspaceId)
      .filter((k) => k.has_encrypted_sync === 1);

    if (keys.length === 0) {
      // Just update the verification hash
      const salt = randomBytes(SALT_LENGTH);
      const saltBase64 = salt.toString('base64');
      const verificationHash = createVerificationHash(newPassphrase, salt);

      await supabase
        .from('workspace_encryption')
        .update({
          salt: saltBase64,
          verification_hash: verificationHash,
          updated_at: new Date().toISOString(),
        })
        .eq('workspace_id', workspaceId);

      return;
    }

    // Download, decrypt with old passphrase, re-encrypt with new passphrase
    for (const key of keys) {
      try {
        // Download and decrypt with old passphrase
        const privateKeyData = await this.downloadKeyFromCloud(
          supabase,
          workspaceId,
          key.id,
          oldPassphrase,
        );

        // Mark as not synced temporarily
        keyQueries.upsert({ ...key, has_encrypted_sync: 0 });

        // Re-initialize with new passphrase (generates new salt)
        const newSalt = randomBytes(SALT_LENGTH);
        const newSaltBase64 = newSalt.toString('base64');
        const newVerificationHash = createVerificationHash(newPassphrase, newSalt);

        await supabase
          .from('workspace_encryption')
          .update({
            salt: newSaltBase64,
            verification_hash: newVerificationHash,
            updated_at: new Date().toISOString(),
          })
          .eq('workspace_id', workspaceId);

        // Store decrypted key temporarily in local storage, then re-sync
        // (This ensures we use the new passphrase for encryption)
        await this.syncKeyToCloud(supabase, workspaceId, key.id, newPassphrase);
      } catch (error) {
        logger.error(`Failed to re-encrypt key ${key.id}:`, error);
        throw error;
      }
    }
  },
};
