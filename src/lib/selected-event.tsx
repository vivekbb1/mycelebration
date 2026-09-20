import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { useInvites } from "@/components/host-invites";
import { Label } from "@/components/ui/label";

type Ctx = {
  /** The event every host screen is currently working on, or "" for all. */
  inviteId: string;
  setInviteId: (id: string) => void;
  ready: boolean;
};

const SelectedEvent = createContext<Ctx>({ inviteId: "", setInviteId: () => {}, ready: false });

const KEY = "host.selected-event";

/**
 * Keeps one chosen event across the host tabs, so functions, guests, wardrobe
 * and setup all show and save against the same celebration.
 */
export function SelectedEventProvider({ children }: { children: ReactNode }) {
  const invites = useInvites();
  const [inviteId, setInviteId] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded) return;
    const stored = typeof window === "undefined" ? null : window.localStorage.getItem(KEY);
    if (stored) setInviteId(stored);
    setLoaded(true);
  }, [loaded]);

  // Fall back to the first event once the list arrives, or when the stored one is gone.
  useEffect(() => {
    const list = invites.data ?? [];
    if (!loaded || list.length === 0) return;
    if (!inviteId || !list.some((i) => i.id === inviteId)) setInviteId(list[0]!.id);
  }, [invites.data, inviteId, loaded]);

  useEffect(() => {
    if (!loaded || typeof window === "undefined") return;
    if (inviteId) window.localStorage.setItem(KEY, inviteId);
  }, [inviteId, loaded]);

  const value = useMemo(
    () => ({ inviteId, setInviteId, ready: loaded && !invites.isLoading }),
    [inviteId, loaded, invites.isLoading],
  );

  return <SelectedEvent.Provider value={value}>{children}</SelectedEvent.Provider>;
}

/** The event the host is working on. Returns "" outside the host area. */
export function useSelectedEvent() {
  return useContext(SelectedEvent);
}

/** Keeps rows whose event matches the chosen one; rows with no event stay. */
export function matchesSelectedEvent(rowInviteId: string | null, selected: string) {
  if (!selected) return true;
  if (!rowInviteId) return true;
  return rowInviteId === selected;
}

/** The one place a host chooses which celebration they're working on. */
export function EventPicker() {
  const { inviteId, setInviteId } = useSelectedEvent();
  const invites = useInvites();
  const list = invites.data ?? [];

  return (
    <div className="panel mt-6 flex flex-wrap items-center gap-3 p-3 sm:p-4">
      <Label htmlFor="host-event" className="text-xs text-muted-foreground">
        Working on
      </Label>
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No event yet — create one under the Event tab.
        </p>
      ) : (
        <select
          id="host-event"
          className="field-select w-full sm:w-64"
          value={inviteId}
          onChange={(e) => setInviteId(e.target.value)}
        >
          {list.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      )}
      <p className="w-full text-xs text-muted-foreground sm:w-auto">
        Functions, guests, wardrobe and setup all apply to this event.
      </p>
    </div>
  );
}
