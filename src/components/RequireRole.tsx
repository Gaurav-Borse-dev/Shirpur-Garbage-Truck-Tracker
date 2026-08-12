import type { ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";
import { useServerAuth } from "@/hooks/useServerAuth";
import { useAuth } from "@/store/auth";
import { useT } from "@/lib/i18n";

/**
 * Gates a route on the server-verified session cookie or active client session.
 */
export function RequireRole({
  role,
  redirectTo,
  children,
}: {
  role: "admin" | "driver" | "resident";
  redirectTo: string;
  children: ReactNode;
}) {
  const { user, loading } = useServerAuth();
  const clientSession = useAuth((s) => s.session);
  const tr = useT();

  const activeRole = user?.role || clientSession?.role;

  if (loading && !clientSession) {
    return <div className="min-h-screen w-full grid place-items-center text-sm text-neutral-400">{tr("Checking access…")}</div>;
  }
  if (activeRole !== role) return <Navigate to={redirectTo} />;
  return <>{children}</>;
}