import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type TravelSettings = {
  need: "none" | "stay" | "stay_transfer";
  travel_required: boolean;
  passport_required: boolean;
  prepaid_checkin?: string | null;
  prepaid_checkout?: string | null;
  extra_paid_by?: "guest" | "host" | null;
};

const DEFAULT_SETTINGS: TravelSettings = {
  need: "none",
  travel_required: false,
  passport_required: false,
};

/** The hosts' travel setup for this guest — what to ask for, and whether it's required. */
export function useTravelSettings() {
  return useQuery({
    queryKey: ["my-travel-settings"],
    queryFn: async (): Promise<TravelSettings> => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) return DEFAULT_SETTINGS;
      const { data, error } = await supabase.rpc("my_travel_settings");
      if (error) throw error;
      const row = (data ?? {}) as Partial<TravelSettings>;
      return {
        need: row.need ?? DEFAULT_SETTINGS.need,
        travel_required: row.travel_required ?? DEFAULT_SETTINGS.travel_required,
        passport_required: row.passport_required ?? DEFAULT_SETTINGS.passport_required,
        prepaid_checkin: row.prepaid_checkin ?? null,
        prepaid_checkout: row.prepaid_checkout ?? null,
        extra_paid_by: row.extra_paid_by ?? null,
      };
    },
  });
}
