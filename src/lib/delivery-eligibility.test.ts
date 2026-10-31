import { test } from "node:test";
import assert from "node:assert/strict";
import { canArriveInTime, daysNeeded, productionDaysFromSizes } from "./delivery-eligibility.ts";

const today = "2026-11-01";
test("on time when production + courier fit before the event", () => {
  assert.equal(canArriveInTime({ production_days: 10, courier_days: 5 }, "2026-11-16", {}, today), true);
});
test("too late when production + courier pass the event date", () => {
  assert.equal(canArriveInTime({ production_days: 10, courier_days: 6 }, "2026-11-16", {}, today), false);
});
test("looks with no delivery info stay visible", () => {
  assert.equal(canArriveInTime({}, "2026-11-02", { default_courier_days: 30 }, today), true);
});
test("buffer days are added", () => {
  assert.equal(canArriveInTime({ production_days: 10, courier_days: 5 }, "2026-11-16", { delivery_buffer_days: 1 }, today), false);
});
test("default courier days used when look has none", () => {
  assert.equal(daysNeeded({ production_days: 7 }, { default_courier_days: 4 }), 11);
});
test("ready-to-ship sizes count as zero production days", () => {
  assert.equal(daysNeeded({ sizes: [{ label: "M", available: true, ready_to_ship: true }] }, { default_courier_days: 3 }), 3);
});

test("host cut-off replaces event date and buffer", () => {
  const look = { production_days: 10, courier_days: 5 };
  const s = { delivery_buffer_days: 7 };
  assert.equal(canArriveInTime(look, { eventDate: "2026-12-31", cutoff: "2026-11-14" }, s, "2026-10-31"), false);
  assert.equal(canArriveInTime(look, { eventDate: "2026-12-31", cutoff: "2026-11-15" }, s, "2026-10-31"), true);
  assert.equal(canArriveInTime(look, "2026-11-22", s, "2026-10-31"), true);
});

test("shop sizes give making days", () => {
  assert.equal(productionDaysFromSizes([{ available: true, ready_to_ship: true }], "2026-10-31"), 0);
  assert.equal(productionDaysFromSizes([{ available: true, ships_by: "2026-11-20" }, { available: true, ships_by: "2026-11-10" }, { available: false, ships_by: "2026-11-01" }], "2026-10-31"), 10);
  assert.equal(productionDaysFromSizes([{ available: true }], "2026-10-31"), null);
});
