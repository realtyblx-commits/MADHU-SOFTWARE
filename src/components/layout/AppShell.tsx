import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  Plane,
  Receipt,
  FileText,
  Settings,
  LogOut,
  Building2,
  Menu,
  PlusCircle,
  BarChart3,
  ShieldCheck,
  Search,
  Bell,
  User,
  ChevronDown,
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { logAuditEvent } from "@/lib/audit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useEmployees } from "@/lib/queries";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV: readonly NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/payslips", label: "Payslips", icon: FileText },
  { to: "/payslips/create", label: "Create Payslip", icon: PlusCircle },
  { to: "/employees", label: "Employees", icon: Users },
  { to: "/attendance", label: "Attendance / Payroll Data", icon: CalendarCheck },
  { to: "/reports", label: "Reports / Analytics", icon: BarChart3 },
  { to: "/audit-logs", label: "Audit Logs", icon: ShieldCheck },
  { to: "/settings", label: "Settings", icon: Settings },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin") || roles.includes("superadmin");

  const items: readonly NavItem[] = useMemo(() => {
    if (isAdmin) return NAV;
    return [
      { to: "/dashboard", label: "My Dashboard", icon: LayoutDashboard },
      { to: "/payslips", label: "My Payslips", icon: FileText },
      { to: "/attendance", label: "My Attendance", icon: CalendarCheck },
      { to: "/my-documents", label: "My Documents / KYC", icon: ShieldCheck },
    ];
  }, [isAdmin]);

  return (
    <nav className="flex flex-col gap-1 px-3 py-1">
      {items.map(({ to, label, icon: Icon }) => {
        const active = pathname === to || pathname.startsWith(`${to}/`);
        return (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            className={cn(
              "group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200",
              active
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/25 font-semibold"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            )}
          >
            <Icon className={cn("size-4 shrink-0 transition-transform duration-200 group-hover:scale-110", active ? "text-white" : "text-sidebar-foreground/70")} />
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3 px-5 py-5 mb-1 shrink-0">
      <div className="flex size-11 items-center justify-center rounded-xl bg-white/5 border border-white/10 p-1.5 shadow-inner">
        <img src="/apple-touch-icon.png" alt="BLX" className="h-full w-full object-contain" />
      </div>
      <div className="leading-tight">
        <p className="text-base font-extrabold tracking-wider text-sidebar-foreground">BLX REALTY</p>
        <p className="text-[10px] uppercase tracking-[0.24em] text-amber-500/90 font-semibold">
          PRIVATE LIMITED
        </p>
      </div>
    </div>
  );
}

export function AppShell() {
  const { user, roles } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const { data: employees = [] } = useEmployees();

  // Automatically detect and sync any late check-ins (>10:45 AM) to notification feed


  const handleGlobalSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && globalSearch.trim()) {
      navigate({ to: "/employees" });
    }
  };

  const signOut = async () => {
    try {
      await logAuditEvent({
        action: "LOGOUT",
        entity_type: "auth",
        user_email: user?.email || undefined,
        description: `User ${user?.email || "User"} signed out`,
      });
      await supabase.auth.signOut();
    } catch (e) {
      console.error("Sign out error", e);
    }
    window.location.href = "/auth";
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex sticky top-0 h-screen z-30 overflow-y-auto">
        <Brand />
        <NavLinks />

        {/* Real Estate Building Card Widget from Mockup */}
        <div className="mx-3 my-auto pt-2">
          <div className="relative h-48 w-full overflow-hidden rounded-2xl border border-sidebar-border shadow-xl group">
            <img
              src="/blx-building.jpg"
              alt="BLX Realty Skyscraper"
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent p-3.5 flex flex-col justify-end text-left">
              <div className="flex items-center gap-1.5 mb-1">
                <Building2 className="size-3.5 text-amber-400" />
                <p className="text-xs font-bold tracking-wider text-white">BLX REALTY</p>
              </div>
              <p className="text-[11px] text-zinc-300 leading-snug font-medium">
                Building Legacies,<br />Creating Futures.
              </p>
              <p className="text-[10px] text-blue-400 font-mono mt-2 tracking-wide">
                www.theblxrealty.com
              </p>
            </div>
          </div>
        </div>

        {/* User Profile & Sign Out Footer */}
        <div className="mt-auto border-t border-sidebar-border p-3 shrink-0">
          <div className="flex items-center gap-3 p-2 rounded-xl bg-sidebar-accent/20 border border-sidebar-border">
            <div className="flex size-9 items-center justify-center rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 font-bold shrink-0">
              <User className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-sidebar-foreground">
                {user?.email?.split("@")[0] === "admin" ? "BLX Admin Bossu" : user?.email || "BLX Admin Bossu"}
              </p>
              <p className="truncate text-[10px] text-muted-foreground capitalize">
                {roles.includes("superadmin")
                  ? "Super Admin"
                  : roles.includes("admin")
                    ? "Administrator"
                    : roles.includes("hr")
                      ? "HR"
                      : "Employee"}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={signOut}
            aria-label="Sign out"
            className="mt-2.5 w-full justify-center text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 border-rose-900/40 font-medium h-8"
          >
            <LogOut className="size-3.5 mr-1.5" /> Sign out
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-card/75 px-3 sm:px-4 lg:px-8 backdrop-blur-md">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="lg:hidden">
              <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Open navigation menu">
                    <Menu className="size-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64 bg-sidebar p-0 flex flex-col">
                  <SheetTitle className="sr-only">Navigation</SheetTitle>
                  <Brand />
                  <NavLinks onNavigate={() => setOpen(false)} />
                  <div className="mt-auto border-t border-sidebar-border p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-sidebar-foreground/70">Theme Mode</span>
                      <ThemeToggle variant="button" className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent" />
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={signOut}
                      aria-label="Sign out of account"
                      className="w-full justify-center font-medium"
                    >
                      <LogOut className="size-4 mr-2" /> Sign out
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
            <span className="text-sm font-semibold tracking-wide lg:hidden truncate max-w-[140px] sm:max-w-none">BLX Realty Payroll</span>
          </div>

          {/* Top Search Bar & Header Controls */}
          <div className="flex items-center gap-1.5 sm:gap-3 ml-auto">
            <div className="relative hidden sm:block w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                id="global-header-search"
                name="global-header-search"
                type="search"
                autoComplete="off"
                aria-label="Search employees, payslips"
                placeholder="Search employees, payslips... (Press Enter)"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                onKeyDown={handleGlobalSearch}
                className="pl-9 h-9 bg-muted/40 border-border/60 text-xs rounded-xl focus-visible:ring-blue-500"
              />
            </div>



            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              aria-label="Sign out of account"
              title="Sign out of account"
              className="text-xs text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 font-medium h-9 px-2 sm:px-2.5 rounded-xl"
            >
              <LogOut className="size-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Logout</span>
            </Button>

            <ThemeToggle variant="dropdown" />
          </div>
        </header>

        <main className="flex-1 p-3 sm:p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="no-print mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
