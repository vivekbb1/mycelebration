import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Inbox, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * Requests hosts send from their own package page. Approving one assigns the
 * package and add-ons exactly as the manual controls do.
 */
export function PlanRequests() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const requests = useQuery({
    queryKey: ["plan-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_requests")
        .select("id, user_id, invite_id, plan_id, addon_ids, note, status, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const ids = [...new Set((data ?? []).map((r) => r.user_id))];
      const inviteIds = [...new Set((data ?? []).map((r) => r.invite_id).filter(Boolean))] as string[];
      const [profiles, plans, addons, celebrations] = await Promise.all([
        ids.length
          ? supabase.from("profiles").select("id, full_name, email").in("id", ids)
          : Promise.resolve({ data: [] as { id: string; full_name: string; email: string | null }[] }),
        supabase.from("plans").select("id, name"),
        supabase.from("addons").select("id, name"),
        inviteIds.length
          ? supabase.from("invites").select("id, name").in("id", inviteIds)
          : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      ]);
      return (data ?? []).map((r) => {
        const who = (profiles.data ?? []).find((p) => p.id === r.user_id);
        const addonIds = Array.isArray(r.addon_ids) ? (r.addon_ids as string[]) : [];
        return {
          ...r,
          addonIds,
          who: who?.full_name || who?.email || "Host",
          celebration:
            (celebrations.data ?? []).find((c) => c.id === r.invite_id)?.name ?? "No celebration",
          email: who?.email ?? "",
          planName: (plans.data ?? []).find((p) => p.id === r.plan_id)?.name ?? r.plan_id ?? "—",
          addonNames: addonIds.map(
            (id) => (addons.data ?? []).find((a) => a.id === id)?.name ?? id,
          ),
        };
      });
    },
  });

  const decide = async (
    id: string,
    inviteId: string | null,
    planId: string | null,
    addonIds: string[],
    approve: boolean,
  ) => {
    setBusy(id);
    if (approve && !inviteId) {
      setBusy(null);
      return void toast.error("This request isn't linked to a celebration, so it can't be switched on.");
    }
    if (approve && inviteId) {
      if (planId) {
        const { error } = await supabase
          .from("celebration_subscriptions")
          .upsert({ invite_id: inviteId, plan_id: planId, status: "active" }, { onConflict: "invite_id" });
        if (error) {
          setBusy(null);
          return void toast.error(error.message);
        }
      }
      for (const addonId of addonIds) {
        await supabase
          .from("celebration_addons")
          .upsert({ invite_id: inviteId, addon_id: addonId }, { onConflict: "invite_id,addon_id" });
      }
    }
    const { error } = await supabase
      .from("plan_requests")
      .update({
        status: approve ? "approved" : "declined",
        decided_at: new Date().toISOString(),
      })
      .eq("id", id);
    setBusy(null);
    if (error) return void toast.error(error.message);
    toast.success(approve ? "Package switched on for that celebration." : "Request declined.");
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["plan-requests"] }),
      qc.invalidateQueries({ queryKey: ["platform-hosts"] }),
      qc.invalidateQueries({ queryKey: ["my-features"] }),
    ]);
  };

  const list = requests.data ?? [];
  const waiting = list.filter((r) => r.status === "pending");

  return (
    <section className="panel mt-8 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-xl">
          <Inbox className="size-5 text-primary" /> Package requests
        </h2>
        {waiting.length > 0 ? <Badge>{waiting.length} waiting</Badge> : null}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        What hosts have asked for on their own package page. You can still set anyone's package by
        hand above.
      </p>
      <ul className="mt-4 divide-y divide-border text-sm">
        {list.map((r) => (
          <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
            <div className="min-w-0">
              <p className="truncate">
                {r.who}
                {r.email ? (
                  <span className="ml-2 text-xs text-muted-foreground">{r.email}</span>
                ) : null}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                For {r.celebration} · wants {r.planName}
                {r.addonNames.length ? ` plus ${r.addonNames.join(", ")}` : ""}
              </p>
              {r.note ? <p className="mt-1 text-xs">{r.note}</p> : null}
            </div>
            {r.status === "pending" ? (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  disabled={busy === r.id}
                  onClick={() => decide(r.id, r.invite_id, r.plan_id, r.addonIds, true)}
                >
                  <Check className="size-4" /> Switch it on
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy === r.id}
                  onClick={() => decide(r.id, r.user_id, r.plan_id, r.addonIds, false)}
                >
                  <X className="size-4" /> Decline
                </Button>
              </div>
            ) : (
              <Badge variant={r.status === "approved" ? "default" : "secondary"}>
                {r.status === "approved" ? "Switched on" : "Declined"}
              </Badge>
            )}
          </li>
        ))}
        {list.length === 0 ? (
          <li className="py-4 text-muted-foreground">No requests yet.</li>
        ) : null}
      </ul>
    </section>
  );
}
