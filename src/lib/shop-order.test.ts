import { it } from "node:test";
import { strictEqual, throws } from "node:assert";
import { addAddOn, familyOrderReport, orderTotals, removeAddOn, setAlternative, setOrderedSize, setRevisedPrice, substituteItem, updateAddOn, validateOrder, type OrderItem } from "./shop-order";
const item = { price: 10000, discount: 1000 } as OrderItem;
it("retains original price while revised size pricing and discounts determine value, not payment", () => {
  const original = [{ ...item, reservationId: "a", originalPrice: 10000 }];
  const revised = setRevisedPrice(original, "a", 12000);
  strictEqual(revised[0]?.originalPrice, 10000);
  strictEqual(revised[0]?.price, 12000);
  strictEqual(original[0]?.price, 10000);
  const t = orderTotals(revised, [{ amount: 3000, date: "2026-10-21", reference: "Advance" }]);
  strictEqual(t.total, 11000); strictEqual(t.paid, 3000); strictEqual(t.balance, 8000);
});
it("records a different actual size for each look without changing selected sizes", () => {
  const original = [{ ...item, reservationId: "a", size: "M" }, { ...item, reservationId: "b", size: "S" }];
  const changed = setOrderedSize(setOrderedSize(original, "a", "L"), "b", "Made to measure");
  const saved = JSON.parse(JSON.stringify(changed)) as OrderItem[];
  strictEqual(saved[0]?.orderedSize, "L"); strictEqual(saved[1]?.orderedSize, "Made to measure");
  strictEqual(saved[0]?.size, "M"); strictEqual(saved[1]?.size, "S");
  strictEqual(original[0]?.orderedSize, undefined);
});
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
it("adds extra items such as trousers to the order total and validates their discounts", () => {
  const withTrousers = addAddOn([{ ...item, reservationId: "a" }], "a", { id: "t", label: "Trousers", sku: "TR1", size: "32", shop: "", price: 3000, discount: 500, notes: "" });
  const t = orderTotals(withTrousers, [{ amount: 11000, date: "2026-10-21", reference: "" }]);
  strictEqual(t.total, 11500); strictEqual(t.balance, 500);
  throws(() => validateOrder(updateAddOn(withTrousers, "a", "t", { discount: 3001 }), []));
  strictEqual(orderTotals(removeAddOn(withTrousers, "a", "t"), []).total, 9000);
});
it("an order-only alternative keeps the guest's chosen look and size", () => {
  const original = [{ ...item, reservationId: "a", title: "Guest look", size: "M" }];
  const swapped = setAlternative(original, "a", { title: "Alt", sku: "ALT1", designer: "", shop: "", image: "" });
  strictEqual(swapped[0]?.title, "Guest look"); strictEqual(swapped[0]?.size, "M"); strictEqual(swapped[0]?.reservationId, "a");
  strictEqual(swapped[0]?.alternative?.sku, "ALT1"); strictEqual(original[0]?.alternative, undefined);
});
it("reports amount ordered per family including extra items", () => {
  const a = { ...item, reservationId: "a", wearer: "A", family: "Sethi", addOns: [{ id: "t", label: "Trousers", sku: "", size: "", shop: "", price: 4840, discount: 242, notes: "" }] };
  const b = { ...item, reservationId: "b", wearer: "B", family: "Sethi" }, c = { ...item, reservationId: "c", wearer: "C", family: "Malik" };
  const r = familyOrderReport([[a, c], [b]]);
  strictEqual(r[0]?.family, "Sethi"); strictEqual(r[0]?.amount, 22598); strictEqual(r[0]?.looks, 2); strictEqual(r[0]?.extras, 1);
  strictEqual(r[1]?.amount, 9000);
});
