import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { useFeatures } from "@/lib/features";

export type TravelNeed = "none" | "stay" | "stay_transfer";

export const TRAVEL_NEED_LABEL: Record<TravelNeed, string> = {
  none: "No travel help",
  stay: "Stay only",
  stay_transfer: "Stay + pickup",
};

/**
 * Each family's travel need for a celebration (family choice, else the
 * celebration default) and which families still owe required details.
 */
export function useFamilyTravelNeeds(inviteId: string | null | undefined) {
  const { has } = useFeatures();
  const enabled = !!inviteId && has("arrivals");
  const q = useQuery({
    queryKey: ["family-travel-needs", inviteId],
    enabled,
    queryFn: async () => {
      const [inv, fams, plans, passports] = await Promise.all([
        supabase
          .from("invites")
          .select("default_travel_need, travel_required, passport_required")
          .eq("id", inviteId!)
          .maybeSingle(),
        supabase.from("families").select("name, travel_need").eq("invite_id", inviteId!),
        supabase.from("travel_plans").select("household").eq("invite_id", inviteId!),
        supabase.from("guest_passports").select("household").eq("invite_id", inviteId!),
      ]);
      const def = (inv.data?.default_travel_need ?? "none") as TravelNeed;
      const needs = new Map<string, TravelNeed>(
        (fams.data ?? []).map((f) => [f.name, ((f.travel_need as TravelNeed | null) ?? def)]),
      );
      const withTravel = new Set((plans.data ?? []).map((p) => p.household));
      const withPassport = new Set((passports.data ?? []).map((p) => p.household));
      const travelMissing: string[] = [];
      const passportMissing: string[] = [];
      for (const [name, need] of needs) {
        if (need === "none") continue;
        if (inv.data?.travel_required && !withTravel.has(name)) travelMissing.push(name);
        if (inv.data?.passport_required && !withPassport.has(name)) passportMissing.push(name);
      }
      return {
        defaultNeed: def,
        needs,
        travelRequired: !!inv.data?.travel_required,
        passportRequired: !!inv.data?.passport_required,
        travelMissing,
        passportMissing,
      };
    },
  });
  const data = q.data;
  return {
    enabled,
    data,
    needOf: (household: string | null | undefined): TravelNeed =>
      (household ? data?.needs.get(household) : undefined) ?? data?.defaultNeed ?? "none",
  };
}

export function TravelNeedBadge({ need }: { need: TravelNeed }) {
  return (
    <Badge variant={need === "none" ? "outline" : "secondary"} className="whitespace-nowrap">
      {TRAVEL_NEED_LABEL[need]}
    </Badge>
  );
}

/** Families that still owe required travel or passport details. */
export function MissingTravelDetails({ inviteId }: { inviteId: string | null | undefined }) {
  const { enabled, data } = useFamilyTravelNeeds(inviteId);
  if (!enabled || !data || (!data.travelRequired && !data.passportRequired)) return null;
  const owing = new Set([...data.travelMissing, ...data.passportMissing]);
  return (
    <section className="panel p-4 sm:p-6">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Required details still owed</p>
      <p className="mt-2 text-3xl text-primary">{owing.size}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        families
        {data.travelRequired ? ` · ${data.travelMissing.length} missing travel` : ""}
        {data.passportRequired ? ` · ${data.passportMissing.length} missing passports` : ""}
      </p>
      {owing.size > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {[...owing].sort().map((h) => (
            <Badge key={h} variant="outline">
              {h}
              {data.travelMissing.includes(h) ? " · travel" : ""}
              {data.passportMissing.includes(h) ? " · passport" : ""}
            </Badge>
          ))}
        </div>
      )}
    </section>
  );
}
