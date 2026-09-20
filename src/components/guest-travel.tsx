import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plane, Users, CalendarClock, Check, X, ChevronDown, ChevronUp } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { GuestArrivals } from "@/components/guest-arrivals";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Plan = {
  id: string;
  household: string;
  guest_name: string | null;
  party_size: number | null;
  arrival_date: string | null;
  arrival_time: string | null;
  arrival_flight: string | null;
  departure_date: string | null;
  departure_time: string | null;
  departure_flight: string | null;
  notes: string | null;
};

type EventRow = { id: string; name: string; event_date: string | null; start_time: string | null };

const blank = {
  party_size: "",
  arrival_date: "",
  arrival_time: "",
  arrival_flight: "",
  departure_date: "",
  departure_time: "",
  departure_flight: "",
  notes: "",
};

/** Yes/no per event with a head count up top, plus optional travel details. */
export function GuestTravel({ events }: { events: EventRow[] }) {
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<"family" | "me">("family");
  const [form, setForm] = useState({ ...blank });
  const [loaded, setLoaded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [topCount, setTopCount] = useState("");
  const [travelOpen, setTravelOpen] = useState(false);

  const me = useQuery({
    queryKey: ["travel-me"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, household")
        .eq("id", userData.user.id)
        .maybeSingle();
      return data;
    },
  });

  const household = (me.data?.household ?? "").trim();
  const myName = (me.data?.full_name ?? "").trim();

  const people = useQuery({
    queryKey: ["travel-people"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("household_members");
      if (error) throw error;
      return (data ?? []) as { name: string; gender: string | null }[];
    },
  });

  const plans = useQuery({
    queryKey: ["travel-plans", household],
    enabled: Boolean(household),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("travel_plans")
        .select("*")
        .eq("household", household);
      if (error) throw error;
      return (data ?? []) as Plan[];
    },
  });

  const attendance = useQuery({
    queryKey: ["event-attendance", household],
    enabled: Boolean(household),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_attendance")
        .select("event_id, attending, guest_count")
        .eq("household", household);
      if (error) throw error;
      return data ?? [];
    },
  });

  const current = useMemo(
    () =>
      (plans.data ?? []).find((p) =>
        scope === "family" ? p.guest_name === null : p.guest_name === myName,
      ) ?? null,
    [plans.data, scope, myName],
  );

  // Load whichever plan the guest is looking at into the form.
  const key = `${scope}:${current?.id ?? "new"}`;
  useEffect(() => {
    if (loaded === key) return;
    setLoaded(key);
    setForm(
      current
        ? {
            party_size: current.party_size ? String(current.party_size) : "",
            arrival_date: current.arrival_date ?? "",
            arrival_time: current.arrival_time ?? "",
            arrival_flight: current.arrival_flight ?? "",
            departure_date: current.departure_date ?? "",
            departure_time: current.departure_time ?? "",
            departure_flight: current.departure_flight ?? "",
            notes: current.notes ?? "",
          }
        : { ...blank },
    );
  }, [key, loaded, current]);

  // Travel is optional — only unfold it on its own if they've already given details.
  useEffect(() => {
    if (current) setTravelOpen(true);
  }, [current]);

  const familySize = (people.data ?? []).length || 1;
  const defaultCount = topCount.trim() !== "" ? topCount : String(familySize);

  const rowFor = (eventId: string) =>
    (attendance.data ?? []).find((r) => r.event_id === eventId) ?? null;

  const countFor = (eventId: string) => {
    if (counts[eventId] !== undefined) return counts[eventId];
    const row = rowFor(eventId);
    if (!row) return defaultCount;
    return row.attending ? String(row.guest_count) : defaultCount;
  };

  const saveTravel = async () => {
    if (!household) {
      toast.error("We couldn't find your family name — please tell the hosts.");
      return;
    }
    setBusy(true);
    const payload = {
      household,
      guest_name: scope === "family" ? null : myName || "Guest",
      party_size: form.party_size ? Number(form.party_size) : null,
      arrival_date: form.arrival_date || null,
      arrival_time: form.arrival_time || null,
      arrival_flight: form.arrival_flight.trim() || null,
      departure_date: form.departure_date || null,
      departure_time: form.departure_time || null,
      departure_flight: form.departure_flight.trim() || null,
      notes: form.notes.trim() || null,
    };
    const { error } = current
      ? await supabase.from("travel_plans").update(payload).eq("id", current.id)
      : await supabase.from("travel_plans").insert(payload);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      scope === "family"
        ? "Saved — these travel details cover everyone in your family."
        : "Saved — your own travel details are with the hosts.",
    );
    setLoaded(null);
    await queryClient.invalidateQueries({ queryKey: ["travel-plans", household] });
  };

  const saveAnswer = async (eventId: string, attending: boolean, raw: string) => {
    if (!household) {
      toast.error("Your invitation isn't linked yet — enter your code on the sign-in page.");
      return;
    }
    const wanted = raw.trim() === "" ? Number(defaultCount) || 1 : Math.max(0, Number(raw));
    const value = attending ? Math.max(wanted, 1) : 0;
    const { error } = await supabase
      .from("event_attendance")
      .upsert(
        { household, event_id: eventId, attending, guest_count: value },
        { onConflict: "household,event_id" },
      );
    if (error) {
      toast.error(error.message);
      return;
    }
    setCounts((prev) => ({ ...prev, [eventId]: String(attending ? value : "") || "" }));
    await queryClient.invalidateQueries({ queryKey: ["event-attendance", household] });
    await queryClient.invalidateQueries({ queryKey: ["portal-attendance"] });
  };

  const arrival = form.arrival_date;

  // An event that starts before they land is one they'd miss.
  const missed = arrival ? events.filter((e) => e.event_date && e.event_date < arrival) : [];

  return (
    <>
      <div className="mt-8">
        <GuestArrivals household={household} />
      </div>
      <section className="panel mt-8 p-4 sm:p-6">

        <h2 className="flex items-center gap-2 text-xl">
          <Users className="size-4 text-primary" /> Who's coming, event by event
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Start with how many of you are coming, then say yes or no to each event. Change the
          number on any event where it's different.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-border/60 p-3">
          <div className="space-y-2">
            <Label htmlFor="top-count">How many of you are coming</Label>
            <Input
              id="top-count"
              type="number"
              min={1}
              max={50}
              className="w-24"
              value={defaultCount}
              onChange={(e) => setTopCount(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            This number is used for every event you say yes to.
          </p>
        </div>

        {missed.length > 0 ? (
          <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
            <p className="flex items-center gap-2 text-primary">
              <CalendarClock className="size-4" /> You land on{" "}
              {new Date(`${arrival}T00:00:00`).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
              })}
              , after {missed.map((e) => e.name).join(", ")}.
            </p>
            <p className="mt-1 text-muted-foreground">
              Please answer no to those, so we don't hold places you can't use.
            </p>
          </div>
        ) : null}

        <div className="mt-4 space-y-3">
          {events.map((e) => {
            const row = rowFor(e.id);
            const answered = row ? (row.attending ? "yes" : "no") : null;
            return (
              <div
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm">{e.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.event_date
                      ? new Date(`${e.event_date}T00:00:00`).toLocaleDateString("en-GB", {
                          weekday: "short",
                          day: "numeric",
                          month: "long",
                        })
                      : "Date to be confirmed"}
                    {e.start_time ? ` · ${e.start_time}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    className="w-20"
                    aria-label={`How many of you at ${e.name}`}
                    value={countFor(e.id)}
                    onChange={(ev) => setCounts({ ...counts, [e.id]: ev.target.value })}
                    onBlur={(ev) => {
                      if (answered === "yes") void saveAnswer(e.id, true, ev.target.value);
                    }}
                  />
                  <Button
                    size="sm"
                    variant={answered === "yes" ? "default" : "outline"}
                    className="gap-1"
                    onClick={() => saveAnswer(e.id, true, countFor(e.id))}
                  >
                    <Check className="size-3" /> Yes
                  </Button>
                  <Button
                    size="sm"
                    variant={answered === "no" ? "secondary" : "outline"}
                    className="gap-1"
                    onClick={() => saveAnswer(e.id, false, "0")}
                  >
                    <X className="size-3" /> No
                  </Button>
                </div>
              </div>
            );
          })}
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">Your celebrations will appear here.</p>
          ) : null}
        </div>
      </section>

      <section className="panel mt-6 p-4 sm:p-6">
        <button
          type="button"
          onClick={() => setTravelOpen((v) => !v)}
          className="flex w-full flex-wrap items-center justify-between gap-3 text-left"
          aria-expanded={travelOpen}
        >
          <span>
            <span className="flex items-center gap-2 text-xl">
              <Plane className="size-4 text-primary" /> Your travel (optional)
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">
              Only if you're travelling in — flights in and out help us plan pickups and rooms.
            </span>
          </span>
          {travelOpen ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </button>

        {travelOpen ? (
          <>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setScope("family")}
                className={`rounded-full border px-3 py-1.5 text-xs ${
                  scope === "family"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground"
                }`}
              >
                For the whole family
              </button>
              <button
                type="button"
                onClick={() => setScope("me")}
                className={`rounded-full border px-3 py-1.5 text-xs ${
                  scope === "me"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground"
                }`}
              >
                Just for me
              </button>
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div className="space-y-4">
                <p className="text-eyebrow">Arriving</p>
                <div className="space-y-2">
                  <Label htmlFor="arr-date">Arrival date</Label>
                  <Input
                    id="arr-date"
                    type="date"
                    value={form.arrival_date}
                    onChange={(e) => setForm({ ...form, arrival_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="arr-time">Landing time</Label>
                  <Input
                    id="arr-time"
                    type="time"
                    value={form.arrival_time}
                    onChange={(e) => setForm({ ...form, arrival_time: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="arr-flight">Flight number</Label>
                  <Input
                    id="arr-flight"
                    maxLength={20}
                    placeholder="e.g. EK 512"
                    value={form.arrival_flight}
                    onChange={(e) => setForm({ ...form, arrival_flight: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-eyebrow">Leaving</p>
                <div className="space-y-2">
                  <Label htmlFor="dep-date">Departure date</Label>
                  <Input
                    id="dep-date"
                    type="date"
                    value={form.departure_date}
                    onChange={(e) => setForm({ ...form, departure_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dep-time">Departure time</Label>
                  <Input
                    id="dep-time"
                    type="time"
                    value={form.departure_time}
                    onChange={(e) => setForm({ ...form, departure_time: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dep-flight">Flight number</Label>
                  <Input
                    id="dep-flight"
                    maxLength={20}
                    placeholder="e.g. EK 511"
                    value={form.departure_flight}
                    onChange={(e) => setForm({ ...form, departure_flight: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="party">
                  How many of you are travelling{scope === "family" ? "" : " with you"}?
                </Label>
                <Input
                  id="party"
                  type="number"
                  min={1}
                  max={50}
                  value={form.party_size}
                  onChange={(e) => setForm({ ...form, party_size: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="travel-notes">Anything else? (optional)</Label>
                <Textarea
                  id="travel-notes"
                  rows={3}
                  maxLength={600}
                  placeholder="Connecting flight, early check-in, someone joining later…"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>

            <Button className="mt-5" disabled={busy} onClick={saveTravel}>
              {current ? "Update travel details" : "Save travel details"}
            </Button>
          </>
        ) : null}
      </section>
    </>
  );
}
