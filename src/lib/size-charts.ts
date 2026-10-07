// Standard size charts (copied from Pernia's Pop-Up Shop), measurements in inches.
export type ShopSize = {
  label: string;
  available: boolean;
  ready_to_ship?: boolean;
  ships_by?: string | null;
};

export type ChartForm = "women" | "men";

type Range = [number, number];
export type ChartRow = { size: string; uk?: number; bust?: Range; chest?: Range; waist: Range; neck?: Range; hip: Range };

const r = (a: number, b = a): Range => [a, b];

export const WOMEN_CHART: ChartRow[] = [
  ["XS", 4, 32, 26, 36], ["S", 6, 34, 28, 38], ["M", 8, 36, 30, 40], ["L", 10, 38, 32, 42],
  ["XL", 12, 40, 34, 44], ["XXL", 14, 42, 36, 46], ["3XL", 16, 44, 38, 48], ["4XL", 18, 46, 40, 50],
  ["5XL", 20, 48, 42, 52], ["6XL", 22, 50, 44, 54],
].map(([size, uk, bust, waist, hip]) => ({
  size: size as string, uk: uk as number, bust: r(bust as number), waist: r(waist as number), hip: r(hip as number),
}));

export const MEN_CHART: ChartRow[] = [
  ["XS", 36, 28, 30, 14, 36.5, 38.5], ["S", 38, 30, 32, 15, 38.5, 40.5], ["M", 40, 32, 34, 16, 40.5, 41.5],
  ["L", 42, 34, 36, 17, 41.5, 42.5], ["XL", 44, 36, 38, 18, 42.5, 43.5], ["XXL", 46, 38, 40, 19, 43.5, 44.5],
  ["3XL", 48, 40, 42, 20, 44.5, 46.5], ["4XL", 50, 42, 44, 21, 46.5, 48.5], ["5XL", 52, 44, 46, 22, 48.5, 50.5],
  ["6XL", 54, 46, 48, 23, 50.5, 52.5],
].map(([size, chest, w1, w2, neck, h1, h2]) => ({
  size: size as string, chest: r(chest as number), waist: r(w1 as number, w2 as number), neck: r(neck as number), hip: r(h1 as number, h2 as number),
}));

export const STANDARD_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL", "6XL"];
export const MADE_TO_MEASURE = "Made to measure";

/** Gender → which form/chart. Boys and girls use their own, but have no shop chart. */
export function formFor(gender: string | null | undefined): ChartForm {
  return gender === "men" || gender === "boy" ? "men" : "women";
}
export function hasChart(gender: string | null | undefined) {
  return gender !== "boy" && gender !== "girl";
}
export function chartFor(form: ChartForm) {
  return form === "men" ? MEN_CHART : WOMEN_CHART;
}

export const toInches = (v: number, unit: string | null | undefined) => (unit === "cm" ? v / 2.54 : v);
export const fmt = (n: number, unit: "cm" | "in") =>
  unit === "cm" ? String(Math.round(n * 2.54)) : String(Math.round(n * 10) / 10);
export const fmtRange = ([a, b]: Range, unit: "cm" | "in") =>
  a === b ? fmt(a, unit) : `${fmt(a, unit)}–${fmt(b, unit)}`;

type M = {
  unit?: string | null; bust?: number | null; chest?: number | null; waist?: number | null; hip?: number | null; neck?: number | null;
};

/**
 * Smallest size whose chart measurements cover every one the guest gave.
 * Returns `between` when the guest sits over one size on some measurement, so the larger was picked.
 */
export function suggestSize(m: M | null | undefined, form: ChartForm): { size: string; between: boolean } | null {
  if (!m) return null;
  const top = form === "men" ? (m.chest ?? m.bust) : (m.bust ?? m.chest);
  const given: Array<[keyof ChartRow, number]> = [];
  if (top) given.push([form === "men" ? "chest" : "bust", toInches(Number(top), m.unit)]);
  if (m.waist) given.push(["waist", toInches(Number(m.waist), m.unit)]);
  if (m.hip) given.push(["hip", toInches(Number(m.hip), m.unit)]);
  if (form === "men" && m.neck) given.push(["neck", toInches(Number(m.neck), m.unit)]);
  if (!given.length) return null;
  const chart = chartFor(form);
  let idx = 0;
  let between = false;
  for (const [key, val] of given) {
    let i = chart.findIndex((row) => val <= ((row[key] as Range | undefined)?.[1] ?? Infinity) + 0.25);
    if (i === -1) i = chart.length - 1;
    const exact = chart.findIndex((row) => {
      const rg = row[key] as Range | undefined;
      return rg ? val >= rg[0] - 0.25 && val <= rg[1] + 0.25 : false;
    });
    if (exact === -1) between = true;
    idx = Math.max(idx, i);
  }
  // Different measurements pointing at different sizes also counts as "between".
  const lows = given.map(([key, val]) => chart.findIndex((row) => val <= ((row[key] as Range | undefined)?.[1] ?? Infinity) + 0.25));
  if (new Set(lows).size > 1) between = true;
  return { size: chart[idx]!.size, between };
}

export const HOW_TO: Record<string, string> = {
  height: "Stand straight against a wall without shoes; measure from the floor to the top of the head.",
  bust: "Around the fullest part of the bust, tape level across the back.",
  under_bust: "Around the ribcage, right under the bust.",
  chest: "Under the arms, around the fullest part of the chest, tape level across the back.",
  neck: "Around the base of the neck, leaving one finger's room.",
  waist: "Around the natural waist — the narrowest part, just above the belly button.",
  hip: "Around the fullest part of the hips and seat, feet together.",
  shoulder: "Across the back, from one shoulder point to the other.",
  sleeve_length: "From the shoulder point down to where the sleeve should end.",
  armhole: "Around the arm where it joins the shoulder, tape under the armpit.",
  top_length: "From the highest point of the shoulder down to where the top should end.",
  bottom_length: "From the natural waist down to the floor, in the shoes you'll wear.",
  inseam: "Inner leg, from the crotch down to the ankle.",
};

export const TIPS = [
  "Measure over light, close-fitting clothing — not over a jacket or jumper.",
  "Keep the tape snug but not tight, and level all the way round.",
  "Ask someone to help; it's hard to measure yourself accurately.",
  "Stand relaxed and breathe normally.",
  "If you're between two sizes, choose the larger one — tailors can take it in.",
];
