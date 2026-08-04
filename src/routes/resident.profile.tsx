import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { serverSignOut } from "@/lib/auth.functions";
import { useState } from "react";
import { useAuth } from "@/store/auth";
import { useSettings } from "@/store/settings";
import { useBookings } from "@/store/bookings";

export const Route = createFileRoute("/resident/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const session = useAuth((s) => s.session)!;
  const logout = useAuth((s) => s.logout);
  const radius = useSettings((s) => s.alertRadius);
  const setRadius = useSettings((s) => s.setAlertRadius);
  const [draft, setDraft] = useState(radius);
  const dirty = draft !== radius;

  const phone = session.role === "resident" ? session.phone : "—";
  const initials = phone.slice(-2);
  const options = [100, 250, 500, 1000];
  const allBookings = useBookings((s) => s.bookings);
  const myBookings = allBookings.filter((b) => b.residentPhone === phone);
  const pendingCount = myBookings.filter((b) => b.status === "pending").length;

  return (
    <div className="absolute inset-0 overflow-y-auto bg-white">
      <div className="px-6 pt-8 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-ink text-white grid place-items-center font-bold text-xl">{initials}</div>
        <div>
          <div className="font-bold text-ink">+91 {phone}</div>
          <div className="text-xs text-neutral-500">Resident · {session.role === "resident" ? session.city : ""}</div>
        </div>
      </div>

      <div className="px-6 mt-8">
        <h2 className="text-sm font-bold text-ink">Alert distance</h2>
        <p className="text-xs text-neutral-500 mt-1">You'll be alerted when truck is within {draft >= 1000 ? `${draft / 1000} km` : `${draft} m`}.</p>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {options.map((o) => (
            <button
              key={o}
              onClick={() => setDraft(o)}
              className={`h-10 rounded-full text-sm font-semibold transition-colors ${
                draft === o ? "bg-ink text-white" : "bg-neutral-100 text-neutral-600"
              }`}
            >
              {o >= 1000 ? `${o / 1000}km` : `${o}m`}
            </button>
          ))}
        </div>
        {dirty && (
          <button
            onClick={() => setRadius(draft)}
            className="mt-4 w-full h-12 rounded-xl bg-brand text-white font-semibold"
          >
            Save preferences
          </button>
        )}
      </div>

      <div className="px-6 mt-8">
        <button
          onClick={() => navigate({ to: "/resident/booking" })}
          className="w-full rounded-2xl border border-neutral-200 p-4 flex items-center justify-between hover:bg-neutral-50"
        >
          <div className="text-left">
            <div className="text-sm font-bold text-ink">Book a Big Dustbin</div>
            <div className="text-xs text-neutral-500 mt-0.5">For weddings, parties & functions</div>
            {myBookings.length > 0 && (
              <div className="text-[11px] text-neutral-400 mt-1">{myBookings.length} request{myBookings.length === 1 ? "" : "s"}{pendingCount ? ` · ${pendingCount} pending` : ""}</div>
            )}
          </div>
          <span className="text-neutral-400">›</span>
        </button>
      </div>

      <div className="px-6 mt-8 space-y-1">
        <Row label="Notifications" value="On" />
        <Row label="Language" value="English" />
        <Row label="Help & Support" value="›" />
        <Row label="About CleanTrack" value="v1.0" />
      </div>

      <div className="px-6 mt-8 pb-10">
        <button
          onClick={async () => { await serverSignOut(); logout(); navigate({ to: "/role" }); }}
          className="w-full h-12 rounded-xl border border-red-200 text-red-600 font-semibold"
        >
          Logout
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-neutral-100">
      <div className="text-sm text-ink">{label}</div>
      <div className="text-sm text-neutral-500">{value}</div>
    </div>
  );
}