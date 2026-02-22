import { useMemo, useState } from 'react';
import { Terminal, ShieldCheck, KeyRound, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type AuthMode = 'signin' | 'signup';

function PasswordStrength({ password }: { password: string }) {
  const score = useMemo(() => {
    if (!password) return 0;
    let value = 0;
    value += Math.min(password.length * 8, 40);
    if (/[a-z]/.test(password)) value += 15;
    if (/[A-Z]/.test(password)) value += 15;
    if (/\d/.test(password)) value += 15;
    if (/[^a-zA-Z0-9]/.test(password)) value += 15;
    return Math.min(value, 100);
  }, [password]);

  const tone =
    score >= 80 ? 'bg-emerald-500' : score >= 55 ? 'bg-amber-500' : 'bg-rose-500';

  return (
    <div className="space-y-1">
      <div className="h-1.5 w-full rounded-full bg-white/10">
        <div className={cn('h-full rounded-full transition-all duration-300', tone)} style={{ width: `${score}%` }} />
      </div>
      <p className="text-[11px] text-zinc-400">Password strength: {score}%</p>
    </div>
  );
}

export function LoginPage() {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSignUp = mode === 'signup';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    try {
      if (isSignUp) {
        if (password.length < 8) {
          throw new Error('Use at least 8 characters for account security.');
        }

        const { error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              name: name.trim(),
            },
          },
        });
        if (signUpError) throw signUpError;

        setNotice('Account created. Check your email for verification if enabled.');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuth(provider: 'github' | 'google') {
    setLoading(true);
    setError(null);
    setNotice(null);

    const { error: oauthError } = await supabase.auth.signInWithOAuth({ provider });
    if (oauthError) {
      setError(oauthError.message);
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0a0f] text-zinc-100">
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 10%, rgba(16,185,129,0.2) 0, transparent 35%), radial-gradient(circle at 85% 80%, rgba(59,130,246,0.18) 0, transparent 40%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.12] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 p-6 lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <section className="rounded-2xl border border-emerald-500/20 bg-black/40 p-6 backdrop-blur-xl lg:p-10">
          <div className="mb-8 flex items-center gap-3">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2">
              <Terminal className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-mono text-emerald-400">$ archterm boot</p>
              <h1 className="text-3xl font-semibold tracking-tight">Operator Access</h1>
            </div>
          </div>

          <div className="space-y-4 font-mono text-sm leading-relaxed text-zinc-300">
            <p>
              ArchTerm is designed for operators who manage real infrastructure. Authenticate once,
              then connect, automate, and collaborate from a terminal-native workspace.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <ShieldCheck className="mb-2 h-4 w-4 text-emerald-400" />
                <p className="text-xs text-zinc-300">Workspace-level encryption controls.</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <KeyRound className="mb-2 h-4 w-4 text-cyan-400" />
                <p className="text-xs text-zinc-300">SSH keys and passphrases managed safely.</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <Users className="mb-2 h-4 w-4 text-violet-400" />
                <p className="text-xs text-zinc-300">Team workflows for shared environments.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-black/55 p-5 backdrop-blur-xl lg:p-7">
          <div className="mb-5 flex items-center justify-between rounded-lg border border-white/10 bg-black/40 p-1.5">
            <button
              type="button"
              className={cn(
                'w-1/2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                !isSignUp ? 'bg-emerald-500/20 text-emerald-300' : 'text-zinc-400 hover:text-zinc-200'
              )}
              onClick={() => {
                setMode('signin');
                setError(null);
                setNotice(null);
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={cn(
                'w-1/2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isSignUp ? 'bg-emerald-500/20 text-emerald-300' : 'text-zinc-400 hover:text-zinc-200'
              )}
              onClick={() => {
                setMode('signup');
                setError(null);
                setNotice(null);
              }}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs text-zinc-300">Operator Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Ada Lovelace"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={loading}
                  className="border-white/15 bg-black/40 font-mono text-zinc-100 placeholder:text-zinc-500"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs text-zinc-300">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="border-white/15 bg-black/40 font-mono text-zinc-100 placeholder:text-zinc-500"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs text-zinc-300">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="border-white/15 bg-black/40 font-mono text-zinc-100 placeholder:text-zinc-500"
              />
              {isSignUp && <PasswordStrength password={password} />}
            </div>

            {error && <p className="text-xs text-rose-400">{error}</p>}
            {notice && <p className="text-xs text-emerald-400">{notice}</p>}

            <Button
              type="submit"
              className="w-full bg-emerald-500 text-black hover:bg-emerald-400"
              disabled={loading}
            >
              {loading ? 'Authenticating...' : isSignUp ? 'Create account' : 'Enter ArchTerm'}
            </Button>
          </form>

          <div className="my-4 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="border-white/20 bg-black/30 text-zinc-100 hover:bg-white/10"
              onClick={() => void handleOAuth('github')}
              disabled={loading}
            >
              GitHub
            </Button>
            <Button
              variant="outline"
              className="border-white/20 bg-black/30 text-zinc-100 hover:bg-white/10"
              onClick={() => void handleOAuth('google')}
              disabled={loading}
            >
              Google
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}

