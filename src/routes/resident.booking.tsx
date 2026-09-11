import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/store/auth";
import { useToast } from "@/components/Toast";
import { useT } from "@/lib/i18n";
import { createBooking, getMyBookings } from "@/lib/booking.functions";

export const Route = createFileRoute("/resident/booking")({
  component: BookingPage,
});

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

type BookingRow = {
  id: string;
  residentPhone: string;
  city: string;
  address: string;
  reason: string;
  fromDate: string;
  toDate: string;
  status: "pending" | "approved" | "rejected";
  adminNote?: string;
  createdAt: number;
};

function BookingPage() {
  const tr = useT();
  const session = useAuth((s) => s.session)!;
  const phone = session.role === "resident" ? session.phone : "";
  const qc = useQueryClient();
  const push = useToast((s) => s.push);
  const navigate = useNavigate();

  // Load bookings from database
  const { data: result } = useQuery({
    queryKey: ["my-bookings"],
    queryFn: () => getMyBookings(),
    staleTime: 15_000,
  });

  const mine: BookingRow[] = useMemo(() => {
    return ((result?.bookings ?? []) as BookingRow[]).sort((a, b) => b.createdAt - a.createdAt);
  }, [result]);

  const [address, setAddress] = useState("");
  const [reason, setReason] = useState("");
  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState(todayStr());
  const [err, setErr] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (data: { address: string; reason: string; fromDate: string; toDate: string }) =>
      createBooking({ data }),
    onSuccess: (res) => {
      if (!res.ok) {
        setErr(res.error ?? "Failed to submit booking");
        return;
      }
      void qc.invalidateQueries({ queryKey: ["my-bookings"] });
      push({ title: tr("Booking submitted"), subtitle: tr("Admin will review shortly"), tone: "success" });
      setAddress("");
      setReason("");
    },
    onError: () => setErr("Network error. Please try again."),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (address.trim().length < 5) return setErr(tr("Please enter a full venue address."));
    if (reason.trim().length < 5) return setErr(tr("Please describe the reason (min 5 chars)."));
    if (!fromDate || !toDate) return setErr(tr("Choose both dates."));
    if (fromDate > toDate) return setErr(tr("From date must be before To date."));
    if (fromDate < todayStr()) return setErr(tr("From date cannot be in the past."));
    createMutation.mutate({
      address: address.trim(),
      reason: reason.trim(),
      fromDate,
      toDate,
    });
  }

  return (
    <div className="absolute inset-0 overflow-y-auto bg-white pb-16">
      <div className="px-6 pt-6 flex items-center gap-3">
        <button onClick={() => navigate({ to: "/resident/profile" })} className="text-sm text-neutral-500">‹ {tr("Back")}</button>
      </div>
      <div className="px-6 pt-2">
        <h1 className="text-2xl font-bold text-ink">{tr("Book a Big Dustbin")}</h1>
        <p className="text-sm text-neutral-500 mt-1">{tr("For weddings, functions and large gatherings. Municipality will deliver a community dustbin to your venue.")}</p>
      </div>

      <form onSubmit={submit} className="px-6 mt-5 space-y-4">
        <Field label={tr("Venue address")}>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            maxLength={200}
            rows={2}
            placeholder={tr("House no., street, landmark")}
            className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-ink"
          />
        </Field>
        <Field label={tr("Reason for booking")}>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={300}
            rows={3}
            placeholder={tr("e.g. Wedding reception, birthday party, society function")}
            className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-ink"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={tr("From date")}>
            <input
              type="date"
              value={fromDate}
              min={todayStr()}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 px-3 h-11 text-sm outline-none focus:border-ink"
            />
          </Field>
          <Field label={tr("To date")}>
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
        <button type="submit" disabled={createMutation.isPending} className="w-full h-12 rounded-xl bg-ink text-white font-semibold disabled:opacity-60">
          {createMutation.isPending ? tr("Submitting...") : tr("Submit booking request")}
        </button>
      </form>

      <div className="px-6 mt-8">
        <h2 className="text-sm font-bold text-ink">{tr("Your bookings")}</h2>
        {mine.length === 0 ? (
          <div className="mt-3 text-xs text-neutral-400">{tr("No bookings yet.")}</div>
        ) : (
          <div className="mt-3 space-y-2">
            {mine.map((b) => (
              <BookingCard key={b.id} b={b} tr={tr} />
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

function BookingCard({ b, tr }: { b: BookingRow; tr: (k: string) => string }) {
  const toneMap = {
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
  } as const;
  const statusLabelMap = { pending: tr("pending"), approved: tr("approved"), rejected: tr("rejected") } as const;
  return (
    <div className="rounded-2xl border border-neutral-200 p-3.5">
      <div className="flex items-center justify-between">
        <div className="text-xs font-mono text-neutral-400">{b.id.slice(0, 8)}</div>
        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${toneMap[b.status]}`}>{statusLabelMap[b.status]}</span>
      </div>
      <div className="mt-1.5 text-sm font-semibold text-ink">{b.reason}</div>
      <div className="text-xs text-neutral-500 mt-0.5">{b.address}</div>
      <div className="text-xs text-neutral-600 mt-2">{b.fromDate} → {b.toDate}</div>
      {b.adminNote && <div className="mt-2 text-xs text-neutral-500 italic">{tr("Admin:")} {b.adminNote}</div>}
    </div>
  );
}