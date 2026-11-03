import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck, Lock, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logAuditEvent } from "@/lib/audit";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { RubeGoldbergMachine } from "@/components/auth/RubeGoldbergMachine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — BLX Realty Payroll" },
      { name: "description", content: "Sign in to the BLX Realty payroll and payslip portal." },
      { property: "og:title", content: "Sign in — BLX Realty Payroll" },
      { property: "og:description", content: "Access the BLX Realty payroll and payslip portal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [busy, setBusy] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetBusy, setResetBusy] = useState(false);

  // Auto redirect if already logged in (skip recovery sessions — those go to reset page)
  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    if (hash.includes("type=recovery")) {
      navigate({ to: "/reset-password" });
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        navigate({ to: "/reset-password" });
        return;
      }
      if (session && event !== "TOKEN_REFRESHED") navigate({ to: "/dashboard" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please provide both email and password.");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });
      if (error) {
        toast.error(error.message);
      } else {
        await logAuditEvent({
          action: "LOGIN",
          entity_type: "auth",
          user_email: email.trim(),
          description: `User ${email.trim()} signed in to portal`,
        });
        toast.success("Welcome back!");
        navigate({ to: "/dashboard" });
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to connect to authentication server";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const sendResetLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = resetEmail.trim() || email.trim();
    if (!target) {
      toast.error("Enter the email address for your account.");
      return;
    }

    setResetBusy(true);
    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(target, { redirectTo });
      if (error) throw error;
      toast.success(`Password reset link sent to ${target}. Check your inbox.`);
      setResetOpen(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send reset email");
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <div className="relative h-screen max-h-screen w-full bg-[#FAF9F6] dark:bg-[#050B17] text-slate-900 dark:text-white flex flex-col justify-between overflow-hidden select-none transition-colors duration-300">
      {/* Layer 1: Background Architectural Skyscraper Photo */}
      <div
        className="absolute inset-0 bg-cover bg-center pointer-events-none opacity-30 dark:opacity-20 transition-opacity duration-700 scale-105 filter blur-[0.5px]"
        style={{ backgroundImage: "url('/blx-building.jpg')" }}
      />
      {/* Ambient Light Diffusion Wash (creates luminous clarity in Light Mode, deep midnight navy in Dark Mode) */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/70 via-slate-50/60 to-white/80 dark:from-[#040814]/85 dark:via-[#040814]/75 dark:to-[#040814]/90 pointer-events-none transition-colors duration-500" />

      {/* Atmospheric Ambient Glow Orbs */}
      <div className="absolute -top-32 -left-32 w-[600px] h-[600px] bg-blue-500/15 dark:bg-blue-600/15 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-[600px] h-[600px] bg-amber-500/10 dark:bg-indigo-500/15 rounded-full blur-[180px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-indigo-500/5 dark:bg-blue-400/5 rounded-full blur-[200px] pointer-events-none" />

      {/* Top Header Bar */}
      <header className="relative z-30 w-full px-6 py-2.5 flex items-center justify-between border-b border-slate-200/60 dark:border-white/10 backdrop-blur-2xl bg-white/50 dark:bg-slate-950/50 shadow-sm shrink-0">
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="size-8 sm:size-9 rounded-xl bg-white/90 dark:bg-slate-900/90 p-1.5 shadow-sm flex items-center justify-center ring-1 ring-slate-200/80 dark:ring-white/20 shrink-0">
            <img
              src="/apple-touch-icon.png"
              alt="BLX Realty"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold tracking-[0.14em] text-slate-900 dark:text-white uppercase leading-none">
              BLX REALTY PRIVATE LIMITED
            </h1>
            <p className="text-[10px] uppercase tracking-[0.24em] text-amber-600 dark:text-[#d4af37] font-semibold mt-0.5">
              PAYROLL &amp; PAYSLIP PORTAL
            </p>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/60 dark:bg-slate-900/60 border border-slate-200/80 dark:border-white/10 text-[11px] font-medium text-slate-600 dark:text-slate-300 shadow-sm backdrop-blur-md">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <Lock className="size-3 text-slate-500 dark:text-slate-400" />
            <span>256-bit TLS Encrypted</span>
          </div>
          <ThemeToggle variant="dropdown" />
        </div>
      </header>

      {/* Main Interactive Animation Area */}
      <main className="relative z-20 flex-1 flex flex-col items-center justify-center px-4 py-1 min-h-0 overflow-hidden">
        {/* The Rube Goldberg Mechanical Machine */}
        <RubeGoldbergMachine
          email={email}
          setEmail={setEmail}
          password={password}
          setPassword={setPassword}
          rememberMe={rememberMe}
          setRememberMe={setRememberMe}
          onSubmit={signIn}
          busy={busy}
        />
      </main>

      {/* Bottom Footer Bar */}
      <footer className="relative z-30 w-full px-6 py-2 border-t border-slate-200/60 dark:border-white/10 backdrop-blur-2xl bg-white/50 dark:bg-slate-950/50 flex flex-col sm:flex-row items-center justify-between gap-1 text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Enterprise encryption &amp; audit logging active</span>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => {
              setResetEmail(email.trim());
              setResetOpen(true);
            }}
            className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors"
          >
            Forgot password?
          </button>
          <span>&copy; {new Date().getFullYear()} BLX Realty Private Limited</span>
        </div>
      </footer>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="size-5 text-blue-500" />
              Reset password
            </DialogTitle>
            <DialogDescription>
              Enter your account email. We&apos;ll send a secure link to set a new password.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={sendResetLink} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email</Label>
              <Input
                id="reset-email"
                name="reset-email"
                type="email"
                autoComplete="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="you@theblxrealty.com"
                required
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setResetOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={resetBusy}>
                {resetBusy ? "Sending…" : "Send reset link"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
