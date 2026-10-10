import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { serverSignOut } from "@/lib/auth.functions";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/store/auth";
import { useSettings } from "@/store/settings";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useT } from "@/lib/i18n";
import { useI18n } from "@/store/i18n";
import { getMyBookings } from "@/lib/booking.functions";
import { LANGS } from "@/components/LanguageSwitcher";

export const Route = createFileRoute("/resident/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const tr = useT();
  const navigate = useNavigate();
  const session = useAuth((s) => s.session)!;
  const logout = useAuth((s) => s.logout);
  const queryClient = useQueryClient();
  const radius = useSettings((s) => s.alertRadius);
  const setRadius = useSettings((s) => s.setAlertRadius);
  const lang = useI18n((s) => s.residentLang);
  const setLang = useI18n((s) => s.setLang);
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState(radius);
  const dirty = draft !== radius;

  useEffect(() => {
    if (!langOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!langRef.current?.contains(e.target as Node)) {
        setLangOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLangOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [langOpen]);

  const phone = session.role === "resident" ? session.phone : "—";
  const initials = phone.slice(-2);
  const options = [100, 250, 500, 1000];

  const { data: bookingResult } = useQuery({
    queryKey: ["my-bookings"],
    queryFn: () => getMyBookings(),
    staleTime: 15_000,
  });
  const myBookings = bookingResult?.bookings ?? [];
  const pendingCount = myBookings.filter((b: { status: string }) => b.status === "pending").length;

  return (
    <div className="absolute inset-0 overflow-y-auto bg-white">
      <div className="px-6 pt-8 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-ink text-white grid place-items-center font-bold text-xl">
          {initials}
        </div>
        <div>
          <div className="font-bold text-ink">+91 {phone}</div>
          <div className="text-xs text-neutral-500">
            {tr("Resident")} · {session.role === "resident" ? session.city : ""}
          </div>
        </div>
      </div>

      <div className="px-6 mt-8">
        <h2 className="text-sm font-bold text-ink">{tr("Alert distance")}</h2>
        <p className="text-xs text-neutral-500 mt-1">
          {tr("You'll be alerted when truck is within")}{" "}
          {draft >= 1000 ? `${draft / 1000} km` : `${draft} m`}.
        </p>
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
            {tr("Save preferences")}
          </button>
        )}
      </div>

      <div className="px-6 mt-8">
        <button
          onClick={() => navigate({ to: "/resident/booking" })}
          className="w-full rounded-2xl border border-neutral-200 p-4 flex items-center justify-between hover:bg-neutral-50"
        >
          <div className="text-left">
            <div className="text-sm font-bold text-ink">{tr("Book a Big Dustbin")}</div>
            <div className="text-xs text-neutral-500 mt-0.5">
              {tr("For weddings, parties & functions")}
            </div>
            {myBookings.length > 0 && (
              <div className="text-[11px] text-neutral-400 mt-1">
                {myBookings.length} {myBookings.length === 1 ? tr("request") : tr("requests")}
                {pendingCount ? ` · ${pendingCount} ${tr("pending")}` : ""}
              </div>
            )}
          </div>
          <span className="text-neutral-400">›</span>
        </button>
      </div>

      <div className="px-6 mt-8 space-y-1">
        <button
          onClick={() => navigate({ to: "/resident/notifications" })}
          className="w-full flex items-center justify-between py-3 border-b border-neutral-100 text-left"
        >
          <div className="text-sm text-ink">{tr("Notifications")}</div>
          <div className="text-sm text-neutral-500">{tr("Manage")} ›</div>
        </button>
        <div ref={langRef} className="relative">
          <button
            type="button"
            onClick={() => setLangOpen((v) => !v)}
            className="w-full flex items-center justify-between py-3 border-b border-neutral-100 text-left hover:bg-neutral-50 transition-colors"
            aria-expanded={langOpen}
            aria-label={tr("Language")}
          >
            <div className="text-sm text-ink">{tr("Language")}</div>
            <div className="text-sm text-neutral-500 flex items-center gap-1.5">
              <span>{LANGS.find((l) => l.code === lang)?.native ?? "English"}</span>
              <svg
                viewBox="0 0 20 20"
                className={`w-3.5 h-3.5 text-neutral-400 transition-transform ${langOpen ? "rotate-180" : ""}`}
                fill="currentColor"
              >
                <path
                  d="M5.5 7.5l4.5 4.5 4.5-4.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </button>

          {langOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-neutral-200 rounded-xl shadow-xl overflow-hidden z-50 animate-fade-in">
              <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-neutral-400 font-bold">
                {tr("Language")}
              </div>
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => {
                    setLang(l.code, "resident");
                    setLangOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-neutral-50 transition-colors ${
                    lang === l.code ? "text-brand font-semibold" : "text-ink"
                  }`}
                >
                  <span className="w-6 h-6 rounded-full bg-neutral-100 grid place-items-center text-[10px] font-bold">
                    {l.flag}
                  </span>
                  <span className="flex-1 text-left">{l.native}</span>
                  {lang === l.code && (
                    <svg
                      viewBox="0 0 24 24"
                      className="w-4 h-4 text-brand"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        <Row label={tr("Help & Support")} value="›" />
        <Row label={tr("About CleanTrack")} value="v1.0" />
      </div>

      <div className="px-6 mt-8 pb-10">
        <button
          onClick={async () => {
            await serverSignOut();
            logout();
            queryClient.setQueryData(["server-session"], null);
            queryClient.removeQueries({ queryKey: ["server-session"] });
            navigate({ to: "/role" });
          }}
          className="w-full h-12 rounded-xl border border-red-200 text-red-600 font-semibold"
        >
          {tr("Logout")}
        </button>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  onClick,
}: {
  label: string;
  value: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center justify-between py-3 border-b border-neutral-100 ${
        onClick ? "cursor-pointer hover:bg-neutral-50 transition-colors" : ""
      }`}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div className="text-sm text-ink">{label}</div>
      <div className="text-sm text-neutral-500">{value}</div>
    </div>
  );
}
