import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, ChevronRight, Download, Minus, Plane, Ruler } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { memberLook, memberMeasurements } from "@/lib/outfit-pick-progress";
import type { Database } from "@/integrations/supabase/types";

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
  const [eventFilter, setEventFilter] = useState("all");
  const [sizeFilter, setSizeFilter] = useState("all");
  const fullMeasurements = useQuery({
    queryKey: ["family-picks-order-measurements", inviteId],
    enabled: Boolean(inviteId),
    queryFn: async () => {
      if (!inviteId) return [];
      const { data, error } = await supabase.from("measurements").select("*").eq("invite_id", inviteId);
      if (error) throw error;
      return data ?? [];
    },
  });

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
        .select("id, guest_id, guest_name, member_code_id, status, size_choice, build_garment, build_size, invite_id, outfits(title, designer, notes, source_sku, image_url, images, event_id, boutique_url)");
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
          const look = memberLook(m, members, looks, ev.id);
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

  const matches = (p: typeof families[number]["people"][number]["perEvent"][number]) =>
    (eventFilter === "all" || p.ev.id === eventFilter) &&
    (sizeFilter === "all" || (p.look && (p.look.size_choice || p.look.build_size || "Not selected") === sizeFilter));
  const sizes = [...new Set((res.data ?? []).filter((r) => eventFilter === "all" || r.outfits?.event_id === eventFilter).map((r) => r.size_choice || r.build_size || "Not selected"))].sort();
  const shown = families.filter((f) =>
    filter === "all" ? true : filter === "done" ? f.total > 0 && f.chosen >= f.total : f.chosen < f.total,
  ).filter((f) => f.people.some((p) => p.perEvent.some((e) => e.counts && matches(e))));
  const orderRows = shown.flatMap((f) => f.people.flatMap((p) => p.perEvent.filter((e) => e.look && matches(e)).map((e) => ({ f, p, e }))));
  async function downloadOrders() {
    const XLSX = await import("xlsx");
    const fields = ["unit", "usual_size", "height", "chest", "bust", "under_bust", "waist", "hip", "shoulder", "armhole", "neck", "sleeve_length", "top_length", "bottom_length", "inseam", "notes"] as const;
    const records = orderRows.map(({ f, p, e }) => {
      const m = memberMeasurements(p.m, f.people.map((x) => x.m), fullMeasurements.data ?? []);
      const look = e.look;
      return {
        Family: f.household, Guest: p.m.guest_name, Event: e.ev.name, "Event date": e.ev.event_date ?? "",
        Outfit: look?.outfits?.title ?? "", Designer: look?.outfits?.designer ?? "", SKU: look?.outfits?.source_sku ?? "",
        Description: look?.outfits?.notes ?? "", "Selected size": look?.size_choice || look?.build_size || "Not selected",
        Status: look && ((look.build_garment && look.build_size) || look.status === "confirmed") ? "Confirmed" : "Reserved",
        "Shop link": look?.outfits?.boutique_url ?? "", Photo: look?.outfits?.image_url ?? "",
        "Measurements supplied": m ? "Yes" : "No",
        ...Object.fromEntries(fields.map((k) => [k.replaceAll("_", " "), m?.[k] ?? ""])),
      };
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(records), "Shop orders");
    XLSX.writeFile(workbook, "family-outfit-shop-orders.xlsx");
  }

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

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Select value={eventFilter} onValueChange={(v) => { setEventFilter(v); setSizeFilter("all"); }}>
            <SelectTrigger aria-label="Filter outfits by event" className="w-full sm:w-56"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All events</SelectItem>{pickable.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={sizeFilter} onValueChange={setSizeFilter}>
            <SelectTrigger aria-label="Filter outfits by size" className="w-full sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All sizes</SelectItem>{sizes.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" disabled={!orderRows.length || fullMeasurements.isLoading || fullMeasurements.isError} onClick={() => void downloadOrders()}><Download className="size-4" /> Shop order list ({orderRows.length})</Button>
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
                  {f.people.filter((p) => p.perEvent.some((e) => e.counts && matches(e))).map(({ m, measured, perEvent, arrival, byCheckin }) => (
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
                      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {perEvent.filter((p) => p.counts && matches(p)).map(({ ev, look }) => {
                          const o = look?.outfits as { title: string; image_url: string | null; images: unknown; boutique_url: string | null } | null | undefined;
                          const img = o?.image_url || (Array.isArray(o?.images) ? (o?.images[0] as string) : null);
                          const shop = o?.boutique_url && /^https?:\/\//i.test(o.boutique_url) ? o.boutique_url : null;
                           const confirmed = Boolean(look && ((look.build_garment && look.build_size) || look.status === "confirmed"));
                          return (
                            <div key={ev.id} className="flex min-w-0 items-center gap-3 rounded-lg bg-surface p-2">
                              {img ? (
                                shop ? <a href={shop} target="_blank" rel="noopener noreferrer" aria-label={`Open ${o?.title ?? "outfit"} in shop`} className="shrink-0"><img src={sized(img, 120)} alt={o?.title ?? ""} loading="lazy" className="h-16 w-12 rounded object-cover" /></a> : <img src={sized(img, 120)} alt={o?.title ?? ""} loading="lazy" className="h-16 w-12 shrink-0 rounded object-cover" />
                              ) : (
                                <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded bg-muted">
                                  <Minus className="size-3.5 text-muted-foreground" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
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
                      <MemberMeasurements row={memberMeasurements(m, f.people.map((x) => x.m), fullMeasurements.data ?? []) as Record<string, unknown> | undefined} />
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

const MEASURE_FIELDS: Array<[string, string]> = [
  ["height", "Height"], ["bust", "Bust"], ["chest", "Chest"], ["under_bust", "Under bust"], ["waist", "Waist"], ["hip", "Hip"],
  ["shoulder", "Shoulder"], ["armhole", "Armhole"], ["neck", "Neck"], ["sleeve_length", "Sleeve"], ["top_length", "Top / kurta length"],
  ["bottom_length", "Skirt / trouser length"], ["inseam", "Inseam"],
];

function MemberMeasurements({ row }: { row: Record<string, unknown> | undefined }) {
  if (!row) return null;
  const unit = (row["unit"] as string | null) ?? "cm";
  const given = MEASURE_FIELDS.filter(([k]) => row[k] !== null && row[k] !== undefined);
  if (!given.length && !row["usual_size"] && !row["notes"]) return null;
  return (
    <div className="mt-2 rounded-lg border border-border p-2">
      <p className="flex items-center gap-1 text-[0.65rem] tracking-wider text-muted-foreground uppercase">
        <Ruler className="size-3" /> Measurements · {unit}{row["usual_size"] ? ` · usual size ${String(row["usual_size"])}` : ""}
      </p>
      {given.length ? (
        <dl className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3 lg:grid-cols-5">
          {given.map(([k, label]) => (
            <div key={k} className="flex items-baseline justify-between gap-2">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="text-xs">{String(row[k])}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {row["notes"] ? <p className="mt-1.5 text-xs text-muted-foreground">Note for the tailor: {String(row["notes"])}</p> : null}
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
