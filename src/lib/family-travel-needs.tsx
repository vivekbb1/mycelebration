import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { sendMissingDetailsReminder } from "@/lib/missing-details.functions";

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

/** Families that still owe travel, passport or look choices, with email nudges. */
export function MissingTravelDetails({ inviteId }: { inviteId: string | null | undefined }) {
  const { enabled, data } = useFamilyTravelNeeds(inviteId);
  const nudge = useServerFn(sendMissingDetailsReminder);
  const [busy, setBusy] = useState<string | null>(null);
  const outfits = useQuery({
    queryKey: ["outfit-missing", inviteId],
    enabled: !!inviteId,
    queryFn: async () => {
      const [ev, codes, res] = await Promise.all([
        supabase.from("events").select("id").eq("invite_id", inviteId!).eq("outfit_selection", true),
        supabase.from("invite_codes").select("household, claimed_by").eq("invite_id", inviteId!),
        supabase.from("reservations").select("guest_id").eq("invite_id", inviteId!),
      ]);
      if (!ev.data?.length) return [] as string[];
      const picked = new Set((res.data ?? []).map((r) => r.guest_id));
      const done = new Set<string>();
      const all = new Set<string>();
      for (const c of codes.data ?? []) {
        if (!c.household) continue;
        all.add(c.household);
        if (c.claimed_by && picked.has(c.claimed_by)) done.add(c.household);
      }
      return [...all].filter((h) => !done.has(h));
    },
  });
  const travelMissing = enabled && data?.travelRequired ? data.travelMissing : [];
  const passportMissing = enabled && data?.passportRequired ? data.passportMissing : [];
  const outfitMissing = outfits.data ?? [];
  if (!inviteId) return null;
  const owing = [...new Set([...travelMissing, ...passportMissing, ...outfitMissing])].sort();
  if (!travelMissing.length && !passportMissing.length && !outfits.data) return null;

  const send = async (households: string[]) => {
    setBusy(households.length > 1 ? "__all" : households[0]);
    let sent = 0;
    let skipped = 0;
    try {
      for (const h of households) {
        const r = await nudge({
          data: {
            inviteId,
            household: h,
            travel: travelMissing.includes(h),
            passport: passportMissing.includes(h),
            outfits: outfitMissing.includes(h),
          },
        });
        if (r.sent) sent += 1;
        else skipped += 1;
      }
      toast.success(`Emailed ${sent} ${sent === 1 ? "family" : "families"}${skipped ? ` · ${skipped} had no email` : ""}.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="panel p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Details still owed</p>
          <p className="mt-2 text-3xl text-primary">{owing.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            families
            {data?.travelRequired && enabled ? ` · ${travelMissing.length} travel` : ""}
            {data?.passportRequired && enabled ? ` · ${passportMissing.length} passports` : ""}
            {` · ${outfitMissing.length} looks`}
          </p>
        </div>
        {owing.length > 0 && (
          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => send(owing)}>
            <Mail className="size-4" /> {busy === "__all" ? "Sending…" : "Email them all"}
          </Button>
        )}
      </div>
      {owing.length > 0 && (
        <ul className="mt-3 divide-y divide-border/60">
          {owing.map((h) => (
            <li key={h} className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-sm">
              <span>
                {h}
                <span className="ml-2 inline-flex gap-1">
                  {travelMissing.includes(h) && <Badge variant="outline">travel</Badge>}
                  {passportMissing.includes(h) && <Badge variant="outline">passport</Badge>}
                  {outfitMissing.includes(h) && <Badge variant="outline">looks</Badge>}
                </span>
              </span>
              <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => send([h])}>
                {busy === h ? "Sending…" : "Email"}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
