import { init } from 'ghostty-web';

let initPromise: Promise<void> | null = null;

export function ensureGhosttyInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = init();
  }
  return initPromise;
}

