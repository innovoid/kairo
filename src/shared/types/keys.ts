export type KeyType = 'rsa' | 'ed25519' | 'ecdsa' | 'other';

export interface SshKey {
  id: string;
  workspaceId: string;
  name: string;
  keyType: KeyType;
  publicKey: string;
  fingerprint: string;
  hasEncryptedSync: boolean;
  createdAt: string;
}

export interface ImportKeyInput {
  workspaceId: string;
  name: string;
  pemOrOpenSsh: string;
  passphrase?: string;
}
