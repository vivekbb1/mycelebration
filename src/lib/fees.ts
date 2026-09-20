/**
 * Celebration fees. A fee row is either charged to the guests (audience "guest") or
 * to the host by the platform owner (audience "host"). Each row can carry a
 * flat amount for the whole celebration or for one event, plus an amount per
 * person, so hosts can mix "flat per celebration", "per head" and "per event".
 */
export type FeeRule = {
  id: string;
  invite_id: string;
  event_id: string | null;
  audience: string;
  label: string;
  currency: string;
  base_amount: number;
  per_guest_amount: number;
  note: string | null;
  active: boolean;
};

export const CURRENCIES = ["INR", "AED", "USD", "GBP", "EUR"] as const;

export function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount)}`;
  }
}

export type FeeLine = { label: string; amount: number; currency: string; detail: string };

/**
 * What one household owes: every active guest fee for the celebration, applied to
 * the head count they gave for each event (or their family size when a fee
 * covers the whole celebration).
 */
export function feeLinesFor({
  rules,
  eventNames,
  headsByEvent,
  familyHeads,
}: {
  rules: FeeRule[];
  eventNames: Map<string, string>;
  headsByEvent: Map<string, number>;
  familyHeads: number;
}): FeeLine[] {
  const lines: FeeLine[] = [];
  for (const rule of rules) {
    if (!rule.active || rule.audience !== "guest") continue;
    const heads = rule.event_id
      ? (headsByEvent.get(rule.event_id) ?? 0)
      : Math.max(familyHeads, 0);
    if (rule.event_id && heads <= 0) continue;
    const amount = Number(rule.base_amount ?? 0) + Number(rule.per_guest_amount ?? 0) * heads;
    if (amount <= 0) continue;
    const bits: string[] = [];
    if (Number(rule.base_amount) > 0)
      bits.push(`${formatMoney(Number(rule.base_amount), rule.currency)} flat`);
    if (Number(rule.per_guest_amount) > 0)
      bits.push(
        `${formatMoney(Number(rule.per_guest_amount), rule.currency)} × ${heads} ${
          heads === 1 ? "person" : "people"
        }`,
      );
    lines.push({
      label: rule.event_id ? (eventNames.get(rule.event_id) ?? rule.label) : rule.label,
      amount,
      currency: rule.currency,
      detail: bits.join(" + "),
    });
  }
  return lines;
}

export function totalByCurrency(lines: FeeLine[]) {
  const map = new Map<string, number>();
  for (const l of lines) map.set(l.currency, (map.get(l.currency) ?? 0) + l.amount);
  return [...map.entries()];
}
