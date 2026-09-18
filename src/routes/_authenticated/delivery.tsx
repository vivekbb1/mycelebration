import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BedDouble, Ruler, MapPin, MessageCircle, Mail, CalendarClock } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { parseTimeline, type TimelineStep } from "@/lib/logistics";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/delivery")({
  head: () => ({
    meta: [
      { title: "Your Outfit Delivery Plan — The Wedding Wardrobe" },
      {
        name: "description",
        content:
          "Your reserved looks, their sizes, when they are tailored and how they reach your hotel room on arrival.",
      },
      { property: "og:title", content: "Your Outfit Delivery Plan — The Wedding Wardrobe" },
      {
        property: "og:description",
        content:
          "Tailoring timeline, room delivery at check-in, and how your measurements reach the tailor.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DeliveryPage,
});

function DeliveryPage() {
  const logistics = useQuery({
    queryKey: ["logistics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("logistics")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const mine = useQuery({
    queryKey: ["my-wardrobe"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return { outfits: [], measured: false };

      const { data: reservations } = await supabase
        .from("reservations")
        .select("id, outfit_id")
        .eq("guest_id", user.id);

      const ids = (reservations ?? []).map((r) => r.outfit_id);
      const { data: outfits } = ids.length
        ? await supabase
            .from("outfits")
            .select("id, title, designer, image_url, size_note, garment_type, event_id")
            .in("id", ids)
        : { data: [] };

      const { data: events } = await supabase.from("events").select("id, name").order("sort_order");
      const { data: measurement } = await supabase
        .from("measurements")
        .select("id")
        .eq("guest_id", user.id)
        .limit(1);

      return {
        outfits: (outfits ?? []).map((o) => ({
          ...o,
          eventName: (events ?? []).find((e) => e.id === o.event_id)?.name ?? null,
        })),
        measured: (measurement ?? []).length > 0,
      };
    },
  });

  const outfits = mine.data?.outfits ?? [];
  const plan = logistics.data;
  const timeline: TimelineStep[] = parseTimeline(plan?.timeline);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-eyebrow">Logistics</p>
      <h1 className="mt-3 text-4xl">Your delivery plan</h1>
      {plan?.intro ? (
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{plan.intro}</p>
      ) : null}

      <section className="panel mt-8 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl">Your outfits &amp; sizes</h2>
          <Badge variant={mine.data?.measured ? "default" : "secondary"}>
            {mine.data?.measured ? "Measurements received" : "Measurements still needed"}
          </Badge>
        </div>

        {mine.isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
        ) : outfits.length === 0 ? (
          <div className="mt-4">
            <p className="text-sm text-muted-foreground">
              You haven't reserved a look yet, so there's nothing to tailor.
            </p>
            <Button asChild size="sm" className="mt-4">
              <Link to="/lookbook">Browse the lookbook</Link>
            </Button>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {outfits.map((o) => (
              <li key={o.id} className="flex items-center gap-4 py-4">
                {o.image_url ? (
                  <img
                    src={o.image_url}
                    alt={o.title}
                    loading="lazy"
                    width={72}
                    height={96}
                    className="h-24 w-18 rounded-md object-cover"
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  {o.eventName ? <p className="text-eyebrow">{o.eventName}</p> : null}
                  <p className="mt-1 truncate">{o.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[o.designer, o.garment_type].filter(Boolean).join(" · ")}
                  </p>
                  <p className="mt-1 text-xs text-primary">
                    Size: {o.size_note ?? "Made to your measurements"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {!mine.data?.measured && outfits.length > 0 ? (
          <Button asChild size="sm" className="mt-4">
            <Link to="/measurements">Send your measurements</Link>
          </Button>
        ) : null}
      </section>

      <section className="panel mt-6 p-4 sm:p-6">
        <BedDouble className="size-4 text-primary" />
        <h2 className="mt-3 text-xl">Delivered to your room</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {plan?.checkin_note ??
            "Your outfits are placed in your hotel room before you check in — the events team manages all logistics."}
        </p>
        {plan?.hotel_name || plan?.hotel_address ? (
          <p className="mt-4 flex items-start gap-2 text-sm">
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              {plan?.hotel_name}
              {plan?.hotel_address ? (
                <span className="block text-xs text-muted-foreground">{plan.hotel_address}</span>
              ) : null}
            </span>
          </p>
        ) : null}
      </section>

      {timeline.length ? (
        <section className="mt-10">
          <h2 className="text-2xl">The timeline</h2>
          <ol className="mt-5 space-y-4">
            {timeline.map((m, i) => (
              <li key={`${m.title}-${i}`} className="panel flex gap-4 p-5">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-primary/60 text-xs text-primary">
                  {i + 1}
                </span>
                <div>
                  {m.date ? <p className="text-sm text-primary">{m.date}</p> : null}
                  <h3 className="mt-1 text-lg">{m.title}</h3>
                  {m.body ? (
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{m.body}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section className="mt-10 grid gap-5 sm:grid-cols-2">
        <div className="panel p-4 sm:p-6">
          <Ruler className="size-4 text-primary" />
          <h2 className="mt-3 text-xl">How your measurements reach the tailor</h2>
          <ol className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
            <li>1. Fill the guided form in the portal — cm or inches, whichever you prefer.</li>
            <li>2. The hosts check it against the look you reserved and flag anything unusual.</li>
            <li>
              3. One tailoring sheet per guest goes to the tailor. You never contact the tailor
              yourself, and your measurements stay private to you and the hosts.
            </li>
            <li>4. Changed your mind about a fit? Update the form — the latest version is used.</li>
          </ol>
          {plan?.measurements_deadline ? (
            <p className="mt-4 flex items-start gap-2 text-sm text-primary">
              <CalendarClock className="mt-0.5 size-4 shrink-0" />
              {plan.measurements_deadline}
            </p>
          ) : null}
          <Button asChild size="sm" variant="outline" className="mt-4">
            <Link to="/measurements">Open the measurement form</Link>
          </Button>
        </div>

        <div className="panel p-4 sm:p-6">
          <MessageCircle className="size-4 text-primary" />
          <h2 className="mt-3 text-xl">Who to ask</h2>
          <p className="mt-3 text-sm">{plan?.team_name ?? "The events team"}</p>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            {plan?.team_whatsapp ? (
              <li className="flex items-center gap-2">
                <MessageCircle className="size-4 shrink-0 text-primary" /> {plan.team_whatsapp}
              </li>
            ) : null}
            {plan?.team_email ? (
              <li className="flex items-center gap-2">
                <Mail className="size-4 shrink-0 text-primary" /> {plan.team_email}
              </li>
            ) : null}
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Anything about fittings, sizes or arrival times — ask the events team rather than the
            tailor. They coordinate every outfit.
          </p>
        </div>
      </section>
    </main>
  );
}
