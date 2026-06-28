import { createFileRoute, Link } from "@tanstack/react-router";
import { MobileFrame } from "@/components/MobileFrame";
import { Logo } from "@/components/Logo";
import { LockIcon, TruckIcon, UserIcon } from "@/components/icons";
import { motion } from "framer-motion";

export const Route = createFileRoute("/role")({
  head: () => ({
    meta: [{ title: "Choose your role · CleanTrack" }],
  }),
  component: RolePage,
});

function RolePage() {
  return (
    <MobileFrame>
      <div className="pt-10 px-6">
        <Logo />
      </div>
      <div className="px-6 pt-8">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Who's signing in?</h1>
        <p className="mt-1 text-neutral-500 text-sm">Pick the experience that fits you.</p>
      </div>
      <div className="px-6 mt-6 flex flex-col gap-3">
        <Card to="/login/resident" Icon={UserIcon} title="I'm a Resident" subtitle="Track the truck near me" />
        <Card to="/login/driver" Icon={TruckIcon} title="Truck Driver" subtitle="Share location, manage stops" />
        <Card to="/login/admin" Icon={LockIcon} title="Municipal Admin" subtitle="Monitor the entire fleet" />
      </div>
      <div className="mt-auto pb-8 text-center text-xs text-neutral-400">
        Powered by CleanTrack · v1.0
      </div>
    </MobileFrame>
  );
}

function Card({ to, Icon, title, subtitle }: { to: string; Icon: React.FC<{ className?: string }>; title: string; subtitle: string }) {
  return (
    <motion.div whileTap={{ scale: 0.98 }}>
      <Link
        to={to}
        className="block rounded-2xl border border-neutral-200 p-5 hover:border-neutral-300 transition-colors bg-white"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-neutral-50 grid place-items-center text-ink">
            <Icon className="w-6 h-6" />
          </div>
          <div>
            <div className="font-semibold text-ink">{title}</div>
            <div className="text-sm text-neutral-500">{subtitle}</div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}