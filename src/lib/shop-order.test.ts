import { it } from "node:test";
import { strictEqual, throws } from "node:assert";
import { orderTotals, substituteItem, validateOrder, type OrderItem } from "./shop-order";
const item = { price: 10000, discount: 1000 } as OrderItem;
it("subtracts discounts and part-payments from a grouped order", () => {
  const t = orderTotals([item, { ...item, price: 5000, discount: 500 }], [{ amount: 3000, date: "2026-10-19", reference: "deposit" }]);
  strictEqual(t.total, 13500); strictEqual(t.paid, 3000); strictEqual(t.balance, 10500);
});
it("rejects discounts exceeding the outfit price", () => throws(() => validateOrder([{ ...item, discount: 10001 }], [])));
it("rejects part-payments exceeding the discounted total", () => throws(() => validateOrder([item], [{ amount: 9001, date: "2026-10-19", reference: "" }])));
it("adds courier charges to the order total and tracks the advance", () => {
  const t = orderTotals([item], [{ amount: 2000, date: "2026-10-19", reference: "", kind: "advance" }, { amount: 1000, date: "2026-10-20", reference: "" }], 500);
  strictEqual(t.total, 9500); strictEqual(t.advance, 2000); strictEqual(t.balance, 6500);
});
it("allows payments up to the total including courier", () => {
  validateOrder([item], [{ amount: 9500, date: "2026-10-19", reference: "" }], 500);
  throws(() => validateOrder([item], [{ amount: 9501, date: "2026-10-19", reference: "" }], 500));
});
it("substitutes an outfit in place and refuses duplicates", () => {
  const a = { ...item, reservationId: "a" }, b = { ...item, reservationId: "b" }, c = { ...item, reservationId: "c" };
  strictEqual(substituteItem([a, b], "a", c)[0]?.reservationId, "c");
  throws(() => substituteItem([a, b], "a", b));
});
