import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline } from "react-leaflet";
import L from "leaflet";
import { ClientOnly } from "@/components/ClientOnly";
import { useTrucks } from "@/store/trucks";
import { haversine } from "@/lib/geo";
import { useFormat } from "@/lib/format";

const CARTO_URL = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png";

export const Route = createFileRoute("/admin/replay")({
  component: ReplayPage,
});

function ReplayPage() {
  const fmt = useFormat();
  useTrucks((s) => s.tick);
  const trucks = useTrucks((s) => s.trucks);
  const list = useMemo(() => Object.values(trucks), [trucks]);
  const [truckId, setTruckId] = useState<string>(list[0]?.id ?? "");
  const truck = trucks[truckId];
  const history = truck?.history ?? [];

  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);

  // Clamp idx when history grows / shrinks
  useEffect(() => {
    if (idx >= history.length) setIdx(Math.max(0, history.length - 1));
  }, [history.length, idx]);

  // Playback
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);
  useEffect(() => {
    if (!playing) return;
    lastTickRef.current = performance.now();
    const tick = (now: number) => {
      const dt = now - lastTickRef.current;
      lastTickRef.current = now;
      const step = (dt / 500) * speed; // 1 history point = 500ms real
      setIdx((i) => {
        const next = i + step;
        if (next >= history.length - 1) {
          setPlaying(false);
          return history.length - 1;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, speed, history.length]);

  const iFloor = Math.floor(idx);
  const visible = history.slice(0, iFloor + 1);
  const current = history[iFloor];
  const totalDistance = useMemo(() => {
    let d = 0;
    for (let i = 1; i < visible.length; i++) d += haversine(visible[i - 1].pos, visible[i].pos);
    return d;
  }, [visible.length]); // eslint-disable-line

  const startedAt = history[0]?.at;
  const elapsedSec = current && startedAt ? Math.round((current.at - startedAt) / 1000) : 0;

  return (
    <div className="p-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Route Replay</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Scrub through a truck's recorded movement and replay the full collection loop.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-neutral-500 mr-2">Truck</label>
          <select
            value={truckId}
            onChange={(e) => {
              setTruckId(e.target.value);
              setIdx(0);
              setPlaying(false);
            }}
            className="h-10 px-3 rounded-lg bg-neutral-50 outline-none focus:ring-2 focus:ring-ink/10 text-sm"
          >
            {list.map((t) => (
              <option key={t.id} value={t.id}>
                {t.id} · {t.truck.driverName}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-[1fr_320px] gap-4">
        <div className="rounded-2xl border border-neutral-200 overflow-hidden h-[560px]">
          <ClientOnly fallback={<div className="w-full h-full bg-neutral-50" />}>
            {truck && history.length >= 2 ? (
              <ReplayMap
                trail={visible.map((h) => [h.pos.lat, h.pos.lng] as [number, number])}
                full={history.map((h) => [h.pos.lat, h.pos.lng] as [number, number])}
                cursor={current ? [current.pos.lat, current.pos.lng] : null}
              />
            ) : (
              <div className="w-full h-full grid place-items-center text-sm text-neutral-500 px-8 text-center">
                Collecting movement history… Recordings appear within a few seconds once the truck is online.
              </div>
            )}
          </ClientOnly>
        </div>

        <div className="rounded-2xl border border-neutral-200 p-5 flex flex-col">
          {truck ? (
            <>
              <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Recording
              </div>
              <div className="font-bold text-ink mt-1">
                {truck.id} · {truck.truck.driverName}
              </div>
              <div className="text-xs text-neutral-500">{truck.truck.wardName}</div>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <Stat label="Frames" value={history.length} />
                <Stat label="Elapsed" value={`${elapsedSec}s`} />
                <Stat label="Distance" value={fmt.distance(totalDistance)} />
                <Stat
                  label="Position"
                  value={`${Math.min(iFloor + 1, history.length)}/${history.length}`}
                />
              </div>

              <div className="mt-6">
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, history.length - 1)}
                  value={iFloor}
                  onChange={(e) => {
                    setPlaying(false);
                    setIdx(Number(e.target.value));
                  }}
                  className="w-full accent-[color:var(--ink)]"
                />
              </div>

              <div className="mt-4 flex items-center gap-2">
                <button
                  disabled={history.length < 2}
                  onClick={() => {
                    if (idx >= history.length - 1) setIdx(0);
                    setPlaying((p) => !p);
                  }}
                  className="flex-1 h-11 rounded-lg bg-ink text-white font-semibold disabled:bg-neutral-200 disabled:text-neutral-400"
                >
                  {playing ? "Pause" : "Play"}
                </button>
                <button
                  onClick={() => {
                    setIdx(0);
                    setPlaying(false);
                  }}
                  className="h-11 px-4 rounded-lg border border-neutral-200 text-sm font-semibold text-neutral-600"
                >
                  Reset
                </button>
              </div>

              <div className="mt-4 flex items-center gap-1 text-xs">
                <span className="text-neutral-500 mr-1">Speed</span>
                {[1, 2, 4, 8].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSpeed(s)}
                    className={`px-2.5 h-7 rounded-md font-semibold ${
                      speed === s ? "bg-ink text-white" : "bg-neutral-100 text-neutral-600"
                    }`}
                  >
                    {s}×
                  </button>
                ))}
              </div>

              <div className="mt-auto pt-4 text-[11px] text-neutral-400 leading-relaxed">
                Movement is captured continuously while the truck is online (≈ 2 frames per second, last ~5 minutes).
                Completed routes can be reviewed here for audit and dispute resolution.
              </div>
            </>
          ) : (
            <div className="text-sm text-neutral-500">Pick a truck to begin.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-neutral-50 p-3">
      <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold">{label}</div>
      <div className="text-lg font-bold text-ink mt-0.5">{value}</div>
    </div>
  );
}

function cursorIcon() {
  return L.divIcon({
    html: `<div class="ct-truck-marker" style="background:#111;"><div style="color:white;font-weight:800;font-size:11px;">●</div></div>`,
    className: "",
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

function ReplayMap({
  trail,
  full,
  cursor,
}: {
  trail: [number, number][];
  full: [number, number][];
  cursor: [number, number] | null;
}) {
  const bounds = L.latLngBounds(full);
  return (
    <MapContainer
      bounds={bounds}
      zoomControl={false}
      attributionControl={false}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer url={CARTO_URL} subdomains={["a", "b", "c", "d"]} />
      <Polyline positions={full} pathOptions={{ color: "#d4d4d4", weight: 3, dashArray: "4 6" }} />
      <Polyline positions={trail} pathOptions={{ color: "#111", weight: 5, lineCap: "round" }} />
      {cursor && <Marker position={cursor} icon={cursorIcon()} />}
    </MapContainer>
  );
}