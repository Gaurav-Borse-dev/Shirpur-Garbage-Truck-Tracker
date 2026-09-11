import { AnimatePresence, motion } from "framer-motion";
import { create } from "zustand";
import { useEffect } from "react";
import { playNotificationSound, type SoundType } from "@/lib/notification-sound";

export type WhatsAppAlertItem = {
  id: number;
  title: string;
  subtitle?: string;
  tone?: "default" | "success" | "warning" | SoundType;
  link?: string;
  truckId?: string;
  sender?: string;
  timestamp?: string;
};

type WhatsAppAlertState = {
  items: WhatsAppAlertItem[];
  push: (t: Omit<WhatsAppAlertItem, "id">) => void;
  dismiss: (id: number) => void;
};

let _alertId = 0;

export const useWhatsAppNotification = create<WhatsAppAlertState>((set, get) => ({
  items: [],
  push: (t) => {
    const id = ++_alertId;
    const now = new Date();
    const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;
    const item: WhatsAppAlertItem = {
      ...t,
      id,
      sender: t.sender ?? "CleanTrack Shirpur",
      timestamp: t.timestamp ?? timeStr,
    };

    set({ items: [item, ...get().items.slice(0, 2)] });

    // Play signature garbage tracker notification chime
    const soundKind: SoundType =
      t.tone === "truck_arrived" || t.title.toLowerCase().includes("arrived") || t.title.toLowerCase().includes("almost")
        ? "truck_arrived"
        : t.tone === "truck_nearby" || t.title.toLowerCase().includes("nearby") || t.title.toLowerCase().includes("away")
        ? "truck_nearby"
        : t.tone === "route_completed" || t.title.toLowerCase().includes("completed")
        ? "route_completed"
        : t.tone === "booking_update" || t.title.toLowerCase().includes("booking")
        ? "booking_update"
        : "whatsapp_pop";

    playNotificationSound(soundKind);

    // Auto-dismiss after 6.5s
    setTimeout(() => {
      get().dismiss(id);
    }, 6500);
  },
  dismiss: (id) => set({ items: get().items.filter((x) => x.id !== id) }),
}));

export function WhatsAppNotificationHost() {
  const items = useWhatsAppNotification((s) => s.items);
  const dismiss = useWhatsAppNotification((s) => s.dismiss);

  // WhatsApp-style gentle double vibration
  useEffect(() => {
    if (items.length && typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate?.([80, 60, 100]);
      } catch {}
    }
  }, [items.length]);

  return (
    <div className="pointer-events-none fixed top-3 left-0 right-0 z-[9999] flex flex-col items-center gap-2 px-3 sm:px-4 max-w-lg mx-auto">
      <AnimatePresence>
        {items.map((item) => (
          <motion.div
            key={item.id}
            initial={{ y: -80, opacity: 0, scale: 0.92 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -80, opacity: 0, scale: 0.92 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.4}
            onDragEnd={(_, info) => {
              if (info.offset.y < -30) dismiss(item.id);
            }}
            className="pointer-events-auto w-full rounded-2xl bg-slate-900/95 text-white backdrop-blur-xl border border-slate-700/80 shadow-[0_16px_40px_rgba(0,0,0,0.45)] overflow-hidden cursor-pointer"
            onClick={() => {
              if (item.link) {
                window.location.assign(item.link);
              }
            }}
          >
            {/* Top WhatsApp-style app badge bar */}
            <div className="bg-slate-800/80 px-3.5 py-1.5 flex items-center justify-between border-b border-slate-700/50">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-[10px] text-slate-950 font-bold shadow-sm">
                  🚛
                </div>
                <span className="text-[11px] font-bold text-emerald-400 tracking-wide flex items-center gap-1">
                  {item.sender}
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-emerald-400 inline-block">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 font-medium">{item.timestamp}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    dismiss(item.id);
                  }}
                  className="w-5 h-5 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs font-bold transition-colors"
                  aria-label="Dismiss notification"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Notification message body */}
            <div className="p-3.5 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                  <path d="M10 17h4V5H2v12h3" />
                  <path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h2" />
                  <circle cx="7.5" cy="17.5" r="2.5" />
                  <circle cx="17.5" cy="17.5" r="2.5" />
                </svg>
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white leading-tight truncate">
                  {item.title}
                </div>
                {item.subtitle && (
                  <div className="text-xs text-slate-300 mt-1 leading-normal line-clamp-2">
                    {item.subtitle}
                  </div>
                )}

                {/* Quick actions */}
                <div className="mt-2.5 flex items-center gap-2">
                  {item.link ? (
                    <a
                      href={item.link}
                      onClick={(e) => e.stopPropagation()}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-[11px] font-bold inline-flex items-center gap-1 shadow transition-colors"
                    >
                      <span>📍 Track Live</span>
                    </a>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 text-emerald-400 text-[10px] font-semibold">
                      🔔 Waste Collection Alert
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400">Swipe up to dismiss</span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
