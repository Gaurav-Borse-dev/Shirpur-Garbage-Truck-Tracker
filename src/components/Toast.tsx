import { AnimatePresence, motion } from "framer-motion";
import { create } from "zustand";
import { useEffect } from "react";

type ToastItem = { id: number; title: string; subtitle?: string; tone?: "default" | "success" | "warning" };
type ToastState = {
  items: ToastItem[];
  push: (t: Omit<ToastItem, "id">) => void;
  dismiss: (id: number) => void;
};
let _id = 0;
export const useToast = create<ToastState>((set, get) => ({
  items: [],
  push: (t) => {
    const id = ++_id;
    set({ items: [...get().items, { ...t, id }] });
    setTimeout(() => get().dismiss(id), 4000);
  },
  dismiss: (id) => set({ items: get().items.filter((x) => x.id !== id) }),
}));

export function ToastHost() {
  const items = useToast((s) => s.items);
  useEffect(() => {
    if (items.length && typeof navigator !== "undefined" && "vibrate" in navigator) {
      try { navigator.vibrate?.(120); } catch {}
    }
  }, [items.length]);
  return (
    <div className="pointer-events-none fixed top-3 left-0 right-0 z-[1000] flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="pointer-events-auto w-full max-w-[380px] rounded-2xl bg-[#1C1C1E] text-white px-3 py-3 shadow-2xl flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-brand grid place-items-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="w-5 h-5">
                <path d="M10 17h4V5H2v12h3" />
                <path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h2" />
                <circle cx="7.5" cy="17.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">{t.title}</div>
              {t.subtitle && <div className="text-xs text-white/60 truncate">{t.subtitle}</div>}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}