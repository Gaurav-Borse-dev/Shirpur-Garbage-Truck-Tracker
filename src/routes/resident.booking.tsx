import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useAuth } from "@/store/auth";
import { useBookings, type DustbinBooking } from "@/store/bookings";
import { useToast } from "@/components/Toast";

export const Route = createFileRoute("/resident/booking")({
  component: BookingPage,
});

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function BookingPage() {
  const session = useAuth((s) => s.session)!;
  const phone = session.role === "resident" ? session.phone : "";
  const city = session.role === "resident" ? session.city : "Shirpur";
  const create = useBookings((s) => s.create);
  const all = useBookings((s) => s.bookings);
  const mine = useMemo(
    () => all.filter((x) => x.residentPhone === phone).sort((a, b) => b.createdAt - a.createdAt),
    [all, phone],
  );
  const push = useToast((s) => s.push);
  const navigate = useNavigate();

  const [address, setAddress] = useState("");
  const [reason, setReason] = useState("");
  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState(todayStr());
  const [err, setErr] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (address.trim().length < 5) return setErr("Please enter a full venue address.");
    if (reason.trim().length < 5) return setErr("Please describe the reason (min 5 chars).");
    if (!fromDate || !toDate) return setErr("Choose both dates.");
    if (fromDate > toDate) return setErr("From date must be before To date.");
    if (fromDate < todayStr()) return setErr("From date cannot be in the past.");
    create({
      residentPhone: phone,
      city,
      address: address.trim(),
      reason: reason.trim(),
      fromDate,
      toDate,
    });
    push({ title: "Booking submitted", subtitle: "Admin will review shortly", tone: "success" });
    setAddress("");
    setReason("");
  }

  return (
    <div className="absolute inset-0 overflow-y-auto bg-white pb-16">
      <div className="px-6 pt-6 flex items-center gap-3">
        <button onClick={() => navigate({ to: "/resident/profile" })} className="text-sm text-neutral-500">‹ Back</button>
      </div>
      <div className="px-6 pt-2">
        <h1 className="text-2xl font-bold text-ink">Book a Big Dustbin</h1>
        <p className="text-sm text-neutral-500 mt-1">For weddings, functions and large gatherings. Municipality will deliver a community dustbin to your venue.</p>
      </div>

      <form onSubmit={submit} className="px-6 mt-5 space-y-4">
        <Field label="Venue address">
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            maxLength={200}
            rows={2}
            placeholder="House no., street, landmark"
            className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-ink"
          />
        </Field>
        <Field label="Reason for booking">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={300}
            rows={3}
            placeholder="e.g. Wedding reception, birthday party, society function"
            className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-ink"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From date">
            <input
              type="date"
              value={fromDate}
              min={todayStr()}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 px-3 h-11 text-sm outline-none focus:border-ink"
            />
          </Field>
          <Field label="To date">
            <input
              type="date"
              value={toDate}
              min={fromDate || todayStr()}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 px-3 h-11 text-sm outline-none focus:border-ink"
            />
          </Field>
        </div>
        {err && <div className="text-xs text-red-600">{err}</div>}
        <button type="submit" className="w-full h-12 rounded-xl bg-ink text-white font-semibold">
          Submit booking request
        </button>
      </form>

      <div className="px-6 mt-8">
        <h2 className="text-sm font-bold text-ink">Your bookings</h2>
        {mine.length === 0 ? (
          <div className="mt-3 text-xs text-neutral-400">No bookings yet.</div>
        ) : (
          <div className="mt-3 space-y-2">
            {mine.map((b) => (
              <BookingCard key={b.id} b={b} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs font-semibold text-neutral-500 mb-1.5">{label}</div>
      {children}
    </label>
  );
}

function BookingCard({ b }: { b: DustbinBooking }) {
  const toneMap = {
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
  } as const;
  return (
    <div className="rounded-2xl border border-neutral-200 p-3.5">
      <div className="flex items-center justify-between">
        <div className="text-xs font-mono text-neutral-400">{b.id}</div>
        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${toneMap[b.status]}`}>{b.status}</span>
      </div>
      <div className="mt-1.5 text-sm font-semibold text-ink">{b.reason}</div>
      <div className="text-xs text-neutral-500 mt-0.5">{b.address}</div>
      <div className="text-xs text-neutral-600 mt-2">{b.fromDate} → {b.toDate}</div>
      {b.adminNote && <div className="mt-2 text-xs text-neutral-500 italic">Admin: {b.adminNote}</div>}
    </div>
  );
}