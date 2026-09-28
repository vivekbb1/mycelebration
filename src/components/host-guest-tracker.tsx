import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useSelectedEvent } from "@/lib/selected-event";
import { MissingTravelDetails } from "@/lib/family-travel-needs";

type Stage = "not_sent" | "sent" | "opened" | "joined" | "chosen" | "confirmed";

const stageLabel: Record<Stage, string> = {
  not_sent: "Not sent",
  sent: "Invite sent",
  opened: "Opened link",
  joined: "Code entered",
  chosen: "Look chosen",
  confirmed: "Look confirmed",
};

const issueLabel: Record<string, string> = {
  bounced: "Email bounced",
  complaint: "Marked as spam",
  unsubscribed: "Unsubscribed",
};

const fmt = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "—";

/**
 * One row per invited guest: how far they've got (invite sent → link opened →
 * code entered → look chosen → confirmed), their looks, and how many looks
 * are still free for the celebration.
 */
export function HostGuestTracker() {
  const { inviteId } = useSelectedEvent();
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<"all" | Stage>("all");

  const data = useQuery({
    queryKey: ["guest-tracker", inviteId],
    queryFn: async () => {
      const [codes, fams, res, outfits, events, issues] = await Promise.all([
        supabase
          .from("invite_codes")
          .select(
            "id, guest_name, household, email, invite_id, family_id, invite_sent_at, link_opened_at, claimed_by, claimed_at",
          )
          .order("household"),
        supabase.from("families").select("id, email, invite_id"),
        supabase.from("reservations").select("guest_id, guest_name, status, outfit_id"),
        supabase.from("outfits").select("id, title, event_id"),
        supabase.from("events").select("id, invite_id"),
        supabase.from("email_delivery_events").select("recipient, event_type"),
      ]);
      return {
        codes: codes.data ?? [],
        fams: fams.data ?? [],
        res: res.data ?? [],
        outfits: outfits.data ?? [],
        events: events.data ?? [],
        issues: issues.data ?? [],
      };
    },
  });

  const view = useMemo(() => {
    const d = data.data;
    if (!d) return null;
    const famById = new Map(d.fams.map((f) => [f.id, f]));
    const eventIds = new Set(
      d.events.filter((e) => !inviteId || e.invite_id === inviteId).map((e) => e.id),
    );
    const outfits = d.outfits.filter((o) => !inviteId || (o.event_id && eventIds.has(o.event_id)));
    const outfitById = new Map(outfits.map((o) => [o.id, o]));
    const reserved = new Set(d.res.map((r) => r.outfit_id));
    const unclaimed = outfits.filter((o) => !reserved.has(o.id)).length;
    const issueBy = new Map(d.issues.map((i) => [i.recipient.toLowerCase(), i.event_type]));

    const rows = d.codes
      .filter((c) => {
        const inv = c.invite_id ?? (c.family_id ? famById.get(c.family_id)?.invite_id : null);
        return !inviteId || inv === inviteId;
      })
      .map((c) => {
        const email = (c.email ?? (c.family_id ? famById.get(c.family_id)?.email : null) ?? "").toLowerCase();
        const looks = c.claimed_by
          ? d.res
              .filter((r) => r.guest_id === c.claimed_by && outfitById.has(r.outfit_id))
              .map((r) => ({
                title: outfitById.get(r.outfit_id)?.title ?? "Look",
                confirmed: r.status === "confirmed",
                who: r.guest_name,
              }))
          : [];
        const s: Stage = looks.some((l) => l.confirmed)
          ? "confirmed"
          : looks.length
            ? "chosen"
            : c.claimed_at
              ? "joined"
              : c.link_opened_at
                ? "opened"
                : c.invite_sent_at
                  ? "sent"
                  : "not_sent";
        return { ...c, email, looks, stage: s, issue: email ? issueBy.get(email) : undefined };
      });

    const counts = rows.reduce<Record<string, number>>((a, r) => {
      a[r.stage] = (a[r.stage] ?? 0) + 1;
      return a;
    }, {});
    return { rows, counts, unclaimed, totalLooks: outfits.length };
  }, [data.data, inviteId]);

  if (!view) return <p className="text-sm text-muted-foreground">Loading guests…</p>;

  const term = q.trim().toLowerCase();
  const shown = view.rows.filter(
    (r) =>
      (stage === "all" || r.stage === stage) &&
      (!term || `${r.guest_name} ${r.household ?? ""} ${r.email}`.toLowerCase().includes(term)),
  );

  return (
    <div className="space-y-4">
    <MissingTravelDetails inviteId={inviteId} />
    <section className="panel p-4 sm:p-6">
      <h2 className="text-xl">Guest tracker</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {view.rows.length} invited · {view.unclaimed} of {view.totalLooks} looks still unclaimed.
        Email opens can't be tracked; "Opened link" means they clicked the invitation link.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {(["all", ...Object.keys(stageLabel)] as ("all" | Stage)[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStage(s)}
            className={`rounded-full border px-3 py-1 text-xs ${
              stage === s ? "border-primary bg-primary text-primary-foreground" : "border-border"
            }`}
          >
            {s === "all" ? `All (${view.rows.length})` : `${stageLabel[s]} (${view.counts[s] ?? 0})`}
          </button>
        ))}
      </div>
      <Input
        className="mt-3"
        placeholder="Search guest, family or email"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <ul className="mt-4 divide-y divide-border">
        {shown.map((r) => (
          <li key={r.id} className="py-3">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm">{r.guest_name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {r.household ?? "No family"}
                  {r.email ? ` · ${r.email}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Badge variant={r.stage === "confirmed" ? "default" : "secondary"}>
                  {stageLabel[r.stage]}
                </Badge>
                {r.issue ? (
                  <Badge variant="destructive">{issueLabel[r.issue] ?? r.issue}</Badge>
                ) : null}
              </div>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Sent {fmt(r.invite_sent_at)} · Opened {fmt(r.link_opened_at)} · Joined{" "}
              {fmt(r.claimed_at)}
            </p>
            {r.looks.length ? (
              <ul className="mt-1 space-y-0.5 text-xs">
                {r.looks.map((l, i) => (
                  <li key={i}>
                    {l.confirmed ? "✓ " : "• "}
                    {l.title}
                    {l.who ? ` — for ${l.who}` : ""}
                    {l.confirmed ? " (confirmed)" : " (not confirmed yet)"}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
        {shown.length === 0 ? (
          <li className="py-4 text-sm text-muted-foreground">No guests match.</li>
        ) : null}
      </ul>
    </section>
    </div>
  );
}
