import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CalendarCheck, Ruler, Shirt } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useGuestEvent } from "@/lib/guest-event";
import { Badge } from "@/components/ui/badge";

const day = (d: string | null) =>
  d
    ? new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
    : "Date to follow";

/** At-a-glance: replies + head count per event, looks chosen, measurements sent. */
export function GuestSummarySnapshot({
  household,
  looks,
}: {
  household: string;
  looks: { event_id: string | null; guest_name: string | null; confirmed: boolean }[];
}) {
  const guestEvent = useGuestEvent();

  const events = useQuery({
    queryKey: ["summary-events", household],
    queryFn: async () => {
      const { data: ids } = await supabase.rpc("my_event_ids");
      const list = (ids ?? []).map((r: { event_id: string }) => r.event_id);
      if (list.length === 0) return [];
      const { data } = await supabase
        .from("events")
        .select("id, name, event_date, sort_order")
        .in("id", list)
        .order("sort_order");
      return data ?? [];
    },
  });

  const answers = useQuery({
    queryKey: ["summary-answers", household],
    enabled: Boolean(household),
    queryFn: async () => {
      const { data } = await supabase
        .from("event_attendance")
        .select("event_id, attending, guest_count")
        .eq("household", household);
      return data ?? [];
    },
  });

  const people = useQuery({
    queryKey: ["summary-people"],
    queryFn: async () => {
      const { data } = await supabase.rpc("household_members");
      return ((data ?? []) as { name: string }[]).map((p) => p.name).filter(Boolean);
    },
  });

  const measured = useQuery({
    queryKey: ["summary-measurements"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return [];
      const { data } = await supabase.from("measurements").select("guest_name").eq("guest_id", auth.user.id);
      return (data ?? []).map((m) => m.guest_name);
    },
  });

  const evs = (events.data ?? []).filter((e) => guestEvent.allows(e.id));
  const byEvent = new Map((answers.data ?? []).map((a) => [a.event_id, a]));
  const yes = evs.filter((e) => byEvent.get(e.id)?.attending);
  const heads = Math.max(0, ...yes.map((e) => byEvent.get(e.id)!.guest_count ?? 0));
  const myLooks = looks.filter((l) => guestEvent.allows(l.event_id));
  const confirmed = myLooks.filter((l) => l.confirmed).length;
  const names = people.data ?? [];
  const sent = new Set(measured.data ?? []);
  const measuredCount = names.filter((n) => sent.has(n)).length;

  return (
    <div className="mt-8 grid gap-4 md:grid-cols-3">
      <section className="panel p-4 sm:p-5 md:col-span-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-xl">
            <CalendarCheck className="size-4 text-primary" /> Your RSVP
          </h2>
          <span className="text-sm text-muted-foreground">
            Coming to {yes.length} of {evs.length}
            {heads ? ` · ${heads} of you` : ""}
          </span>
        </div>
        {evs.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No events on your invitation yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {evs.map((e) => {
              const a = byEvent.get(e.id);
              return (
                <li key={e.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{e.name}</span>
                  <span className="text-xs text-muted-foreground">{day(e.event_date)}</span>
                  {!a ? (
                    <Badge variant="outline">No reply yet</Badge>
                  ) : a.attending ? (
                    <Badge>{a.guest_count} coming</Badge>
                  ) : (
                    <Badge variant="secondary">Not coming</Badge>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <Link to="/guest/schedule" className="mt-3 inline-block text-sm text-primary hover:underline">
          Change replies
        </Link>
      </section>

      <section className="panel p-4 sm:p-5 md:col-span-3 lg:col-span-1 sm:col-span-1">
        <h2 className="flex items-center gap-2 text-lg">
          <Shirt className="size-4 text-primary" /> Outfits
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {myLooks.length === 0
            ? "No looks chosen yet."
            : `${myLooks.length} chosen · ${confirmed} confirmed`}
        </p>
        <Link to="/guest/outfits" className="mt-2 inline-block text-sm text-primary hover:underline">
          {myLooks.length === 0 ? "Choose a look" : "See the lookbook"}
        </Link>
      </section>

      <section className="panel p-4 sm:p-5 md:col-span-2">
        <h2 className="flex items-center gap-2 text-lg">
          <Ruler className="size-4 text-primary" /> Measurements
        </h2>
        {names.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {sent.size ? `${sent.size} sent` : "Not sent yet."}
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              {measuredCount} of {names.length} sent
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {names.map((n) => (
                <Badge key={n} variant={sent.has(n) ? "default" : "outline"}>
                  {n} {sent.has(n) ? "✓" : "· to send"}
                </Badge>
              ))}
            </div>
          </>
        )}
        <Link to="/guest/measurements" className="mt-2 inline-block text-sm text-primary hover:underline">
          {measuredCount === names.length && names.length ? "Update measurements" : "Send measurements"}
        </Link>
      </section>
    </div>
  );
}
