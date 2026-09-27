import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, AlertTriangle, CalendarClock } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

const dateLabel = (value: string | null) =>
  value
    ? new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
      })
    : "—";

/** Flights in and out, head counts per event, and who lands too late for one. */
export function HostTravel() {
  const events = useQuery({
    queryKey: ["travel-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, name, event_date, sort_order")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const plans = useQuery({
    queryKey: ["all-travel-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("travel_plans")
        .select("*")
        .order("household");
      if (error) throw error;
      return data;
    },
  });

  const attendance = useQuery({
    queryKey: ["all-event-attendance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_attendance")
        .select("household, event_id, attending, guest_count");
      if (error) throw error;
      return data;
    },
  });

  const invited = useQuery({
    queryKey: ["all-household-event-invites"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("household_event_invites")
        .select("household, event_id");
      if (error) throw error;
      return data;
    },
  });

  /** Per event: families invited, replied, coming, declined and still to reply. */
  const stats = useMemo(() => {
    const map = new Map<
      string,
      { invited: number; replied: number; confirmed: number; declined: number; pending: number }
    >();
    const invitedBy = new Map<string, Set<string>>();
    for (const r of invited.data ?? []) {
      const set = invitedBy.get(r.event_id) ?? new Set<string>();
      set.add(r.household);
      invitedBy.set(r.event_id, set);
    }
    const answers = new Map<string, Map<string, boolean>>();
    for (const a of attendance.data ?? []) {
      const m = answers.get(a.event_id) ?? new Map<string, boolean>();
      m.set(a.household, a.attending);
      answers.set(a.event_id, m);
    }
    const ids = new Set([...invitedBy.keys(), ...answers.keys()]);
    for (const id of ids) {
      const inv = invitedBy.get(id) ?? new Set<string>();
      const ans = answers.get(id) ?? new Map<string, boolean>();
      const all = new Set([...inv, ...ans.keys()]);
      let confirmed = 0;
      let declined = 0;
      for (const v of ans.values()) (v ? confirmed++ : declined++);
      const replied = confirmed + declined;
      map.set(id, {
        invited: all.size,
        replied,
        confirmed,
        declined,
        pending: Math.max(0, all.size - replied),
      });
    }
    return map;
  }, [invited.data, attendance.data]);

  const totals = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of attendance.data ?? []) {
      if (!row.attending) continue;
      map.set(row.event_id, (map.get(row.event_id) ?? 0) + (row.guest_count ?? 0));
    }
    return map;
  }, [attendance.data]);

  const rows = plans.data ?? [];
  const list = events.data ?? [];

  const clashes = rows.flatMap((p) =>
    p.arrival_date
      ? list
          .filter((e) => e.event_date && e.event_date < p.arrival_date!)
          .map((e) => ({ household: p.household, name: p.guest_name, event: e.name }))
      : [],
  );

  /** One entry per event, with who is in town that day and who travels that day. */
  const timeline = useMemo(() => {
    const byHousehold = new Map<string, typeof rows>();
    for (const p of rows) {
      const current = byHousehold.get(p.household) ?? [];
      current.push(p);
      byHousehold.set(p.household, current);
    }

    return list.map((e) => {
      const coming = (attendance.data ?? []).filter(
        (a) => a.event_id === e.id && a.attending && (a.guest_count ?? 0) > 0,
      );
      const people = coming.map((a) => {
        const travel = byHousehold.get(a.household) ?? [];
        const arrivals = travel.map((t) => t.arrival_date).filter(Boolean) as string[];
        const departures = travel.map((t) => t.departure_date).filter(Boolean) as string[];
        const arrival = arrivals.sort()[0] ?? null;
        const departure = departures.sort().slice(-1)[0] ?? null;
        const day = e.event_date;
        return {
          household: a.household,
          guests: a.guest_count ?? 0,
          arrival,
          departure,
          arrivesToday: !!day && arrival === day,
          leavesToday: !!day && departure === day,
          notYetHere: !!day && !!arrival && arrival > day,
          alreadyGone: !!day && !!departure && departure < day,
        };
      });
      people.sort((a, b) => a.household.localeCompare(b.household));
      return {
        id: e.id,
        name: e.name,
        date: e.event_date,
        heads: people.reduce((sum, p) => sum + p.guests, 0),
        people,
      };
    });
  }, [list, rows, attendance.data]);

  return (
    <div className="space-y-6">

      <section className="panel p-4 sm:p-6">
        <h2 className="flex items-center gap-2 text-xl">
          <CalendarClock className="size-4 text-primary" /> Guest timeline
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Every event in order, with who is attending, who arrives that day and who flies out.
        </p>
        {timeline.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Add your celebrations first.</p>
        ) : (
          <ol className="mt-5 space-y-5 border-l border-border/70 pl-5">
            {timeline.map((t) => (
              <li key={t.id} className="relative">
                <span className="absolute -left-[26px] top-2 size-2 rounded-full bg-primary" />
                <div className="flex flex-wrap items-baseline gap-2">
                  <p className="text-lg">{t.name}</p>
                  <span className="text-xs text-muted-foreground">{dateLabel(t.date)}</span>
                  <Badge variant="outline">{t.heads} guests</Badge>
                </div>
                <EventStats s={stats.get(t.id)} />
                {t.people.length === 0 ? (
                  <p className="mt-1 text-sm text-muted-foreground">No one has confirmed yet.</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-sm">
                    {t.people.map((p) => (
                      <li key={`${t.id}-${p.household}`} className="flex flex-wrap items-center gap-2">
                        <span>{p.household}</span>
                        <span className="text-xs text-muted-foreground">
                          {p.guests} {p.guests === 1 ? "guest" : "guests"}
                        </span>
                        {p.arrivesToday ? (
                          <Badge variant="outline" className="text-primary">
                            arrives today
                          </Badge>
                        ) : null}
                        {p.leavesToday ? <Badge variant="outline">flies out today</Badge> : null}
                        {p.notYetHere ? (
                          <Badge variant="outline" className="text-destructive">
                            lands {dateLabel(p.arrival)}
                          </Badge>
                        ) : null}
                        {p.alreadyGone ? (
                          <Badge variant="outline" className="text-destructive">
                            left {dateLabel(p.departure)}
                          </Badge>
                        ) : null}
                        {!p.arrival && !p.departure ? (
                          <span className="text-xs text-muted-foreground">no travel details</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="panel p-4 sm:p-6">
        <h2 className="flex items-center gap-2 text-xl">
          <Users className="size-4 text-primary" /> Heads per event
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          What families have confirmed for each event.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((e) => (
            <div key={e.id} className="rounded-xl border border-border/60 p-4">
              <p className="text-sm">{e.name}</p>
              <p className="mt-1 text-2xl">{totals.get(e.id) ?? 0}</p>
              <p className="text-xs text-muted-foreground">{dateLabel(e.event_date)}</p>
              <EventStats s={stats.get(e.id)} />
            </div>
          ))}
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add your celebrations first.</p>
          ) : null}
        </div>
      </section>

      {clashes.length > 0 ? (
        <section className="panel p-4 sm:p-6">
          <h2 className="flex items-center gap-2 text-xl">
            <AlertTriangle className="size-4 text-primary" /> Landing after an event
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {clashes.map((c, i) => (
              <li key={i}>
                {c.household}
                {c.name ? ` — ${c.name}` : ""} lands after {c.event}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

    </div>

  );
}

type Stats = { invited: number; replied: number; confirmed: number; declined: number; pending: number };

/** Family counts for one event: invited, replied, confirmed, declined, not replied. */
function EventStats({ s }: { s: Stats | undefined }) {
  const v = s ?? { invited: 0, replied: 0, confirmed: 0, declined: 0, pending: 0 };
  const items = [
    { label: "Invited", value: v.invited, tone: "text-foreground" },
    { label: "Replied", value: v.replied, tone: "text-foreground" },
    { label: "Confirmed", value: v.confirmed, tone: "text-primary" },
    { label: "Declined", value: v.declined, tone: "text-destructive" },
    { label: "Not replied", value: v.pending, tone: "text-muted-foreground" },
  ];
  return (
    <div className="mt-3 grid grid-cols-5 gap-1 rounded-lg bg-muted/50 p-2 text-center">
      {items.map((i) => (
        <div key={i.label} className="min-w-0">
          <p className={`text-base leading-tight ${i.tone}`}>{i.value}</p>
          <p className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
            {i.label}
          </p>
        </div>
      ))}
    </div>
  );
}
