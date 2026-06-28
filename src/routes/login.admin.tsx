import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/store/auth";

export const Route = createFileRoute("/login/admin")({
  component: AdminLogin,
});

function AdminLogin() {
  const navigate = useNavigate();
  const setSession = useAuth((s) => s.setSession);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (username === "admin" && password === "cleantrack2024") {
      setSession({ role: "admin", username });
      navigate({ to: "/admin" });
    } else {
      setError("Invalid credentials");
    }
  }

  return (
    <div className="min-h-screen w-full bg-neutral-50 grid place-items-center px-4">
      <div className="w-full max-w-[420px] bg-white rounded-3xl border border-neutral-200 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
        <Logo />
        <h1 className="mt-6 text-2xl font-bold text-ink">Admin Portal</h1>
        <p className="text-sm text-neutral-500 mt-1">Sign in to monitor the fleet.</p>
        <form onSubmit={submit} className="mt-6 space-y-3">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            autoComplete="username"
            className="w-full h-14 px-4 rounded-xl bg-neutral-50 outline-none focus:ring-2 focus:ring-ink/10"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            className="w-full h-14 px-4 rounded-xl bg-neutral-50 outline-none focus:ring-2 focus:ring-ink/10"
          />
          {error && <div className="text-sm text-red-600">{error}</div>}
          <button className="w-full h-14 rounded-xl bg-ink text-white font-semibold">Sign in</button>
        </form>
        <div className="mt-6 text-xs text-neutral-400 text-center">
          Demo: admin / cleantrack2024
        </div>
        <div className="mt-3 text-center">
          <Link to="/role" className="text-xs text-neutral-500 hover:text-ink">← Back to role selection</Link>
        </div>
      </div>
    </div>
  );
}