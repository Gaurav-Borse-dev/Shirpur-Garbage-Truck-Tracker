import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/login/admin")({
  component: () => <Navigate to="/role" replace />,
});