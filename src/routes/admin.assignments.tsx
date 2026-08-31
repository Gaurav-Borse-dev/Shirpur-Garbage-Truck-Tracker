import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useTrucks } from "@/store/trucks";
import { useToast } from "@/components/Toast";
import { CheckIcon } from "@/components/icons";
import { useT } from "@/lib/i18n";
import { updateTruckAssignment } from "@/lib/fleet.functions";

export const Route = createFileRoute("/admin/assignments")({
  component: AssignmentsPage,
});

function AssignmentsPage() {
  const tr = useT();
  useTrucks((s) => s.tick);
  const trucks = useTrucks((s) => s.trucks);
  const push = useToast((s) => s.push);
  const list = useMemo(() => Object.values(trucks), [trucks]);
  const [selectedId, setSelectedId] = useState<string>(list[0]?.id ?? "");
  const selected = trucks[selectedId];

  const [ward, setWard] = useState(selected?.truck.wardName ?? "");
  const [city, setCity] = useState(selected?.truck.city ?? "Shirpur");
  const [error, setError] = useState("");
  const [justSaved, setJustSaved] = useState(false);

  // Sync inputs when truck selection changes
  useEffect(() => {
    if (selected) {
      setWard(selected.truck.wardName);
      setCity(selected.truck.city as string);
      setError("");
      setJustSaved(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const assignMutation = useMutation({
    mutationFn: (args: { truckCode: string; ward: string }) =>
      updateTruckAssignment({ data: args }),
    onSuccess: (res) => {
      if (!res.ok) {
        setError(res.error ?? "Failed to update assignment");
        return;
      }
      // Also update local store for immediate UI feedback
      const currentTrucks = useTrucks.getState().trucks;
      const target = currentTrucks[selectedId];
      if (target) {
        useTrucks.setState({
          trucks: {
            ...currentTrucks,
            [selectedId]: {
              ...target,
              truck: { ...target.truck, wardName: ward.trim() },
            },
          },
          tick: useTrucks.getState().tick + 1,
        });
      }
      push({ title: tr("Assignment updated"), subtitle: `${selectedId} ${tr("now covers")} ${ward}` });
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1800);
    },
    onError: () => setError("Network error. Please try again."),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setJustSaved(false);
    if (!selectedId || !ward.trim()) return;
    assignMutation.mutate({ truckCode: selectedId, ward: ward.trim() });
  }

  return (
    <div className="p-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">{tr("Route Assignments")}</h1>
          <p className="text-sm text-neutral-500 mt-1">
            {tr("Reassign a truck's ward and city. Drivers receive the new route instantly.")}
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-[320px_1fr] gap-4">
        <div className="rounded-2xl border border-neutral-200 max-h-[640px] overflow-y-auto divide-y divide-neutral-100">
          {list.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedId(t.id)}
              className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-neutral-50 ${
                selectedId === t.id ? "bg-neutral-50" : ""
              }`}
            >
              <span
                className={`px-2 py-0.5 rounded-md text-[11px] font-bold text-white ${
                  t.status === "offline" ? "bg-neutral-400" : "bg-brand"
                }`}
              >
                {t.id}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-ink truncate">{t.truck.driverName}</div>
                <div className="text-xs text-neutral-500 truncate">{t.truck.wardName}</div>
              </div>
              <span className="text-[10px] uppercase tracking-wider font-bold text-neutral-400">
                {t.truck.city}
              </span>
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-neutral-200 p-6">
          {!selected ? (
            <div className="text-sm text-neutral-500">{tr("Select a truck to reassign.")}</div>
          ) : (
            <form onSubmit={submit} className="max-w-xl">
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 rounded-md text-xs font-bold text-white bg-brand">
                  {selected.id}
                </span>
                <div>
                  <div className="font-bold text-ink">{selected.truck.driverName}</div>
                  <div className="text-xs text-neutral-500">+91 {selected.truck.driverPhone}</div>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <Field label={tr("Assigned ward")}>
                  <input
                    value={ward}
                    onChange={(e) => setWard(e.target.value)}
                    maxLength={80}
                    placeholder={tr("e.g. Shirpur Ward 4 — Subhash Nagar")}
                    className="w-full h-11 px-3 rounded-lg bg-neutral-50 outline-none focus:ring-2 focus:ring-ink/10"
                  />
                  <div className="text-[11px] text-neutral-400 mt-1">{tr("3–80 characters")}</div>
                </Field>
                <Field label={tr("City")}>
                  <div className="h-11 px-3 rounded-lg bg-neutral-50 flex items-center text-sm font-semibold text-ink">
                    {city}
                  </div>
                </Field>
              </div>

              <div className="mt-6 rounded-xl bg-neutral-50 p-4 text-xs text-neutral-600 leading-relaxed">
                {tr("Saving resets the route for")} {selected.id} {tr("to a freshly generated collection loop centered on the selected city. The driver's app updates instantly — no app restart required.")}
              </div>

              {error && (
                <div className="mt-4 text-sm text-red-600 ct-shake">{error}</div>
              )}

              <div className="mt-6 flex items-center gap-3">
                <button
                  type="submit"
                  className="h-11 px-6 rounded-lg bg-ink text-white font-semibold"
                >
                  {tr("Apply assignment")}
                </button>
                {justSaved && (
                  <motion.div
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-1 text-sm text-brand font-semibold"
                  >
                    <CheckIcon className="w-4 h-4" /> {tr("Synced to driver")}
                  </motion.div>
                )}
              </div>
            </form>
          )}
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