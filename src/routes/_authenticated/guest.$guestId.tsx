import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Eye, ShieldCheck } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useIsAnyHost } from "@/lib/host-role";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/guest/$guestId")({
  head: () => ({
    meta: [
      { title: "Guest view — My Celebration" },
      {
        name: "description",
        content:
          "See a guest's portal exactly as they see it: their reserved looks, measurements and RSVP.",
      },
      { property: "og:title", content: "Guest view — My Celebration" },
      {
        property: "og:description",
        content: "Host view of one guest's reserved looks, measurements and RSVP.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GuestViewPage,
});

const MEASURE_FIELDS: Array<{ key: string; label: string }> = [
  { key: "height", label: "Height" },
  { key: "bust", label: "Bust / chest" },
  { key: "waist", label: "Waist" },
  { key: "hip", label: "Hip" },
  { key: "shoulder", label: "Shoulder" },
  { key: "sleeve_length", label: "Sleeve length" },
  { key: "top_length", label: "Blouse / kurta length" },
  { key: "bottom_length", label: "Skirt / trouser length" },
  { key: "inseam", label: "Inseam" },
];

const RSVP_LABEL: Record<string, string> = {
  yes: "Attending",
  no: "Can't make it",
  pending: "No answer yet",
};

function GuestViewPage() {
  const { guestId } = Route.useParams();

  const role = useIsAnyHost();

  const isHost = role.data === true;

  const profile = useQuery({
    queryKey: ["guest-profile", guestId],
    enabled: isHost,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, city, country, whatsapp, rsvp_status, rsvp_note, rsvp_updated_at")
        .eq("id", guestId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const reservations = useQuery({
    queryKey: ["guest-reservations", guestId],
    enabled: isHost,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select("id, created_at, outfit_id")
        .eq("guest_id", guestId);
      if (error) throw error;
      return data;
    },
  });

  const outfits = useQuery({
    queryKey: ["outfits"],
    enabled: isHost,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("outfits")
        .select("id, title, designer, image_url, size_note, price_note, garment_type, event_id");
      if (error) throw error;
      return data;
    },
  });

  const events = useQuery({
    queryKey: ["events"],
    enabled: isHost,
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("id, name").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const measurements = useQuery({
    queryKey: ["guest-measurements", guestId],
    enabled: isHost,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("measurements")
        .select("*")
        .eq("guest_id", guestId)
        .order("guest_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  if (role.isLoading) {
    return <p className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16 text-sm text-muted-foreground">Loading…</p>;
  }

  if (!isHost) {
    return (
      <main className="mx-auto max-w-md px-4 py-12 sm:px-6 sm:py-16">
        <div className="panel p-4 sm:p-6">
          <ShieldCheck className="size-5 text-primary" />
          <h1 className="mt-4 text-2xl">Hosts only</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This page is part of the host area.
          </p>
          <Button asChild className="mt-5 w-full">
            <Link to="/guest/outfits">Back to the lookbook</Link>
          </Button>
        </div>
      </main>
    );
  }

  const guestName = profile.data?.full_name || "This guest";
  const rsvp = profile.data?.rsvp_status ?? "pending";
  const measureSets = measurements.data ?? [];
  const outfitOf = (id: string) => outfits.data?.find((o) => o.id === id);
  const eventName = (id: string | null) =>
    id ? (events.data?.find((e) => e.id === id)?.name ?? null) : null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/host">
          <ArrowLeft className="size-4" /> Back to the guest list
        </Link>
      </Button>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Badge variant="secondary" className="gap-1">
          <Eye className="size-3" /> Viewing as {guestName}
        </Badge>
        <p className="text-xs text-muted-foreground">
          Read-only — nothing you do here changes their choices.
        </p>
      </div>

      <h1 className="mt-4 text-3xl">{guestName}'s portal</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {[profile.data?.email, profile.data?.whatsapp, [profile.data?.city, profile.data?.country]
          .filter(Boolean)
          .join(", ")]
          .filter(Boolean)
          .join(" · ") || "No contact details yet."}
      </p>

      <div className="gold-rule my-8" />

      <section className="panel p-4 sm:p-6">
        <h2 className="text-xl">RSVP</h2>
        <p className="mt-2 text-sm">
          <Badge variant={rsvp === "yes" ? "default" : rsvp === "no" ? "destructive" : "secondary"}>
            {RSVP_LABEL[rsvp] ?? rsvp}
          </Badge>
        </p>
        {profile.data?.rsvp_note ? (
          <p className="mt-3 text-sm text-muted-foreground">“{profile.data.rsvp_note}”</p>
        ) : null}
      </section>

      <section className="mt-6">
        <h2 className="text-xl">Reserved looks</h2>
        {reservations.isLoading ? (
          <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
        ) : (reservations.data ?? []).length === 0 ? (
          <p className="panel mt-3 p-4 sm:p-6 text-sm text-muted-foreground">
            {guestName} hasn't picked a look yet.
          </p>
        ) : (
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {(reservations.data ?? []).map((r) => {
              const outfit = outfitOf(r.outfit_id);
              const fn = eventName(outfit?.event_id ?? null);
              return (
                <article key={r.id} className="panel overflow-hidden">
                  {outfit?.image_url ? (
                    <img
                      src={outfit.image_url}
                      referrerPolicy="no-referrer"
                      alt={outfit.title}
                      loading="lazy"
                      className="aspect-[3/4] w-full object-cover"
                    />
                  ) : null}
                  <div className="p-4">
                    {fn ? (
                      <p className="text-xs uppercase tracking-[0.18em] text-primary">{fn}</p>
                    ) : null}
                    <h3 className="mt-1 text-lg">{outfit?.title ?? "Outfit"}</h3>
                    {outfit?.designer ? (
                      <p className="text-sm text-muted-foreground">{outfit.designer}</p>
                    ) : null}
                    <p className="mt-2 text-xs text-muted-foreground">
                      {outfit?.size_note ? `Size: ${outfit.size_note}` : "Made to measure"}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel mt-6 p-4 sm:p-6">
        <h2 className="text-xl">Measurements</h2>
        {measurements.isLoading ? (
          <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
        ) : measureSets.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {guestName} hasn't sent measurements yet — a nudge on WhatsApp usually does it.
          </p>
        ) : (
          <div className="mt-4 grid gap-6">
            {measureSets.map((set) => {
              const unit = set.unit ?? "cm";
              return (
                <div key={set.id} className="rounded-lg border border-border p-4">
                  <p className="text-sm">{(set.guest_name ?? "").trim() || guestName}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-primary">
                    In {unit === "in" ? "inches" : "centimetres"}
                  </p>
                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                    {MEASURE_FIELDS.map((f) => {
                      const value = (set as Record<string, unknown>)[f.key];
                      return (
                        <div key={f.key} className="flex items-baseline justify-between gap-3">
                          <dt className="text-muted-foreground">{f.label}</dt>
                          <dd>
                            {value === null || value === undefined
                              ? "—"
                              : `${String(value)} ${unit}`}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                  {set.notes ? (
                    <p className="mt-5 text-sm text-muted-foreground">
                      Note for the tailor: {set.notes}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
