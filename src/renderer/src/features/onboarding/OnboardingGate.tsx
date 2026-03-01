import { useEffect, useMemo, useState } from 'react';
import { Terminal, ShieldCheck, FolderTree, ArrowRight, ArrowLeft, Lock } from 'lucide-react';
import type { Workspace } from '@shared/types/workspace';
import { isE2EMode } from '@/lib/e2e';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AppLoader } from '@/components/ui/AppLoader';
import { cn } from '@/lib/utils';

interface OnboardingGateProps {
  children: React.ReactNode;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; workspace: Workspace; completed: boolean };

function getOnboardingKey(workspaceId: string): string {
  return `archterm:onboarding:v2:${workspaceId}`;
}

function passphraseScore(value: string): number {
  if (!value) return 0;
  let score = 0;
  score += Math.min(value.length * 4, 40);
  if (/[a-z]/.test(value)) score += 15;
  if (/[A-Z]/.test(value)) score += 15;
  if (/\d/.test(value)) score += 15;
  if (/[^a-zA-Z0-9]/.test(value)) score += 15;
  return Math.min(score, 100);
}

function SetupFlow({
  workspace,
  onComplete,
}: {
  workspace: Workspace;
  onComplete: () => void;
}) {
  const [step, setStep] = useState(0);
  const [workspaceName, setWorkspaceName] = useState(workspace.name);
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [encryptionInitialized, setEncryptionInitialized] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const score = useMemo(() => passphraseScore(passphrase), [passphrase]);

  useEffect(() => {
    window.keysApi
      .isWorkspaceEncryptionInitialized(workspace.id)
      .then(setEncryptionInitialized)
      .catch(() => setEncryptionInitialized(false));
  }, [workspace.id]);

  async function handleWorkspaceStep() {
    setError(null);
    const trimmed = workspaceName.trim();
    if (!trimmed) {
      setError('Workspace name cannot be empty.');
      return;
    }

    if (trimmed !== workspace.name) {
      setLoading(true);
      try {
        await window.workspaceApi.update(workspace.id, { name: trimmed });
      } catch (e) {
        setError((e as Error).message);
        return;
      } finally {
        setLoading(false);
      }
    }

    setStep(2);
  }

  async function handleEncryptionStep({ skip = false }: { skip?: boolean } = {}) {
    setError(null);

    if (skip || encryptionInitialized) {
      onComplete();
      return;
    }

    if (!passphrase.trim()) {
      setError('Passphrase is required to enable encryption.');
      return;
    }
    if (passphrase !== confirmPassphrase) {
      setError('Passphrases do not match.');
      return;
    }
    if (score < 55) {
      setError('Use a stronger passphrase (recommended score: 55%+).');
      return;
    }

    setLoading(true);
    try {
      await window.keysApi.initializeWorkspaceEncryption(workspace.id, passphrase);
      onComplete();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0b10] text-zinc-100">
      <div
        className="absolute inset-0 opacity-[0.15] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(16,185,129,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.12) 1px, transparent 1px)',
          backgroundSize: '30px 30px',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          background:
            'radial-gradient(circle at 0% 0%, rgba(16,185,129,0.22), transparent 35%), radial-gradient(circle at 100% 100%, rgba(56,189,248,0.18), transparent 40%)',
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-4xl items-center p-6">
        <div className="w-full rounded-2xl border border-emerald-500/20 bg-black/55 p-6 backdrop-blur-xl lg:p-8">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2">
                <Terminal className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs font-mono text-emerald-400">first-run.setup</p>
                <h1 className="text-lg font-semibold">Initialize Workspace</h1>
              </div>
            </div>
            <div className="text-xs font-mono text-zinc-400">Step {step + 1} / 3</div>
          </div>

          <div className="mb-6 h-1.5 w-full rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${((step + 1) / 3) * 100}%` }}
            />
          </div>

          {step === 0 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">Welcome to ArchTerm</h2>
                <p className="mt-2 text-sm text-zinc-300">
                  Before you start, configure your workspace identity and encryption posture.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <FolderTree className="mb-2 h-4 w-4 text-emerald-400" />
                  <p className="text-xs text-zinc-300">Name your workspace for shared clarity.</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <ShieldCheck className="mb-2 h-4 w-4 text-emerald-400" />
                  <p className="text-xs text-zinc-300">Set baseline controls for team operations.</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <Lock className="mb-2 h-4 w-4 text-emerald-400" />
                  <p className="text-xs text-zinc-300">Encrypt cloud key sync with a passphrase.</p>
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold">Workspace Identity</h2>
                <p className="mt-1 text-sm text-zinc-300">
                  Choose a name your team can quickly recognize.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="workspace-name" className="text-sm text-zinc-300">
                  Workspace Name
                </Label>
                <Input
                  id="workspace-name"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="Production Ops"
                  autoFocus
                  className="h-12 border-white/15 bg-black/40 font-mono text-base text-zinc-100 placeholder:text-zinc-500"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold">Encryption Passphrase</h2>
                <p className="mt-1 text-sm text-zinc-300">
                  Required for secure key sync between devices and team environments.
                </p>
              </div>

              {encryptionInitialized ? (
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
                  Encryption is already initialized for this workspace.
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="workspace-passphrase" className="text-xs text-zinc-300">
                      Passphrase
                    </Label>
                    <Input
                      id="workspace-passphrase"
                      type="password"
                      value={passphrase}
                      onChange={(e) => setPassphrase(e.target.value)}
                      placeholder="Use a long passphrase with symbols"
                      className="border-white/15 bg-black/40 font-mono text-zinc-100 placeholder:text-zinc-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="workspace-passphrase-confirm" className="text-xs text-zinc-300">
                      Confirm Passphrase
                    </Label>
                    <Input
                      id="workspace-passphrase-confirm"
                      type="password"
                      value={confirmPassphrase}
                      onChange={(e) => setConfirmPassphrase(e.target.value)}
                      placeholder="Repeat passphrase"
                      className="border-white/15 bg-black/40 font-mono text-zinc-100 placeholder:text-zinc-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="h-1.5 w-full rounded-full bg-white/10">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          score >= 80 ? 'bg-emerald-500' : score >= 55 ? 'bg-amber-500' : 'bg-rose-500'
                        )}
                        style={{ width: `${score}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-zinc-400">Passphrase strength: {score}%</p>
                  </div>
                </>
              )}
            </div>
          )}

          {error && <p className="mt-4 text-xs text-rose-400">{error}</p>}

          <div className="mt-7 flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              className="border-white/20 bg-black/35 text-zinc-100 hover:bg-white/10"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={loading || step === 0}
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back
            </Button>

            <div className="flex items-center gap-2">
              {step === 2 && !encryptionInitialized && (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-zinc-300 hover:text-zinc-100"
                  onClick={() => void handleEncryptionStep({ skip: true })}
                  disabled={loading}
                >
                  Skip for now
                </Button>
              )}

              {step === 0 && (
                <Button
                  type="button"
                  className="bg-emerald-500 text-black hover:bg-emerald-400"
                  onClick={() => setStep(1)}
                >
                  Continue
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              )}

              {step === 1 && (
                <Button
                  type="button"
                  className="bg-emerald-500 text-black hover:bg-emerald-400"
                  onClick={() => void handleWorkspaceStep()}
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Continue'}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              )}

              {step === 2 && (
                <Button
                  type="button"
                  className="bg-emerald-500 text-black hover:bg-emerald-400"
                  onClick={() => void handleEncryptionStep()}
                  disabled={loading || encryptionInitialized === null}
                >
                  {loading ? 'Applying...' : 'Finish Setup'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function OnboardingGate({ children }: OnboardingGateProps) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    // E2E mode: skip onboarding entirely
    if (isE2EMode()) {
      setState({ status: 'ready', workspace: {} as Workspace, completed: true });
      return;
    }

    let mounted = true;

    const load = async () => {
      try {
        let context = await window.workspaceApi.getActiveContext();
        if (!context) {
          await window.workspaceApi.ensurePersonalWorkspace();
          context = await window.workspaceApi.getActiveContext();
        }

        if (!context?.workspace) {
          throw new Error('Unable to resolve active workspace for onboarding.');
        }

        const workspace = context.workspace;
        const completed = localStorage.getItem(getOnboardingKey(workspace.id)) === 'true';
        if (mounted) {
          setState({ status: 'ready', workspace, completed });
        }
      } catch (e) {
        if (mounted) {
          setState({ status: 'error', message: (e as Error).message });
        }
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  // E2E: bypass rendering the gate UI (still need hooks above)
  if (isE2EMode()) return <>{children}</>;

  if (state.status === 'loading') {
    return <AppLoader message="Loading workspace…" />;
  }

  if (state.status === 'error') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load onboarding: {state.message}
        </div>
      </div>
    );
  }

  if (!state.completed) {
    return (
      <SetupFlow
        workspace={state.workspace}
        onComplete={() => {
          localStorage.setItem(getOnboardingKey(state.workspace.id), 'true');
          setState((prev) =>
            prev.status === 'ready' ? { ...prev, completed: true } : prev
          );
        }}
      />
    );
  }

  return <>{children}</>;
}
