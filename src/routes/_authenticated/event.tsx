import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { scheduleHeadline, scheduleSummary } from "@/lib/schedule";
import { CalendarDays, MapPin, Clock, Shirt, Check, X, HelpCircle } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/event")({
  head: () => ({
    meta: [
      { title: "Wedding Weekend — Dates, Venues & RSVP" },
      {
        name: "description",
        content:
          "Every function of the wedding weekend: dates, timings, venues, dress codes and your RSVP.",
      },
      { property: "og:title", content: "Wedding Weekend — Dates, Venues & RSVP" },
      {
        property: "og:description",
        content: "Mehndi, sangeet, ceremony and reception — timings, venues, dress code and RSVP.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EventPage,
});

const formatDate = (value: string | null) =>
  value
    ? new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Date to be confirmed";

function EventPage() {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [noteTouched, setNoteTouched] = useState(false);

  const events = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select(
          "id, name, event_date, start_time, venue, venue_address, dress_code, note, rsvp_by, sort_order",
        )
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const profile = useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, rsvp_status, rsvp_note")
        .eq("id", userData.user.id)
        .maybeSingle();
      return data;
    },
  });

  const currentNote = noteTouched ? note : (profile.data?.rsvp_note ?? "");

  const saveRsvp = async (status: "yes" | "no") => {
    if (!profile.data) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        rsvp_status: status,
        rsvp_note: currentNote.trim() || null,
        rsvp_updated_at: new Date().toISOString(),
      })
      .eq("id", profile.data.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(status === "yes" ? "Wonderful — you're on the list." : "Thank you for letting us know.");
    setNoteTouched(false);
    await queryClient.invalidateQueries({ queryKey: ["my-profile"] });
  };

  const rsvp = profile.data?.rsvp_status ?? "pending";
  const rsvpBy = events.data?.find((e) => e.rsvp_by)?.rsvp_by ?? null;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-eyebrow">The wedding weekend</p>
      <h1 className="mt-3 text-4xl">{scheduleHeadline(events.data ?? [])}</h1>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        {scheduleSummary(events.data ?? [])} Dress codes are guidance, not rules — but red and ivory
        are reserved for the couple. Once you know which functions you'll join,{" "}
        <Link to="/lookbook" className="text-primary underline-offset-4 hover:underline">
          reserve your looks in the lookbook
        </Link>
        .
      </p>

      <section className="panel mt-8 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl">Your RSVP</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {rsvpBy ? `Please let us know by ${formatDate(rsvpBy)}.` : "Please let us know soon."}
            </p>
          </div>
          <Badge variant={rsvp === "yes" ? "default" : "secondary"}>
            {rsvp === "yes" ? (
              <>
                <Check className="size-3" /> Attending
              </>
            ) : rsvp === "no" ? (
              <>
                <X className="size-3" /> Can't make it
              </>
            ) : (
              <>
                <HelpCircle className="size-3" /> Awaiting your answer
              </>
            )}
          </Badge>
        </div>

        <div className="mt-5 space-y-2">
          <Label htmlFor="rsvp-note">Anything we should know? (optional)</Label>
          <Textarea
            id="rsvp-note"
            rows={3}
            maxLength={600}
            value={currentNote}
            placeholder="Arrival date, dietary needs, travelling with family…"
            onChange={(e) => {
              setNoteTouched(true);
              setNote(e.target.value);
            }}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <Button disabled={busy} onClick={() => saveRsvp("yes")}>
            {rsvp === "yes" ? "Update — I'll be there" : "I'll be there"}
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => saveRsvp("no")}>
            Sadly can't make it
          </Button>
        </div>
      </section>

      <div className="gold-rule my-10" />

      {events.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading the schedule…</p>
      ) : (
        <div className="space-y-5">
          {(events.data ?? []).map((ev) => (
            <article key={ev.id} className="panel p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="text-2xl">{ev.name}</h2>
                <p className="text-sm text-primary">{formatDate(ev.event_date)}</p>
              </div>

              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                {ev.start_time ? (
                  <Detail icon={Clock} label="Timing" value={ev.start_time} />
                ) : null}
                {ev.venue ? (
                  <Detail
                    icon={MapPin}
                    label="Venue"
                    value={ev.venue}
                    sub={ev.venue_address ?? undefined}
                  />
                ) : null}
                {ev.dress_code ? (
                  <Detail icon={Shirt} label="Dress code" value={ev.dress_code} />
                ) : null}
                {ev.note ? <Detail icon={CalendarDays} label="Good to know" value={ev.note} /> : null}
              </dl>

              <div className="mt-5">
                <Button asChild variant="outline" size="sm">
                  <Link to="/lookbook">See looks for the {ev.name.toLowerCase()}</Link>
                </Button>
              </div>
            </article>
          ))}
          {(events.data ?? []).length === 0 ? (
            <p className="panel p-6 text-sm text-muted-foreground">
              The schedule is being finalised. Dates, timings and venues will appear here as soon as
              the hosts add them.
            </p>
          ) : null}
        </div>

      )}
    </main>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  sub?: string | undefined;
}) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
      <div>
        <dt className="text-xs tracking-wide text-muted-foreground uppercase">{label}</dt>
        <dd className="mt-1 leading-relaxed">{value}</dd>
        {sub ? <dd className="mt-0.5 text-xs text-muted-foreground">{sub}</dd> : null}
      </div>
    </div>
  );
}
