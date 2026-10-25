import { it } from "node:test";
import { deepStrictEqual, strictEqual, throws } from "node:assert";
import { setOrderMeasurements } from "./order-measurements";
import type { OrderItem } from "./shop-order";

it("edits only the selected look's measurements without altering requested or ordered size", () => {
  const first = { reservationId: "a", size: "Made to measure", orderedSize: "XL", measurements: { unit: "cm", chest: 105 }, wearerNote: "Carry a shirt", price: 10000 } as OrderItem;
  const second = { ...first, reservationId: "b" };
  const changed = setOrderMeasurements([first, second], "a", { unit: "cm", chest: 107, waist: 93 });
  deepStrictEqual(changed[0]?.measurements, { unit: "cm", chest: 107, waist: 93 });
  strictEqual(changed[0]?.size, "Made to measure"); strictEqual(changed[0]?.orderedSize, "XL");
  strictEqual(changed[0]?.wearerNote, "Carry a shirt"); strictEqual(changed[0]?.price, 10000);
  strictEqual(changed[1], second); strictEqual(first.measurements?.chest, 105);
});
it("refuses to write measurements onto a missing look", () => {
  throws(() => setOrderMeasurements([], "missing", { unit: "cm", chest: 105 }), /no longer/);
});
it("rejects invalid or empty measurement input", () => {
  const items = [{ reservationId: "a" } as OrderItem];
  for (const chest of [-1, 0, "abc"]) throws(() => setOrderMeasurements(items, "a", { unit: "cm", chest }));
  throws(() => setOrderMeasurements(items, "a", { unit: "cm" }));
  throws(() => setOrderMeasurements(items, "a", { unit: "feet", chest: 40 }));
});