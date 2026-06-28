import { motion } from "framer-motion";
import { type ReactNode } from "react";

export function BottomSheet({ children, springKey }: { children: ReactNode; springKey?: string | number }) {
  return (
    <motion.div
      key={springKey}
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 30 }}
      className="absolute left-0 right-0 bottom-0 bg-white rounded-t-3xl shadow-[0_-12px_40px_rgba(0,0,0,0.08)] z-[600]"
    >
      <div className="flex justify-center pt-2 pb-1">
        <div className="w-10 h-1.5 rounded-full bg-neutral-200" />
      </div>
      {children}
    </motion.div>
  );
}