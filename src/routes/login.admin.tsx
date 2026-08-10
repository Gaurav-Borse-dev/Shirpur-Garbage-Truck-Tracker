import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/store/auth";
import { adminLogin } from "@/lib/auth.functions";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/login/admin")({
  head: () => ({
    meta: [
      { title: "Admin Sign In — CleanTrack Shirpur" },
      {
        name: "description",
        content:
          "Municipal staff sign-in for the CleanTrack admin portal: fleet monitoring, driver management and dustbin booking approvals.",
      },
      { property: "og:title", content: "Admin Sign In — CleanTrack Shirpur" },
      {
        property: "og:description",
        content: "Secure sign-in for Shirpur Municipal Corporation fleet administrators.",
      },
      { property: "og:url", content: "https://street-scan-track.lovable.app/login/admin" },
    ],
    links: [{ rel: "canonical", href: "https://street-scan-track.lovable.app/login/admin" }],
  }),
  component: AdminLogin,
});

function AdminLogin() {
  const tr = useT();
  const navigate = useNavigate();
  const setSession = useAuth((s) => s.setSession);
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await adminLogin({ data: { username, password } });
      if (!res.ok) {
        setError(tr("Invalid credentials"));
        return;
      }
      setSession({ role: "admin", username });
      await queryClient.invalidateQueries({ queryKey: ["server-session"] });
      navigate({ to: "/admin" });
    } catch {
      setError(tr("Unable to sign in right now"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-neutral-50 grid place-items-center px-4">
      <div className="w-full max-w-[420px] bg-white rounded-3xl border border-neutral-200 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
        <Logo />
        <h1 className="mt-6 text-2xl font-bold text-ink">{tr("Admin Portal")}</h1>
        <p className="text-sm text-neutral-500 mt-1">{tr("Sign in to monitor the fleet.")}</p>
        <form onSubmit={submit} className="mt-6 space-y-3">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={tr("Username")}
            autoComplete="username"
            className="w-full h-14 px-4 rounded-xl bg-neutral-50 outline-none focus:ring-2 focus:ring-ink/10"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={tr("Password")}
            autoComplete="current-password"
            className="w-full h-14 px-4 rounded-xl bg-neutral-50 outline-none focus:ring-2 focus:ring-ink/10"
          />
          {error && <div className="text-sm text-red-600">{error}</div>}
          <button disabled={busy} className="w-full h-14 rounded-xl bg-ink text-white font-semibold disabled:opacity-60">
            {busy ? tr("Signing in…") : tr("Sign in")}
          </button>
        </form>
        <div className="mt-6 text-center">
          <Link to="/role" className="text-xs text-neutral-500 hover:text-ink">← {tr("Back to role selection")}</Link>
        </div>
      </div>
    </div>
  );
}