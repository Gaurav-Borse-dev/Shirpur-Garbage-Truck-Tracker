import { TruckIcon } from "./icons";
import { useT } from "@/lib/i18n";

export function Logo({ size = 56 }: { size?: number }) {
  const tr = useT();
  return (
    <div className="inline-flex items-center gap-2.5">
      <div
        className="grid place-items-center rounded-2xl bg-brand-soft text-brand"
        style={{ width: size, height: size }}
      >
        <TruckIcon className="w-6 h-6" />
      </div>
      <div className="font-extrabold text-xl tracking-tight text-ink">{tr("CleanTrack")}</div>
    </div>
  );
}