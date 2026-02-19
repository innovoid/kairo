import { safeStorage } from 'electron';
import { getDb } from '../db';

// Uses the existing `app_secrets` table (already in the DB schema from Task 1)
// Key format in app_secrets: `api_key:{provider}` → encrypted API key value

export const apiKeyStore = {
  get(provider: string): string | null {
    const db = getDb();
    const row = db.prepare("select value from app_secrets where key = ?")
      .get(`api_key:${provider}`) as { value: string } | undefined;
    if (!row) return null;
    try {
      if (safeStorage.isEncryptionAvailable()) {
        return safeStorage.decryptString(Buffer.from(row.value, 'base64'));
      }
      return row.value; // fallback: stored as plain text
    } catch {
      return null;
    }
  },

  set(provider: string, key: string): void {
    const db = getDb();
    const value = safeStorage.isEncryptionAvailable()
      ? safeStorage.encryptString(key).toString('base64')
      : key;
    db.prepare("insert or replace into app_secrets (key, value) values (?, ?)")
      .run(`api_key:${provider}`, value);
  },

  delete(provider: string): void {
    const db = getDb();
    db.prepare("delete from app_secrets where key = ?").run(`api_key:${provider}`);
  },
};
