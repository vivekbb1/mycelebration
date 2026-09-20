/**
 * Turns whatever events the host has entered into the one-line summaries the
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

/**
 * The small line above the heading. Derived from the guest's own events, so a
 * single-day celebration never reads "weekend" and a fortnight of events never does either.
 */
export function scheduleEyebrow(events: ScheduleEvent[]): string {
  const dates = [
    ...new Set(events.map((e) => e.event_date).filter((d): d is string => Boolean(d))),
  ].sort();

  if (events.length === 0) return "Your invitation";
  if (dates.length === 0) return events.length === 1 ? "Your event" : "Your events";
  if (dates.length === 1) return "The wedding day";

  const first = day(dates[0] as string);
  const last = day(dates[dates.length - 1] as string);
  const span = Math.round((last.getTime() - first.getTime()) / 86400000) + 1;

  // Only call it a weekend when it really is a short run ending on a Sat/Sun.
  const endsOnWeekend = last.getDay() === 0 || last.getDay() === 6;
  if (span <= 4 && endsOnWeekend) return "The wedding weekend";
  if (span <= 4) return "The wedding days";
  return "The wedding celebrations";
}

/** e.g. "Four events across three days, four dress codes." */
export function scheduleSummary(events: ScheduleEvent[]): string {
  if (events.length === 0) return "The events are still being finalised.";

  const days = new Set(events.map((e) => e.event_date).filter(Boolean)).size;
  const codes = new Set(events.map((e) => e.dress_code).filter(Boolean)).size;

  const parts = [`${asWord(events.length)} event${events.length === 1 ? "" : "s"}`];
  if (days > 1) parts.push(`across ${asWord(days).toLowerCase()} days`);
  if (codes > 0)
    parts.push(`${asWord(codes).toLowerCase()} dress code${codes === 1 ? "" : "s"}`);

  return `${parts.join(", ").replace(/^(\w)/, (m) => m.toUpperCase())}.`;
}
