import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { HostDashboard } from "@/components/host-dashboard";
import { useSelectedEvent } from "@/lib/selected-event";
import { MissingTravelDetails } from "@/lib/family-travel-needs";
import { HostDownloads, ReadyToInvite } from "@/components/host-readiness";

/**
 * At-a-glance numbers for the hosts: who has replied, who has confirmed a look,
 * and which events are attracting the most outfit selections.
 */
export function HostOverview() {
  const { inviteId } = useSelectedEvent();
  const events = useQuery({
    queryKey: ["overview-events", inviteId],
    queryFn: async () => {
      let q = supabase.from("events").select("id, name, event_date, outfit_selection, sort_order");
      if (inviteId) q = q.eq("invite_id", inviteId);
      const { data, error } = await q.order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const invites = useQuery({
    queryKey: ["overview-invites", inviteId],
    queryFn: async () => {
      let q = supabase.from("invite_codes").select("id, guest_name, household, claimed_by, rsvp_status");
      if (inviteId) q = q.eq("invite_id", inviteId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const profiles = useQuery({
    queryKey: ["overview-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, rsvp_status, household");
      if (error) throw error;
      return data;
    },
  });

  const outfits = useQuery({
    queryKey: ["overview-outfits", inviteId],
    queryFn: async () => {
      let q = supabase.from("outfits").select("id, title, event_id");
      if (inviteId) q = q.eq("invite_id", inviteId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const reservations = useQuery({
    queryKey: ["overview-reservations", inviteId],
    queryFn: async () => {
      let q = supabase.from("reservations").select("id, outfit_id, guest_id, guest_name");
      if (inviteId) q = q.eq("invite_id", inviteId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  // Count only people on the guest list — hosts and leftover accounts
  // without an invitation are ignored, so the cards match the list below.
  const rsvp = useMemo(() => {
    const list = invites.data ?? [];
    const byId = new Map((profiles.data ?? []).map((p) => [p.id, p]));
    const claimed = list.filter((i) => i.claimed_by && byId.has(i.claimed_by));
    // A reply recorded by a host on the invitation counts too, even before sign-up.
    const status = (i: (typeof list)[number]) => {
      const own = i.claimed_by ? byId.get(i.claimed_by)?.rsvp_status : undefined;
      return own === "yes" || own === "no" ? own : i.rsvp_status;
    };
    const yes = list.filter((i) => status(i) === "yes").length;
    const no = list.filter((i) => status(i) === "no").length;
    const invited = list.length;
    const households = new Set(list.map((i) => i.household ?? i.guest_name)).size;
    return {
      invited,
      households,
      registered: claimed.length,
      guestIds: new Set(claimed.map((i) => i.claimed_by!)),
      notRegistered: invited - claimed.length,
      yes,
      no,
      waiting: invited - yes - no,
    };
  }, [profiles.data, invites.data]);

  const chosen = useMemo(() => {
    const rows = (reservations.data ?? []).filter((r) => rsvp.guestIds.has(r.guest_id));
    const guests = new Set(rows.map((r) => r.guest_id)).size;
    return {
      looks: rows.length,
      guests,
      stillToChoose: Math.max(rsvp.registered - guests, 0),
    };
  }, [reservations.data, rsvp.registered, rsvp.guestIds]);

  const byFunction = useMemo(() => {
    const outfitById = new Map((outfits.data ?? []).map((o) => [o.id, o]));
    const counts = new Map<string, number>();
    let unassigned = 0;
    for (const r of reservations.data ?? []) {
      const outfit = outfitById.get(r.outfit_id);
      if (!outfit) continue;
      if (!outfit.event_id) {
        unassigned += 1;
        continue;
      }
      counts.set(outfit.event_id, (counts.get(outfit.event_id) ?? 0) + 1);
    }
    const rows = (events.data ?? [])
      .filter((e) => e.outfit_selection !== false)
      .map((e) => ({
        id: e.id,
        name: e.name,
        date: e.event_date,
        count: counts.get(e.id) ?? 0,
        offered: (outfits.data ?? []).filter((o) => o.event_id === e.id).length,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    const max = rows.reduce((m, r) => Math.max(m, r.count), 0);
    return { rows, max, unassigned };
  }, [events.data, outfits.data, reservations.data]);

  const loading =
    events.isLoading || invites.isLoading || profiles.isLoading || reservations.isLoading;

  return (
    <div className="space-y-6">
      <ReadyToInvite inviteId={inviteId} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Guests invited" value={rsvp.invited} note={`${rsvp.households} families`} />
        <Tile
          label="Replied yes"
          value={rsvp.yes}
          note={rsvp.no > 0 ? `${rsvp.no} can't make it` : "no regrets yet"}
        />
        <Tile
          label="Waiting on a reply"
          value={rsvp.waiting}
          note={`${rsvp.notRegistered} not registered yet`}
        />
        <Tile
          label="Outfits confirmed"
          value={chosen.looks}
          note={`${chosen.guests} guests · ${chosen.stillToChoose} still to choose`}
        />
      </div>

      <MissingTravelDetails inviteId={inviteId} />
      <HostDownloads inviteId={inviteId} />

      <section className="panel p-4 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl">Selections by event</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Which events guests are choosing looks for, most popular first.
            </p>
          </div>
          {byFunction.unassigned > 0 ? (
            <Badge variant="secondary">
              {byFunction.unassigned} not tied to an event
            </Badge>
          ) : null}
        </div>

        <ul className="mt-5 space-y-4">
          {byFunction.rows.map((row) => (
            <li key={row.id}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span>
                  {row.name}
                  {row.date ? (
                    <span className="ml-2 text-xs text-muted-foreground">{row.date}</span>
                  ) : null}
                </span>
                <span className="text-muted-foreground">
                  <span className="text-primary">{row.count}</span> chosen · {row.offered} on offer
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{
                    width: `${byFunction.max > 0 ? Math.round((row.count / byFunction.max) * 100) : 0}%`,
                  }}
                />
              </div>
            </li>
          ))}
          {!loading && byFunction.rows.length === 0 ? (
            <li className="text-sm text-muted-foreground">
              No events offer a wardrobe selection yet.
            </li>
          ) : null}
          {loading ? <li className="text-sm text-muted-foreground">Loading…</li> : null}
        </ul>
      </section>
      <HostDashboard />
    </div>
  );
}

function Tile({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="panel p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl text-primary">{value}</p>
      {note ? <p className="mt-1 text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}
