import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * Which families are invited to which functions. A family with no ticks at all
 * is treated as invited to everything, so nothing breaks for families you
 * haven't looked at yet.
 */
export function HostFunctionAccess() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);

  const events = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, name, event_date, sort_order")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const guests = useQuery({
    queryKey: ["invites-households"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invite_codes")
        .select("id, guest_name, household")
        .order("household");
      if (error) throw error;
      return data;
    },
  });

  const access = useQuery({
    queryKey: ["household-event-invites"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("household_event_invites")
        .select("id, household, event_id, outfit_selection");
      if (error) throw error;
      return data;
    },
  });

  const families = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const g of guests.data ?? []) {
      const key = (g.household ?? "").trim() || (g.guest_name ?? "").trim();
      if (!key) continue;
      const names = map.get(key) ?? [];
      if (g.guest_name) names.push(g.guest_name);
      map.set(key, names);
    }
    return [...map.entries()]
      .map(([household, names]) => ({ household, names }))
      .sort((a, b) => a.household.localeCompare(b.household));
  }, [guests.data]);

  const visible = families.filter((f) => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return (
      f.household.toLowerCase().includes(q) ||
      f.names.some((n) => n.toLowerCase().includes(q))
    );
  });

  const rowsFor = (household: string) =>
    (access.data ?? []).filter((r) => r.household === household);

  const isTicked = (household: string, eventId: string) => {
    const rows = rowsFor(household);
    if (rows.length === 0) return true; // no choices made yet = invited to all
    return rows.some((r) => r.event_id === eventId);
  };

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["household-event-invites"] });
  };

  const toggle = async (household: string, eventId: string) => {
    const rows = rowsFor(household);
    setBusy(true);

    // First change for this family: record every function, then remove the one
    // being unticked, so "all" becomes an explicit list.
    if (rows.length === 0) {
      const all = (events.data ?? []).filter((e) => e.id !== eventId);
      const { error } = await supabase
        .from("household_event_invites")
        .insert(all.map((e) => ({ household, event_id: e.id })));
      setBusy(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      await refresh();
      return;
    }

    const existing = rows.find((r) => r.event_id === eventId);
    const { error } = existing
      ? await supabase.from("household_event_invites").delete().eq("id", existing.id)
      : await supabase.from("household_event_invites").insert({ household, event_id: eventId });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refresh();
  };

  const inviteToAll = async (household: string) => {
    setBusy(true);
    const { error } = await supabase
      .from("household_event_invites")
      .delete()
      .eq("household", household);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${household} can see every function.`);
    await refresh();
  };

  const everyoneTo = async (eventId: string, eventName: string) => {
    setBusy(true);
    const rows = families
      .filter((f) => rowsFor(f.household).length > 0)
      .filter((f) => !rowsFor(f.household).some((r) => r.event_id === eventId))
      .map((f) => ({ household: f.household, event_id: eventId }));
    if (rows.length === 0) {
      setBusy(false);
      toast.success(`Everyone already sees ${eventName}.`);
      return;
    }
    const { error } = await supabase.from("household_event_invites").insert(rows);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Added ${rows.length} famil${rows.length === 1 ? "y" : "ies"} to ${eventName}.`);
    await refresh();
  };

  const countFor = (eventId: string) =>
    families.filter((f) => isTicked(f.household, eventId)).length;

  return (
    <div className="space-y-6">
      <div className="panel p-6">
        <h2 className="text-xl">Who is invited to what</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Tick the functions each family is invited to. They'll only see those functions — and only
          the outfits for those functions. A family with nothing ticked sees every function.
        </p>
        <div className="mt-4 max-w-sm">
          <Input
            value={filter}
            placeholder="Find a family or a name…"
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      </div>

      <div className="panel overflow-x-auto p-0">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="p-4 font-normal text-muted-foreground">
                Family ({visible.length})
              </th>
              {(events.data ?? []).map((ev) => (
                <th key={ev.id} className="p-4 font-normal">
                  <span className="block">{ev.name}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {countFor(ev.id)} invited
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => everyoneTo(ev.id, ev.name)}
                    className="mt-1 text-xs text-primary underline-offset-4 hover:underline"
                  >
                    Invite everyone
                  </button>
                </th>
              ))}
              <th className="p-4 font-normal text-muted-foreground">All</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((f) => (
              <tr key={f.household} className="border-b border-border last:border-0">
                <td className="p-4">
                  <p>{f.household}</p>
                  {f.names.length > 0 ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">{f.names.join(", ")}</p>
                  ) : null}
                </td>
                {(events.data ?? []).map((ev) => (
                  <td key={ev.id} className="p-4">
                    <Checkbox
                      checked={isTicked(f.household, ev.id)}
                      disabled={busy}
                      aria-label={`${f.household} invited to ${ev.name}`}
                      onCheckedChange={() => toggle(f.household, ev.id)}
                    />
                  </td>
                ))}
                <td className="p-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy || rowsFor(f.household).length === 0}
                    onClick={() => inviteToAll(f.household)}
                  >
                    All functions
                  </Button>
                </td>
              </tr>
            ))}
            {visible.length === 0 ? (
              <tr>
                <td className="p-4 text-sm text-muted-foreground" colSpan={(events.data?.length ?? 0) + 2}>
                  No families match that search.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
