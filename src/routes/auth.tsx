import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ShieldCheck,
  FileText,
  CheckCircle2,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logAuditEvent } from "@/lib/audit";
import { Input } from "@/components/ui/input";
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
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
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
      const message = err instanceof Error ? err.message : "Failed to connect to authentication server";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-[#050B17] text-white flex items-center justify-center px-4 py-8 lg:py-12 lg:px-8 overflow-hidden">
      {/* Background Architectural Blueprint & Ambient Glow */}
      <div
        className="absolute inset-0 bg-cover bg-center pointer-events-none opacity-10 mix-blend-luminosity"
        style={{ backgroundImage: "url('/blx-building.jpg')" }}
      />
      <div className="absolute -top-32 -left-32 w-[550px] h-[550px] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[160px] pointer-events-none" />

      {/* Decorative Golden Arc & Dot Matrix SVG */}
      <svg
        className="absolute bottom-0 left-0 w-[500px] h-[500px] pointer-events-none opacity-30"
        viewBox="0 0 500 500"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="50" cy="500" r="380" stroke="#d4af37" strokeWidth="1" strokeDasharray="3 3" />
        <circle cx="50" cy="500" r="420" stroke="#d4af37" strokeWidth="1.5" strokeOpacity="0.6" />
        <circle cx="50" cy="500" r="460" stroke="#d4af37" strokeWidth="0.8" strokeDasharray="6 6" />
      </svg>

      {/* Floating Theme Toggle in Top Right */}
      <div className="absolute top-5 right-5 z-50">
        <ThemeToggle variant="dropdown" />
      </div>

      {/* Centered Two-Column Content Container */}
      <div className="relative z-10 w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center">
        {/* Left Column: Branding, Statement & Badges */}
        <div className="lg:col-span-7 flex flex-col justify-center space-y-7 lg:pr-4">
          {/* Logo Badge */}
          <div className="flex items-center gap-4">
            <div className="size-16 rounded-2xl bg-white p-2.5 shadow-2xl flex items-center justify-center ring-1 ring-white/20 shrink-0">
              <img
                src="/apple-touch-icon.png"
                alt="BLX Realty"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className="text-xl lg:text-2xl font-bold tracking-[0.14em] text-white font-sans uppercase">
                BLX REALTY PRIVATE LIMITED
              </h1>
              <p className="text-[11px] uppercase tracking-[0.28em] text-[#d4af37] font-semibold mt-0.5">
                PAYROLL &amp; PAYSLIP PORTAL
              </p>
            </div>
          </div>

          {/* Accent Gold Divider Line */}
          <div className="w-10 h-0.5 bg-[#d4af37] rounded-full" />

          {/* Hero Statement */}
          <div className="space-y-3">
            <h2 className="text-3xl sm:text-4xl lg:text-4xl font-serif text-white font-normal leading-[1.25] tracking-tight">
              Secure. Reliable. Built for<br />
              People who Build Spaces.
            </h2>
            <p className="text-slate-300/80 text-sm max-w-md font-light leading-relaxed">
              Access your payroll, payslips and employment information in one secure portal.
            </p>
          </div>

          {/* Three Feature Pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-4 border-t border-white/10 max-w-xl">
            {/* Feature 1 */}
            <div className="space-y-1.5">
              <div className="size-7 rounded-lg border border-white/15 bg-white/5 flex items-center justify-center">
                <ShieldCheck className="size-4 text-white/90" />
              </div>
              <p className="font-semibold text-xs text-white">Secure Access</p>
              <p className="text-[11px] text-slate-400 font-light leading-relaxed">
                Bank-grade security to protect your data
              </p>
            </div>

            {/* Feature 2 */}
            <div className="space-y-1.5">
              <div className="size-7 rounded-lg border border-white/15 bg-white/5 flex items-center justify-center">
                <FileText className="size-4 text-white/90" />
              </div>
              <p className="font-semibold text-xs text-white">Private &amp; Confidential</p>
              <p className="text-[11px] text-slate-400 font-light leading-relaxed">
                Your payroll data is always private
              </p>
            </div>

            {/* Feature 3 */}
            <div className="space-y-1.5">
              <div className="size-7 rounded-lg border border-white/15 bg-white/5 flex items-center justify-center">
                <CheckCircle2 className="size-4 text-white/90" />
              </div>
              <p className="font-semibold text-xs text-white">Always Available</p>
              <p className="text-[11px] text-slate-400 font-light leading-relaxed">
                Access anytime, anywhere
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Floating Clean Sign-In Card */}
        <div className="lg:col-span-5 flex justify-center lg:justify-end">
          <div className="w-full max-w-md bg-white dark:bg-[#0c1424] rounded-[2rem] p-7 sm:p-9 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6)] border border-slate-100/90 dark:border-slate-800 transition-all">
            {/* Top Right Enterprise Access Pill */}
            <div className="flex justify-end mb-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-[11px] font-medium text-slate-600 dark:text-slate-300 shadow-sm">
                <Lock className="size-3 text-slate-500 dark:text-slate-400" />
                <span>Secure enterprise access</span>
              </div>
            </div>

            {/* Title & Instructions */}
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Welcome back
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Sign in with your credentials to access your BLX Realty payroll portal.
              </p>
            </div>

            {/* Credentials Form */}
            <form onSubmit={signIn} className="space-y-4">
              {/* Email Input */}
              <div className="space-y-1.5">
                <label
                  htmlFor="auth-email"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                  <Input
                    id="auth-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@blxrealty.com"
                    className="pl-10 h-11 bg-slate-50/70 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-sm focus-visible:ring-2 focus-visible:ring-blue-600 transition-all"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <label
                  htmlFor="auth-password"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                  <Input
                    id="auth-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10 pr-10 h-11 bg-slate-50/70 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-sm focus-visible:ring-2 focus-visible:ring-blue-600 transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="size-4 rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 accent-blue-600 cursor-pointer"
                  />
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Remember me
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() =>
                    toast.info("Please contact your BLX Realty HR administrator to reset your password.")
                  }
                  className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Forgot password?
                </button>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={busy}
                className="w-full h-12 bg-gradient-to-r from-[#112349] via-[#1a3675] to-[#112349] hover:from-[#1a3675] hover:to-[#204495] text-white font-semibold text-sm rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              >
                <span>{busy ? "Signing in…" : "Sign in to Portal"}</span>
                <ChevronRight className="size-4 stroke-[2.5]" />
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-6 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100 dark:border-slate-800" />
              </div>
              <span className="relative bg-white dark:bg-[#0c1424] px-3 text-[10px] uppercase tracking-wider text-slate-400 font-medium">
                Security &amp; Privacy
              </span>
            </div>

            {/* Bottom Security Notice Pill */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80">
              <div className="size-7 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 text-blue-600 dark:text-blue-400">
                <ShieldCheck className="size-4" />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug font-light">
                Your data is encrypted and securely stored. We never share your information.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
