import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

// Client-safe shapes for the host-managed delivery plan.

export type TimelineStep = {
  date: string;
  title: string;
  body: string;
};

export type Logistics = {
  id: string;
  intro: string;
  hotel_name: string | null;
  hotel_address: string | null;
  checkin_note: string | null;
  measurements_deadline: string | null;
  team_name: string | null;
  team_whatsapp: string | null;
  team_email: string | null;
  timeline: TimelineStep[];
};

export function parseTimeline(value: unknown): TimelineStep[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((step): step is Record<string, unknown> => typeof step === "object" && step !== null)
    .map((step) => ({
      date: typeof step["date"] === "string" ? step["date"] : "",
      title: typeof step["title"] === "string" ? step["title"] : "",
      body: typeof step["body"] === "string" ? step["body"] : "",
    }))
    .filter((step) => step.title || step.date || step.body);
}

/** Whether the host has the delivery plan switched on for guests. */
export function useDeliveryPlan() {
  return useQuery({
    queryKey: ["logistics-enabled"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("logistics")
        .select("enabled")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return { enabled: data?.enabled ?? true };
    },
  });
}
