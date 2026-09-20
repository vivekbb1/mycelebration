import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BadgeCheck, Check, HelpCircle, Shirt, Users, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GuestFees } from "@/components/guest-fees";

export const Route = createFileRoute("/_authenticated/portal")({
  head: () => ({
    meta: [
      { title: "Your Guest Portal — Replies, Outfits & Payments" },
      {
        name: "description",
        content:
          "Reply for every function you're invited to, confirm the outfit set aside for you and settle what's payable, all in one place.",
      },
      { property: "og:title", content: "Your Guest Portal — Replies, Outfits & Payments" },
      {
        property: "og:description",
        content: "One place to reply per function, confirm your outfit and pay what's due.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PortalPage,
});

const dateLabel = (value: string | null | undefined) =>
  value
    ? new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
      })
    : "date to come";

type Look = {
  id: string;
  guest_name: string | null;
  build_garment: string | null;
  build_size: string | null;
  outfits: { title: string; designer: string | null; event_id: string | null } | null;
};

/** One portal a guest works through: reply per function, confirm outfits, settle fees. */
function PortalPage() {
  const qc = useQueryClient();
  const [heads, setHeads] = useState<Record<string, string>>({});

  const me = useQuery({
    queryKey: ["portal-me"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, household")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const myEventIds = useQuery({
    queryKey: ["my-event-ids"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_event_ids");
      if (error) throw error;
      return new Set(((data ?? []) as { event_id: string }[]).map((r) => r.event_id));
    },
  });

  const events = useQuery({
    queryKey: ["portal-events", [...(myEventIds.data ?? [])].sort().join(",")],
    enabled: myEventIds.isSuccess,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select(
          "id, name, event_date, start_time, venue, dress_code, rsvp_by, outfit_selection, outfit_ready_by, sort_order",
        )
        .order("sort_order");
      if (error) throw error;
      const allowed = myEventIds.data;
      return allowed ? data.filter((e) => allowed.has(e.id)) : data;
    },
  });

  const household = me.data?.household ?? null;

  const attendance = useQuery({
    queryKey: ["portal-attendance", household],
    enabled: Boolean(household),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_attendance")
        .select("id, event_id, attending, guest_count")
        .eq("household", household as string);
      if (error) throw error;
      return data ?? [];
    },
  });

  const looks = useQuery({
    queryKey: ["portal-looks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select("id, guest_name, build_garment, build_size, outfits(title, designer, event_id)");
      if (error) throw error;
      return (data ?? []) as unknown as Look[];
    },
  });

  const people = useQuery({
    queryKey: ["portal-people"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("household_members");
      if (error) throw error;
      return (data ?? []) as { name: string; gender: string | null }[];
    },
  });

  const answerFor = (eventId: string) =>
    (attendance.data ?? []).find((a) => a.event_id === eventId) ?? null;

  const looksByEvent = useMemo(() => {
    const map = new Map<string, Look[]>();
    for (const row of looks.data ?? []) {
      const key = row.outfits?.event_id ?? "any";
      map.set(key, [...(map.get(key) ?? []), row]);
    }
    return map;
  }, [looks.data]);

  const reply = useMutation({
    mutationFn: async (input: { eventId: string; attending: boolean; guestCount: number }) => {
      if (!household) throw new Error("no-household");
      const { error } = await supabase.from("event_attendance").upsert(
        {
          household,
          event_id: input.eventId,
          attending: input.attending,
          guest_count: Math.max(input.guestCount, input.attending ? 1 : 0),
        },
        { onConflict: "household,event_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved — thank you.");
      qc.invalidateQueries({ queryKey: ["portal-attendance"] });
      qc.invalidateQueries({ queryKey: ["my-fee-attendance"] });
    },
    onError: (err) =>
      toast.error(
        err instanceof Error && err.message === "no-household"
          ? "Your invitation isn't linked yet — enter your code on the sign-in page."
          : "Couldn't save that — try again.",
      ),
  });

  const replyAll = useMutation({
    mutationFn: async (input: { attending: boolean; guestCount: number; eventIds: string[] }) => {
      if (!household) throw new Error("no-household");
      const rows = input.eventIds.map((event_id) => ({
        household,
        event_id,
        attending: input.attending,
        guest_count: Math.max(input.guestCount, input.attending ? 1 : 0),
      }));
      if (rows.length === 0) return;
      const { error } = await supabase
        .from("event_attendance")
        .upsert(rows, { onConflict: "household,event_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved for every function — thank you.");
      qc.invalidateQueries({ queryKey: ["portal-attendance"] });
      qc.invalidateQueries({ queryKey: ["my-fee-attendance"] });
      setHeads({});
    },
    onError: (err) =>
      toast.error(
        err instanceof Error && err.message === "no-household"
          ? "Your invitation isn't linked yet — enter your code on the sign-in page."
          : "Couldn't save that — try again.",
      ),
  });

  const list = events.data ?? [];
  const familySize = (people.data ?? []).length || 1;
  const answered = (attendance.data ?? []).length;
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = list.filter((ev) => !ev.event_date || ev.event_date >= today);
  const past = list.filter((ev) => ev.event_date && ev.event_date < today);
  const bulkValue = bulkHeads || String(familySize);

  return (
    <main className="bg-zari">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-center text-eyebrow">Your portal</p>
        <h1 className="mt-3 text-center text-4xl">
          {me.data?.full_name ? `${me.data.full_name}, here's everything` : "Everything in one place"}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-center text-sm leading-relaxed text-muted-foreground">
          Reply for each function you're invited to, confirm the outfit set aside for you, and settle
          anything payable — all from this page.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Users className="size-3" /> {familySize} on your invitation
          </Badge>
          <Badge variant={answered >= list.length && list.length > 0 ? "default" : "outline"}>
            {answered} of {list.length} functions answered
          </Badge>
        </div>

        {events.isLoading ? (
          <p className="mt-10 text-center text-sm text-muted-foreground">Fetching your functions…</p>
        ) : list.length === 0 ? (
          <p className="panel mt-10 p-5 text-center text-sm text-muted-foreground sm:p-6">
            Your functions will appear here as soon as the hosts settle the schedule.
          </p>
        ) : (
          <ol className="mt-8 space-y-5">
            {list.map((ev) => {
              const a = answerFor(ev.id);
              const headValue = heads[ev.id] ?? String(a?.guest_count ?? familySize);
              const mine = [...(looksByEvent.get(ev.id) ?? []), ...(looksByEvent.get("any") ?? [])];
              const picksOutfits = ev.outfit_selection !== false;
              return (
                <li key={ev.id} className="panel p-5 sm:p-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-2xl">{ev.name}</h2>
                    <span className="text-sm text-muted-foreground">
                      {dateLabel(ev.event_date)}
                      {ev.start_time ? ` · ${ev.start_time}` : ""}
                    </span>
                  </div>
                  {ev.venue ? <p className="mt-1 text-sm text-muted-foreground">{ev.venue}</p> : null}
                  {ev.dress_code ? <p className="mt-1 text-sm text-primary">{ev.dress_code}</p> : null}
                  {ev.rsvp_by ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Reply by {dateLabel(ev.rsvp_by)}
                    </p>
                  ) : null}

                  <div className="mt-4 rounded-lg border border-border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm">Are you coming to this one?</p>
                      <Badge
                        variant={
                          a == null ? "outline" : a.attending ? "default" : "secondary"
                        }
                        className="gap-1"
                      >
                        {a == null ? (
                          <>
                            <HelpCircle className="size-3" /> Not answered
                          </>
                        ) : a.attending ? (
                          <>
                            <Check className="size-3" /> Coming · {a.guest_count}
                          </>
                        ) : (
                          <>
                            <X className="size-3" /> Not coming
                          </>
                        )}
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap items-end gap-3">
                      <div className="space-y-2">
                        <Label htmlFor={`heads-${ev.id}`}>How many of you</Label>
                        <Input
                          id={`heads-${ev.id}`}
                          type="number"
                          min={1}
                          max={50}
                          className="w-24"
                          value={headValue}
                          onChange={(e) => setHeads((p) => ({ ...p, [ev.id]: e.target.value }))}
                        />
                      </div>
                      <Button
                        disabled={reply.isPending}
                        onClick={() =>
                          reply.mutate({
                            eventId: ev.id,
                            attending: true,
                            guestCount: Number(headValue) || 1,
                          })
                        }
                      >
                        We'll be there
                      </Button>
                      <Button
                        variant="outline"
                        disabled={reply.isPending}
                        onClick={() =>
                          reply.mutate({ eventId: ev.id, attending: false, guestCount: 0 })
                        }
                      >
                        Can't make this one
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg border border-border p-4">
                    <p className="flex items-center gap-2 text-sm">
                      <Shirt className="size-4 shrink-0 text-primary" /> Your outfit
                      {ev.outfit_ready_by ? (
                        <span className="text-xs text-muted-foreground">
                          · ready by {dateLabel(ev.outfit_ready_by)}
                        </span>
                      ) : null}
                    </p>
                    {!picksOutfits ? (
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
                      <>
                        <ul className="mt-3 space-y-2 text-sm">
                          {mine.map((row) => {
                            const done = Boolean(row.build_garment && row.build_size);
                            return (
                              <li key={`${ev.id}-${row.id}`} className="flex flex-wrap items-center gap-2">
                                <span className="truncate">
                                  {row.outfits?.title ?? "Look"}
                                  {row.outfits?.designer ? ` — ${row.outfits.designer}` : ""}
                                  {row.guest_name ? (
                                    <span className="text-muted-foreground"> · for {row.guest_name}</span>
                                  ) : null}
                                </span>
                                <Badge variant={done ? "default" : "outline"} className="gap-1">
                                  {done ? (
                                    <>
                                      <BadgeCheck className="size-3" /> Confirmed ·{" "}
                                      {row.build_size}
                                    </>
                                  ) : (
                                    "Needs confirming"
                                  )}
                                </Badge>
                              </li>
                            );
                          })}
                        </ul>
                        <Button asChild size="sm" variant="outline" className="mt-3">
                          <Link to="/confirm">Confirm garment, designer and size</Link>
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <GuestFees />

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="sm" variant="outline">
            <Link to="/measurements">Send measurements</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/plan">What's expected of you</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
