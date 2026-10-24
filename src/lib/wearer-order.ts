import type { OrderItem } from "./shop-order";
import type { FamilyLookLine } from "./shop-order-pdf";

/** Replace only one look's wearer note; every other field and item stays as saved. */
export function setWearerNote(items: OrderItem[], reservationId: string, note: string): OrderItem[] {
  if (!items.some((i) => i.reservationId === reservationId)) throw new Error("This look is no longer in the order. Reopen it to continue");
  return items.map((i) => i.reservationId === reservationId ? { ...i, wearerNote: note.trim() } : i);
}

const norm = (s: string | undefined | null) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
/** Same person = same name within the same family (names alone repeat across families). */
export function sameWearer(a: { wearer: string; family: string }, b: { wearer: string; family: string }) {
  return norm(a.wearer) === norm(b.wearer) && norm(a.family) === norm(b.family);
}

type Sub = { original: { title?: string | null }; replacement: { title?: string | null; image?: string | null } } | undefined;
/** Guest-facing PDF line: photos, names, sizes, extras and note — never prices, model numbers or shops. */
export function wearerLookLine(item: OrderItem, wearer: string, sub?: Sub): FamilyLookLine {
  const alt = item.alternative ?? (sub ? { title: sub.replacement.title ?? "", image: sub.replacement.image ?? "" } : null);
  return {
    wearer, event: item.event, title: alt?.title || item.title, image: alt ? alt.image ?? "" : item.image,
    size: item.size, orderedSize: item.orderedSize ?? "", substituted: Boolean(alt),
    originalTitle: alt ? (item.alternative ? item.title : sub?.original.title || item.title) : "",
    extras: (item.addOns ?? []).map((a) => ({ label: !a.label || /^extra item$/i.test(a.label.trim()) ? "Additional piece to complete the look" : a.label, size: a.size })),
    note: (item.wearerNote ?? "").trim(),
  };
}
