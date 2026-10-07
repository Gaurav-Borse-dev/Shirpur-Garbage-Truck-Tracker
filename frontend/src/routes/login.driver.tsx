import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/login/driver")({
  component: () => <Navigate to="/role" replace />,
});
