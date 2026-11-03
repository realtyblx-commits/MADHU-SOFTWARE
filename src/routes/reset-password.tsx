import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { KeyRound, ShieldCheck, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset password — BLX Realty Payroll" },
      { name: "description", content: "Set a new password for your BLX Realty payroll portal account." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setReady(true);
        setChecking(false);
      }
    });

    // Recovery links land with hash tokens; getSession picks them up after parse
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) {
        setReady(true);
      }
      setChecking(false);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim().length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: password.trim() });
      if (error) throw error;
      toast.success("Password updated. You can sign in with your new password.");
      await supabase.auth.signOut();
      navigate({ to: "/auth" });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-[#FAF9F6] dark:bg-[#050B17] text-slate-900 dark:text-white flex flex-col">
      <div
        className="absolute inset-0 bg-cover bg-center pointer-events-none opacity-30 dark:opacity-20"
        style={{ backgroundImage: "url('/blx-building.jpg')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-white/70 via-slate-50/60 to-white/80 dark:from-[#040814]/85 dark:via-[#040814]/75 dark:to-[#040814]/90 pointer-events-none" />

      <header className="relative z-30 w-full px-6 py-2.5 flex items-center justify-between border-b border-slate-200/60 dark:border-white/10 backdrop-blur-2xl bg-white/50 dark:bg-slate-950/50">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-xl bg-white/90 dark:bg-slate-900/90 p-1.5 shadow-sm flex items-center justify-center ring-1 ring-slate-200/80 dark:ring-white/20">
            <img src="/apple-touch-icon.png" alt="BLX Realty" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-[0.14em] uppercase leading-none">BLX REALTY PRIVATE LIMITED</h1>
            <p className="text-[10px] uppercase tracking-[0.24em] text-amber-600 dark:text-[#d4af37] font-semibold mt-0.5">
              Password Reset
            </p>
          </div>
        </div>
        <ThemeToggle variant="dropdown" />
      </header>

      <main className="relative z-20 flex-1 flex items-center justify-center px-4 py-10">
        <Card className="w-full max-w-md border-border/80 bg-card/95 backdrop-blur shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <KeyRound className="size-5 text-blue-500" />
              Set a new password
            </CardTitle>
            <CardDescription>
              Choose a new password for your payroll portal account. Minimum 6 characters.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {checking ? (
              <p className="text-sm text-muted-foreground">Verifying reset link…</p>
            ) : !ready ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  This reset link is invalid or has expired. Request a new password reset from the sign-in page.
                </p>
                <Button type="button" className="w-full" onClick={() => navigate({ to: "/auth" })}>
                  Back to sign in
                </Button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New password</Label>
                  <PasswordInput
                    id="new-password"
                    name="new-password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter new password"
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm password</Label>
                  <PasswordInput
                    id="confirm-password"
                    name="confirm-password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Re-enter new password"
                    required
                    minLength={6}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Updating…" : "Update password"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </main>

      <footer className="relative z-30 px-6 py-2 border-t border-slate-200/60 dark:border-white/10 backdrop-blur-2xl bg-white/50 dark:bg-slate-950/50 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Secure password recovery</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Lock className="size-3" />
          <span>&copy; {new Date().getFullYear()} BLX Realty Private Limited</span>
        </div>
      </footer>
    </div>
  );
}
