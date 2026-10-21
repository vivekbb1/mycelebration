export type OrderItem = { reservationId: string; wearer: string; family: string; event: string; title: string; designer: string; sku: string; size: string; orderedSize?: string; originalPrice?: number | null; shop: string; image: string; price: number; discount: number; measurements: Record<string, string | number> | null; notes: string };

/** Revised vendor price changes never replace the original upload snapshot. */
export function setRevisedPrice(items: OrderItem[], reservationId: string, price: number) {
  return items.map((item) => item.reservationId === reservationId ? { ...item, price } : item);
}

/** Shop sizing is order-only; never overwrite the guest's selected size. */
export function setOrderedSize(items: OrderItem[], reservationId: string, orderedSize: string) {
  return items.map((item) => item.reservationId === reservationId ? { ...item, orderedSize } : item);
}
export type PaymentKind = "advance" | "payment";
export type OrderPayment = { amount: number; date: string; reference: string; kind?: PaymentKind };
export type DocKind = "proforma" | "invoice" | "bill" | "receipt" | "other";
export type OrderDocument = { kind: DocKind; path: string; name: string; number: string; amount: number | null; date: string };

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Order value = outfit prices − discounts + courier charges; payments (advance included) reduce the balance. */
export function orderTotals(items: OrderItem[], payments: OrderPayment[], courier = 0) {
  const gross = items.reduce((s, i) => s + i.price, 0);
  const discount = items.reduce((s, i) => s + i.discount, 0);
  const total = r2(gross - discount + (courier || 0));
  const paid = r2(payments.reduce((s, p) => s + p.amount, 0));
  const advance = r2(payments.filter((p) => p.kind === "advance").reduce((s, p) => s + p.amount, 0));
  return { gross, discount, courier: courier || 0, total, paid, advance, balance: r2(total - paid) };
}

export function validateOrder(items: OrderItem[], payments: OrderPayment[], courier = 0) {
  if (!items.length) throw new Error("Select at least one outfit");
  for (const i of items) if (!Number.isFinite(i.price) || !Number.isFinite(i.discount) || i.price < 0 || i.discount < 0 || i.discount > i.price) throw new Error("Discount must be between zero and the outfit price");
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
