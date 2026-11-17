import { createFileRoute, Navigate } from "@tanstack/react-router";
import { z } from "zod";

const search = z.object({
  phone: z.string().optional(),
  role: z.enum(["resident", "driver", "admin"]).optional(),
});

export const Route = createFileRoute("/otp")({
  validateSearch: (s) => search.parse(s),
  component: () => <Navigate to="/role" replace />,
});
