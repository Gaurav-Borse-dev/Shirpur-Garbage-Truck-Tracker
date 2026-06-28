import { TruckIcon } from "./icons";

export function Logo({ size = 56 }: { size?: number }) {
  return (
    <div className="inline-flex items-center gap-2.5">
      <div
        className="grid place-items-center rounded-2xl bg-brand-soft text-brand"
        style={{ width: size, height: size }}
      >
        <TruckIcon className="w-6 h-6" />
      </div>
      <div className="font-extrabold text-xl tracking-tight text-ink">CleanTrack</div>
    </div>
  );
}