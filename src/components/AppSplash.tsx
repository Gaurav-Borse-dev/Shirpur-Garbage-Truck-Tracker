import { useEffect, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import shirpurLogo from "@/assets/shirpur-logo.jpg.asset.json";

const SESSION_KEY = "cleantrack-splash-shown";

export function AppSplash({ children }: { children: ReactNode }) {
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
        }, 2200);
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
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="fixed inset-0 z-[9999] bg-white grid place-items-center"
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-center text-center px-8"
            >
              <div className="w-32 h-32 rounded-full overflow-hidden ring-1 ring-neutral-200 shadow-[0_10px_40px_rgba(0,0,0,0.08)] bg-white grid place-items-center">
                <img
                  src={shirpurLogo.url}
                  alt="Shirpur–Varvade Nagarparishad"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="mt-6 text-[11px] uppercase tracking-[0.22em] text-neutral-400 font-semibold">
                Shirpur–Varvade Nagarparishad
              </div>
              <div className="mt-2 text-2xl font-extrabold text-ink tracking-tight">
                CleanTrack
              </div>
              <div className="mt-1 text-xs text-neutral-500">
                Shirpur · Maharashtra
              </div>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: 96 }}
                transition={{ duration: 1.8, ease: "easeInOut" }}
                className="mt-6 h-[3px] rounded-full bg-brand"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}