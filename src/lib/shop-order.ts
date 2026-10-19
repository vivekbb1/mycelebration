export type OrderItem = { reservationId: string; wearer: string; family: string; event: string; title: string; designer: string; sku: string; size: string; shop: string; image: string; price: number; discount: number; measurements: Record<string, string | number> | null; notes: string };
export type OrderPayment = { amount: number; date: string; reference: string };
export function orderTotals(items: OrderItem[], payments: OrderPayment[]) {
  const gross = items.reduce((s, i) => s + i.price, 0);
  const discount = items.reduce((s, i) => s + i.discount, 0);
  const total = Math.round((gross - discount) * 100) / 100;
  const paid = Math.round(payments.reduce((s, p) => s + p.amount, 0) * 100) / 100;
  return { gross, discount, total, paid, balance: Math.round((total - paid) * 100) / 100 };
}
export function validateOrder(items: OrderItem[], payments: OrderPayment[]) {
  if (!items.length) throw new Error("Select at least one outfit");
  for (const i of items) if (!Number.isFinite(i.price) || !Number.isFinite(i.discount) || i.price < 0 || i.discount < 0 || i.discount > i.price) throw new Error("Discount must be between zero and the outfit price");
  for (const p of payments) if (!Number.isFinite(p.amount) || p.amount <= 0) throw new Error("Part-payment must be greater than zero");
  if (orderTotals(items, payments).balance < 0) throw new Error("Payments cannot exceed the discounted total");
}