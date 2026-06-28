import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { MobileFrame } from "@/components/MobileFrame";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/store/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CleanTrack — Live garbage truck tracking" },
      { name: "description", content: "Never miss your truck again. Live tracking for Shirpur and Dhule." },
      { property: "og:title", content: "CleanTrack" },
      { property: "og:description", content: "Never miss your truck again." },
    ],
  }),
  component: Splash,
});

function Splash() {
  const navigate = useNavigate();
  const session = useAuth((s) => s.session);
  useEffect(() => {
    const t = setTimeout(() => {
      if (session?.role === "resident") navigate({ to: "/resident" });
      else if (session?.role === "driver") navigate({ to: "/driver" });
      else if (session?.role === "admin") navigate({ to: "/admin" });
      else navigate({ to: "/role" });
    }, 1800);
    return () => clearTimeout(t);
  }, [navigate, session]);

  return (
    <MobileFrame>
      <div className="flex-1 grid place-items-center px-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center text-center"
        >
          <Logo size={88} />
          <p className="mt-6 text-base text-neutral-500 max-w-[260px]">
            Never miss your truck again.
          </p>
        </motion.div>
      </div>
      <div className="pb-10 text-center text-xs text-neutral-400">
        Shirpur · Dhule Municipal Corporation
      </div>
    </MobileFrame>
  );
}
