/**
 * Turns whatever functions the host has entered into the one-line summaries the
 * guest pages show, so no date, city or count is ever hard-coded.
 */

export type ScheduleEvent = {
  name?: string | null;
  event_date?: string | null;
  venue?: string | null;
  dress_code?: string | null;
};

const NUMBER_WORDS = [
  "No",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
];

const asWord = (n: number) => NUMBER_WORDS[n] ?? String(n);

const day = (iso: string) => new Date(`${iso}T00:00:00`);

/** e.g. "11–13 February 2027 · Devi Ratn" or "14 March 2027". */
export function scheduleHeadline(events: ScheduleEvent[]): string {
  const dates = events
    .map((e) => e.event_date)
    .filter((d): d is string => Boolean(d))
    .sort();

  const places = [...new Set(events.map((e) => e.venue).filter((v): v is string => Boolean(v)))];
  const place = places.length === 1 ? places[0] : null;

  if (dates.length === 0) {
    return place ? `Dates to be confirmed · ${place}` : "Dates to be confirmed";
  }

  const first = day(dates[0] as string);
  const last = day(dates[dates.length - 1] as string);
  const sameDay = dates[0] === dates[dates.length - 1];
  const sameMonth =
    first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear();

  const long = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const range = sameDay
    ? long(first)
    : sameMonth
      ? `${first.getDate()}–${long(last)}`
      : `${first.toLocaleDateString("en-GB", { day: "numeric", month: "long" })} – ${long(last)}`;

  return place ? `${range} · ${place}` : range;
}

/** e.g. "Four functions across three days, four dress codes." */
export function scheduleSummary(events: ScheduleEvent[]): string {
  if (events.length === 0) return "The functions are still being finalised.";

  const days = new Set(events.map((e) => e.event_date).filter(Boolean)).size;
  const codes = new Set(events.map((e) => e.dress_code).filter(Boolean)).size;

  const parts = [`${asWord(events.length)} function${events.length === 1 ? "" : "s"}`];
  if (days > 1) parts.push(`across ${asWord(days).toLowerCase()} days`);
  if (codes > 0)
    parts.push(`${asWord(codes).toLowerCase()} dress code${codes === 1 ? "" : "s"}`);

  return `${parts.join(", ").replace(/^(\w)/, (m) => m.toUpperCase())}.`;
}
