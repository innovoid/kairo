import { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { LoginPage } from './LoginPage';
import { isE2EMode } from '@/lib/e2e';
import { AppLoader } from '@/components/ui/AppLoader';

interface AuthGateProps {
  children: React.ReactNode;
}

/**
 * Register the access token with the main process so Supabase-gated IPC
 * calls work. Guards against:
 *  - window.authApi being undefined (Vite dev server / preload not loaded)
 *  - duplicate calls with the same token (Supabase fires onAuthStateChange
 *    synchronously during getSession in some refresh paths)
 */
async function syncTokenToMain(
  token: string | null,
  lastTokenRef: React.MutableRefObject<string | null>,
  onReady: () => void,
): Promise<void> {
  if (token === lastTokenRef.current) {
    // Same token — main process already has it, just mark ready
    onReady();
    return;
  }
  lastTokenRef.current = token;
  if (window.authApi?.setAccessToken) {
    await window.authApi.setAccessToken(token);
  }
  onReady();
}

export function AuthGate({ children }: AuthGateProps) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [tokenReady, setTokenReady] = useState(false);
  // Tracks the last token sent to the main process to avoid duplicate IPC calls
  const lastTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (isE2EMode()) {
      setSession({} as Session);
      setTokenReady(true);
      return;
    }

    // Register the auth-state subscriber BEFORE calling getSession so we never
    // miss an event (Supabase best practice).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setTokenReady(false);
      void syncTokenToMain(session?.access_token ?? null, lastTokenRef, () => setTokenReady(true));
    });

    // Get the current session — may trigger the subscriber above synchronously
    // on the token-refresh path, but syncTokenToMain deduplicates.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession((prev) => {
        // onAuthStateChange may have already set a session; don't overwrite
        // a more-recent truthy value with a stale null.
        if (prev !== undefined) return prev;
        return session;
      });
      void syncTokenToMain(session?.access_token ?? null, lastTokenRef, () => setTokenReady(true));
    });

    return () => subscription.unsubscribe();
  }, []);

  // E2E: bypass auth gate entirely
  if (isE2EMode()) return <>{children}</>;

  // Loading: waiting for initial session check or token registration
  if (session === undefined || !tokenReady) {
    return <AppLoader />;
  }

  if (!session) {
    return <LoginPage />;
  }

  return <>{children}</>;
}
