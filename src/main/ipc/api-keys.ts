import type { IpcMainInvokeEvent } from 'electron';
import { apiKeyStore } from '../services/api-key-store';

export const apiKeysIpcHandlers = {
  get(_event: IpcMainInvokeEvent, provider: string): string | null {
    return apiKeyStore.get(provider);
  },
  set(_event: IpcMainInvokeEvent, provider: string, key: string): void {
    apiKeyStore.set(provider, key);
  },
  delete(_event: IpcMainInvokeEvent, provider: string): void {
    apiKeyStore.delete(provider);
  },
};
