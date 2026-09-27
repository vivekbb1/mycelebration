import { createFileRoute } from "@tanstack/react-router";

import { HostRoute } from "@/components/host-area";
import { HOST_SUB_LABELS, parseHostPath } from "@/lib/host-url";

const SECTION_LABELS: Record<string, string> = {
  overview: "Overview",
  invitations: "Celebration",
  functions: "Events",
  guests: "Guests",
  wardrobe: "Wardrobe",
  setup: "Setup",
};

export const Route = createFileRoute("/_authenticated/host/$")({
  head: ({ params }) => {
    const { section, sub } = parseHostPath(params._splat);
    const name = [SECTION_LABELS[section] ?? "Host area", sub ? HOST_SUB_LABELS[sub] : null]
      .filter(Boolean)
      .join(" · ");
    return {
      meta: [
        { title: `${name} — My Celebration` },
        { name: "description", content: `${name} in your celebration's host area.` },
        { property: "og:title", content: `${name} — My Celebration` },
        { property: "og:description", content: "Run your celebration: guests, events, outfits and replies." },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: HostRoute,
});
