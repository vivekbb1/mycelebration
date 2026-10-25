/** Order-only replacement: what the shop actually supplies instead of the guest's chosen look. */
export type OrderAlternative = { title: string; sku: string; designer: string; shop: string; image: string; outfitId?: string | null };
/** Extra piece ordered for a wearer's look (e.g. trousers for a kurta sold without them). Host-only. */
export type OrderAddOn = { id: string; label: string; sku: string; size: string; shop: string; price: number; discount: number; notes: string };
export type OrderItem = { reservationId: string; wearer: string; family: string; event: string; title: string; designer: string; sku: string; size: string; orderedSize?: string; originalPrice?: number | null; shop: string; image: string; price: number; discount: number; measurements: Record<string, string | number> | null; notes: string; alternative?: OrderAlternative | null; addOns?: OrderAddOn[];
  /** Per-look delivery tracking (host-only). */
  expectedDelivery?: string; arrivedOn?: string; tracking?: string; courierName?: string; trackingUrl?: string;
  /** Host ticked that a non-set look was completed offline (host-only). */
  setHandled?: boolean;
  /** Note shown to the wearer: accessories to carry, styling tips. Mirrored to their look once placed. */
  wearerNote?: string };

/** Photo enrichment is optional: malformed links and shop failures must not block an order save. */
export async function enrichOrderAlternative(item: OrderItem, fetchLook: (url: URL) => Promise<{ images: string[]; sku: string; designer: string } | null>): Promise<OrderItem> {
  const alt = item.alternative;
  if (!alt || alt.outfitId || alt.image || !alt.shop) return item;
  try {
    const url = new URL(alt.shop);
    if (url.protocol !== "https:" && url.protocol !== "http:") return item;
    const look = await fetchLook(url);
    return look ? { ...item, alternative: { ...alt, image: look.images[0] ?? "", sku: alt.sku || look.sku, designer: alt.designer || look.designer } } : item;
  } catch {
    // Retain the host's replacement details; explicit Fetch still reports lookup errors.
    return item;
  }
}

/** Revised vendor price changes never replace the original upload snapshot. */
export function setRevisedPrice(items: OrderItem[], reservationId: string, price: number) {
  return items.map((item) => item.reservationId === reservationId ? { ...item, price } : item);
}

/** Shop sizing is order-only; never overwrite the guest's selected size. */
export function setOrderedSize(items: OrderItem[], reservationId: string, orderedSize: string) {
  return items.map((item) => item.reservationId === reservationId ? { ...item, orderedSize } : item);
}

/** Swap what the shop supplies for one wearer; the guest's own choice stays untouched. */
export function setAlternative(items: OrderItem[], reservationId: string, alternative: OrderAlternative | null) {
  return items.map((item) => item.reservationId === reservationId ? { ...item, alternative } : item);
}

export function addAddOn(items: OrderItem[], reservationId: string, addOn: OrderAddOn) {
  return items.map((item) => item.reservationId === reservationId ? { ...item, addOns: [...(item.addOns ?? []), addOn] } : item);
}
export function updateAddOn(items: OrderItem[], reservationId: string, id: string, patch: Partial<OrderAddOn>) {
  return items.map((item) => item.reservationId === reservationId ? { ...item, addOns: (item.addOns ?? []).map((a) => a.id === id ? { ...a, ...patch } : a) } : item);
}
export function removeAddOn(items: OrderItem[], reservationId: string, id: string) {
  return items.map((item) => item.reservationId === reservationId ? { ...item, addOns: (item.addOns ?? []).filter((a) => a.id !== id) } : item);
}
export type PaymentKind = "advance" | "payment";
export type OrderPayment = { amount: number; date: string; reference: string; kind?: PaymentKind };
export type DocKind = "proforma" | "invoice" | "bill" | "receipt" | "other";
export type OrderDocument = { kind: DocKind; path: string; name: string; number: string; amount: number | null; date: string };

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Order value = outfit + extra-item prices − discounts + courier charges; payments (advance included) reduce the balance. */
export function orderTotals(items: OrderItem[], payments: OrderPayment[], courier = 0) {
  const gross = r2(items.reduce((s, i) => s + i.price + (i.addOns ?? []).reduce((a, x) => a + x.price, 0), 0));
  const discount = r2(items.reduce((s, i) => s + i.discount + (i.addOns ?? []).reduce((a, x) => a + x.discount, 0), 0));

  const total = r2(gross - discount + (courier || 0));
  const paid = r2(payments.reduce((s, p) => s + p.amount, 0));
  const advance = r2(payments.filter((p) => p.kind === "advance").reduce((s, p) => s + p.amount, 0));
  return { gross, discount, courier: courier || 0, total, paid, advance, balance: r2(total - paid) };
}

export function validateOrder(items: OrderItem[], payments: OrderPayment[], courier = 0) {
  if (!items.length) throw new Error("Select at least one outfit");
  for (const i of items) {
    if (!Number.isFinite(i.price) || !Number.isFinite(i.discount) || i.price < 0 || i.discount < 0 || i.discount > i.price) throw new Error("Discount must be between zero and the outfit price");
    for (const a of i.addOns ?? []) {
      if (!a.label.trim()) throw new Error("Name each extra item (for example Trousers)");
      if (!Number.isFinite(a.price) || !Number.isFinite(a.discount) || a.price < 0 || a.discount < 0 || a.discount > a.price) throw new Error("Extra item discount must be between zero and its price");
    }
    if (i.alternative && !i.alternative.title.trim() && !i.alternative.sku.trim()) throw new Error("Give the alternative outfit a name or model number");
  }
  if (!Number.isFinite(courier) || courier < 0) throw new Error("Courier charges can't be negative");
  for (const p of payments) if (!Number.isFinite(p.amount) || p.amount <= 0) throw new Error("Payment must be greater than zero");
  if (orderTotals(items, payments, courier).balance < 0) throw new Error("Payments cannot exceed the order total");
}

/** Swap one outfit in an order for another, keeping its position. */
export function substituteItem(items: OrderItem[], outId: string, next: OrderItem) {
  if (items.some((i) => i.reservationId === next.reservationId)) throw new Error("That outfit is already in this order");
  return items.map((i) => (i.reservationId === outId ? next : i));
}

/** Indian digit grouping (xx,xx,xxx.xx) for INR; standard grouping otherwise. */
export function nf(currency = "INR"): [string, Intl.NumberFormatOptions] {
  return [currency === "INR" ? "en-IN" : "en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }];
}
export const money = (n: number, currency = "INR") => n.toLocaleString(...nf(currency));

/** Discounted amount ordered per family (looks + extra items) across the given orders' items. */
export function familyOrderReport(orders: OrderItem[][], familyOf?: (item: OrderItem) => string | undefined) {
  const map = new Map<string, { family: string; people: Set<string>; looks: number; extras: number; amount: number }>();
  for (const i of orders.flat()) {
    const family = (familyOf?.(i) ?? i.family)?.trim() || "No family";
    const row = map.get(family) ?? { family, people: new Set(), looks: 0, extras: 0, amount: 0 };
    row.people.add(i.wearer); row.looks++; row.extras += (i.addOns ?? []).length;
    row.amount = r2(row.amount + i.price - i.discount + (i.addOns ?? []).reduce((s, a) => s + a.price - a.discount, 0));
    map.set(family, row);
  }
  return [...map.values()].map((r) => ({ ...r, people: [...r.people].sort() })).sort((a, b) => b.amount - a.amount);
}
