import { it } from "node:test";
import { deepStrictEqual, strictEqual } from "node:assert";
import { orderSizeWarnings } from "./order-size-review";

it("flags requested M versus ordered L for reconfirmation", () => {
  strictEqual(orderSizeWarnings({ size: "M", orderedSize: "L", measurements: null }).length, 1);
});
it("flags made-to-measure request ordered as standard size", () => {
  strictEqual(orderSizeWarnings({ size: "Made to measure", orderedSize: "M", measurements: { chest: 40 } }).length, 1);
});
it("flags made-to-measure order without measurement values", () => {
  strictEqual(orderSizeWarnings({ size: "Made to measure", orderedSize: "MTM", measurements: { unit: "in" } }).length, 1);
});
it("does not flag matching custom sizing with measurements", () => {
  deepStrictEqual(orderSizeWarnings({ size: "Made to measure", orderedSize: "MTM", measurements: { chest: 40 } }), []);
});
it("does not infer an absent ordered size from the request", () => {
  strictEqual(orderSizeWarnings({ size: "M", measurements: null }).length, 1);
});
it("treats common equivalent size labels as matching", () => {
  deepStrictEqual(orderSizeWarnings({ size: "XXL", orderedSize: "2XL", measurements: null }), []);
});