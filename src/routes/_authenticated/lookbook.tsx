import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, Lock, Check, MapPin } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { scheduleHeadline, scheduleSummary } from "@/lib/schedule";
import { sendReservationEmail } from "@/lib/reservation-email.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { claimInvite } from "@/routes/auth";

export const Route = createFileRoute("/_authenticated/lookbook")({
  head: () => ({
    meta: [
      { title: "The Lookbook — Reserve Your Wedding Outfit" },
      {
        name: "description",
        content:
          "Browse curated lehengas, sarees, sherwanis and gowns for each wedding function. One guest per look, tailoring included.",
      },
      { property: "og:title", content: "The Lookbook — Reserve Your Wedding Outfit" },
      {
        property: "og:description",
        content: "Curated designer outfits per function. Claim a look and it's locked to you alone.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Lookbook,
});

type Outfit = {
  id: string;
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
};

function Lookbook() {
  const queryClient = useQueryClient();
  const emailConfirmation = useServerFn(sendReservationEmail);
  const [activeEvent, setActiveEvent] = useState<string>("all");
  const [code, setCode] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [activePerson, setActivePerson] = useState<string | null>(null);
  const [wardrobeOverride, setWardrobeOverride] = useState<Record<string, string>>({});

  const me = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, invite_claimed, gender, household")
        .eq("id", user.id)
        .maybeSingle();
      return (
        data ?? {
          id: user.id,
          full_name: "",
          invite_claimed: false,
          gender: null as string | null,
          household: null as string | null,
        }
      );
    },
  });

  const events = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select(
          "id, name, event_date, start_time, venue, dress_code, sort_order, outfit_selection",
        )
        .order("sort_order");
      if (error) throw error;
      return data;
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
        .select("id, outfit_id, guest_id, guest_name");
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
    for (const r of reservations.data ?? []) map.set(r.outfit_id, r.guest_name ?? null);
    return map;
  }, [reservations.data]);

  // Functions where the hosts dress the guests, and the ones where guests wear their own.
  const pickableEvents = (events.data ?? []).filter((e) => e.outfit_selection !== false);
  const ownOutfitEvents = (events.data ?? []).filter((e) => e.outfit_selection === false);
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
  const wardrobe = wardrobeOverride[activeName] ?? activeRecord?.gender ?? myGender;

  const selectable = (outfits.data ?? []).filter(
    (o) =>
      (!o.event_id || !ownOutfitIds.has(o.event_id)) &&
      (!wardrobe || (o.gender ?? "women") === wardrobe),
  );

  const visible = selectable.filter(
    (o) => activeEvent === "all" || o.event_id === activeEvent,
  );

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
      guest_name: me.data?.full_name || null,
    });
    if (error) {
      setBusyId(null);
      toast.error(
        error.code === "23505"
          ? "Another guest just claimed this look — please pick a different one."
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

  if (me.isLoading) {
    return <p className="mx-auto max-w-6xl px-4 py-16 text-sm text-muted-foreground">Loading…</p>;
  }

  if (me.data && !me.data.invite_claimed) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <div className="panel p-6">
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

  if (me.data && !myGender) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <div className="panel p-6">
          <p className="text-eyebrow">Almost there</p>
          <h1 className="mt-3 text-2xl">Who are we dressing?</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tell us which wardrobe to show you{me.data.household ? ` for the ${me.data.household}` : ""}.
            Every person invited has their own link, so a husband and wife each choose their own
            looks and send their own measurements.
          </p>
          <div className="mt-5 grid gap-3">
            <Button onClick={() => saveGender("women")}>Womenswear</Button>
            <Button variant="outline" onClick={() => saveGender("men")}>
              Menswear
            </Button>
          </div>
        </div>
      </main>
    );
  }

  const myOutfits = (outfits.data ?? []).filter((o) => mineByOutfit.has(o.id));

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-eyebrow">The lookbook</p>
      <h1 className="mt-3 text-4xl">Choose your looks</h1>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        Each outfit can be claimed by one guest only. Reserve one per function — the outfit and
        tailoring are our gift. Then send your{" "}
        <Link to="/measurements" className="text-primary underline-offset-4 hover:underline">
          measurements
        </Link>
        .
      </p>

      <div className="panel mt-6 flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="size-4 text-primary" />
          {scheduleHeadline(events.data ?? [])} — {scheduleSummary(events.data ?? [])}
        </p>
        <div className="flex items-center gap-3">
          <button
            className="text-xs text-primary underline-offset-4 hover:underline"
            onClick={() => saveGender(myGender === "men" ? "women" : "men")}
          >
            Showing {myGender === "men" ? "menswear" : "womenswear"} — switch
          </button>
          <Button asChild size="sm" variant="outline">
            <Link to="/event">Dates, venues &amp; RSVP</Link>
          </Button>
        </div>
      </div>

      {myOutfits.length > 0 ? (
        <section className="panel mt-6 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl">
              Your reserved look{myOutfits.length > 1 ? "s" : ""} ({myOutfits.length})
            </h2>
            <Button asChild size="sm" variant="outline">
              <Link to="/delivery">Pickup &amp; delivery plan</Link>
            </Button>
          </div>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {myOutfits.map((o) => (
              <li key={o.id} className="flex items-center gap-4">
                {o.image_url ? (
                  <img
                    src={o.image_url}
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
                    {(events.data ?? []).find((e) => e.id === o.event_id)?.name ?? "Any function"} ·{" "}
                    {o.size_note ?? "Made to measure"}
                  </p>
                  <p className="mt-1 text-xs text-primary">Locked to you</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-2">
        <FilterChip active={activeEvent === "all"} onClick={() => setActiveEvent("all")}>
          All functions
        </FilterChip>
        {pickableEvents.map((ev) => (
          <FilterChip
            key={ev.id}
            active={activeEvent === ev.id}
            onClick={() => setActiveEvent(ev.id)}
          >
            {ev.name}
          </FilterChip>
        ))}
      </div>

      {pickableEvents.length > 0 ? (
        <div className="panel mt-4 p-4">
          <p className="text-eyebrow">Your picks</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {pickableEvents.map((ev) => {
              const chosen = myOutfits.some((o) => o.event_id === ev.id);
              return (
                <li
                  key={ev.id}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    chosen ? "border-primary text-primary" : "border-border text-muted-foreground"
                  }`}
                >
                  {ev.name} — {chosen ? "chosen" : "not chosen yet"}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {ownOutfitEvents.length > 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          For {ownOutfitEvents.map((e) => e.name).join(", ")} please wear your own outfit — there's
          nothing to choose.
        </p>
      ) : null}

      {activeEvent !== "all"
        ? (() => {
            const ev = (events.data ?? []).find((e) => e.id === activeEvent);
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
                </p>
              </div>
            );
          })()
        : null}

      {outfits.isLoading ? (
        <p className="mt-10 text-sm text-muted-foreground">Loading the wardrobe…</p>
      ) : visible.length === 0 ? (
        <div className="panel mt-8 p-8 text-center">
          <h2 className="text-xl">Nothing here yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Outfits are still being curated for this function. Check back shortly.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((outfit) => {
            const mine = mineByOutfit.has(outfit.id);
            const taken = mine || !outfit.is_available;
            const eventName = (events.data ?? []).find((e) => e.id === outfit.event_id)?.name;
            return (
              <article key={outfit.id} className="panel flex flex-col overflow-hidden">
                <div className="relative bg-secondary">
                  <LookGallery outfit={outfit} dimmed={taken && !mine} />
                  {taken ? (
                    <Badge
                      variant={mine ? "default" : "secondary"}
                      className="absolute top-3 left-3"
                    >
                      {mine ? "Yours" : "Reserved"}
                    </Badge>
                  ) : null}
                </div>

                <div className="flex flex-1 flex-col p-5">
                  {eventName ? <p className="text-eyebrow">{eventName}</p> : null}
                  <h2 className="mt-2 text-xl leading-snug">{outfit.title}</h2>
                  {outfit.designer ? (
                    <p className="mt-1 text-sm text-muted-foreground">{outfit.designer}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {outfit.color_family ? (
                      <span className="rounded-full border border-border px-2 py-0.5">
                        {outfit.color_family}
                      </span>
                    ) : null}
                    {outfit.garment_type ? (
                      <span className="rounded-full border border-border px-2 py-0.5">
                        {outfit.garment_type}
                      </span>
                    ) : null}
                    {outfit.size_note ? (
                      <span className="rounded-full border border-border px-2 py-0.5">
                        {outfit.size_note}
                      </span>
                    ) : null}
                  </div>
                  {outfit.notes ? (
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      {outfit.notes}
                    </p>
                  ) : null}

                  <div className="mt-5 flex flex-wrap items-center gap-2 pt-1">
                    {mine ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyId === outfit.id}
                        onClick={() => release(outfit)}
                      >
                        <Check className="size-4" /> Release
                      </Button>
                    ) : taken ? (
                      <Button variant="secondary" size="sm" disabled>
                        Already claimed
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        disabled={busyId === outfit.id}
                        onClick={() => reserve(outfit)}
                      >
                        {busyId === outfit.id ? "Reserving…" : "Reserve this look"}
                      </Button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
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
      className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:border-primary hover:text-primary"
      }`}
    >
      {children}
    </button>
  );
}

/** Main photo plus the other angles of the same look, when the boutique has them. */
function LookGallery({ outfit, dimmed }: { outfit: Outfit; dimmed: boolean }) {
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

  return (
    <>
      <img
        src={photos[Math.min(active, photos.length - 1)]}
        alt={outfit.title}
        loading="lazy"
        className={`aspect-[3/4] w-full object-cover ${dimmed ? "opacity-35 grayscale" : ""}`}
      />
      {photos.length > 1 ? (
        <div className="absolute bottom-2 left-2 flex gap-1.5">
          {photos.slice(0, 5).map((src, i) => (
            <button
              key={src}
              type="button"
              aria-label={`Photo ${i + 1} of ${outfit.title}`}
              onClick={() => setActive(i)}
              className={`overflow-hidden rounded border ${i === active ? "border-primary" : "border-transparent opacity-70"}`}
            >
              <img src={src} alt="" loading="lazy" className="h-11 w-8 object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}
