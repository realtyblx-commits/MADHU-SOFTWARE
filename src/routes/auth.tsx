import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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
          description: `User ${email} signed in to portal`,
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
            <CardDescription>Sign in with your credentials to access your BLX Realty payroll portal.</CardDescription>
          </CardHeader>
          <CardContent>
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
                  placeholder="admin@blxrealty.com"
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
                {busy ? "Signing in…" : "Sign in to Portal"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
