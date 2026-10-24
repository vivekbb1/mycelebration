import { it } from "node:test";
import { strictEqual } from "node:assert";
import { familyOrderLooks, type ReportOrder } from "./family-order-looks";
import { orderTotals, type OrderItem } from "./shop-order";

const item = { reservationId: "a", wearer: "Old name", family: "Old family", price: 10000, discount: 1000, title: "Original", size: "M", alternative: { title: "Replacement", sku: "ALT" }, addOns: [{ id: "t", label: "Trousers", price: 3000, discount: 500 }] } as OrderItem;
const order: ReportOrder = { id: "1", reference: "ORDER-1", seller_reference: "", shop_name: "", currency: "INR", status: "placed", courier_charges: 500, items: [item, { ...item, reservationId: "b", family: "Second", addOns: [] }], payments: [{ amount: 3000, kind: "advance", date: "2026-10-24", reference: "" }, { amount: 2000, date: "2026-10-24", reference: "" }] };
it("links original, replacement and extras to the current person and merged family", () => {
  const report = familyOrderLooks([order], [{ ...item, family: "Merged", wearer: "Current name" }]);
  const family = report.find((f) => f.family === "Merged");
  strictEqual(family?.rows[0]?.wearer, "Current name");
  strictEqual(family?.rows[0]?.item.title, "Original");
  strictEqual(family?.rows[0]?.item.size, "M");
  strictEqual(family?.rows[0]?.item.alternative?.sku, "ALT");
  strictEqual(family?.rows[0]?.item.addOns?.[0]?.id, "t");
  strictEqual(family?.amounts.get("INR"), 11500);
});
it("keeps recorded payments and courier at whole-order level for shared families", () => {
  const report = familyOrderLooks([order], []);
  strictEqual(report.length, 2);
  const linked = report[0]?.rows[0]?.order;
  if (!linked) throw new Error("Missing order");
  const totals = orderTotals(linked.items, linked.payments, linked.courier_charges);
  strictEqual(totals.total, 21000);
  strictEqual(totals.paid, 5000);
  strictEqual(totals.balance, 16000);
  strictEqual(totals.advance, 3000);
});
it("excludes cancelled orders and keeps currencies separate", () => {
  const report = familyOrderLooks([order, { ...order, id: "cancelled", status: "cancelled" }, { ...order, id: "2", currency: "AED" }], []);
  const family = report.find((f) => f.family === "Old family");
  strictEqual(family?.rows.length, 2);
  strictEqual(family?.amounts.get("INR"), 11500);
  strictEqual(family?.amounts.get("AED"), 11500);
});