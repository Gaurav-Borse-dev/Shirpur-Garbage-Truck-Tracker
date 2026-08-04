import type { ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";
import { useServerAuth } from "@/hooks/useServerAuth";

/**
 * Gates a route on the server-verified session cookie.
 * Editing localStorage/zustand can no longer grant access.
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
  if (loading) {
    return <div className="min-h-screen w-full grid place-items-center text-sm text-neutral-400">Checking access…</div>;
  }
  if (!user || user.role !== role) return <Navigate to={redirectTo} />;
  return <>{children}</>;
}