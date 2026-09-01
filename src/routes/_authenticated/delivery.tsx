import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PackageCheck, Ruler, Scissors, MapPin, MessageCircle, Mail } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { MILESTONES, PICKUP_WINDOWS, TAILOR } from "@/lib/delivery-plan";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/delivery")({
  head: () => ({
    meta: [
      { title: "Delivery & Pickup Plan — The Wedding Wardrobe" },
      {
        name: "description",
        content:
          "When your outfit is tailored, where to collect it in Jaipur, and how your measurements reach the tailor.",
      },
      { property: "og:title", content: "Delivery & Pickup Plan — The Wedding Wardrobe" },
      {
        property: "og:description",
        content: "Tailoring timeline, pickup windows in Jaipur and how measurements reach the atelier.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DeliveryPage,
});

function DeliveryPage() {
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
        .select("id, unit, height, bust, waist, hip")
        .eq("guest_id", user.id)
        .maybeSingle();

      return {
        outfits: (outfits ?? []).map((o) => ({
          ...o,
          eventName: (events ?? []).find((e) => e.id === o.event_id)?.name ?? null,
        })),
        measured: Boolean(measurement),
      };
    },
  });

  const outfits = mine.data?.outfits ?? [];

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-eyebrow">Logistics</p>
      <h1 className="mt-3 text-4xl">Your delivery plan</h1>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        You never have to speak to a tailor or pay for anything. Reserve a look, send your
        measurements once, and collect the finished outfit in Jaipur.
      </p>

      <section className="panel mt-8 p-6">
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

      <section className="mt-10">
        <h2 className="text-2xl">The timeline</h2>
        <ol className="mt-5 space-y-4">
          {MILESTONES.map((m, i) => (
            <li key={m.title} className="panel flex gap-4 p-5">
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-primary/60 text-xs text-primary">
                {i + 1}
              </span>
              <div>
                <p className="text-sm text-primary">{m.date}</p>
                <h3 className="mt-1 text-lg">{m.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{m.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl">Pickup windows</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {PICKUP_WINDOWS.map((p) => (
            <div key={p.label} className="panel p-5">
              <PackageCheck className="size-4 text-primary" />
              <p className="mt-3 text-eyebrow">{p.label}</p>
              <p className="mt-2 text-sm">{p.when}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{p.where}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10 grid gap-5 sm:grid-cols-2">
        <div className="panel p-6">
          <Ruler className="size-4 text-primary" />
          <h2 className="mt-3 text-xl">How your measurements reach the tailor</h2>
          <ol className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
            <li>1. Fill the guided form in the portal — cm or inches, whichever you prefer.</li>
            <li>2. We review it against the outfit you reserved and flag anything unusual.</li>
            <li>
              3. The hosts send a single tailoring sheet per guest to the atelier. You never email
              the tailor yourself, and your measurements stay private to you and the hosts.
            </li>
            <li>4. Changed your mind about a fit? Update the form — we use the latest version.</li>
          </ol>
          <Button asChild size="sm" variant="outline" className="mt-4">
            <Link to="/measurements">Open the measurement form</Link>
          </Button>
        </div>

        <div className="panel p-6">
          <Scissors className="size-4 text-primary" />
          <h2 className="mt-3 text-xl">The atelier</h2>
          <p className="mt-3 text-sm">{TAILOR.name}</p>
          <p className="text-xs text-muted-foreground">Master tailor: {TAILOR.contact}</p>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" /> {TAILOR.address}
            </li>
            <li className="flex items-center gap-2">
              <MessageCircle className="size-4 shrink-0 text-primary" /> {TAILOR.whatsapp}
            </li>
            <li className="flex items-center gap-2">
              <Mail className="size-4 shrink-0 text-primary" /> {TAILOR.email}
            </li>
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            For anything urgent, message the family group rather than the atelier — we coordinate
            all fittings.
          </p>
        </div>
      </section>
    </main>
  );
}
