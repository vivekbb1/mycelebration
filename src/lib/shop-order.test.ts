import { it } from "node:test";
import { strictEqual, throws } from "node:assert";
import { orderTotals, validateOrder, type OrderItem } from "./shop-order";
const item = { price: 10000, discount: 1000 } as OrderItem;
it("subtracts discounts and part-payments from a grouped order", () => {
  const t = orderTotals([item, { ...item, price: 5000, discount: 500 }], [{ amount: 3000, date: "2026-10-19", reference: "deposit" }]);
  strictEqual(t.total, 13500); strictEqual(t.paid, 3000); strictEqual(t.balance, 10500);
});
it("rejects discounts exceeding the outfit price", () => throws(() => validateOrder([{ ...item, discount: 10001 }], [])));
it("rejects part-payments exceeding the discounted total", () => throws(() => validateOrder([item], [{ amount: 9001, date: "2026-10-19", reference: "" }])));