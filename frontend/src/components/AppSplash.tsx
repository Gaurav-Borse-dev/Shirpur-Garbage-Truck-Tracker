import { useEffect, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import shirpurLogoImg from "@/assets/shirpur-logo.jpg";
import { useT } from "@/lib/i18n";

const SESSION_KEY = "cleantrack-splash-shown";

export function AppSplash({ children }: { children: ReactNode }) {
  const tr = useT();
  const [show, setShow] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const shown = sessionStorage.getItem(SESSION_KEY);
      if (!shown) {
        setShow(true);
        const t = setTimeout(() => {
          sessionStorage.setItem(SESSION_KEY, "1");
          setShow(false);
        }, 1800);
        return () => clearTimeout(t);
      }
    } catch {}
  }, []);

  return (
    <>
      {children}
      <AnimatePresence>
        {mounted && show && (
          <motion.div
            key="app-splash"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="fixed inset-0 z-[9999] bg-white grid place-items-center"
          >
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-center text-center px-8"
            >
              <div className="w-32 h-32 rounded-2xl overflow-hidden p-2 ring-1 ring-neutral-200 shadow-[0_12px_36px_rgba(0,0,0,0.08)] bg-white grid place-items-center">
                <img
                  src={shirpurLogoImg}
                  alt={tr("Shirpur–Varvade Nagarparishad")}
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="mt-6 text-[11px] uppercase tracking-[0.22em] text-red-800 font-extrabold">
                {tr("Shirpur–Varvade Nagarparishad")}
              </div>
              <div className="mt-1 text-2xl font-extrabold text-ink tracking-tight flex items-center gap-1.5">
                {tr("CleanTrack")}
              </div>
              <div className="mt-1 text-xs text-neutral-500 font-medium">
                {tr("Shirpur · Dhule · Maharashtra")}
              </div>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: 96 }}
                transition={{ duration: 1.2, ease: "easeInOut" }}
                className="mt-5 h-[3px] rounded-full bg-brand"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
