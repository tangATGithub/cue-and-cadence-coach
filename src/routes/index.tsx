import { createFileRoute } from "@tanstack/react-router";

import { VoiceCoach } from "@/components/VoiceCoach";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Coach — Hands-free voice personal trainer" },
      {
        name: "description",
        content: "A phone-friendly voice personal trainer with male and female coaches, hands-free exercise cues and completed workout logging.",
      },
      { property: "og:title", content: "Coach — Hands-free voice personal trainer" },
      {
        property: "og:description",
        content: "A phone-friendly voice personal trainer with male and female coaches, hands-free exercise cues and completed workout logging.",
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
