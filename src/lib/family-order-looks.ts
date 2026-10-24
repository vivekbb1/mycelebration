import { orderTotals, type OrderItem, type OrderPayment } from "./shop-order";

export type ReportOrder = {
  id: string; reference: string; seller_reference: string; shop_name: string;
  status: string; currency: string; courier_charges: number;
  items: OrderItem[]; payments: OrderPayment[];
};

/** Payments belong to whole orders, never implicitly to one wearer or family. */
export function familyOrderLooks(orders: ReportOrder[], candidates: OrderItem[], matches?: (item: OrderItem, order: ReportOrder) => boolean) {
  const current = new Map(candidates.map((item) => [item.reservationId, item]));
  const families = new Map<string, { family: string; rows: { order: ReportOrder; item: OrderItem; wearer: string }[]; amounts: Map<string, number> }>();
  for (const order of orders) {
    if (order.status === "cancelled") continue;
    for (const item of order.items) {
      if (matches && !matches(item, order)) continue;
      const person = current.get(item.reservationId);
      const family = (person?.family ?? item.family)?.trim() || "No family";
      const row = families.get(family) ?? { family, rows: [], amounts: new Map<string, number>() };
      row.rows.push({ order, item, wearer: person?.wearer ?? item.wearer });
      const value = orderTotals([item], []).total;
      row.amounts.set(order.currency, Math.round(((row.amounts.get(order.currency) ?? 0) + value) * 100) / 100);
      families.set(family, row);
    }
  }
  return [...families.values()].sort((a, b) => a.family.localeCompare(b.family));
}