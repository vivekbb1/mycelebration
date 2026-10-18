import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, ChevronRight, Minus, Plane, Ruler } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { wardrobeLabel } from "@/lib/wardrobe-options";

type Ev = { id: string; name: string; event_date: string | null; outfit_selection: boolean | null };

function sized(src: string, w: number) {
  if (src.startsWith("/api/public/outfit-image/")) return `${src.split("?")[0]}?w=${w}`;
  if (/^https:\/\/[^/]*pernia/i.test(src)) return `/api/public/shop-image?w=${w}&u=${encodeURIComponent(src)}`;
  return src;
}

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

/** Event progress cards plus one card per family: members, their looks per event, and a score. */
export function HostFamilyPicks({
  inviteId,
  events,
  measurements,
}: {
  inviteId: string | null;
  events: Ev[];
  measurements: Array<{ guest_id: string; guest_name: string | null }>;
}) {
  const [filter, setFilter] = useState<"all" | "open" | "done">("all");

  const codes = useQuery({
    queryKey: ["family-picks-codes", inviteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invite_codes")
        .select("id, guest_name, gender, household, claimed_by, invite_id")
        .order("guest_name");
      if (error) throw error;
      return (data ?? []).filter((g) => !inviteId || g.invite_id === inviteId);
    },
  });

  const access = useQuery({
    queryKey: ["family-picks-access", inviteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("household_event_invites")
        .select("household, event_id, outfit_selection, invite_id");
      if (error) throw error;
      return (data ?? []).filter((r) => !inviteId || r.invite_id === inviteId);
    },
  });

  const res = useQuery({
    queryKey: ["family-picks-reservations", inviteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select("id, guest_id, guest_name, status, size_choice, build_garment, build_size, invite_id, outfits(title, image_url, images, event_id, boutique_url)");
      if (error) throw error;
      return (data ?? []).filter((r) => !inviteId || r.invite_id === inviteId);
    },
  });

  const travel = useQuery({
    queryKey: ["family-picks-travel", inviteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("travel_plans")
        .select("household, guest_name, travellers, arrival_date, checkin_date, invite_id");
      if (error) throw error;
      return (data ?? []).filter((r) => !inviteId || r.invite_id === inviteId);
    },
  });

  const kids = useQuery({
    queryKey: ["family-picks-kids", inviteId],
    queryFn: async () => {
      const set = new Set<string>();
      const [o, f] = await Promise.all([
        supabase.from("outfits").select("event_id, gender").in("gender", ["boy", "girl"]),
        supabase.from("outfit_feeds").select("event_id, audience").in("audience", ["boy", "girl"]),
      ]);
      for (const r of o.data ?? []) if (r.event_id) set.add(`${r.event_id}|${r.gender}`);
      for (const r of f.data ?? []) if (r.event_id) set.add(`${r.event_id}|${r.audience}`);
      return set;
    },
  });

  const pickable = events.filter((e) => e.outfit_selection !== false);

  const families = useMemo(() => {
    const byHouse = new Map<string, NonNullable<typeof codes.data>>();
    for (const c of codes.data ?? []) {
      const h = c.household?.trim() || c.guest_name;
      byHouse.set(h, [...(byHouse.get(h) ?? []), c]);
    }
    const kidSet = kids.data ?? new Set<string>();
    return [...byHouse.entries()].map(([household, members]) => {
      const rows = (access.data ?? []).filter((r) => r.household === household);
      const evs = rows.length
        ? pickable.filter((e) => rows.some((r) => r.event_id === e.id && r.outfit_selection !== false))
        : pickable;
      const ids = new Set(members.map((m) => m.claimed_by).filter(Boolean) as string[]);
      const looks = (res.data ?? []).filter((r) => ids.has(r.guest_id));
      const names = members.map((m) => norm(m.guest_name));
      let chosen = 0;
      let total = 0;
      const people = members.map((m) => {
        const name = norm(m.guest_name);
        const kid = m.gender === "boy" || m.gender === "girl";
        const measured = measurements.some(
          (x) => (m.claimed_by && x.guest_id === m.claimed_by && (!x.guest_name || norm(x.guest_name) === name)) ||
            (ids.has(x.guest_id) && norm(x.guest_name) === name),
        );
        const plans = (travel.data ?? []).filter((t) => t.household === household && (t.arrival_date || t.checkin_date));
        const plan =
          plans.find((t) => (t.travellers ?? []).some((n: string) => norm(n) === name)) ??
          plans.find((t) => norm(t.guest_name) === name) ??
          plans.find((t) => !(t.travellers ?? []).length && !t.guest_name);
        const arrival = plan?.arrival_date ?? plan?.checkin_date ?? null;
        const byCheckin = Boolean(plan && !plan.arrival_date);
        const perEvent = evs.map((ev) => {
          const look = looks.find((r) => {
            const o = r.outfits as { event_id: string | null } | null;
            if (o?.event_id !== ev.id) return false;
            const who = norm(r.guest_name);
            if (who) return who === name;
            return r.guest_id === m.claimed_by || names.length === 1;
          });
          const counts = !kid || kidSet.has(`${ev.id}|${m.gender}`) || Boolean(look);
          if (counts) total++;
          if (counts && look) chosen++;
          return { ev, look, counts };
        });
        return { m, measured, perEvent, arrival, byCheckin };
      });
      return { household, people, chosen, total, evs };
    }).sort((a, b) => Number(a.chosen >= a.total) - Number(b.chosen >= b.total) || a.household.localeCompare(b.household));
  }, [codes.data, access.data, res.data, kids.data, travel.data, pickable, measurements]);

  const eventStats = pickable.map((ev) => {
    let c = 0;
    let t = 0;
    for (const f of families)
      for (const p of f.people) {
        const x = p.perEvent.find((pe) => pe.ev.id === ev.id);
        if (x?.counts) {
          t++;
          if (x.look) c++;
        }
      }
    return { ev, c, t };
  });
  const allC = eventStats.reduce((s, e) => s + e.c, 0);
  const allT = eventStats.reduce((s, e) => s + e.t, 0);

  const shown = families.filter((f) =>
    filter === "all" ? true : filter === "done" ? f.total > 0 && f.chosen >= f.total : f.chosen < f.total,
  );

  if (codes.isLoading || res.isLoading || access.isLoading)
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (pickable.length === 0)
    return <p className="text-sm text-muted-foreground">No event has outfit selection switched on yet.</p>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="All events" sub="Whole celebration" c={allC} t={allT} />
        {eventStats.map(({ ev, c, t }) => (
          <StatCard
            key={ev.id}
            title={ev.name}
            sub={ev.event_date ? new Date(`${ev.event_date}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "Date to be confirmed"}
            c={c}
            t={t}
          />
        ))}
      </div>

      <div className="panel p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl">Outfit picks by family</h2>
          <div className="flex gap-1">
            {(["all", "open", "done"] as const).map((k) => (
              <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} onClick={() => setFilter(k)}>
                {k === "all" ? "All" : k === "open" ? "Still choosing" : "Complete"}
              </Button>
            ))}
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {shown.length === 0 ? <p className="text-sm text-muted-foreground">No families here.</p> : null}
          {shown.map((f) => {
            const done = f.total > 0 && f.chosen >= f.total;
            return (
              <div key={f.household} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    to="/family/$household"
                    params={{ household: f.household }}
                    className="flex items-center gap-1 text-lg hover:text-primary"
                  >
                    {f.household}
                    <ChevronRight className="size-4" />
                  </Link>
                  <Badge variant={done ? "default" : "secondary"}>
                    {f.chosen} / {f.total} outfits chosen{done ? " · All set" : ""}
                  </Badge>
                </div>
                <div className="mt-3 divide-y divide-border">
                  {f.people.map(({ m, measured, perEvent, arrival, byCheckin }) => (
                    <div key={m.id} className="py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm">{m.guest_name}</p>
                        {m.gender ? <span className="text-xs text-muted-foreground">{wardrobeLabel(m.gender)}</span> : null}
                        <span className={`flex items-center gap-1 text-xs ${measured ? "text-primary" : "text-muted-foreground"}`}>
                          <Ruler className="size-3" />
                          {measured ? "Measurements in" : "No measurements yet"}
                        </span>
                      </div>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <Plane className="size-3" />
                        {arrival ? `${byCheckin ? "Checks in" : "Arrives"} ${fmt(arrival)}` : "Arrival or check-in not shared yet"}
                      </p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {perEvent.filter((p) => p.counts).map(({ ev, look }) => {
                          const o = look?.outfits as { title: string; image_url: string | null; images: unknown; boutique_url: string | null } | null | undefined;
                          const img = o?.image_url || (Array.isArray(o?.images) ? (o?.images[0] as string) : null);
                          const shop = o?.boutique_url && /^https?:\/\//i.test(o.boutique_url) ? o.boutique_url : null;
                           const confirmed = Boolean(look && ((look.build_garment && look.build_size) || look.status === "confirmed"));
                          return (
                            <div key={ev.id} className="flex items-center gap-3 rounded-lg bg-surface p-2">
                              {img ? (
                                shop ? <a href={shop} target="_blank" rel="noopener noreferrer" aria-label={`Open ${o?.title ?? "outfit"} in shop`} className="shrink-0"><img src={sized(img, 120)} alt={o?.title ?? ""} loading="lazy" className="h-16 w-12 rounded object-cover" /></a> : <img src={sized(img, 120)} alt={o?.title ?? ""} loading="lazy" className="h-16 w-12 shrink-0 rounded object-cover" />
                              ) : (
                                <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded bg-muted">
                                  <Minus className="size-3.5 text-muted-foreground" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-[0.65rem] tracking-wider text-muted-foreground uppercase">{ev.name}</p>
                                {o ? (
                                  <>
                                    {shop ? <a href={shop} target="_blank" rel="noopener noreferrer" className="block truncate text-xs hover:text-primary hover:underline" title={o.title}>{o.title}</a> : <p className="truncate text-xs">{o.title}</p>}
                                     <p className="text-xs text-muted-foreground">Size: {look?.size_choice ?? look?.build_size ?? "Not selected"}</p>
                                    <p className="flex items-center gap-1 text-xs text-primary">
                                      <Check className="size-3" />
                                      {confirmed ? "Confirmed" : "Reserved"}
                                    </p>
                                  </>
                                ) : (
                                  <p className="text-xs text-muted-foreground">Not chosen</p>
                                )}
                                <p className="text-[0.65rem] text-muted-foreground">{gap(arrival, ev.event_date)}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, sub, c, t }: { title: string; sub: string; c: number; t: number }) {
  const pct = t ? Math.round((c / t) * 100) : 0;
  return (
    <div className="panel p-4">
      <p className="truncate text-sm">{title}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
      <p className="mt-2 text-2xl">
        {c} <span className="text-base text-muted-foreground">/ {t}</span>
      </p>
      <p className="text-xs text-muted-foreground">outfits chosen</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function fmt(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** Days between arrival and the event, for planning alterations. */
function gap(arrival: string | null, event: string | null) {
  if (!arrival || !event) return "Days before event: —";
  const d = Math.round((Date.parse(`${event}T00:00:00Z`) - Date.parse(`${arrival}T00:00:00Z`)) / 86400000);
  if (d < 0) return `Arrives ${-d} day${d === -1 ? "" : "s"} after the event`;
  if (d === 0) return "Arrives on the day";
  return `${d} day${d === 1 ? "" : "s"} before the event`;
}
