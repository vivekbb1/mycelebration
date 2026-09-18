import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { CalendarClock, Plane, Ruler, Scissors, Shirt } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/plan")({
  head: () => ({
    meta: [
      { title: "What's Expected — Your Outfits, Sizes & Dates" },
      {
        name: "description",
        content:
          "Everything set aside for you: the look chosen for each function, the measurements we hold and the dates to be ready by.",
      },
      { property: "og:title", content: "What's Expected — Your Outfits, Sizes & Dates" },
      {
        property: "og:description",
        content:
          "One page with your outfit for each function, the measurements we hold and every date you need.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlanPage,
});

const dateLabel = (value: string | null | undefined) =>
  value
    ? new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
      })
    : null;

type Look = {
  outfit_id: string;
  guest_name: string | null;
  build_size: string | null;
  build_fabric: string | null;
  build_garment: string | null;
  outfits: {
    title: string;
    event_id: string | null;
    designer: string | null;
    garment_type: string | null;
    size_note: string | null;
    image_url: string | null;
  } | null;
};

/** One page a guest can check: the look set aside for them, their sizes and every date. */
function PlanPage() {
  const myEventIds = useQuery({
    queryKey: ["my-event-ids"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_event_ids");
      if (error) throw error;
      return new Set(((data ?? []) as { event_id: string }[]).map((r) => r.event_id));
    },
  });

  const events = useQuery({
    queryKey: ["plan-events", [...(myEventIds.data ?? [])].sort().join(",")],
    enabled: myEventIds.isSuccess,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select(
          "id, name, event_date, start_time, venue, dress_code, outfit_selection, outfit_ready_by, outfit_slot_note, sort_order",
        )
        .order("sort_order");
      if (error) throw error;
      const allowed = myEventIds.data;
      return allowed ? data.filter((e) => allowed.has(e.id)) : data;
    },
  });

  const looks = useQuery({
    queryKey: ["plan-looks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select(
          "outfit_id, guest_name, build_size, build_fabric, build_garment, outfits(title, event_id, designer, garment_type, size_note, image_url)",
        );
      if (error) throw error;
      return (data ?? []) as unknown as Look[];
    },
  });

  const measurements = useQuery({
    queryKey: ["plan-measurements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("measurements")
        .select("id, guest_name, unit, bust, waist, hip, shoulder, height, updated_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const travel = useQuery({
    queryKey: ["plan-travel"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("travel_plans")
        .select(
          "id, guest_name, arrival_date, arrival_time, arrival_flight, departure_date, departure_time, departure_flight",
        )
        .order("arrival_date");
      if (error) throw error;
      return data ?? [];
    },
  });

  const looksByEvent = useMemo(() => {
    const map = new Map<string, Look[]>();
    for (const row of looks.data ?? []) {
      const key = row.outfits?.event_id ?? "any";
      map.set(key, [...(map.get(key) ?? []), row]);
    }
    return map;
  }, [looks.data]);

  const list = events.data ?? [];
  const loading = events.isLoading || looks.isLoading;

  return (
    <main className="bg-zari">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <p className="text-center text-eyebrow">Your plan</p>
        <h1 className="mt-3 text-center text-4xl">What's expected of you</h1>
        <p className="mx-auto mt-4 max-w-xl text-center text-sm leading-relaxed text-muted-foreground">
          Every function you're invited to, the look set aside for each one, the measurements we
          hold and the dates it all needs to be ready by.
        </p>

        {loading ? (
          <p className="mt-10 text-center text-sm text-muted-foreground">Gathering your details…</p>
        ) : (
          <ol className="mt-10 space-y-5">
            {list.map((ev) => {
              const mine = [...(looksByEvent.get(ev.id) ?? []), ...(looksByEvent.get("any") ?? [])];
              const picks = ev.outfit_selection !== false;
              return (
                <li key={ev.id} className="panel p-5 sm:p-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-2xl">{ev.name}</h2>
                    <span className="text-sm text-muted-foreground">
                      {dateLabel(ev.event_date) ?? "date to come"}
                      {ev.start_time ? ` · ${ev.start_time}` : ""}
                    </span>
                  </div>
                  {ev.venue ? (
                    <p className="mt-1 text-sm text-muted-foreground">{ev.venue}</p>
                  ) : null}
                  {ev.dress_code ? (
                    <p className="mt-1 text-sm text-primary">{ev.dress_code}</p>
                  ) : null}

                  {ev.outfit_ready_by || ev.outfit_slot_note ? (
                    <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                      <CalendarClock className="size-4 shrink-0 text-primary" />
                      {ev.outfit_ready_by
                        ? `Outfit ready by ${dateLabel(ev.outfit_ready_by)}`
                        : "Outfit timing"}
                      {ev.outfit_slot_note ? (
                        <span className="text-muted-foreground">· {ev.outfit_slot_note}</span>
                      ) : null}
                    </p>
                  ) : null}

                  <div className="mt-4 rounded-lg border border-border p-4">
                    <p className="flex items-center gap-2 text-sm">
                      <Shirt className="size-4 shrink-0 text-primary" /> Your outfit
                    </p>
                    {!picks ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        You'll wear your own outfit for this one.
                      </p>
                    ) : mine.length === 0 ? (
                      <div className="mt-2">
                        <p className="text-sm text-muted-foreground">Nothing chosen yet.</p>
                        <Button asChild size="sm" variant="outline" className="mt-3">
                          <Link to="/lookbook">Choose a look</Link>
                        </Button>
                      </div>
                    ) : (
                      <ul className="mt-3 space-y-3">
                        {mine.map((row) => (
                          <li
                            key={`${ev.id}-${row.outfit_id}`}
                            className="flex items-start gap-3 text-sm"
                          >
                            {row.outfits?.image_url ? (
                              <img
                                src={row.outfits.image_url}
                                alt=""
                                loading="lazy"
                                className="size-16 shrink-0 rounded-md object-cover"
                              />
                            ) : null}
                            <div className="min-w-0">
                              <p className="truncate">
                                {row.outfits?.title ?? "Look"}
                                {row.guest_name ? (
                                  <span className="text-muted-foreground">
                                    {" "}
                                    · for {row.guest_name}
                                  </span>
                                ) : null}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {[
                                  row.build_garment ?? row.outfits?.garment_type,
                                  row.build_size ? `size ${row.build_size}` : row.outfits?.size_note,
                                  row.build_fabric,
                                ]
                                  .filter(Boolean)
                                  .join(" · ") || "Details to follow"}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              );
            })}
            {list.length === 0 ? (
              <p className="panel p-6 text-center text-sm text-muted-foreground">
                Your functions will appear here as soon as the schedule is settled.
              </p>
            ) : null}
          </ol>
        )}

        <section className="panel mt-8 p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-xl">
            <Ruler className="size-4 shrink-0 text-primary" /> Measurements we hold
          </h2>
          {(measurements.data ?? []).length === 0 ? (
            <div className="mt-3">
              <p className="text-sm text-muted-foreground">
                We don't have any measurements yet — they're needed before your outfit can be
                tailored.
              </p>
              <Button asChild size="sm" variant="outline" className="mt-3">
                <Link to="/measurements">Send measurements</Link>
              </Button>
            </div>
          ) : (
            <>
              <ul className="mt-4 space-y-2">
                {(measurements.data ?? []).map((m) => (
                  <li key={m.id} className="rounded-lg border border-border p-3 text-sm">
                    <p className="flex flex-wrap items-center gap-2">
                      {m.guest_name || "You"}
                      <Badge variant="outline">{m.unit}</Badge>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {[
                        m.height ? `height ${m.height}` : null,
                        m.bust ? `bust ${m.bust}` : null,
                        m.waist ? `waist ${m.waist}` : null,
                        m.hip ? `hip ${m.hip}` : null,
                        m.shoulder ? `shoulder ${m.shoulder}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "Started, but still mostly empty"}
                    </p>
                  </li>
                ))}
              </ul>
              <Button asChild size="sm" variant="outline" className="mt-4">
                <Link to="/measurements">Check or change them</Link>
              </Button>
            </>
          )}
        </section>

        <section className="panel mt-8 p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-xl">
            <Plane className="size-4 shrink-0 text-primary" /> Arriving and leaving
          </h2>
          {(travel.data ?? []).length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No travel dates yet — add them with your reply so fittings can be planned around you.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {(travel.data ?? []).map((row) => (
                <li key={row.id} className="rounded-lg border border-border p-3 text-sm">
                  <p className="truncate">{row.guest_name || "Whole family"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Arrives {dateLabel(row.arrival_date) ?? "date to come"}
                    {row.arrival_time ? ` at ${row.arrival_time}` : ""}
                    {row.arrival_flight ? ` · ${row.arrival_flight}` : ""} · Leaves{" "}
                    {dateLabel(row.departure_date) ?? "date to come"}
                    {row.departure_time ? ` at ${row.departure_time}` : ""}
                    {row.departure_flight ? ` · ${row.departure_flight}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <Button asChild size="sm" variant="outline" className="mt-4">
            <Link to="/event">Add or change travel dates</Link>
          </Button>
        </section>

        <p className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
          <Scissors className="size-3.5" /> Anything look wrong? Send the hosts a message from your
          invitation page.
        </p>
      </div>
    </main>
  );
}
