import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { matchesSelectedEvent, useSelectedEvent } from "@/lib/selected-event";

type Filter = "all" | "no_reply" | "no_look" | "no_measure";

/** One board: every guest's reply, claimed look and measurements side by side. */
export function HostDashboard() {
  const { inviteId } = useSelectedEvent();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

  const data = useQuery({
    queryKey: ["host-dashboard"],
    queryFn: async () => {
      const [guests, res, meas] = await Promise.all([
        supabase
          .from("invite_codes")
          .select("id, guest_name, household, claimed_by, rsvp_status, invite_id"),
        supabase.from("reservations").select("guest_id, guest_name, outfits(title)"),
        supabase.from("measurements").select("guest_id, guest_name"),
      ]);
      if (guests.error) throw guests.error;
      if (res.error) throw res.error;
      if (meas.error) throw meas.error;
      return { guests: guests.data ?? [], res: res.data ?? [], meas: meas.data ?? [] };
    },
  });

  const rows = useMemo(() => {
    const d = data.data;
    if (!d) return [];
    return d.guests
      .filter((g) => matchesSelectedEvent(g.invite_id, inviteId))
      .map((g) => {
        const looks = d.res
          .filter((r) => r.guest_id === g.claimed_by && (!r.guest_name || r.guest_name === g.guest_name))
          .map((r) => (r.outfits as { title: string } | null)?.title ?? "A look");
        const measured = d.meas.some(
          (m) => m.guest_id === g.claimed_by && (!m.guest_name || m.guest_name === g.guest_name),
        );
        return { ...g, looks, measured: !!g.claimed_by && measured };
      })
      .sort((a, b) => (a.household ?? "").localeCompare(b.household ?? ""));
  }, [data.data, inviteId]);

  const counts = {
    all: rows.length,
    no_reply: rows.filter((r) => r.rsvp_status === "pending" || !r.rsvp_status).length,
    no_look: rows.filter((r) => r.looks.length === 0).length,
    no_measure: rows.filter((r) => !r.measured).length,
  };

  const shown = rows.filter((r) => {
    if (filter === "no_reply" && !(r.rsvp_status === "pending" || !r.rsvp_status)) return false;
    if (filter === "no_look" && r.looks.length > 0) return false;
    if (filter === "no_measure" && r.measured) return false;
    const s = q.trim().toLowerCase();
    return !s || `${r.guest_name} ${r.household ?? ""}`.toLowerCase().includes(s);
  });

  const chips: [Filter, string][] = [
    ["all", "Everyone"],
    ["no_reply", "No reply yet"],
    ["no_look", "No look claimed"],
    ["no_measure", "Measurements pending"],
  ];

  return (
    <section className="panel p-4 sm:p-6">
      <h2 className="text-xl">Every guest at a glance</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Replies, claimed looks and measurements in one list. Tap a family to open their file.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {chips.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-full border px-3 py-1 text-xs ${
              filter === key ? "border-primary bg-primary text-primary-foreground" : "border-border"
            }`}
          >
            {label} · {counts[key]}
          </button>
        ))}
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a name"
          className="h-8 w-full sm:ml-auto sm:w-48"
        />
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-2 pr-3 font-normal">Guest</th>
              <th className="py-2 pr-3 font-normal">RSVP</th>
              <th className="py-2 pr-3 font-normal">Look claimed</th>
              <th className="py-2 font-normal">Measurements</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className="border-t border-border/50">
                <td className="py-2 pr-3">
                  {r.guest_name}
                  {r.household ? (
                    <Link
                      to="/family/$household"
                      params={{ household: r.household }}
                      className="block text-xs text-primary hover:underline"
                    >
                      {r.household}
                    </Link>
                  ) : null}
                </td>
                <td className="py-2 pr-3">
                  <Badge
                    variant={r.rsvp_status === "yes" ? "default" : r.rsvp_status === "no" ? "destructive" : "outline"}
                  >
                    {r.rsvp_status === "yes" ? "Coming" : r.rsvp_status === "no" ? "Can't come" : "No reply"}
                  </Badge>
                </td>
                <td className="py-2 pr-3">
                  {r.looks.length ? (
                    r.looks.join(", ")
                  ) : (
                    <span className="text-muted-foreground">Not yet</span>
                  )}
                </td>
                <td className="py-2">
                  {r.measured ? (
                    <Badge variant="secondary">Sent</Badge>
                  ) : (
                    <Badge variant="outline">{r.claimed_by ? "Pending" : "Not registered"}</Badge>
                  )}
                </td>
              </tr>
            ))}
            {!data.isLoading && shown.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-4 text-muted-foreground">
                  No guests here yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
