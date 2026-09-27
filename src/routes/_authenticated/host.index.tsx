import { createFileRoute, redirect } from "@tanstack/react-router";

import { HostRoute } from "@/components/host-area";
import { hostSplat } from "@/lib/host-url";

export const Route = createFileRoute("/_authenticated/host/")({
  validateSearch: (search: Record<string, unknown>): { tab?: string } =>
    typeof search["tab"] === "string" ? { tab: search["tab"] } : {},
  beforeLoad: ({ search }) => {
    // Old links like /host?tab=guests move to /host/guests.
    if (search.tab && search.tab !== "overview") {
      throw redirect({ to: "/host/$", params: { _splat: hostSplat(search.tab) }, replace: true });
    }
  },
  head: () => ({
    meta: [
      { title: "Overview — Host Area — My Celebration" },
      { name: "description", content: "Replies, outfits and measurements for your celebration at a glance." },
      { property: "og:title", content: "Host Area — My Celebration" },
      { property: "og:description", content: "Run your celebration: guests, events, outfits and replies." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HostRoute,
});
