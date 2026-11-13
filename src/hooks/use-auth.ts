import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "hr" | "employee" | "superadmin";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [rolesLoading, setRolesLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setUser(next?.user ?? null);
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
      if (!data.session?.user) setRolesLoading(false);
      if (data.session?.user?.email && !data.session.user.email.includes("admin")) {
        fetch("/api/auth/sync-employee", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: data.session.user.id,
            email: data.session.user.email,
          }),
        }).catch(() => {});
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setRoles([]);
      setRolesLoading(false);
      return;
    }
    setRolesLoading(true);
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (cancelled) return;
        const fromDb = (data ?? []).map((r) => r.role as AppRole);
        const metaRole = user.user_metadata?.role as AppRole | undefined;
        if (metaRole && !fromDb.includes(metaRole)) fromDb.push(metaRole);
        // Bootstrap: primary admin email is always treated as admin+superadmin
        if (user.email?.toLowerCase() === "admin@blxrealty.com") {
          if (!fromDb.includes("admin")) fromDb.push("admin");
          if (!fromDb.includes("superadmin")) fromDb.push("superadmin");
        }
        setRoles(fromDb);
        setRolesLoading(false);
      })
      .catch(() => {
        if (!cancelled) setRolesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const isSuperAdmin =
    roles.includes("superadmin") ||
    user?.user_metadata?.role === "superadmin" ||
    user?.email?.toLowerCase() === "admin@blxrealty.com";
  const isAdmin = roles.includes("admin") || roles.includes("superadmin") || isSuperAdmin;
  const isManager = isAdmin || roles.includes("hr");
  const authReady = !loading && !rolesLoading;

  return {
    session,
    user,
    roles,
    isManager,
    isAdmin,
    isSuperAdmin,
    loading: !authReady,
    authReady,
  };
}
