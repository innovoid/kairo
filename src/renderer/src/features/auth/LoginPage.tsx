import { useMemo, useState } from "react";
import {
  ShieldCheck,
  KeyRound,
  Users,
  Github,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArchTermLogo } from "@/components/ui/ArchTermLogo";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

type AuthMode = "signin" | "signup";

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
    score >= 80
      ? "bg-emerald-500"
      : score >= 55
        ? "bg-amber-500"
        : "bg-rose-500";

  return (
    <div className="space-y-1">
      <div className="h-1.5 w-full rounded-full bg-white/10">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            tone,
          )}
          style={{ width: `${score}%` }}
        />
      </div>
      <p className="text-[11px] text-zinc-400">Password strength: {score}%</p>
    </div>
  );
}

export function LoginPage() {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSignUp = mode === "signup";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    try {
      if (isSignUp) {
        if (password.length < 8) {
          throw new Error("Use at least 8 characters for account security.");
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

        setNotice(
          "Account created. Check your email for verification if enabled.",
        );
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

  async function handleOAuth(provider: "github" | "google") {
    setLoading(true);
    setError(null);
    setNotice(null);

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
    });
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
            "radial-gradient(circle at 20% 10%, rgba(16,185,129,0.2) 0, transparent 35%), radial-gradient(circle at 85% 80%, rgba(59,130,246,0.18) 0, transparent 40%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.12] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 p-6 justify-center lg:grid lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:gap-16">
        <motion.section
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col justify-center"
        >
          <div className="mb-10">
            <ArchTermLogo size="md" />
          </div>

          <div className="space-y-6">
            <p className="text-lg leading-relaxed text-zinc-300 max-w-md">
              Securely connect, automate, and collaborate across your
              infrastructure from a single terminal-native workspace.
            </p>

            <div className="grid gap-4 mt-8">
              <div className="flex items-start gap-4">
                <div className="mt-1 rounded-full bg-white/5 p-2 ring-1 ring-white/10">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-zinc-100">
                    End-to-End Encrypted
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Your SSH keys and connection data are encrypted at rest
                    using AES-256-GCM.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="mt-1 rounded-full bg-white/5 p-2 ring-1 ring-white/10">
                  <KeyRound className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-zinc-100">
                    Zero-Trust Key Management
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Private keys never leave your machine. Synchronize access
                    securely.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="mt-1 rounded-full bg-white/5 p-2 ring-1 ring-white/10">
                  <Users className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-zinc-100">
                    Team Workspaces
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Organize hosts, snippets, and playbooks in isolated team
                    environments.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-xl shadow-2xl relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-50 pointer-events-none" />

          <div className="relative">
            <div className="mb-6 flex items-center justify-between rounded-lg border border-white/10 bg-black/60 p-1">
              <button
                type="button"
                className={cn(
                  "w-1/2 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200",
                  !isSignUp
                    ? "bg-zinc-800/80 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5",
                )}
                onClick={() => {
                  setMode("signin");
                  setError(null);
                  setNotice(null);
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                className={cn(
                  "w-1/2 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200",
                  isSignUp
                    ? "bg-zinc-800/80 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5",
                )}
                onClick={() => {
                  setMode("signup");
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
                  <Label htmlFor="name" className="text-xs text-zinc-300">
                    Name
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Jane Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    disabled={loading}
                    data-no-focus-ring="true"
                    className="border-white/10 bg-black/40 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-1 focus-visible:ring-emerald-500/50 focus-visible:border-emerald-500/50 shadow-none"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs text-zinc-300">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="border-white/10 bg-black/40 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-1 focus-visible:ring-emerald-500/50 focus-visible:border-emerald-500/50 shadow-none"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs text-zinc-300">
                    Password
                  </Label>
                  {!isSignUp && (
                    <a
                      href="#"
                      className="text-[10px] text-zinc-500 hover:text-emerald-400 transition-colors"
                    >
                      Forgot password?
                    </a>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="border-white/10 bg-black/40 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-1 focus-visible:ring-emerald-500/50 focus-visible:border-emerald-500/50 shadow-none"
                />
                <AnimatePresence>
                  {isSignUp && password.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <PasswordStrength password={password} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-md bg-rose-500/10 border border-rose-500/20 px-3 py-2"
                  >
                    <p className="text-xs text-rose-400">{error}</p>
                  </motion.div>
                )}
                {notice && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-3 py-2"
                  >
                    <p className="text-xs text-emerald-400">{notice}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <Button
                type="submit"
                className="w-full bg-emerald-500 text-black hover:bg-emerald-400 mt-2 transition-all active:scale-[0.98]"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                    Authenticating...
                  </span>
                ) : isSignUp ? (
                  "Create Account"
                ) : (
                  "Continue to ArchTerm"
                )}
              </Button>
            </form>

            <div className="my-6 relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-[#1a1a1f] px-2 text-zinc-500">
                  or continue with
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white transition-all active:scale-[0.98]"
                onClick={() => void handleOAuth("github")}
                disabled={loading}
              >
                <Github className="mr-2 h-4 w-4" />
                GitHub
              </Button>
              <Button
                variant="outline"
                className="border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white transition-all active:scale-[0.98]"
                onClick={() => void handleOAuth("google")}
                disabled={loading}
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Google
              </Button>
            </div>
          </div>
        </motion.section>
      </main>
    </div>
  );
}
