import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "hr" | "employee" | "superadmin";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setUser(next?.user ?? null);
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
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
      return;
    }
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (cancelled) return;
        const fromDb = (data ?? []).map((r) => r.role as AppRole);
        const metaRole = user.user_metadata?.role as AppRole | undefined;
        if (metaRole && !fromDb.includes(metaRole)) fromDb.push(metaRole);
        setRoles(fromDb);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Prefer explicit superadmin role; bootstrap admin email kept until SQL migration adds the enum
  const isSuperAdmin =
    roles.includes("superadmin") ||
    (roles.includes("admin") &&
      (user?.email?.toLowerCase() === "admin@blxrealty.com" ||
        user?.user_metadata?.role === "superadmin"));
  const isAdmin = roles.includes("admin") || roles.includes("superadmin");
  const isManager = isAdmin || roles.includes("hr");

  return { session, user, roles, isManager, isAdmin, isSuperAdmin, loading };
}
