import { createFileRoute, Link } from "@tanstack/react-router";
import { MobileFrame } from "@/components/MobileFrame";
import { Logo } from "@/components/Logo";
import { LockIcon, TruckIcon, UserIcon } from "@/components/icons";
import { motion } from "framer-motion";
import { useT } from "@/lib/i18n";
import ShirpurImageSlider from "@/components/ShirpurImageSlider";

export const Route = createFileRoute("/role")({
  head: () => ({
    meta: [
      { title: "Choose Your Role — CleanTrack Shirpur" },
      {
        name: "description",
        content:
          "Pick how you use CleanTrack in Shirpur: resident truck tracking, driver duty and stops, or the municipal admin fleet dashboard.",
      },
      { property: "og:title", content: "Choose Your Role — CleanTrack Shirpur" },
      {
        property: "og:description",
        content: "Resident, driver or municipal admin — choose your CleanTrack experience.",
      },
      { property: "og:url", content: "https://street-scan-track.shirpur.app/role" },
    ],
    links: [{ rel: "canonical", href: "https://street-scan-track.shirpur.app/role" }],
  }),
  component: RolePage,
});

function RolePage() {
  const t = useT();
  return (
    <MobileFrame>
      <div className="pt-6 px-6">
        <Logo />
      </div>
      <ShirpurImageSlider />
      <div className="px-6 pt-4">
        <h1 className="text-2xl font-bold tracking-tight text-ink">{t("Who's signing in?")}</h1>
        <p className="mt-1 text-neutral-500 text-sm">{t("Pick the experience that fits you.")}</p>
      </div>
      <div className="px-6 mt-6 flex flex-col gap-3">
        <Card to="/login/resident" Icon={UserIcon} title={t("I'm a Resident")} subtitle={t("Track the truck near me")} />
        <Card to="/login/driver" Icon={TruckIcon} title={t("Truck Driver")} subtitle={t("Share location, manage stops")} />
        <Card to="/login/admin" Icon={LockIcon} title={t("Municipal Admin")} subtitle={t("Monitor the entire fleet")} />
      </div>
      <div className="mt-auto pb-8 text-center text-xs text-neutral-400">
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
