import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { MobileFrame } from "@/components/MobileFrame";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/store/auth";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CleanTrack — Live Garbage Truck Tracking, Shirpur" },
      {
        name: "description",
        content:
          "Track Shirpur's municipal garbage trucks live on a map, see accurate arrival times for your street, and never miss a collection again.",
      },
      { property: "og:title", content: "CleanTrack — Live Garbage Truck Tracking, Shirpur" },
      {
        property: "og:description",
        content:
          "Live truck positions, street-level arrival alerts and dustbin bookings for residents of Shirpur, Maharashtra.",
      },
      { property: "og:url", content: "https://street-scan-track.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://street-scan-track.lovable.app/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Service",
          name: "CleanTrack Garbage Truck Tracking",
          serviceType: "Live municipal waste collection tracking",
          description:
            "Live garbage truck tracking, collection arrival alerts and community dustbin bookings for residents of Shirpur.",
          areaServed: { "@type": "City", name: "Shirpur" },
          provider: {
            "@type": "GovernmentOrganization",
            name: "Shirpur Municipal Corporation",
          },
        }),
      },
    ],
  }),
  component: Splash,
});

function Splash() {
  const navigate = useNavigate();
  const tr = useT();
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
          <h1 className="sr-only">{tr("CleanTrack — Live Garbage Truck Tracking in Shirpur")}</h1>
          <p className="mt-6 text-base text-neutral-500 max-w-[260px]">
            {tr("Never miss your truck again.")}
          </p>
        </motion.div>
      </div>
      <div className="pb-10 text-center text-xs text-neutral-400">
        {tr("Shirpur Municipal Corporation")}
      </div>
    </MobileFrame>
  );
}
