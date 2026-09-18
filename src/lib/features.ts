import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/** Everything a host can be given. Keys are stored in plans and subscriptions. */
export const FEATURES = [
  { key: "rsvp_basic", label: "Basic replies", blurb: "Yes / no answers from guests" },
  {
    key: "rsvp_extended",
    label: "Extended replies",
    blurb: "Head counts per function, travel dates and flights",
  },
  { key: "guest_list", label: "Guest list", blurb: "Families, codes and invitations" },
  { key: "functions", label: "Functions", blurb: "The schedule of celebrations" },
  {
    key: "guest_communication",
    label: "Guest communication",
    blurb: "Call logs, notes and follow-up suggestions",
  },
  {
    key: "guest_tracker",
    label: "Guest tracker",
    blurb: "Who is looked after by which host, hand-overs and workload",
  },
  { key: "messaging", label: "Messages", blurb: "The two-way thread with guests" },
  { key: "email", label: "Email sending", blurb: "Invitations and reminders by email" },
  { key: "wardrobe_picker", label: "Wardrobe picker", blurb: "Outfits guests can choose from" },
  {
    key: "wardrobe_selector",
    label: "Wardrobe selector",
    blurb: "Building a look for a guest, sizes and fabrics",
  },
  { key: "delivery", label: "Delivery plan", blurb: "How outfits reach the guests" },
  { key: "branding", label: "Branding", blurb: "Fonts, colours, logos and saved themes" },
  {
    key: "vendor_management",
    label: "Vendor management",
    blurb: "Boutiques, ateliers and their orders",
  },
  { key: "budgeting", label: "Budgeting", blurb: "What each function and outfit costs" },
] as const;

export type FeatureKey = (typeof FEATURES)[number]["key"];

export const featureLabel = (key: string) =>
  FEATURES.find((f) => f.key === key)?.label ?? key.replace(/_/g, " ");

/** What the signed-in host may use, plus whether they run the platform. */
export function useFeatures() {
  const mine = useQuery({
    queryKey: ["my-features"],
    staleTime: 60_000,
    queryFn: async () => {
      const [features, admin] = await Promise.all([
        supabase.rpc("my_features"),
        supabase.rpc("is_platform_admin"),
      ]);
      const list = Array.isArray(features.data) ? (features.data as string[]) : [];
      return { list, isPlatformAdmin: admin.data === true };
    },
  });

  const list = mine.data?.list ?? [];
  const everything = list.includes("all");

  return {
    ready: mine.isSuccess,
    isPlatformAdmin: mine.data?.isPlatformAdmin ?? false,
    /** Until we know, nothing is hidden — pages don't flicker on every load. */
    has: (key: FeatureKey) => (!mine.isSuccess ? true : everything || list.includes(key)),
    features: list,
  };
}
