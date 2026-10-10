import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { ClearMeasurementsButton } from "@/components/clear-measurements-button";
import { AddFamilyMemberButton, FamilyMemberActions } from "@/components/host-family-members";

import { supabase } from "@/integrations/supabase/client";
import { useIsAnyHost } from "@/lib/host-role";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFeatures } from "@/lib/features";
import { GuestPassports } from "@/components/guest-passports";
import { FamilyTravelAdmin } from "@/components/family-travel-admin";
import { FamilyNotes } from "@/components/family-notes";
import { splitTags } from "@/components/host-function-access";

export const Route = createFileRoute("/_authenticated/family/$household")({
  head: () => ({
    meta: [
      { title: "Family file — My Celebration" },
      {
        name: "description",
        content:
          "Everything about one family in one place: members, contact details, head count, replies, flights, passports and looks.",
      },
      { property: "og:title", content: "Family file — My Celebration" },
      {
        property: "og:description",
        content: "One family's details, replies, travel and wardrobe choices for hosts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FamilyPage,
});

const dateLabel = (value: string | null) =>
  value
    ? new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
      })
    : "—";

const rsvpLabel = (value: string | null | undefined) => {
  const v = (value ?? "").toLowerCase();
  if (v === "yes" || v === "attending" || v === "confirmed") return "Coming";
  if (v === "no" || v === "declined" || v === "regrets") return "Can't come";
  return "Waiting";
};

function FamilyPage() {
  const { household } = Route.useParams();
  const name = decodeURIComponent(household);
  const queryClient = useQueryClient();
  const { has } = useFeatures();
  const [draft, setDraft] = useState<Record<string, string>>({});

  const role = useIsAnyHost();
  const isHost = role.data === true;

  const people = useQuery({
    queryKey: ["family-people", name],
    enabled: isHost,
    queryFn: async () => {
      const byHousehold = await supabase
        .from("invite_codes")
        .select("*")
        .eq("household", name)
        .order("guest_name");
      if (byHousehold.error) throw byHousehold.error;
      if ((byHousehold.data ?? []).length > 0) return byHousehold.data;
      const byName = await supabase
        .from("invite_codes")
        .select("*")
        .eq("guest_name", name)
        .order("guest_name");
      if (byName.error) throw byName.error;
      return byName.data ?? [];
    },
  });

  const rows = people.data ?? [];
  const inviteId = rows.find((r) => r.invite_id)?.invite_id ?? null;
  const familyId = rows.find((r) => r.family_id)?.family_id ?? null;
  const guestIds = rows.map((r) => r.id);
  const userIds = rows.map((r) => r.claimed_by).filter(Boolean) as string[];

  const events = useQuery({
    queryKey: ["family-events", inviteId],
    enabled: isHost && rows.length > 0,
    queryFn: async () => {
      const query = supabase.from("events").select("id, name, event_date, dress_code").order("sort_order");
      const { data, error } = inviteId ? await query.eq("invite_id", inviteId) : await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const assigned = useQuery({
    queryKey: ["family-assigned", name],
    enabled: isHost,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("household_event_invites")
        .select("event_id")
        .eq("household", name);
      if (error) throw error;
      return (data ?? []).map((r) => r.event_id);
    },
  });

  const attendance = useQuery({
    queryKey: ["family-attendance", name],
    enabled: isHost,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_attendance")
        .select("event_id, attending, guest_count")
        .eq("household", name);
      if (error) throw error;
      return data ?? [];
    },
  });

  const travel = useQuery({
    queryKey: ["family-travel", name],
    enabled: isHost,
    queryFn: async () => {
      const { data, error } = await supabase.from("travel_plans").select("*").eq("household", name);
      if (error) throw error;
      return data ?? [];
    },
  });

  const comms = useQuery({
    queryKey: ["family-comms", name, guestIds.join(",")],
    enabled: isHost && has("guest_communication") && guestIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guest_communications")
        .select("id, invite_id, channel, outcome, notes, follow_up_on, contacted_at")
        .in("invite_id", guestIds)
        .order("contacted_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const lookAfter = useQuery({
    queryKey: ["family-hosts", name, guestIds.join(",")],
    enabled: isHost && has("guest_tracker") && guestIds.length > 0,
    queryFn: async () => {
      const links = await supabase
        .from("guest_hosts")
        .select("invite_id, host_id, note")
        .in("invite_id", guestIds);
      if (links.error) throw links.error;
      const hostIds = [...new Set((links.data ?? []).map((l) => l.host_id))];
      if (hostIds.length === 0) return [] as Array<{ invite_id: string; label: string }>;
      const profiles = await supabase.from("profiles").select("id, full_name, email").in("id", hostIds);
      return (links.data ?? []).map((l) => {
        const p = (profiles.data ?? []).find((x) => x.id === l.host_id);
        return { invite_id: l.invite_id, label: p?.full_name || p?.email || "A host" };
      });
    },
  });

  const looks = useQuery({
    queryKey: ["family-looks", name, userIds.join(",")],
    enabled: isHost && has("wardrobe_picker") && userIds.length > 0,
    queryFn: async () => {
      const res = await supabase
        .from("reservations")
        .select("id, guest_id, guest_name, status, order_status, build_garment, build_size, outfit_id")
        .in("guest_id", userIds);
      if (res.error) throw res.error;
      const outfitIds = [...new Set((res.data ?? []).map((r) => r.outfit_id))];
      const outfits = outfitIds.length
        ? await supabase
            .from("outfits")
            .select("id, title, designer, image_url, event_id")
            .in("id", outfitIds)
        : { data: [] as Array<{ id: string; title: string; designer: string | null; image_url: string | null; event_id: string | null }> };
      return (res.data ?? []).map((r) => ({
        ...r,
        outfit: (outfits.data ?? []).find((o) => o.id === r.outfit_id) ?? null,
      }));
    },
  });

  // Hosts can read their guests' measurements, so the tailor's numbers are here too.
  const measurements = useQuery({
    queryKey: ["family-measurements", name, userIds.join(",")],
    enabled: isHost && userIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("measurements")
        .select("*")
        .in("guest_id", userIds);
      if (error) throw error;
      return data;
    },
  });

  const savePassport = async (
    id: string,
    field: "passport_number" | "passport_nationality" | "passport_expiry",
    value: string,
  ) => {
    const clean = value.trim() || null;
    const patch =
      field === "passport_number"
        ? { passport_number: clean }
        : field === "passport_nationality"
          ? { passport_nationality: clean }
          : { passport_expiry: clean };
    const { error } = await supabase.from("invite_codes").update(patch).eq("id", id);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Saved");
    await queryClient.invalidateQueries({ queryKey: ["family-people", name] });
  };

  if (role.isLoading) {
    return (
      <p className="mx-auto max-w-6xl px-4 py-12 text-sm text-muted-foreground sm:px-6">Loading…</p>
    );
  }

  if (!isHost) {
    return (
      <main className="mx-auto max-w-md px-4 py-12 sm:px-6 sm:py-16">
        <div className="panel p-4 sm:p-6">
          <ShieldCheck className="size-5 text-primary" />
          <h1 className="mt-4 text-2xl">Hosts only</h1>
          <p className="mt-2 text-sm text-muted-foreground">This page is part of the host area.</p>
          <Button asChild className="mt-5 w-full">
            <Link to="/guest/invite">Back to your invitation</Link>
          </Button>
        </div>
      </main>
    );
  }


  const owner = useQuery({
    queryKey: ["is-celebration-owner", inviteId],
    enabled: isHost && Boolean(inviteId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_celebration_owner", { _invite_id: inviteId as string });
      if (error) throw error;
      return Boolean(data);
    },
  });
  const isOwner = owner.data === true;

  const eventList = (events.data ?? []).filter(
    (e) => (assigned.data ?? []).length === 0 || (assigned.data ?? []).includes(e.id),
  );
  const totalCount = (attendance.data ?? [])
    .filter((a) => a.attending)
    .reduce((sum, a) => Math.max(sum, a.guest_count ?? 0), 0);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/host/$" params={{ _splat: "guests" }}>
          <ArrowLeft className="size-4" /> Back to the guest list
        </Link>
      </Button>

      <h1 className="mt-4 text-3xl">{name}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {rows.length} {rows.length === 1 ? "person" : "people"} on the list
        {totalCount ? ` · ${totalCount} coming at most` : ""}
      </p>

      <div className="gold-rule my-8" />

      <div className="grid gap-6">
        <section className="panel p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl">Family members</h2>
            {isHost && inviteId ? <AddFamilyMemberButton inviteId={inviteId} household={name} /> : null}
          </div>
          {rows.length === 1 && rows[0]?.claimed_by ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Registration may not be finished — add the rest of the family here.
            </p>
          ) : null}
          {rows.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No one on this family yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {rows.map((p) => (
                <li key={p.id} className="py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p>{p.guest_name}</p>
                    <Badge variant="secondary">{p.category}</Badge>
                    {p.gender ? <Badge variant="outline">{p.gender}</Badge> : null}
                    <Badge variant={p.claimed_by ? "default" : "outline"}>
                      {p.claimed_by ? "Registered" : "Not registered"}
                    </Badge>
                    <Badge variant="outline">{rsvpLabel(p.rsvp_status)}</Badge>
                    {isHost ? <span className="ml-auto flex"><FamilyMemberActions person={p} /></span> : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {[p.code, p.email, p.phone].filter(Boolean).join(" · ") || "No contact details"}
                  </p>
                  {splitTags(p.tags).length > 0 ? (
                    <p className="mt-1 text-xs text-primary">
                      {splitTags(p.tags)
                        .map((t) => `#${t}`)
                        .join(" ")}
                    </p>
                  ) : null}
                  {has("guest_tracker") ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Looked after by:{" "}
                      {(lookAfter.data ?? [])
                        .filter((l) => l.invite_id === p.id)
                        .map((l) => l.label)
                        .join(", ") || "no one yet"}
                    </p>
                  ) : null}

                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <Input
                      placeholder="Passport number"
                      maxLength={40}
                      defaultValue={p.passport_number ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...d, [`${p.id}-n`]: e.target.value }))}
                      onBlur={() =>
                        savePassport(p.id, "passport_number", draft[`${p.id}-n`] ?? p.passport_number ?? "")
                      }
                    />
                    <Input
                      placeholder="Nationality"
                      maxLength={40}
                      defaultValue={p.passport_nationality ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...d, [`${p.id}-c`]: e.target.value }))}
                      onBlur={() =>
                        savePassport(
                          p.id,
                          "passport_nationality",
                          draft[`${p.id}-c`] ?? p.passport_nationality ?? "",
                        )
                      }
                    />
                    <Input
                      type="date"
                      aria-label={`Passport expiry for ${p.guest_name}`}
                      defaultValue={p.passport_expiry ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...d, [`${p.id}-e`]: e.target.value }))}
                      onBlur={() =>
                        savePassport(p.id, "passport_expiry", draft[`${p.id}-e`] ?? p.passport_expiry ?? "")
                      }
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {has("arrivals") ? (<>
        <section className="panel p-4 sm:p-6">
          <h2 className="text-xl">Passports sent by the family</h2>
          <GuestPassports household={name} people={rows.map((p) => p.guest_name)} />
        </section>

        <FamilyTravelAdmin household={name} inviteId={inviteId} familyId={familyId} />
        {isHost && inviteId ? <FamilyRooms household={name} inviteId={inviteId} /> : null}
        </>) : null}

        <FamilyNotes household={name} inviteId={inviteId} isOwner={isOwner} />

        <section className="panel p-4 sm:p-6">
          <h2 className="text-xl">Replies and head count by event</h2>
          {eventList.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No events chosen for this family yet — use the Assign tab.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {eventList.map((e) => {
                const a = (attendance.data ?? []).find((x) => x.event_id === e.id);
                return (
                  <li key={e.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                    <span className="min-w-0 flex-1 truncate">{e.name}</span>
                    <span className="text-xs text-muted-foreground">{dateLabel(e.event_date)}</span>
                    <Badge variant={a?.attending ? "default" : a ? "destructive" : "outline"}>
                      {a?.attending ? "Coming" : a ? "Can't come" : "No answer"}
                    </Badge>
                    <Badge variant="outline">{a?.attending ? (a.guest_count ?? 0) : 0} guests</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {has("arrivals") ? (
        <section className="panel p-4 sm:p-6">
          <h2 className="text-xl">Flights and travel</h2>
          {(travel.data ?? []).length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No travel details yet.</p>
          ) : (
            <ul className="mt-4 space-y-3 text-sm">
              {(travel.data ?? []).map((t) => (
                <li key={t.id} className="rounded-lg border border-border p-3">
                  <p>{t.guest_name || "Whole family"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Arrives {dateLabel(t.arrival_date)}
                    {t.arrival_time ? ` · ${t.arrival_time}` : ""}
                    {t.arrival_flight ? ` · ${t.arrival_flight}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Leaves {dateLabel(t.departure_date)}
                    {t.departure_time ? ` · ${t.departure_time}` : ""}
                    {t.departure_flight ? ` · ${t.departure_flight}` : ""}
                  </p>
                  {t.notes ? <p className="mt-1 text-xs">{t.notes}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
        ) : null}

        {has("wardrobe_picker") ? (
          <section className="panel p-4 sm:p-6">
            <h2 className="text-xl">Wardrobe choices</h2>
            {(looks.data ?? []).length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No looks chosen yet.</p>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {(looks.data ?? []).map((r) => {
                  const ev = (events.data ?? []).find((e) => e.id === r.outfit?.event_id);
                  return (
                    <article key={r.id} className="overflow-hidden rounded-xl border border-border">
                      {r.outfit?.image_url ? (
                        <img
                          src={r.outfit.image_url}
                          referrerPolicy="no-referrer"
                          alt={r.outfit.title}
                          loading="lazy"
                          className="aspect-[3/4] w-full object-cover"
                        />
                      ) : null}
                      <div className="p-3">
                        {ev ? <p className="text-xs text-primary">{ev.name}</p> : null}
                        <p className="mt-0.5 text-sm">{r.outfit?.title ?? "Outfit"}</p>
                        <p className="text-xs text-muted-foreground">
                          {[r.guest_name, r.outfit?.designer, r.build_size].filter(Boolean).join(" · ")}
                        </p>
                        <Badge variant="outline" className="mt-2">
                          {r.order_status}
                        </Badge>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        ) : null}

        <section className="panel p-4 sm:p-6">
          <h2 className="text-xl">Measurements</h2>
          {(measurements.data ?? []).length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Nobody in this family has sent their measurements yet.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {(measurements.data ?? []).map((m) => {
                const unit = (m.unit as string | null) ?? "cm";
                const fields: Array<[string, unknown]> = [
                  ["Height", m.height],
                  ["Bust / chest", m.bust],
                  ["Waist", m.waist],
                  ["Hip", m.hip],
                  ["Shoulder", m.shoulder],
                  ["Sleeve", m.sleeve_length],
                  ["Blouse / kurta length", m.top_length],
                  ["Skirt / trouser length", m.bottom_length],
                  ["Inseam", m.inseam],
                ];
                const given = fields.filter(([, v]) => v !== null && v !== undefined);
                return (
                  <div key={m.id as string} className="rounded-xl border border-border p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 text-sm">
                        {(m.guest_name as string) || "Guest"}{" "}
                        <span className="text-xs text-muted-foreground">in {unit}</span>
                      </p>
                      <ClearMeasurementsButton id={m.id as string} name={(m.guest_name as string) || "this guest"} />
                    </div>
                    {given.length === 0 ? (
                      <p className="mt-2 text-xs text-muted-foreground">Nothing filled in yet.</p>
                    ) : (
                      <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                        {given.map(([label, value]) => (
                          <div key={label} className="flex items-baseline justify-between gap-3">
                            <dt className="text-xs text-muted-foreground">{label}</dt>
                            <dd className="text-sm">
                              {String(value)} {unit}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    {m.notes ? (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Note for the tailor: {m.notes as string}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>


        {has("guest_communication") ? (
          <section className="panel p-4 sm:p-6">
            <h2 className="text-xl">Communication timeline</h2>
            {(comms.data ?? []).length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Nothing recorded yet — log a call or message under Guests → Communication.
              </p>
            ) : (
              <ol className="mt-4 space-y-4 border-l border-border/70 pl-5">
                {(comms.data ?? []).map((c) => {
                  const who = rows.find((r) => r.id === c.invite_id)?.guest_name ?? "Guest";
                  return (
                    <li key={c.id} className="relative">
                      <span className="absolute -left-[26px] top-2 size-2 rounded-full bg-primary" />
                      <p className="text-sm">
                        {who} — {c.channel} · {c.outcome}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(c.contacted_at).toLocaleString()}
                        {c.follow_up_on ? ` · follow up ${dateLabel(c.follow_up_on)}` : ""}
                      </p>
                      {c.notes ? <p className="mt-1 text-sm">{c.notes}</p> : null}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        ) : null}
      </div>
    </main>
  );
}

function FamilyRooms({ household, inviteId }: { household: string; inviteId: string }) {
  const q = useQuery({
    queryKey: ["family-rooms", inviteId, household],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("room_assignments")
        .select("id, guest_name, extra_bed, hotel_rooms(room_number, floor, category, vendors(name))")
        .eq("invite_id", inviteId)
        .eq("household", household);
      if (error) return [];
      return data ?? [];
    },
  });
  if (!q.data?.length) return null;
  return (
    <section className="panel p-4 sm:p-6">
      <h2 className="text-xl">Rooms</h2>
      <p className="mt-1 text-sm text-muted-foreground">Change rooms under Guests → Rooms.</p>
      <ul className="mt-3 space-y-1 text-sm">
        {q.data.map((a) => {
          const r = a.hotel_rooms as unknown as { room_number: string; floor: string | null; category: string; vendors: { name: string } | null } | null;
          return (
            <li key={a.id}>
              {a.guest_name}: {r?.vendors?.name} room {r?.room_number}
              {r?.floor ? ` (floor ${r.floor})` : ""} · {r?.category}
              {a.extra_bed ? " · extra bed" : ""}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
