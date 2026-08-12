import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth, type ApprovedDriver } from "@/store/auth";
import { TRUCKS } from "@/lib/trucks";
import { PlusIcon, EditIcon, TrashIcon } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/admin/drivers")({
  component: DriversPage,
});

function DriversPage() {
  const tr = useT();
  const drivers = useAuth((s) => s.approvedDrivers);
  const add = useAuth((s) => s.addDriver);
  const update = useAuth((s) => s.updateDriver);
  const remove = useAuth((s) => s.removeDriver);
  const push = useToast((s) => s.push);
  const [editing, setEditing] = useState<ApprovedDriver | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<ApprovedDriver | null>(null);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">{tr("Driver Management")}</h1>
          <p className="text-sm text-neutral-500 mt-1">{drivers.length} {tr("drivers approved")} · {TRUCKS.length - drivers.filter(d => d.active).length} {tr("trucks available")}</p>
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
            <AnimatePresence>
              {drivers.map((d, i) => {
                const truck = TRUCKS.find((t) => t.id === d.truckId);
                return (
                  <motion.tr
                    key={d.phone}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -20 }}
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
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {(adding || editing) && (
          <DriverModal
            existing={editing ?? undefined}
            onClose={() => { setAdding(false); setEditing(null); }}
            onSubmit={(d) => {
              if (editing) {
                const err = update(editing.phone, d);
                if (err) return err;
                push({ title: tr("Driver updated") });
              } else {
                const err = add(d);
                if (err) return err;
                push({ title: tr("Driver added successfully") });
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
              remove(confirmRemove.phone);
              push({ title: tr("Driver removed") });
              setConfirmRemove(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function DriverModal({ existing, onClose, onSubmit }: {
  existing?: ApprovedDriver;
  onClose: () => void;
  onSubmit: (d: Omit<ApprovedDriver, "active">) => string | null;
}) {
  const tr = useT();
  const drivers = useAuth((s) => s.approvedDrivers);
  const [name, setName] = useState(existing?.name ?? "");
  const [phone, setPhone] = useState(existing?.phone ?? "");
  const [truckId, setTruckId] = useState(existing?.truckId ?? TRUCKS[10].id);
  const [error, setError] = useState("");
  const ward = TRUCKS.find((t) => t.id === truckId)?.wardName ?? "—";

  const availableTrucks = TRUCKS.filter((t) => t.id === existing?.truckId || !drivers.some((d) => d.truckId === t.id && d.active));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const err = onSubmit({ name: name.trim(), phone: phone.trim(), truckId });
    if (err) setError(err);
    else onClose();
  }

  return (
    <motion.div className="fixed inset-0 z-[2000] bg-black/30 grid place-items-center px-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.form onSubmit={submit}
        initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }}
        className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-ink">{existing ? tr("Edit Driver") : tr("Add New Driver")}</h2>
        <div className="mt-5 space-y-3">
          <Field label={tr("Driver name")}>
            <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full h-11 px-3 rounded-lg bg-neutral-50 outline-none focus:ring-2 focus:ring-ink/10" />
          </Field>
          <Field label={tr("Mobile number")}>
            <div className="flex gap-2">
              <div className="h-11 px-3 grid place-items-center rounded-lg bg-neutral-50 font-semibold text-sm">+91</div>
              <input value={phone} maxLength={10} disabled={!!existing}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                className="flex-1 h-11 px-3 rounded-lg bg-neutral-50 outline-none focus:ring-2 focus:ring-ink/10 disabled:opacity-50" />
            </div>
          </Field>
          <Field label={tr("Assign truck")}>
            <select value={truckId} onChange={(e) => setTruckId(e.target.value)}
              className="w-full h-11 px-3 rounded-lg bg-neutral-50 outline-none focus:ring-2 focus:ring-ink/10">
              {availableTrucks.map((t) => (
                <option key={t.id} value={t.id}>{t.id} · {t.wardName.split("—")[0].trim()}</option>
              ))}
            </select>
          </Field>
          <div className="text-xs text-neutral-500">{tr("Ward")}: <span className="font-semibold text-ink">{ward}</span></div>
          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>
        <div className="mt-6 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 h-11 rounded-lg bg-neutral-100 font-semibold text-neutral-600">{tr("Cancel")}</button>
          <button type="submit" className="flex-1 h-11 rounded-lg bg-ink text-white font-semibold">{existing ? tr("Save changes") : tr("Add Driver")}</button>
        </div>
      </motion.form>
    </motion.div>
  );
}

function ConfirmModal({ driver, onCancel, onConfirm }: { driver: ApprovedDriver; onCancel: () => void; onConfirm: () => void }) {
  const tr = useT();
  return (
    <motion.div className="fixed inset-0 z-[2000] bg-black/30 grid place-items-center px-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }}
        className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center">
        <h2 className="text-lg font-bold text-ink">{tr("Remove driver?")}</h2>
        <p className="text-sm text-neutral-500 mt-2">{tr("Are you sure you want to remove")} {driver.name}? {tr("Their truck will go offline.")}</p>
        <div className="mt-5 flex gap-2">
          <button onClick={onCancel} className="flex-1 h-11 rounded-lg bg-neutral-100 font-semibold text-neutral-600">{tr("Cancel")}</button>
          <button onClick={onConfirm} className="flex-1 h-11 rounded-lg bg-red-500 text-white font-semibold">{tr("Remove Driver")}</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs font-semibold text-neutral-500 mb-1">{label}</div>
      {children}
    </label>
  );
}