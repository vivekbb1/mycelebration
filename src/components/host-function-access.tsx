import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useSelectedEvent } from "@/lib/selected-event";

/**
 * Which families are invited to which events. A family with no ticks at all
 * is treated as invited to everything, so nothing breaks for families you
 * haven't looked at yet.
 */
export function HostFunctionAccess() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [pickedFamilies, setPickedFamilies] = useState<Set<string>>(new Set());
  const [pickedEvents, setPickedEvents] = useState<Set<string>>(new Set());
  const { inviteId: selectedInvite } = useSelectedEvent();

  const events = useQuery({
    queryKey: ["events", selectedInvite],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, name, event_date, sort_order, invite_id")
        .order("sort_order");
      if (error) throw error;
      // Only the celebration being worked on, so ticks never land on another one.
      return (data ?? []).filter((e) => !selectedInvite || e.invite_id === selectedInvite);
    },
  });

  const guests = useQuery({
    queryKey: ["invites-households", selectedInvite],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invite_codes")
        .select("id, guest_name, household, invite_id")
        .order("household");
      if (error) throw error;
      return (data ?? []).filter((g) => !selectedInvite || g.invite_id === selectedInvite);
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

  /** Does this family get to choose an outfit for this event? Default: yes. */
  const picksOutfit = (household: string, eventId: string) => {
    const row = rowsFor(household).find((r) => r.event_id === eventId);
    return row ? row.outfit_selection !== false : true;
  };

  const toggleOutfit = async (household: string, eventId: string) => {
    const rows = rowsFor(household);
    setBusy(true);

    // No explicit choices yet: write a row for every event first, so the
    // "no outfit selection" flag has somewhere to live.
    if (rows.length === 0) {
      const { error } = await supabase.from("household_event_invites").insert(
        (events.data ?? []).map((e) => ({
          household,
          event_id: e.id,
          outfit_selection: e.id !== eventId,
        })),
      );
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
      ? await supabase
          .from("household_event_invites")
          .update({ outfit_selection: existing.outfit_selection === false })
          .eq("id", existing.id)
      : await supabase
          .from("household_event_invites")
          .insert({ household, event_id: eventId, outfit_selection: false });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refresh();
  };

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["household-event-invites"] });
  };

  const toggle = async (household: string, eventId: string) => {
    const rows = rowsFor(household);
    setBusy(true);

    // First change for this family: record every event, then remove the one
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
    toast.success(`${household} can see every event.`);
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

  /**
   * Bulk assign: apply the chosen events to every picked family at once.
   * "add" keeps what they already had, "remove" takes those events away,
   * "only" replaces their list with exactly the chosen events.
   */
  const applyBulk = async (mode: "add" | "remove" | "only") => {
    const all = (events.data ?? []).map((e) => e.id);
    const chosen = all.filter((id) => pickedEvents.has(id));
    const households = visible.map((f) => f.household).filter((h) => pickedFamilies.has(h));
    if (households.length === 0 || chosen.length === 0) return;

    setBusy(true);
    for (const household of households) {
      const rows = rowsFor(household).filter((r) => all.includes(r.event_id));
      const current = rows.length === 0 ? new Set(all) : new Set(rows.map((r) => r.event_id));
      const next = new Set(
        mode === "only"
          ? chosen
          : mode === "add"
            ? [...current, ...chosen]
            : all.filter((id) => current.has(id) && !chosen.includes(id)),
      );

      // Everything ticked is stored as "no rows at all", which means every event.
      const keepsEverything = all.every((id) => next.has(id));
      const { error: wipe } = await supabase
        .from("household_event_invites")
        .delete()
        .eq("household", household)
        .in("event_id", all);
      if (wipe) {
        setBusy(false);
        toast.error(wipe.message);
        return;
      }
      if (!keepsEverything && next.size > 0) {
        const { error } = await supabase.from("household_event_invites").insert(
          [...next].map((id) => ({
            household,
            event_id: id,
            outfit_selection: rows.find((r) => r.event_id === id)?.outfit_selection ?? true,
          })),
        );
        if (error) {
          setBusy(false);
          toast.error(error.message);
          return;
        }
      }
    }
    setBusy(false);
    toast.success(
      `Updated ${households.length} famil${households.length === 1 ? "y" : "ies"}.`,
    );
    setPickedFamilies(new Set());
    setPickedEvents(new Set());
    await refresh();
  };


  return (
    <div className="space-y-6">
      <div className="panel p-4 sm:p-6">
        <h2 className="text-xl">Assign guests to events</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Tick the events each family is invited to. They'll only see those events — and only
          the outfits for those days. A family with nothing ticked sees every event. Under
          each tick you can also decide whether that family chooses an outfit from you for that
          day, or wears their own.
        </p>
        <div className="mt-4 max-w-sm">
          <Input
            value={filter}
            placeholder="Find a family or a name…"
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      </div>

      <div className="panel space-y-4 p-4 sm:p-6">
        <div>
          <h3 className="text-lg">Assign several at once</h3>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Tick the families in the list below, choose the events here, then say what to do.
            Picking a person's family covers everyone in it.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {(events.data ?? []).map((ev) => {
            const on = pickedEvents.has(ev.id);
            return (
              <button
                key={ev.id}
                type="button"
                onClick={() =>
                  setPickedEvents((prev) => {
                    const next = new Set(prev);
                    if (next.has(ev.id)) next.delete(ev.id);
                    else next.add(ev.id);
                    return next;
                  })
                }
                className={`rounded-full border px-3 py-1.5 text-xs transition ${
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-primary/50"
                }`}
              >
                {ev.name}
              </button>
            );
          })}
          {(events.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Add some events first.</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            disabled={busy || pickedFamilies.size === 0 || pickedEvents.size === 0}
            onClick={() => applyBulk("add")}
          >
            Add to these events
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy || pickedFamilies.size === 0 || pickedEvents.size === 0}
            onClick={() => applyBulk("only")}
          >
            Only these events
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy || pickedFamilies.size === 0 || pickedEvents.size === 0}
            onClick={() => applyBulk("remove")}
          >
            Remove from these events
          </Button>
          <span className="text-xs text-muted-foreground">
            {pickedFamilies.size} famil{pickedFamilies.size === 1 ? "y" : "ies"} ·{" "}
            {pickedEvents.size} event{pickedEvents.size === 1 ? "" : "s"} picked
          </span>
          {pickedFamilies.size > 0 || pickedEvents.size > 0 ? (
            <button
              type="button"
              onClick={() => {
                setPickedFamilies(new Set());
                setPickedEvents(new Set());
              }}
              className="text-xs text-primary underline-offset-4 hover:underline"
            >
              Clear
            </button>
          ) : null}
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
                  <td key={ev.id} className="p-4 align-top">
                    <Checkbox
                      checked={isTicked(f.household, ev.id)}
                      disabled={busy}
                      aria-label={`${f.household} invited to ${ev.name}`}
                      onCheckedChange={() => toggle(f.household, ev.id)}
                    />
                    {isTicked(f.household, ev.id) ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => toggleOutfit(f.household, ev.id)}
                        className={`mt-2 block text-xs underline-offset-4 hover:underline ${
                          picksOutfit(f.household, ev.id) ? "text-primary" : "text-muted-foreground"
                        }`}
                      >
                        {picksOutfit(f.household, ev.id) ? "Outfit from you" : "Own outfit"}
                      </button>
                    ) : null}
                  </td>
                ))}
                <td className="p-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy || rowsFor(f.household).length === 0}
                    onClick={() => inviteToAll(f.household)}
                  >
                    All events
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
