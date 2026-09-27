import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFeatures } from "@/lib/features";

export const Route = createFileRoute("/_authenticated/hosts")({
  head: () => ({
    meta: [
      { title: "Host dashboard — packages, replies and outfit slots" },
      {
        name: "description",
        content:
          "Every host account with the package they are on, the replies still outstanding and the outfit slots still to be filled.",
      },
      { property: "og:title", content: "Host dashboard — packages, replies and outfit slots" },
      {
        property: "og:description",
        content: "See each host's package, pending replies and open outfit slots at a glance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HostDashboard,
});

type Row = {
  id: string;
  name: string;
  email: string;
  planName: string;
  status: string;
  addons: string[];
  events: number;
  guests: number;
  pendingRsvp: number;
  openSlots: number;
};

function HostDashboard() {
  const { isPlatformAdmin } = useFeatures();
  const [search, setSearch] = useState("");

  const rows = useQuery({
    queryKey: ["host-dashboard"],
    queryFn: async (): Promise<Row[]> => {
      const roles = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      if (roles.error) throw roles.error;
      const ids = [...new Set((roles.data ?? []).map((r) => r.user_id))];
      if (ids.length === 0) return [];

      const [profiles, subs, plans, hostAddons, addons, invites, guests, families, reservations] =
        await Promise.all([
          supabase.from("profiles").select("id, full_name, email").in("id", ids),
          supabase.from("host_subscriptions").select("user_id, plan_id, status").in("user_id", ids),
          supabase.from("plans").select("id, name"),
          supabase.from("host_addons").select("user_id, addon_id").in("user_id", ids),
          supabase.from("addons").select("id, name"),
          supabase.from("invites").select("id, created_by"),
          supabase
            .from("invite_codes")
            .select("id, invite_id, family_id, rsvp_status, claimed_by"),
          supabase.from("families").select("id, invite_id, needs_wardrobe"),
          supabase.from("reservations").select("guest_id, guest_name"),
        ]);
      for (const r of [profiles, subs, plans, hostAddons, addons, invites, guests, families, reservations])
        if (r.error) throw r.error;

      const planName = (id: string | null) =>
        plans.data?.find((p) => p.id === (id ?? "free"))?.name ?? "Free";
      const addonName = (id: string) => addons.data?.find((a) => a.id === id)?.name ?? id;

      /** A guest has a look set aside when a reservation exists for them. */
      const reservedGuestIds = new Set((reservations.data ?? []).map((r) => r.guest_id));

      return ids.map((id) => {
        const profile = profiles.data?.find((p) => p.id === id);
        const sub = subs.data?.find((s) => s.user_id === id);
        const myInviteIds = new Set(
          (invites.data ?? []).filter((i) => i.created_by === id).map((i) => i.id),
        );
        const familyNeedsWardrobe = new Map(
          (families.data ?? []).map((f) => [f.id, f.needs_wardrobe]),
        );
        const mine = (guests.data ?? []).filter((g) => g.invite_id && myInviteIds.has(g.invite_id));

        return {
          id,
          name: profile?.full_name || "Host",
          email: profile?.email ?? "",
          planName: planName(sub?.plan_id ?? null),
          status: sub?.status ?? "active",
          addons: (hostAddons.data ?? [])
            .filter((a) => a.user_id === id)
            .map((a) => addonName(a.addon_id)),
          events: myInviteIds.size,
          guests: mine.length,
          pendingRsvp: mine.filter((g) => (g.rsvp_status ?? "pending") === "pending").length,
          openSlots: mine.filter((g) => {
            const needs = g.family_id ? familyNeedsWardrobe.get(g.family_id) !== false : true;
            if (!needs) return false;
            return !(g.claimed_by && reservedGuestIds.has(g.claimed_by));
          }).length,
        };
      });
    },
  });

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = rows.data ?? [];
    return q ? list.filter((h) => `${h.name} ${h.email}`.toLowerCase().includes(q)) : list;
  }, [rows.data, search]);

  const totals = useMemo(
    () => ({
      hosts: shown.length,
      pendingRsvp: shown.reduce((s, h) => s + h.pendingRsvp, 0),
      openSlots: shown.reduce((s, h) => s + h.openSlots, 0),
    }),
    [shown],
  );

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <p className="text-eyebrow">Hosts</p>
      <h1 className="mt-3 flex items-center gap-2 text-3xl sm:text-4xl">
        <Users className="size-6 text-primary" /> Host dashboard
      </h1>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        Every host account, the package they're on, and what's still waiting on their guests —
        replies not yet given and looks not yet chosen.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="panel p-4">
          <p className="font-display text-3xl text-primary">{totals.hosts}</p>
          <p className="mt-1 text-xs text-muted-foreground">host accounts</p>
        </div>
        <div className="panel p-4">
          <p className="font-display text-3xl text-primary">{totals.pendingRsvp}</p>
          <p className="mt-1 text-xs text-muted-foreground">replies still to come</p>
        </div>
        <div className="panel p-4">
          <p className="font-display text-3xl text-primary">{totals.openSlots}</p>
          <p className="mt-1 text-xs text-muted-foreground">outfit slots still open</p>
        </div>
      </div>

      <section className="panel mt-8 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl">Hosts ({shown.length})</h2>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search a host…"
            className="w-full sm:w-56"
          />
        </div>

        <ul className="mt-4 divide-y divide-border">
          {shown.map((h) => (
            <li key={h.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0">
                <p className="truncate text-sm">{h.name}</p>
                <p className="truncate text-xs text-muted-foreground">{h.email}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{h.planName}</Badge>
                  {h.status === "active" ? null : <Badge variant="secondary">Paused</Badge>}
                  {h.addons.map((a) => (
                    <Badge key={a} variant="secondary">
                      {a}
                    </Badge>
                  ))}
                </div>
              </div>
              <dl className="grid grid-cols-4 gap-3 text-center sm:w-72">
                <Cell label="events" value={h.events} />
                <Cell label="guests" value={h.guests} />
                <Cell label="no reply" value={h.pendingRsvp} />
                <Cell label="no look" value={h.openSlots} />
              </dl>
            </li>
          ))}
          {shown.length === 0 ? (
            <li className="py-4 text-sm text-muted-foreground">No host accounts yet.</li>
          ) : null}
        </ul>
      </section>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link to="/host">Back to your celebration</Link>
        </Button>
        {isPlatformAdmin ? (
          <Button asChild variant="secondary">
            <Link to="/platform">Packages &amp; add-ons</Link>
          </Button>
        ) : null}
      </div>
    </main>
  );
}

function Cell({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dd className="font-display text-xl text-primary">{value}</dd>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
    </div>
  );
}
