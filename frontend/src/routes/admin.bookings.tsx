import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useBookings, type BookingStatus } from "@/store/bookings";
import { useToast } from "@/components/Toast";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/admin/bookings")({
  component: AdminBookings,
});

function AdminBookings() {
  const tr = useT();
  const bookings = useBookings((s) => s.bookings);
  const decide = useBookings((s) => s.decide);
  const push = useToast((s) => s.push);
  const [filter, setFilter] = useState<BookingStatus | "all">("all");

  const filtered = useMemo(
    () => [...bookings]
      .filter((b) => filter === "all" || b.status === filter)
      .sort((a, b) => b.createdAt - a.createdAt),
    [bookings, filter],
  );
  const counts = useMemo(() => ({
    all: bookings.length,
    pending: bookings.filter((b) => b.status === "pending").length,
    approved: bookings.filter((b) => b.status === "approved").length,
    rejected: bookings.filter((b) => b.status === "rejected").length,
  }), [bookings]);

  function act(id: string, status: "approved" | "rejected") {
    const note = status === "rejected" ? (window.prompt(tr("Reason for rejection (optional)")) || undefined) : undefined;
    decide(id, status, note);
    push({
      title: `${tr("Booking")} ${status === "approved" ? tr("approved") : tr("rejected")}`,
      subtitle: id,
      tone: status === "approved" ? "success" : "warning",
    });
  }

  return (
    <div className="absolute inset-0 overflow-y-auto p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-ink">{tr("Dustbin Bookings")}</h1>
        <p className="text-sm text-neutral-500 mt-1">{tr("Approve community dustbin requests from residents for functions and events.")}</p>
      </header>

      <div className="flex gap-2 mb-5">
        {(["all", "pending", "approved", "rejected"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`px-3.5 h-9 rounded-full text-xs font-semibold capitalize border transition-colors ${
              filter === k ? "bg-ink text-white border-ink" : "bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50"
            }`}
          >
            {tr(k)} <span className="opacity-60">({counts[k]})</span>
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-neutral-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">{tr("Booking")}</th>
              <th className="text-left px-4 py-3 font-semibold">{tr("Resident")}</th>
              <th className="text-left px-4 py-3 font-semibold">{tr("Address")}</th>
              <th className="text-left px-4 py-3 font-semibold">{tr("Reason")}</th>
              <th className="text-left px-4 py-3 font-semibold">{tr("Dates")}</th>
              <th className="text-left px-4 py-3 font-semibold">{tr("Status")}</th>
              <th className="text-right px-4 py-3 font-semibold">{tr("Action")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="text-center py-10 text-sm text-neutral-400">{tr("No bookings")}</td></tr>
            )}
            {filtered.map((b) => (
              <tr key={b.id} className="border-t border-neutral-100 align-top">
                <td className="px-4 py-3 font-mono text-xs text-neutral-500">{b.id}</td>
                <td className="px-4 py-3">
                  <div className="font-semibold text-ink">+91 {b.residentPhone}</div>
                  <div className="text-xs text-neutral-400">{b.city}</div>
                </td>
                <td className="px-4 py-3 text-neutral-700 max-w-[220px]">{b.address}</td>
                <td className="px-4 py-3 text-neutral-700 max-w-[260px]">{b.reason}</td>
                <td className="px-4 py-3 text-neutral-700 whitespace-nowrap">{b.fromDate}<div className="text-xs text-neutral-400">{tr("to")} {b.toDate}</div></td>
                <td className="px-4 py-3">
                  <StatusPill status={b.status} />
                  {b.adminNote && <div className="text-[11px] text-neutral-400 mt-1 italic">{b.adminNote}</div>}
                </td>
                <td className="px-4 py-3 text-right">
                  {b.status === "pending" ? (
                    <div className="inline-flex gap-2">
                      <button onClick={() => act(b.id, "approved")} className="h-8 px-3 rounded-lg bg-emerald-600 text-white text-xs font-semibold">{tr("Approve")}</button>
                      <button onClick={() => act(b.id, "rejected")} className="h-8 px-3 rounded-lg border border-neutral-200 text-xs font-semibold text-neutral-600 hover:bg-neutral-50">{tr("Reject")}</button>
                    </div>
                  ) : (
                    <span className="text-xs text-neutral-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: BookingStatus }) {
  const tr = useT();
  const map = {
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
  } as const;
  return <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${map[status]}`}>{tr(status)}</span>;
}