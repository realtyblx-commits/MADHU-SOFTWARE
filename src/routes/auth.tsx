import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { jsonStore } from "@/lib/json-store";
import { logAuditEvent } from "@/lib/audit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ui/theme-toggle";

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
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/dashboard" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const handleQuickLogin = async (loginEmail: string, loginPass: string) => {
    setEmail(loginEmail);
    setPassword(loginPass);
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPass });
      if (error) {
        toast.error(error.message);
      } else {
        await logAuditEvent({
          action: "LOGIN",
          entity_type: "auth",
          user_email: loginEmail,
          description: `User ${loginEmail} authenticated via Quick Access`,
        });
        toast.success(`Signed in as ${loginEmail}`);
        navigate({ to: "/dashboard" });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to sign in";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(error.message);
      } else {
        await logAuditEvent({
          action: "LOGIN",
          entity_type: "auth",
          user_email: email,
          description: `User ${email} authenticated via credentials form`,
        });
        toast.success("Welcome back!");
        navigate({ to: "/dashboard" });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to connect to authentication server";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-sidebar px-4 py-10">
      <div className="absolute top-4 right-4">
        <ThemeToggle variant="dropdown" />
      </div>

      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex size-14 items-center justify-center rounded-xl bg-white p-2 shadow-md">
            <img src="/apple-touch-icon.png" alt="BLX" className="h-full w-full object-contain" />
          </div>
          <h1 className="mt-4 text-xl font-bold tracking-wide text-sidebar-foreground">
            BLX REALTY PRIVATE LIMITED
          </h1>
          <p className="text-xs uppercase tracking-[0.24em] text-sidebar-primary font-medium">
            Payroll &amp; Payslip Portal
          </p>
        </div>

        <Card className="shadow-panel">
          <CardHeader>
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>Sign in to access your BLX Realty payroll portal.</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Admin Quick Login & Employee Notice */}
            <div className="mb-5 rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-xs space-y-2.5">
              <div className="flex items-center justify-between font-semibold text-primary">
                <span>Administrator Quick Access</span>
                <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-primary">
                  ADMIN READY
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                className="w-full h-auto flex items-center justify-between p-2.5 text-left hover:bg-primary/10 hover:border-primary/40 transition-colors bg-card"
                onClick={() => handleQuickLogin("admin@blxrealty.com", "admin123")}
              >
                <div>
                  <div className="font-semibold text-foreground">👑 Admin Account</div>
                  <div className="text-[11px] text-muted-foreground">admin@blxrealty.com</div>
                </div>
                <div className="text-[10px] font-mono bg-muted px-2 py-1 rounded text-muted-foreground">
                  admin123
                </div>
              </Button>

              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] font-semibold text-muted-foreground flex items-center justify-between">
                  <span>👤 Employee Quick Access (1-Click)</span>
                  <span className="text-[10px] text-muted-foreground font-mono">pwd: employee123</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-0.5">
                  {[
                    { name: "Devesh Vats", email: "devesh@theblxrealty.com", role: "Realtor · ₹30,000" },
                    { name: "Vishal M Raju", email: "vishal@theblxrealty.com", role: "Sr Realtor · ₹50,000" },
                    { name: "Balindar", email: "balindar@theblxrealty.com", role: "Digital Mkt · ₹23,000" },
                    { name: "Chandrika", email: "chandrika@theblxrealty.com", role: "Presales · ₹23,000" },
                    { name: "Siddarth", email: "siddarth@theblxrealty.com", role: "Realtor · ₹25,000" },
                    { name: "Jigyasa Dhiman", email: "jigyasa@theblxrealty.com", role: "Content & Mkt · ₹30,000" },
                  ].map((emp) => (
                    <Button
                      key={emp.email}
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      className="h-auto py-1.5 px-2 text-left flex flex-col items-start justify-start text-[11px] hover:bg-blue-500/10 hover:border-blue-500/40 transition-colors"
                      onClick={() => handleQuickLogin(emp.email, "employee123")}
                    >
                      <span className="font-semibold text-foreground truncate w-full">{emp.name}</span>
                      <span className="text-[10px] text-muted-foreground truncate w-full">{emp.role}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <form onSubmit={signIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@blxrealty.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <PasswordInput
                      id="password"
                      name="password"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full font-semibold" disabled={busy}>
                    Sign in to Portal
                  </Button>
                </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
