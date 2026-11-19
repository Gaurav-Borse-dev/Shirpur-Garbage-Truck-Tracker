import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PrivacyView } from "@/components/PrivacyView";

export const Route = createFileRoute("/resident/privacy")({
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
      { property: "og:url", content: "https://cleantruck.live/resident/privacy" },
    ],
    links: [{ rel: "canonical", href: "https://cleantruck.live/resident/privacy" }],
  }),
  component: ResidentPrivacyComponent,
});

function ResidentPrivacyComponent() {
  const navigate = useNavigate();
  return <PrivacyView onBack={() => navigate({ to: "/resident/profile" })} />;
}
