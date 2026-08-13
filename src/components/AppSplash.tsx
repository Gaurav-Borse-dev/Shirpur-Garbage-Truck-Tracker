import { useEffect, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import shirpurLogoImg from "@/assets/shirpur-logo.jpg";
import { useT } from "@/lib/i18n";

const SESSION_KEY = "cleantrack-splash-shown";

export function AppSplash({ children }: { children: ReactNode }) {
  const tr = useT();
  const [show, setShow] = useState(false);
  const [mounted, setMounted] = useState(false);

  const handleContinue = () => {
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {}
    setShow(false);
  };

  useEffect(() => {
    setMounted(true);
    try {
      const shown = sessionStorage.getItem(SESSION_KEY);
      if (!shown) {
        setShow(true);
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
            onClick={handleContinue}
            onTouchStart={handleContinue}
            whileTap={{ scale: 0.99 }}
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed inset-0 z-[9999] bg-white grid place-items-center cursor-pointer select-none touch-manipulation"
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="flex flex-col items-center text-center px-8"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="w-32 h-32 rounded-2xl overflow-hidden p-2 ring-1 ring-neutral-200 shadow-[0_12px_36px_rgba(0,0,0,0.08)] bg-white grid place-items-center"
              >
                <img
                  src={shirpurLogoImg}
                  alt={tr("Shirpur–Varvade Nagarparishad")}
                  className="w-full h-full object-contain pointer-events-none"
                />
              </motion.div>
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
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="mt-5 h-[3px] rounded-full bg-brand"
              />
              <motion.div
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                className="mt-6 text-xs text-neutral-400 font-medium tracking-wide"
              >
                {tr("Touch anywhere to continue")}
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
