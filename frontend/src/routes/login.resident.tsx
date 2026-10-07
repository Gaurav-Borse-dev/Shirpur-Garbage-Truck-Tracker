import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/login/resident")({
  component: () => <Navigate to="/role" replace />,
});
