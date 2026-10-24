/** Orders people as they appear in the invitation (first added first) and events in schedule order. */
export type SequencePerson = { guest_name: string; household?: string | null; created_at: string };
export type SequenceEvent = { name: string; sort_order: number; event_date?: string | null };
export type Sequencer = { person: (wearer: string) => number; event: (event: string) => number; compare: (a: { wearer: string; event: string }, b: { wearer: string; event: string }) => number };

const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
const LAST = Number.MAX_SAFE_INTEGER;

export function makeSequencer(people: SequencePerson[], events: SequenceEvent[]): Sequencer {
  const personRank = new Map<string, number>();
  [...people].sort((a, b) => a.created_at.localeCompare(b.created_at)).forEach((p, i) => { const k = key(p.guest_name); if (!personRank.has(k)) personRank.set(k, i); });
  const eventRank = new Map<string, number>();
  [...events].sort((a, b) => a.sort_order - b.sort_order || (a.event_date ?? "").localeCompare(b.event_date ?? "")).forEach((e, i) => { const k = key(e.name); if (!eventRank.has(k)) eventRank.set(k, i); });
  const person = (w: string) => personRank.get(key(w)) ?? LAST;
  const event = (e: string) => eventRank.get(key(e)) ?? LAST;
  return {
    person, event,
    compare: (a, b) => person(a.wearer) - person(b.wearer) || a.wearer.localeCompare(b.wearer) || event(a.event) - event(b.event) || a.event.localeCompare(b.event),
  };
}

/** Fallback when invitation/schedule data isn't loaded yet: alphabetical person, then event. */
export const alphabetical: Sequencer = makeSequencer([], []);
