// Cache whether the main process permits E2E mode (only in dev/test builds).
// Resolved once at startup; defaults to false until the IPC call returns.
let e2eAllowed: boolean | null = null;

export async function initE2EGate(): Promise<void> {
  try {
    e2eAllowed = await window.authApi.isE2EModeAllowed();
  } catch {
    e2eAllowed = false;
  }
}

export function isE2EMode(): boolean {
  if (typeof window === 'undefined') return false;
  // If the main process hasn't confirmed E2E is allowed, deny it regardless
  // of what the URL query string says.
  if (e2eAllowed !== true) return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('e2e') === '1';
}
