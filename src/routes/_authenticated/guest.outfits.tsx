import { WARDROBES, WARDROBE_VALUES, isWardrobe, wardrobeLabel } from "@/lib/wardrobe-options";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LiveFeed } from "@/components/live-feed";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, Lock, Check, MapPin, Heart, Pin, Search } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useGuestEvent } from "@/lib/guest-event";
import { useNeedsWardrobe } from "@/lib/wardrobe";
import { scheduleHeadline, scheduleSummary } from "@/lib/schedule";
import { sendReservationEmail } from "@/lib/reservation-email.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { claimInvite } from "@/routes/auth";
import { useDeliveryPlan } from "@/lib/logistics";

export const Route = createFileRoute("/_authenticated/guest/outfits")({
  head: () => ({
    meta: [
      { title: "The Lookbook — Reserve Your Wedding Outfit" },
      {
        name: "description",
        content:
          "Browse curated lehengas, sarees, sherwanis and gowns for each wedding event. One guest per look, tailoring included.",
      },
      { property: "og:title", content: "The Lookbook — Reserve Your Wedding Outfit" },
      {
        property: "og:description",
        content: "Curated designer outfits per event. Claim a look and it's locked to you alone.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Lookbook,
});

type Outfit = {
  id: string;
  is_pinned?: boolean;
  event_id: string | null;
  title: string;
  designer: string | null;
  boutique_url: string | null;
  image_url: string | null;
  color_family: string | null;
  gender: string;
  garment_type: string | null;
  size_note: string | null;
  price_note: string | null;
  notes: string | null;
  images: string[] | null;
  is_available: boolean;
  created_at?: string | null;
};

function Lookbook() {
  const deliveryPlan = useDeliveryPlan();
  const queryClient = useQueryClient();
  const emailConfirmation = useServerFn(sendReservationEmail);
  const [activeEvent, setActiveEvent] = useState<string>("all");
  const [code, setCode] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [favOnly, setFavOnly] = useState(false);
  const [picksOnly, setPicksOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [colour, setColour] = useState("");
  const [designer, setDesigner] = useState("");
  const [garment, setGarment] = useState("");
  const [freeOnly, setFreeOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"recommended" | "newest" | "az">("recommended");
  const [pageSize, setPageSize] = useState(24);
  const [limit, setLimit] = useState(24);
  const favourites = useQuery({
    queryKey: ["outfit-favourites"],
    queryFn: async () => {
      const { data } = await supabase.from("outfit_favourites").select("outfit_id");
      return new Set((data ?? []).map((f) => f.outfit_id));
    },
  });
  const toggleFavourite = async (id: string) => {
    const isFav = favourites.data?.has(id);
    const { error } = isFav
      ? await supabase.from("outfit_favourites").delete().eq("outfit_id", id)
      : await supabase.from("outfit_favourites").insert({ outfit_id: id });
    if (error) return;
    await favourites.refetch();
  };
  const [activePerson, setActivePerson] = useState<string | null>(null);
  const [wardrobeOverride, setWardrobeOverride] = useState<Record<string, string>>({});
  const { needsWardrobe } = useNeedsWardrobe();

  const me = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return null;
      const [{ data }, guestOf] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, invite_claimed, gender, household")
          .eq("id", user.id)
          .maybeSingle(),
        supabase.rpc("my_guest_invite_ids"),
      ]);
      // A host account is "claimed" too, but only a guest code unlocks the wardrobe.
      const isGuest = (guestOf.data ?? []).length > 0;
      const row = data ?? {
        id: user.id,
        full_name: "",
        invite_claimed: false,
        gender: null as string | null,
        household: null as string | null,
      };
      return { ...row, invite_claimed: Boolean(row.invite_claimed) && isGuest };
    },
  });

  // Only the events this family is invited to.
  const myEventIds = useQuery({
    queryKey: ["my-event-ids"],
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return new Set<string>();
      const { data, error } = await supabase.rpc("my_event_ids");
      if (error) throw error;
      return new Set(((data ?? []) as { event_id: string }[]).map((r) => r.event_id));
    },
  });

  const events = useQuery({
    queryKey: ["events", "mine", [...(myEventIds.data ?? [])].sort().join(",")],
    enabled: myEventIds.isSuccess,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select(
          "id, name, event_date, start_time, venue, dress_code, sort_order, outfit_selection, outfit_choose_by",
        )
        .order("sort_order");
      if (error) throw error;
      const allowed = myEventIds.data;
      return allowed ? data.filter((e) => allowed.has(e.id)) : data;
    },
  });

  const outfits = useQuery({
    queryKey: ["outfits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("outfits")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Outfit[];
    },
  });

  const reservations = useQuery({
    queryKey: ["reservations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select("id, outfit_id, guest_id, guest_name, status");
      if (error) throw error;
      return data;
    },
  });

  // Everyone invited under the same family name, so a couple can choose one after the other.
  const household = useQuery({
    queryKey: ["household-members"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("household_members");
      if (error) throw error;
      return (data ?? []) as { name: string; gender: string | null }[];
    },
  });

  // Only your own reservations are readable; other guests stay anonymous and
  // an outfit taken by someone else simply shows as unavailable.
  const mineByOutfit = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const r of reservations.data ?? []) {
      if (me.data?.id && r.guest_id !== me.data.id) continue;
      map.set(r.outfit_id, r.guest_name ?? null);
    }
    return map;
  }, [reservations.data, me.data?.id]);

  // Per-family choices: for some events a family chooses a look from us, for
  // others they wear their own — set by the hosts, family by family.
  const myAccess = useQuery({
    queryKey: ["my-household-event-invites"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("household_event_invites")
        .select("event_id, outfit_selection");
      if (error) throw error;
      return data;
    },
  });

  // The family's own setting wins; otherwise the event's setting from the Events tab.
  const familyPicks = (eventId: string) => {
    const row = (myAccess.data ?? []).find((r) => r.event_id === eventId);
    if (row) return row.outfit_selection !== false;
    return (events.data ?? []).find((e) => e.id === eventId)?.outfit_selection !== false;
  };

  // Events where the hosts dress the guests, and the ones where guests wear their own.
  const guestEvent = useGuestEvent();
  const eventList = (events.data ?? []).filter((e) => guestEvent.allows(e.id));

  const pickableEvents = eventList.filter(
    (e) => familyPicks(e.id),
  );
  const ownOutfitEvents = eventList.filter(
    (e) => !familyPicks(e.id),
  );
  const ownOutfitIds = new Set(ownOutfitEvents.map((e) => e.id));

  // Each guest sees the looks made for them: menswear or womenswear, never both.
  const myGender = (me.data?.gender as string | null) ?? null;

  const saveGender = async (gender: string) => {
    if (!me.data?.id) return;
    const { error } = await supabase.from("profiles").update({ gender }).eq("id", me.data.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["me"] });
  };

  // Pick the person first: every name invited under this family becomes a capsule.
  const people = useMemo(() => {
    const list = household.data ?? [];
    if (list.length > 0) return list;
    return [
      {
        name: (me.data?.full_name ?? "").trim() || "You",
        gender: myGender,
      },
    ];
  }, [household.data, me.data?.full_name, myGender]);

  const activeName =
    (activePerson && people.some((p) => p.name === activePerson) ? activePerson : null) ??
    people.find((p) => p.name === (me.data?.full_name ?? "").trim())?.name ??
    people[0]?.name ??
    "You";

  const activeRecord = people.find((p) => p.name === activeName) ?? people[0];

  // The wardrobes this family actually needs: a family of only men never sees womenswear.
  const familyWardrobes = new Set(
    people.map((p) => p.gender).filter((g): g is string => isWardrobe(g)),
  );
  const onlyWardrobe = familyWardrobes.size === 1 ? [...familyWardrobes][0] : null;
  const everyoneKnown = people.every((p) => isWardrobe(p.gender));
  // Switching only makes sense when we don't already know who this family is.
  const canSwitchWardrobe = !(everyoneKnown && onlyWardrobe);

  const wardrobe = canSwitchWardrobe
    ? (wardrobeOverride[activeName] ?? activeRecord?.gender ?? myGender)
    : (activeRecord?.gender ?? onlyWardrobe);

  const invitedIds = myEventIds.data;

  const selectable = (outfits.data ?? []).filter(
    (o) =>
      (!o.event_id || !ownOutfitIds.has(o.event_id)) &&
      // Looks for an event this family isn't invited to stay hidden.
      (!o.event_id || !invitedIds || invitedIds.has(o.event_id)) &&
      (!wardrobe || (o.gender ?? "women") === wardrobe),
  );

  const inEvent = selectable.filter((o) => activeEvent === "all" || o.event_id === activeEvent);
  const optionsOf = (pick: (o: Outfit) => string | null | undefined) =>
    [...new Set(inEvent.map((o) => pick(o)?.trim()).filter((v): v is string => Boolean(v)))].sort(
      (a, b) => a.localeCompare(b),
    );
  const colourOptions = optionsOf((o) => o.color_family);
  const designerOptions = optionsOf((o) => o.designer);
  const garmentOptions = optionsOf((o) => o.garment_type);
  const q = search.trim().toLowerCase();

  const filtered = inEvent
    .filter((o) => !favOnly || favourites.data?.has(o.id))
    .filter((o) => !picksOnly || o.is_pinned)
    .filter((o) => !colour || o.color_family?.trim() === colour)
    .filter((o) => !designer || o.designer?.trim() === designer)
    .filter((o) => !garment || o.garment_type?.trim() === garment)
    .filter((o) => !freeOnly || (o.is_available && !mineByOutfit.has(o.id)))
    .filter(
      (o) =>
        !q ||
        [o.title, o.designer, o.color_family, o.garment_type]
          .some((v) => v?.toLowerCase().includes(q)),
    )
    .sort((a, b) =>
      sortBy === "az"
        ? a.title.localeCompare(b.title)
        : sortBy === "newest"
          ? String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""))
          : Number(!!b.is_pinned) - Number(!!a.is_pinned),
    );
  const visible = filtered.slice(0, limit);
  const filtersOn = Boolean(q || colour || designer || garment || freeOnly || favOnly || picksOnly);
  const clearFilters = () => {
    setSearch(""); setColour(""); setDesigner(""); setGarment("");
    setFreeOnly(false); setFavOnly(false); setPicksOnly(false);
  };

  const reserve = async (outfit: Outfit) => {
    setBusyId(outfit.id);
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      setBusyId(null);
      return;
    }
    const { error } = await supabase.from("reservations").insert({
      outfit_id: outfit.id,
      guest_id: user.id,
      guest_name: activeName || me.data?.full_name || null,
    });
    if (error) {
      setBusyId(null);
      toast.error(
        error.code === "23505"
          ? "Another guest just claimed this look — please pick a different one."
          : error.message.includes("ONE_LOOK_PER_EVENT")
            ? `${activeName} already has a look for this event — release it first to choose another.`
            : error.message,
      );
      await queryClient.invalidateQueries({ queryKey: ["reservations"] });
      await queryClient.invalidateQueries({ queryKey: ["outfits"] });
      return;
    }

    let emailed = false;
    try {
      const result = await emailConfirmation({ data: { outfitId: outfit.id } });
      emailed = result.sent;
    } catch {
      emailed = false;
    }
    setBusyId(null);

    toast.success(
      emailed
        ? `${outfit.title} is yours — a confirmation with pickup details is on its way to your inbox.`
        : `${outfit.title} is yours. Pickup details are on the delivery page.`,
    );
    await queryClient.invalidateQueries({ queryKey: ["reservations"] });
    await queryClient.invalidateQueries({ queryKey: ["outfits"] });
    await queryClient.invalidateQueries({ queryKey: ["my-wardrobe"] });
  };

  const release = async (outfit: Outfit) => {
    setBusyId(outfit.id);
    const { error } = await supabase.from("reservations").delete().eq("outfit_id", outfit.id);
    setBusyId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Reservation released.");
    await queryClient.invalidateQueries({ queryKey: ["reservations"] });
    await queryClient.invalidateQueries({ queryKey: ["outfits"] });
    await queryClient.invalidateQueries({ queryKey: ["my-wardrobe"] });
  };

  if (!needsWardrobe) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="panel p-4 sm:p-6 text-center">
          <p className="text-eyebrow">Nothing to choose</p>
          <h1 className="mt-3 text-2xl">You'll wear your own outfit</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We're not dressing your family for this wedding, so there's no look to pick and no
            measurements to send. Just let us know you're coming.
          </p>
          <Button asChild className="mt-5">
            <Link to="/guest/schedule">Go to your RSVP</Link>
          </Button>
        </div>
      </main>
    );
  }

  if (me.isLoading) {
    return <p className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8 text-sm text-muted-foreground">Loading…</p>;
  }

  if (me.data && !me.data.invite_claimed) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="panel p-4 sm:p-6">
          <Lock className="size-5 text-primary" />
          <h1 className="mt-4 text-2xl">Enter your invitation code</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We sent a personal code with your invitation on WhatsApp or email.
          </p>
          <div className="mt-5 space-y-2">
            <Label htmlFor="claim-code">Invitation code</Label>
            <Input
              id="claim-code"
              value={code}
              maxLength={64}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. EMMA-2041"
            />
          </div>
          <Button
            className="mt-4 w-full"
            onClick={async () => {
              if (await claimInvite(code)) {
                await queryClient.invalidateQueries({ queryKey: ["me"] });
              }
            }}
          >
            Unlock the wardrobe
          </Button>
        </div>
      </main>
    );
  }

  // Everyone invited under this invitation code, by name — choose the person first.
  const namedPeople = (household.data ?? []).filter((p) => p.name && p.name !== "Guest");

  if (me.data && !wardrobe) {
    const chosen = activePerson
      ? namedPeople.find((p) => p.name === activePerson)
      : undefined;

    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="panel p-4 sm:p-6">
          <p className="text-eyebrow">Almost there</p>
          <h1 className="mt-3 text-2xl">Who are we dressing?</h1>
          {namedPeople.length > 0 && !chosen ? (
            <>
              <p className="mt-2 text-sm text-muted-foreground">
                Everyone invited{me.data.household ? ` under ${me.data.household}` : ""} — choose
                the person whose look you're picking now. You can come back and choose for the
                others afterwards.
              </p>
              <div className="mt-5 grid gap-3">
                {namedPeople.map((p) => (
                  <Button
                    key={p.name}
                    variant={p.gender ? "default" : "outline"}
                    onClick={() => setActivePerson(p.name)}
                  >
                    {p.name}
                  </Button>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-muted-foreground">
                Which rail should we open for {chosen ? chosen.name : "you"}?
              </p>
              <div className="mt-5 grid gap-3">
                {WARDROBES.map((w, i) => (
                  <Button
                    key={w.value}
                    variant={i === 0 ? "default" : "outline"}
                    onClick={() =>
                      chosen
                        ? setWardrobeOverride((prev) => ({ ...prev, [chosen.name]: w.value }))
                        : saveGender(w.value)
                    }
                  >
                    {chosen ? `${chosen.name} — ${w.label.toLowerCase()}` : w.label}
                  </Button>
                ))}
                {chosen ? (
                  <Button variant="ghost" onClick={() => setActivePerson(null)}>
                    Choose someone else
                  </Button>
                ) : null}
              </div>
            </>
          )}
        </div>
      </main>
    );
  }

  // Reservations are grouped by the person they were chosen for.
  const outfitsFor = (name: string) =>
    (outfits.data ?? []).filter(
      (o) => mineByOutfit.has(o.id) && (mineByOutfit.get(o.id) ?? activeName) === name,
    );
  const myOutfits = outfitsFor(activeName);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <p className="text-eyebrow">The lookbook</p>
      <h1 className="mt-3 text-3xl sm:text-4xl">Choose your looks</h1>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        Each outfit can be claimed by one guest only. Reserve one per event — the outfit and
        tailoring are our gift. Then send your{" "}
        <Link to="/guest/measurements" className="text-primary underline-offset-4 hover:underline">
          measurements
        </Link>
        .
      </p>

      <section className="panel mt-6 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="size-4 shrink-0 text-primary" />
            <span className="truncate">
              {scheduleHeadline(eventList)} — {scheduleSummary(eventList)}
            </span>
          </p>
          <Link
            to="/guest/schedule"
            className="text-xs text-primary underline-offset-4 hover:underline"
          >
            Dates, venues &amp; replies
          </Link>
        </div>

        <p className="text-eyebrow mt-4">{people.length > 1 ? "Choosing for" : "Your looks"}</p>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {(people.length ? people : [{ name: me.data?.full_name || "You" }]).map((person) => {
            const active = person.name === activeName;
            const picks = (reservations.data ?? [])
              .filter(
                (r) =>
                  (r.guest_name ?? me.data?.full_name ?? "") === person.name ||
                  (people.length <= 1 && !r.guest_name),
              )
              .map((r) => ({ r, o: (outfits.data ?? []).find((o) => o.id === r.outfit_id) }))
              .filter((x) => x.o);
            return (
              <li key={person.name}>
                <button
                  type="button"
                  onClick={() => setActivePerson(person.name)}
                  aria-pressed={active}
                  className={`w-full rounded-md border p-3 text-left transition-colors ${
                    active ? "border-primary bg-primary/5" : "border-border hover:border-primary"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{person.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {picks.length ? `${picks.length} chosen` : "None yet"}
                    </span>
                  </span>
                  {picks.map(({ r, o }) => (
                    <span key={r.id} className="mt-2 flex items-center gap-2 text-xs">
                      {o!.image_url ? (
                        <img src={sized(o!.image_url, 120)} alt="" loading="lazy" className="h-10 w-8 shrink-0 rounded object-cover" />
                      ) : null}
                      <span className="min-w-0">
                        <span className="block truncate">{o!.title}</span>
                        <span className="block text-muted-foreground">
                          {eventList.find((e) => e.id === o!.event_id)?.name ?? "Any event"} ·{" "}
                          {r.status === "confirmed" ? "Confirmed" : "Chosen"}
                        </span>
                      </span>
                    </span>
                  ))}
                </button>
              </li>
            );
          })}
        </ul>

        <p className="mt-3 text-xs text-muted-foreground">
          Showing {activeName}&rsquo;s {wardrobeLabel(wardrobe).toLowerCase()} looks
          {canSwitchWardrobe ? (
            <>
              {" — "}
              <button
                className="text-primary underline-offset-4 hover:underline"
                onClick={() => {
                  const idx = WARDROBE_VALUES.indexOf(wardrobe ?? "");
                  const next = WARDROBE_VALUES[(idx + 1) % WARDROBE_VALUES.length] ?? "men";
                  setWardrobeOverride((prev) => ({ ...prev, [activeName]: next }));
                  if (people.length <= 1) void saveGender(next);
                }}
              >
                switch
              </button>
            </>
          ) : null}
        </p>
      </section>



      {myOutfits.length > 0 ? (
        <section className="panel mt-6 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl">
              Reserved for {activeName} ({myOutfits.length})
            </h2>
            {deliveryPlan.data?.enabled !== false ? (
              <Button asChild size="sm" variant="outline">
                <Link to="/delivery">Pickup &amp; delivery plan</Link>
              </Button>
            ) : null}
          </div>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {myOutfits.map((o) => (
              <li key={o.id} className="flex items-center gap-4">
                {o.image_url ? (
                  <img
                    src={o.image_url}
                    referrerPolicy="no-referrer"
                    alt={o.title}
                    loading="lazy"
                    width={56}
                    height={75}
                    className="h-[75px] w-14 rounded-md object-cover"
                  />
                ) : null}
                <div className="min-w-0">
                  <p className="truncate text-sm">{o.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {eventList.find((e) => e.id === o.event_id)?.name ?? "Any event"} ·{" "}
                    {o.size_note ?? "Made to measure"}
                  </p>
                  <p className="mt-1 text-xs text-primary">Locked to you</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="-mx-4 mt-8 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        <FilterChip active={activeEvent === "all"} onClick={() => setActiveEvent("all")}>
          All days
        </FilterChip>
        {pickableEvents.map((ev) => {
          const chosen = myOutfits.some((o) => o.event_id === ev.id);
          return (
            <FilterChip
              key={ev.id}
              active={activeEvent === ev.id}
              onClick={() => setActiveEvent(ev.id)}
            >
              {chosen ? <Check className="mr-1 inline size-3.5 align-[-2px]" /> : null}
              {ev.name}
            </FilterChip>
          );
        })}
      </div>


      {ownOutfitEvents.length > 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          For {ownOutfitEvents.map((e) => e.name).join(", ")} please wear your own outfit — there's
          nothing to choose.
        </p>
      ) : null}

      {activeEvent !== "all"
        ? (() => {
            const ev = eventList.find((e) => e.id === activeEvent);
            if (!ev) return null;
            return (
              <div className="panel mt-6 flex items-start gap-3 p-4">
                <CalendarDays className="mt-0.5 size-4 shrink-0 text-primary" />
                <p className="text-sm text-muted-foreground">
                  <span className="text-foreground">{ev.name}</span>
                  {ev.event_date ? ` · ${ev.event_date}` : ""}
                  {ev.start_time ? ` · ${ev.start_time}` : ""}
                  {ev.venue ? ` · ${ev.venue}` : ""}
                  {ev.dress_code ? ` — ${ev.dress_code}` : ""}
                  {ev.outfit_choose_by ? (
                    <span className="mt-1 block text-foreground">
                      {new Date().toISOString().slice(0, 10) > ev.outfit_choose_by
                        ? `Choices closed on ${new Date(`${ev.outfit_choose_by}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long" })} — contact your hosts to change a look.`
                        : `Choose your looks by ${new Date(`${ev.outfit_choose_by}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}.`}
                    </span>
                  ) : null}
                </p>
              </div>
            );
          })()
        : null}

      {outfits.isLoading ? (
        <p className="mt-10 text-sm text-muted-foreground">Loading the wardrobe…</p>
      ) : inEvent.length === 0 ? (
        <div className="panel mt-8 p-8 text-center">
          <h2 className="text-xl">Nothing here yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Outfits are still being curated for this event. Check back shortly.
          </p>
        </div>
      ) : (
        <>
        <div className="panel mt-6 space-y-3 p-3 sm:p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setLimit(pageSize); }}
              placeholder="Search looks, designers, colours…"
              className="pl-9"
              maxLength={80}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "Any colour", value: colour, set: setColour, opts: colourOptions },
              { label: "Any designer", value: designer, set: setDesigner, opts: designerOptions },
              { label: "Any type", value: garment, set: setGarment, opts: garmentOptions },
            ].map((f) => (
              <select
                key={f.label}
                aria-label={f.label}
                className="field-select h-9 w-full text-sm"
                value={f.value}
                disabled={f.opts.length === 0}
                onChange={(e) => { f.set(e.target.value); setLimit(pageSize); }}
              >
                <option value="">{f.label}</option>
                {f.opts.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            ))}
            <select
              aria-label="Sort"
              className="field-select h-9 w-full text-sm"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            >
              <option value="recommended">Recommended first</option>
              <option value="newest">Newest first</option>
              <option value="az">A to Z</option>
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={freeOnly ? "default" : "outline"}
              onClick={() => setFreeOnly((v) => !v)}
            >
              Still available
            </Button>
          {selectable.some((o) => o.is_pinned) ? (
            <Button
              size="sm"
              variant={picksOnly ? "default" : "outline"}
              onClick={() => setPicksOnly((v) => !v)}
            >
              <Pin className="mr-1 size-4" />
              Recommended by your hosts ({selectable.filter((o) => o.is_pinned).length})
            </Button>
          ) : null}
          <Button
            size="sm"
            variant={favOnly ? "default" : "outline"}
            onClick={() => setFavOnly((v) => !v)}
          >
            <Heart className={`mr-1 size-4 ${favOnly ? "fill-current" : ""}`} />
            Favourites{favourites.data?.size ? ` (${favourites.data.size})` : ""}
          </Button>
            <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              Per page
              <select
                aria-label="Looks per page"
                className="field-select h-8 w-auto text-xs"
                value={pageSize}
                onChange={(e) => { const n = Number(e.target.value); setPageSize(n); setLimit(n); }}
              >
                {[24, 48, 96].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            Showing {Math.min(limit, filtered.length)} of {filtered.length} look
            {filtered.length === 1 ? "" : "s"}
            {filtersOn ? (
              <>
                {" · "}
                <button type="button" onClick={clearFilters} className="text-primary underline-offset-4 hover:underline">
                  Clear filters
                </button>
              </>
            ) : null}
          </p>
        </div>
        {filtered.length === 0 && !favOnly ? (
          <p className="mt-4 text-sm text-muted-foreground">No looks match these filters.</p>
        ) : null}
        {favOnly && visible.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Tap the heart on any look to save it here.
          </p>
        ) : null}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {visible.map((outfit, idx) => {
            const heldBy = mineByOutfit.has(outfit.id)
              ? (mineByOutfit.get(outfit.id) ?? activeName)
              : null;
            const mine = heldBy === activeName;
            const taken = heldBy !== null || !outfit.is_available;
            const confirmed = mine && (reservations.data ?? []).some((r) => r.outfit_id === outfit.id && r.status === "confirmed");
            const details = [outfit.color_family, outfit.garment_type, outfit.size_note].filter(Boolean).join(" · ");
            return (
              <article key={outfit.id} className="panel group flex flex-col overflow-hidden">
                <div className="relative bg-secondary">
                  <LookGallery outfit={outfit} dimmed={taken && !mine} eager={idx < 8} />
                  {taken ? (
                    <Badge variant={mine ? "default" : "secondary"} className="absolute top-2 left-2 max-w-[70%] truncate">
                      {mine ? `For ${activeName}` : heldBy ? `For ${heldBy}` : "Reserved"}
                      {/* heldBy is only ever a member of your own family */}
                    </Badge>
                  ) : outfit.is_pinned ? (
                    <Badge className="absolute top-2 left-2 gap-1"><Pin className="size-3" /> Recommended</Badge>
                  ) : null}
                  <button
                    type="button"
                    aria-label={favourites.data?.has(outfit.id) ? "Remove from favourites" : "Add to favourites"}
                    onClick={() => toggleFavourite(outfit.id)}
                    className="absolute top-2 right-2 z-10 grid size-8 place-items-center rounded-full bg-background/85 text-primary shadow"
                  >
                    <Heart className={`size-4 ${favourites.data?.has(outfit.id) ? "fill-current" : ""}`} />
                  </button>
                  {details || outfit.notes ? (
                    <div className="pointer-events-none absolute inset-x-0 bottom-14 hidden bg-background/90 p-3 text-xs leading-relaxed text-foreground opacity-0 transition-opacity group-hover:opacity-100 md:block">
                      {details ? <p className="font-medium">{details}</p> : null}
                      {outfit.notes ? <p className="mt-1 line-clamp-4 text-muted-foreground">{outfit.notes}</p> : null}
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-1 flex-col p-3">
                  <h2 className="line-clamp-2 min-h-[2.5rem] text-sm leading-snug" title={outfit.title}>{outfit.title}</h2>
                  <p className="mt-0.5 h-4 truncate text-xs text-muted-foreground">{outfit.designer ?? ""}</p>
                  <div className="mt-auto pt-3">
                    {confirmed ? (
                      <Button variant="secondary" size="sm" className="w-full" disabled>
                        <Check className="size-4" /> Confirmed
                      </Button>
                    ) : mine ? (
                      <Button variant="outline" size="sm" className="w-full" disabled={busyId === outfit.id} onClick={() => release(outfit)}>
                        <Check className="size-4" /> Release
                      </Button>
                    ) : taken ? (
                      <Button variant="secondary" size="sm" className="w-full" disabled>Already claimed</Button>
                    ) : (
                      <Button size="sm" className="w-full" disabled={busyId === outfit.id} onClick={() => reserve(outfit)}>
                        {busyId === outfit.id ? "Reserving…" : "Reserve"}
                      </Button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        {filtered.length > limit ? (
          <div className="mt-6 flex justify-center">
            <Button variant="outline" onClick={() => setLimit((n) => n + pageSize)}>
              Show {Math.min(pageSize, filtered.length - limit)} more ({filtered.length - limit} left)
            </Button>
          </div>
        ) : null}
        </>
      )}

      {activeEvent !== "all" && pickableEvents.some((e) => e.id === activeEvent) ? (
        <LiveFeed
          eventId={activeEvent}
          defaultAudience={wardrobe ?? null}
          guestName={activeName || me.data?.full_name || null}
        />
      ) : activeEvent === "all" && pickableEvents.length > 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          Pick a day above to see more looks for it.
        </p>
      ) : null}
    </main>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-1.5 text-sm transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:border-primary hover:text-primary"
      }`}
    >
      {children}
    </button>
  );
}

/** Smaller copy for our own stored photos; shop photos are copied in on first view. */
function sized(src: string, w: number) {
  if (src.startsWith("/api/public/outfit-image/")) return `${src.split("?")[0]}?w=${w}`;
  const size = [120, 240, 400, 600, 800].includes(w) ? w : 400;
  if (/^https:\/\/[^/]*pernia/i.test(src)) return `/api/public/shop-image?w=${size}&u=${encodeURIComponent(src)}`;
  return src;
}

/** Main photo with a swipeable strip of the other angles underneath. */
function LookGallery({ outfit, dimmed, eager }: { outfit: Outfit; dimmed: boolean; eager?: boolean }) {
  const photos = (
    Array.isArray(outfit.images) && outfit.images.length
      ? outfit.images
      : outfit.image_url
        ? [outfit.image_url]
        : []
  ).filter((s): s is string => typeof s === "string");
  const [active, setActive] = useState(0);

  if (photos.length === 0) {
    return (
      <div className="flex aspect-[3/4] items-center justify-center px-4 text-center font-display text-sm text-muted-foreground">
        {outfit.title}
      </div>
    );
  }
  const main = photos[Math.min(active, photos.length - 1)]!;

  return (
    <div>
      <img
        src={sized(main, 400)}
        srcSet={`${sized(main, 400)} 400w, ${sized(main, 600)} 600w`}
        sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
        alt={outfit.title}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={eager ? "high" : "low"}
        width={400}
        height={533}
        className={`aspect-[3/4] w-full object-cover ${dimmed ? "opacity-35 grayscale" : ""}`}
      />
      <div className="flex h-14 snap-x gap-1 overflow-x-auto bg-background p-1.5 [scrollbar-width:none]">
        {photos.length > 1
          ? photos.slice(0, 6).map((src, i) => (
              <button
                key={src}
                type="button"
                aria-label={`Photo ${i + 1} of ${outfit.title}`}
                onClick={() => setActive(i)}
                onMouseEnter={() => setActive(i)}
                className={`shrink-0 snap-start overflow-hidden rounded border ${i === active ? "border-primary" : "border-transparent opacity-70"}`}
              >
                <img src={sized(src, 120)} alt="" loading="lazy" decoding="async" width={33} height={44} className="h-11 w-[33px] object-cover" />
              </button>
            ))
          : null}
      </div>
    </div>
  );
}
