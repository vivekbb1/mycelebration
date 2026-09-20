import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Gauge } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { splitTags } from "@/lib/tags";

type Guest = {
  id: string;
  guest_name: string;
  household: string | null;
  tags: string | null;
};

type Note = {
  invite_id: string;
  follow_up_on: string | null;
  contacted_at: string;
};

const prettyDate = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

/** How much each host is carrying: their guests, what's overdue and what's coming up. */
export function HostWorkload() {
  const today = new Date().toISOString().slice(0, 10);
  const weekAhead = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const hosts = useQuery({
    queryKey: ["workload-hosts"],
    queryFn: async () => {
      const roles = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      if (roles.error) throw roles.error;
      const ids = (roles.data ?? []).map((r) => r.user_id);
      if (ids.length === 0) return [] as { id: string; name: string }[];
      const people = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
      if (people.error) throw people.error;
      return ids.map((id) => {
        const p = (people.data ?? []).find((row) => row.id === id);
        return { id, name: (p?.full_name ?? "").trim() || (p?.email ?? "") || "Host" };
      });
    },
  });

  const guests = useQuery({
    queryKey: ["workload-guests"],
    queryFn: async (): Promise<Guest[]> => {
      const { data, error } = await supabase
        .from("invite_codes")
        .select("id, guest_name, household, tags");
      if (error) throw error;
      return data as Guest[];
    },
  });

  const links = useQuery({
    queryKey: ["workload-links"],
    queryFn: async () => {
      const { data, error } = await supabase.from("guest_hosts").select("invite_id, host_id");
      if (error) throw error;
      return data;
    },
  });

  const notes = useQuery({
    queryKey: ["workload-notes"],
    queryFn: async (): Promise<Note[]> => {
      const { data, error } = await supabase
        .from("guest_communications")
        .select("invite_id, follow_up_on, contacted_at")
        .order("contacted_at", { ascending: false });
      if (error) throw error;
      return data as Note[];
    },
  });

  const replies = useQuery({
    queryKey: ["workload-replies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("household, rsvp_status");
      if (error) throw error;
      return data;
    },
  });

  const repliedHouseholds = useMemo(() => {
    const set = new Set<string>();
    for (const row of replies.data ?? []) {
      if (row.household && row.rsvp_status && row.rsvp_status !== "pending") {
        set.add(row.household);
      }
    }
    return set;
  }, [replies.data]);

  const rows = useMemo(() => {
    const byHost = new Map<string, string[]>();
    for (const row of links.data ?? []) {
      byHost.set(row.host_id, [...(byHost.get(row.host_id) ?? []), row.invite_id]);
    }
    const guestById = new Map((guests.data ?? []).map((g) => [g.id, g]));
    const notesFor = new Map<string, Note[]>();
    for (const n of notes.data ?? []) {
      notesFor.set(n.invite_id, [...(notesFor.get(n.invite_id) ?? []), n]);
    }

    return (hosts.data ?? [])
      .map((h) => {
        const ids = byHost.get(h.id) ?? [];
        const mine = ids.map((id) => guestById.get(id)).filter(Boolean) as Guest[];
        const overdue: { name: string; on: string }[] = [];
        const upcoming: { name: string; on: string }[] = [];
        let notContacted = 0;
        let awaitingReply = 0;

        for (const g of mine) {
          const history = notesFor.get(g.id) ?? [];
          if (history.length === 0) notContacted += 1;
          if (!g.household || !repliedHouseholds.has(g.household)) awaitingReply += 1;
          const due = history.find((n) => n.follow_up_on);
          if (due?.follow_up_on) {
            const entry = { name: g.guest_name, on: due.follow_up_on };
            if (due.follow_up_on <= today) overdue.push(entry);
            else if (due.follow_up_on <= weekAhead) upcoming.push(entry);
          }
        }

        overdue.sort((a, b) => a.on.localeCompare(b.on));
        upcoming.sort((a, b) => a.on.localeCompare(b.on));

        return {
          ...h,
          guests: mine.length,
          notContacted,
          awaitingReply,
          overdue,
          upcoming,
        };
      })
      .sort((a, b) => b.overdue.length - a.overdue.length || b.guests - a.guests);
  }, [hosts.data, guests.data, links.data, notes.data, repliedHouseholds, today, weekAhead]);

  const assignedIds = new Set((links.data ?? []).map((r) => r.invite_id));
  const unassigned = (guests.data ?? []).filter((g) => !assignedIds.has(g.id)).length;

  return (
    <div className="space-y-6">
      <section className="panel p-4 sm:p-6">
        <h2 className="flex items-center gap-2 text-xl">
          <Gauge className="size-4 text-primary" /> How the hosts are doing
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Who is carrying how many guests, what has slipped, and which words are due this week.
          Hand a guest to someone else under Who invited whom.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border/60 p-4">
            <p className="text-2xl">{guests.data?.length ?? 0}</p>
            <p className="text-xs text-muted-foreground">Guests on the list</p>
          </div>
          <div className="rounded-xl border border-border/60 p-4">
            <p className="text-2xl">{rows.length}</p>
            <p className="text-xs text-muted-foreground">Hosts helping</p>
          </div>
          <div className="rounded-xl border border-border/60 p-4">
            <p className="text-2xl">{unassigned}</p>
            <p className="text-xs text-muted-foreground">Nobody's name against them yet</p>
          </div>
        </div>
      </section>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hosts yet — invite them under Setup &rarr; Hosts, then put guests against their names.
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {rows.map((r) => (
          <section key={r.id} className="panel p-4 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg">{r.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {r.guests} guest{r.guests === 1 ? "" : "s"} to look after
                </p>
              </div>
              {r.overdue.length > 0 ? (
                <Badge variant="destructive">{r.overdue.length} slipped</Badge>
              ) : (
                <Badge variant="outline">Up to date</Badge>
              )}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg border border-border/60 p-3">
                <p className="text-xl">{r.awaitingReply}</p>
                <p className="text-[11px] text-muted-foreground">Waiting on a reply</p>
              </div>
              <div className="rounded-lg border border-border/60 p-3">
                <p className="text-xl">{r.notContacted}</p>
                <p className="text-[11px] text-muted-foreground">Not spoken to yet</p>
              </div>
              <div className="rounded-lg border border-border/60 p-3">
                <p className="text-xl">{r.upcoming.length}</p>
                <p className="text-[11px] text-muted-foreground">Due this week</p>
              </div>
            </div>

            {r.overdue.length > 0 || r.upcoming.length > 0 ? (
              <ul className="mt-4 space-y-2 text-xs">
                {[...r.overdue, ...r.upcoming].slice(0, 6).map((t) => (
                  <li
                    key={`${t.name}-${t.on}`}
                    className="flex items-center gap-2 rounded-lg border border-border/50 p-2"
                  >
                    <CalendarClock className="size-3 text-primary" />
                    <span>{t.name}</span>
                    <span
                      className={
                        t.on <= today ? "text-destructive" : "text-muted-foreground"
                      }
                    >
                      {t.on <= today ? "was due" : "due"} {prettyDate(t.on)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-xs text-muted-foreground">
                Nothing pending for {r.name.split(" ")[0]}.
              </p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
