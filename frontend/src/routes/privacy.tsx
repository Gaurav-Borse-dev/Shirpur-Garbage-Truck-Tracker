import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MobileFrame } from "@/components/MobileFrame";
import { ResidentPrivacyPage } from "./resident.privacy";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy · CleanTrack Shirpur" },
      {
        name: "description",
        content:
          "Official Privacy Policy for Shirpur Garbage Truck Tracker (CleanTrack Shirpur) operated for Shirpur-Varwade Nagarparishad.",
      },
      { property: "og:title", content: "Privacy Policy · CleanTrack Shirpur" },
      {
        property: "og:description",
        content:
          "Privacy Policy, location usage, data protection and user rights for Shirpur Garbage Truck Tracker.",
      },
      { property: "og:url", content: "https://street-scan-track.shirpur.app/privacy" },
    ],
    links: [{ rel: "canonical", href: "https://street-scan-track.shirpur.app/privacy" }],
  }),
  component: PublicPrivacyPage,
});

function PublicPrivacyPage() {
  return (
    <MobileFrame>
      <div className="flex-1 relative overflow-hidden bg-neutral-50 h-full">
        <ResidentPrivacyPage />
      </div>
    </MobileFrame>
  );
}

export default PublicPrivacyPage;
