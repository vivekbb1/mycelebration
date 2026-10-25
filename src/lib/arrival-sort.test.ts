import { it } from "node:test";
import { deepStrictEqual } from "node:assert";
import { compareArrivals } from "./arrival-sort";
import { makeSequencer } from "./order-sequence";

const seq = makeSequencer([
  { guest_name: "Tobias", created_at: "2026-01-01" },
  { guest_name: "Dennis", created_at: "2026-01-02" },
], [{ name: "Wedding", sort_order: 1 }, { name: "Bollywood", sort_order: 2 }]);
const rows = [
  { wearer: "Dennis", family: "A", i: { event: "Bollywood", expectedDelivery: "2026-11-01" } },
  { wearer: "Tobias", family: "Z", i: { event: "Bollywood", expectedDelivery: "2026-10-31" } },
  { wearer: "Tobias", family: "Z", i: { event: "Wedding", expectedDelivery: "2026-11-05" } },
];
it("individual sorting keeps each person's events together in schedule order", () => {
  deepStrictEqual([...rows].sort((a, b) => compareArrivals(a, b, "individual", seq)), [rows[2], rows[1], rows[0]]);
});
it("family sorting groups families then members and events", () => {
  deepStrictEqual([...rows].sort((a, b) => compareArrivals(a, b, "family", seq)), [rows[0], rows[2], rows[1]]);
});
it("event sorting follows the schedule then families", () => {
  deepStrictEqual([...rows].sort((a, b) => compareArrivals(a, b, "event", seq)), [rows[2], rows[0], rows[1]]);
});