import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PlusIcon, TrashIcon } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { useT } from "@/lib/i18n";
import { useTrucks } from "@/store/trucks";
import { getWards, addWard, removeWard } from "@/lib/fleet.functions";

export const Route = createFileRoute("/admin/wards")({
  component: WardsPage,
});

function WardsPage() {
  const tr = useT();
  const qc = useQueryClient();
  const push = useToast((s) => s.push);
  const [adding, setAdding] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<{ id: string; name: string } | null>(null);

  // All trucks — used to check whether a ward is in use
  const allTrucks = useTrucks((s) => s.trucks);
  const trucksByWard = Object.values(allTrucks).reduce<Record<string, string[]>>((acc, lt) => {
    const w = lt.truck.wardName;
    if (w) (acc[w] ??= []).push(lt.id);
    return acc;
  }, {});

  // Load wards from database
  const { data, isLoading } = useQuery({
    queryKey: ["wards"],
    queryFn: () => getWards(),
    staleTime: 15_000,
  });

  const wards = data?.wards ?? [];

  const addMutation = useMutation({
    mutationFn: (name: string) => addWard({ data: { name } }),
    onSuccess: (res) => {
      if (!res.ok) {
        push({ title: tr("Error"), subtitle: res.error, tone: "warning" });
        return;
      }
      void qc.invalidateQueries({ queryKey: ["wards"] });
      push({ title: tr("Ward added successfully") });
    },
    onError: () => push({ title: tr("Failed to add ward"), tone: "warning" }),
  });

  const removeMutation = useMutation({
    mutationFn: (wardId: string) => removeWard({ data: { wardId } }),
    onSuccess: (res) => {
      if (!res.ok) {
        push({ title: tr("Error"), subtitle: res.error, tone: "warning" });
        return;
      }
      void qc.invalidateQueries({ queryKey: ["wards"] });
      push({ title: tr("Ward removed") });
    },
    onError: () => push({ title: tr("Failed to remove ward"), tone: "warning" }),
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">{tr("Ward Management")}</h1>
          <p className="text-sm text-neutral-500 mt-1">
            {wards.length} {tr("wards configured")}
          </p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="h-10 px-4 rounded-lg bg-ink text-white text-sm font-semibold flex items-center gap-2"
        >
          <PlusIcon className="w-4 h-4" /> {tr("Add Ward")}
        </button>
      </div>

      <div className="mt-6 rounded-2xl border border-neutral-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">{tr("Ward Name")}</th>
              <th className="text-left px-4 py-3 font-semibold">{tr("Assigned Trucks")}</th>
              <th className="text-left px-4 py-3 font-semibold">{tr("Created")}</th>
              <th className="text-right px-4 py-3 font-semibold">{tr("Actions")}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-neutral-400">
                  {tr("Loading wards…")}
                </td>
              </tr>
            ) : wards.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-neutral-400">
                  {tr("No wards configured yet. Click 'Add Ward' to create one.")}
                </td>
              </tr>
            ) : (
              wards.map((w, i) => {
                const assignedTrucks = trucksByWard[w.name] ?? [];
                return (
                  <tr
                    key={w.id}
                    className={`border-t border-neutral-100 ${i % 2 ? "bg-neutral-50/40" : ""}`}
                  >
                    <td className="px-4 py-3 font-semibold text-ink">{w.name}</td>
                    <td className="px-4 py-3">
                      {assignedTrucks.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {assignedTrucks.map((code) => (
                            <span
                              key={code}
                              className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-brand-soft text-brand"
                            >
                              {code}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-neutral-400">{tr("None")}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-neutral-500 text-xs">
                      {new Date(w.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setConfirmRemove({ id: w.id, name: w.name })}
                        className="p-2 rounded-md hover:bg-red-50 text-red-500"
                        title={tr("Delete ward")}
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add Ward Modal */}
      {adding && (
        <AddWardModal
          onClose={() => setAdding(false)}
          onSubmit={(name) => {
            addMutation.mutate(name);
            setAdding(false);
          }}
        />
      )}

      {/* Confirm Delete Modal */}
      {confirmRemove && (
        <ConfirmDeleteModal
          wardName={confirmRemove.name}
          assignedTrucks={trucksByWard[confirmRemove.name] ?? []}
          onCancel={() => setConfirmRemove(null)}
          onConfirm={() => {
            removeMutation.mutate(confirmRemove.id);
            setConfirmRemove(null);
          }}
        />
      )}
    </div>
  );
}

/* ── Add Ward Modal ──────────────────────────────────────────────────── */

function AddWardModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (name: string) => void }) {
  const tr = useT();
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const trimmed = name.trim();
    if (!trimmed) {
      setError(tr("Ward name is required"));
      return;
    }
    if (trimmed.length < 3) {
      setError(tr("Ward name must be at least 3 characters"));
      return;
    }
    onSubmit(trimmed);
  }

  return (
    <div className="fixed inset-0 z-[2000] bg-black/30 grid place-items-center px-4">
      <form onSubmit={submit} className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-ink">{tr("Add New Ward")}</h2>
        <div className="mt-5 space-y-3">
          <label className="block">
            <div className="text-xs font-semibold text-neutral-500 mb-1.5">{tr("Ward name")}</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              className="w-full h-11 px-3 rounded-lg bg-neutral-50 outline-none focus:ring-2 focus:ring-ink/10"
              placeholder={tr("e.g. Shirpur Ward 17 — New Area")}
              autoFocus
            />
          </label>
          <div className="text-[11px] text-neutral-400">
            {tr("Choose a descriptive name. Format: 'Shirpur Ward [number] — [area name]'")}
          </div>
        </div>
        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
        <div className="mt-5 flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-lg border border-neutral-200 text-sm font-semibold"
          >
            {tr("Cancel")}
          </button>
          <button type="submit" className="h-10 px-5 rounded-lg bg-ink text-white text-sm font-semibold">
            {tr("Add Ward")}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ── Confirm Delete Modal ────────────────────────────────────────────── */

function ConfirmDeleteModal({
  wardName,
  assignedTrucks,
  onCancel,
  onConfirm,
}: {
  wardName: string;
  assignedTrucks: string[];
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const tr = useT();
  const hasAssignments = assignedTrucks.length > 0;

  return (
    <div className="fixed inset-0 z-[2000] bg-black/30 grid place-items-center px-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
        <h2 className="text-lg font-bold text-ink">{tr("Delete ward?")}</h2>
        <p className="text-sm text-neutral-600 mt-2">
          <span className="font-semibold">{wardName}</span> {tr("will be permanently removed.")}
        </p>
        {hasAssignments && (
          <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-3">
            <p className="text-xs font-semibold text-amber-700">{tr("Warning: This ward is assigned to trucks")}</p>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {assignedTrucks.map((code) => (
                <span key={code} className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800">
                  {code}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-amber-600 mt-1.5">
              {tr("Reassign these trucks to another ward before deleting.")}
            </p>
          </div>
        )}
        <div className="mt-5 flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="h-10 px-4 rounded-lg border border-neutral-200 text-sm font-semibold"
          >
            {tr("Cancel")}
          </button>
          <button
            onClick={onConfirm}
            disabled={hasAssignments}
            className={`h-10 px-5 rounded-lg text-sm font-semibold ${
              hasAssignments
                ? "bg-neutral-200 text-neutral-400 cursor-not-allowed"
                : "bg-red-600 text-white hover:bg-red-700"
            }`}
          >
            {tr("Delete")}
          </button>
        </div>
      </div>
    </div>
  );
}
