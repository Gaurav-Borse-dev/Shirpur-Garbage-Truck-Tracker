import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, type ApprovedDriver } from "@/store/auth";
import { useTrucks } from "@/store/trucks";
import { PlusIcon, EditIcon, TrashIcon } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { useT } from "@/lib/i18n";
import { getFleetDrivers } from "@/lib/tracking.functions";
import { addFleetDriver, updateFleetDriver, removeFleetDriver } from "@/lib/fleet.functions";

export const Route = createFileRoute("/admin/drivers")({
  component: DriversPage,
});

function DriversPage() {
  const tr = useT();
  const qc = useQueryClient();
  const allTrucks = useTrucks((s) => s.trucks);
  const truckList = useMemo(() => Object.values(allTrucks).map((lt) => lt.truck), [allTrucks]);
  const push = useToast((s) => s.push);
  const [editing, setEditing] = useState<ApprovedDriver | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<ApprovedDriver | null>(null);

  // Load drivers from database
  const { data: dbDrivers } = useQuery({
    queryKey: ["fleet-drivers"],
    queryFn: () => getFleetDrivers(),
    staleTime: 15_000,
  });

  // Map DB drivers to the ApprovedDriver shape the UI expects
  const drivers: ApprovedDriver[] = useMemo(() => {
    if (!dbDrivers?.drivers?.length) {
      // Fallback to local store if DB not loaded
      return useAuth.getState().approvedDrivers;
    }
    return dbDrivers.drivers.map((d) => ({
      name: d.name,
      phone: d.phone,
      truckId: d.assignedTruckCode ?? "",
      active: d.onDuty,
      dbId: d.dbId,
    }));
  }, [dbDrivers]);

  const addMutation = useMutation({
    mutationFn: (d: { name: string; phone: string; truckId: string }) =>
      addFleetDriver({ data: { name: d.name, phone: d.phone, licenseNo: "N/A", truckCode: d.truckId } }),
    onSuccess: (res) => {
      if (!res.ok) {
        push({ title: tr("Error"), subtitle: res.error, tone: "warning" });
        return;
      }
      void qc.invalidateQueries({ queryKey: ["fleet-drivers"] });
      push({ title: tr("Driver added successfully") });
    },
    onError: () => push({ title: tr("Failed to add driver"), tone: "warning" }),
  });

  const updateMutation = useMutation({
    mutationFn: (d: { driverId: string; name?: string; phone?: string; truckCode?: string; active?: boolean }) =>
      updateFleetDriver({ data: d }),
    onSuccess: (res) => {
      if (!res.ok) {
        push({ title: tr("Error"), subtitle: res.error, tone: "warning" });
        return;
      }
      void qc.invalidateQueries({ queryKey: ["fleet-drivers"] });
      push({ title: tr("Driver updated") });
    },
    onError: () => push({ title: tr("Failed to update driver"), tone: "warning" }),
  });

  const removeMutation = useMutation({
    mutationFn: (driverId: string) => removeFleetDriver({ data: { driverId } }),
    onSuccess: (res) => {
      if (!res.ok) {
        push({ title: tr("Error"), subtitle: res.error, tone: "warning" });
        return;
      }
      void qc.invalidateQueries({ queryKey: ["fleet-drivers"] });
      push({ title: tr("Driver removed") });
    },
    onError: () => push({ title: tr("Failed to remove driver"), tone: "warning" }),
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">{tr("Driver Management")}</h1>
          <p className="text-sm text-neutral-500 mt-1">{drivers.length} {tr("drivers approved")} · {truckList.length - drivers.filter(d => d.active).length} {tr("trucks available")}</p>
        </div>
        <button onClick={() => setAdding(true)} className="h-10 px-4 rounded-lg bg-ink text-white text-sm font-semibold flex items-center gap-2">
          <PlusIcon className="w-4 h-4" /> {tr("Add Driver")}
        </button>
      </div>

      <div className="mt-6 rounded-2xl border border-neutral-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">{tr("Name")}</th>
              <th className="text-left px-4 py-3 font-semibold">{tr("Mobile")}</th>
              <th className="text-left px-4 py-3 font-semibold">{tr("Truck")}</th>
              <th className="text-left px-4 py-3 font-semibold">{tr("Ward")}</th>
              <th className="text-left px-4 py-3 font-semibold">{tr("Status")}</th>
              <th className="text-right px-4 py-3 font-semibold">{tr("Actions")}</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((d, i) => {
              const truck = truckList.find((t) => t.id === d.truckId);
              return (
                <tr
                  key={d.phone}
                  className={`border-t border-neutral-100 ${i % 2 ? "bg-neutral-50/40" : ""}`}
                >
                  <td className="px-4 py-3 font-semibold text-ink">{d.name}</td>
                  <td className="px-4 py-3 text-neutral-600">+91 {d.phone}</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-brand-soft text-brand">{d.truckId}</span></td>
                  <td className="px-4 py-3 text-neutral-600 text-xs">{truck?.wardName ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`ct-pill ${d.active ? "bg-brand-soft text-brand" : "bg-neutral-100 text-neutral-500"}`}>
                      {d.active ? tr("Active") : tr("Inactive")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setEditing(d)} className="p-2 rounded-md hover:bg-neutral-100 text-neutral-500"><EditIcon className="w-4 h-4" /></button>
                    <button onClick={() => setConfirmRemove(d)} className="p-2 rounded-md hover:bg-red-50 text-red-500"><TrashIcon className="w-4 h-4" /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {(adding || editing) && (
        <DriverModal
          existing={editing ?? undefined}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSubmit={(d) => {
            if (editing) {
              if (!editing.dbId) {
                push({ title: tr("Cannot update — driver not in database yet"), tone: "warning" });
                return null;
              }
              updateMutation.mutate({
                driverId: editing.dbId,
                name: d.name,
                phone: d.phone,
                truckCode: d.truckId,
              });
            } else {
              addMutation.mutate(d);
            }
            return null;
          }}
        />
      )}
      {confirmRemove && (
        <ConfirmModal
          driver={confirmRemove}
          onCancel={() => setConfirmRemove(null)}
          onConfirm={() => {
            if (confirmRemove.dbId) {
              removeMutation.mutate(confirmRemove.dbId);
            } else {
              push({ title: tr("Cannot remove — driver not in database"), tone: "warning" });
            }
            setConfirmRemove(null);
          }}
        />
      )}
    </div>
  );
}

function DriverModal({ existing, onClose, onSubmit }: {
  existing?: ApprovedDriver;
  onClose: () => void;
  onSubmit: (d: Omit<ApprovedDriver, "active">) => string | null;
}) {
  const tr = useT();
  const allTrucks = useTrucks((s) => s.trucks);
  const truckList = useMemo(() => Object.values(allTrucks).map((lt) => lt.truck), [allTrucks]);
  const [name, setName] = useState(existing?.name ?? "");
  const [phone, setPhone] = useState(existing?.phone ?? "");
  const [truckId, setTruckId] = useState(existing?.truckId ?? truckList[0]?.id ?? "GBR-01");
  const [error, setError] = useState("");
  const ward = truckList.find((t) => t.id === truckId)?.wardName ?? "—";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) { setError(tr("Name is required")); return; }
    if (!/^\d{10}$/.test(phone)) { setError(tr("Phone must be 10 digits")); return; }
    const err = onSubmit({ name: name.trim(), phone: phone.trim(), truckId });
    if (err) setError(err);
    else onClose();
  }

  return (
    <div className="fixed inset-0 z-[2000] bg-black/30 grid place-items-center px-4">
      <form onSubmit={submit}
        className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-ink">{existing ? tr("Edit Driver") : tr("Add New Driver")}</h2>
        <div className="mt-5 space-y-3">
          <Field label={tr("Driver name")}>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60}
              className="w-full h-11 px-3 rounded-lg bg-neutral-50 outline-none focus:ring-2 focus:ring-ink/10" placeholder={tr("Full name")} />
          </Field>
          <Field label={tr("Mobile number")}>
            <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              className="w-full h-11 px-3 rounded-lg bg-neutral-50 outline-none focus:ring-2 focus:ring-ink/10" placeholder={tr("10-digit number")}
              disabled={!!existing} />
          </Field>
          <Field label={tr("Assigned truck")}>
            <select value={truckId} onChange={(e) => setTruckId(e.target.value)}
              className="w-full h-11 px-3 rounded-lg bg-neutral-50 outline-none focus:ring-2 focus:ring-ink/10">
              {truckList.map((t) => (
                <option key={t.id} value={t.id}>{t.id} · {t.wardName}</option>
              ))}
            </select>
          </Field>
          <div className="text-xs text-neutral-500">{tr("Ward")}: {ward}</div>
        </div>
        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
        <div className="mt-5 flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="h-10 px-4 rounded-lg border border-neutral-200 text-sm font-semibold">{tr("Cancel")}</button>
          <button type="submit" className="h-10 px-5 rounded-lg bg-ink text-white text-sm font-semibold">{tr("Save")}</button>
        </div>
      </form>
    </div>
  );
}

function ConfirmModal({ driver, onCancel, onConfirm }: {
  driver: ApprovedDriver;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const tr = useT();
  return (
    <div className="fixed inset-0 z-[2000] bg-black/30 grid place-items-center px-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
        <h2 className="text-lg font-bold text-ink">{tr("Remove driver?")}</h2>
        <p className="text-sm text-neutral-600 mt-2">{driver.name} (+91 {driver.phone}) {tr("will be removed from the fleet.")}</p>
        <div className="mt-5 flex gap-2 justify-end">
          <button onClick={onCancel} className="h-10 px-4 rounded-lg border border-neutral-200 text-sm font-semibold">{tr("Cancel")}</button>
          <button onClick={onConfirm} className="h-10 px-5 rounded-lg bg-red-600 text-white text-sm font-semibold">{tr("Remove")}</button>
        </div>
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