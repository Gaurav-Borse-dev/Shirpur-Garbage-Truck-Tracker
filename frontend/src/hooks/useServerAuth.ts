import { useQuery } from "@tanstack/react-query";
import { getServerSession } from "@/lib/auth.functions";

/** Server-verified session. The httpOnly cookie is the source of truth for role access. */
export function useServerAuth() {
  const { data, isLoading } = useQuery({
    queryKey: ["server-session"],
    queryFn: () => getServerSession(),
    staleTime: 30_000,
    retry: false,
  });
  return { user: data ?? null, loading: isLoading };
}
