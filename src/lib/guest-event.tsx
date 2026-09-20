import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";

const KEY = "guest.selected-event";

let chosen = "";
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Remembers which celebration a guest is looking at, across their tabs. */
export function setGuestEvent(id: string) {
  chosen = id;
  if (typeof window !== "undefined") window.localStorage.setItem(KEY, id);
  listeners.forEach((cb) => cb());
}

function readStored() {
  if (chosen) return chosen;
  if (typeof window === "undefined") return "";
  chosen = window.localStorage.getItem(KEY) ?? "";
  return chosen;
}

type GuestEvent = { id: string; name: string; eventIds: string[] };

/** The celebrations this guest is invited to, with the events inside each. */
function useGuestEvents() {
  return useQuery({
    queryKey: ["guest-events"],
    queryFn: async (): Promise<GuestEvent[]> => {
      const { data: allowed, error: allowedError } = await supabase.rpc("my_event_ids");
      if (allowedError) throw allowedError;
      const allowedIds = new Set(((allowed ?? []) as { event_id: string }[]).map((r) => r.event_id));

      const { data: functions, error: functionsError } = await supabase
        .from("events")
        .select("id, invite_id")
        .order("sort_order");
      if (functionsError) throw functionsError;

      const byInvite = new Map<string, string[]>();
      for (const row of functions ?? []) {
        if (allowedIds.size > 0 && !allowedIds.has(row.id)) continue;
        if (!row.invite_id) continue;
        const list = byInvite.get(row.invite_id) ?? [];
        list.push(row.id);
        byInvite.set(row.invite_id, list);
      }
      if (byInvite.size === 0) return [];

      const { data: invites, error: invitesError } = await supabase
        .from("invites")
        .select("id, name")
        .in("id", [...byInvite.keys()]);
      if (invitesError) throw invitesError;

      return (invites ?? []).map((i) => ({
        id: i.id,
        name: i.name ?? "Our wedding",
        eventIds: byInvite.get(i.id) ?? [],
      }));
    },
  });
}

/**
 * The celebration a guest is currently viewing, plus the events that belong
 * to it, so every guest page shows one celebration at a time.
 */
export function useGuestEvent() {
  const stored = useSyncExternalStore(
    subscribe,
    () => readStored(),
    () => "",
  );
  const events = useGuestEvents();
  const list = events.data ?? [];
  const inviteId = list.some((e) => e.id === stored) ? stored : (list[0]?.id ?? "");
  const current = list.find((e) => e.id === inviteId);
  const eventIds = new Set(current?.eventIds ?? []);

  /** Keeps an event when it belongs to the chosen celebration (or there's only one). */
  const allows = (eventId: string | null | undefined) => {
    if (list.length < 2 || eventIds.size === 0) return true;
    if (!eventId) return true;
    return eventIds.has(eventId);
  };

  return { inviteId, setInviteId: setGuestEvent, list, allows, loading: events.isLoading };
}

/** The guest's "which celebration" dropdown, shown only when they have more than one. */
export function GuestEventPicker() {
  const { inviteId, setInviteId, list } = useGuestEvent();
  if (list.length < 2) return null;

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="guest-event" className="sr-only">
        Which celebration
      </Label>
      <select
        id="guest-event"
        className="field-select h-9 max-w-[10rem] py-1 text-xs sm:max-w-[14rem] sm:text-sm"
        value={inviteId}
        onChange={(e) => setInviteId(e.target.value)}
      >
        {list.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>
    </div>
  );
}
