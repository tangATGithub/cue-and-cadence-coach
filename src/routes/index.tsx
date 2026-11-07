import { createFileRoute } from "@tanstack/react-router";

import { VoiceCoach } from "@/components/VoiceCoach";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Coach — Hands-free voice personal trainer" },
      {
        name: "description",
        content: "Tap once and talk. Coach cues your breathing, posture, core and where to feel the burn.",
      },
      { property: "og:title", content: "Coach — Hands-free voice personal trainer" },
      {
        property: "og:description",
        content: "Tap once and talk. Coach cues your breathing, posture, core and where to feel the burn.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return <VoiceCoach />;
}
