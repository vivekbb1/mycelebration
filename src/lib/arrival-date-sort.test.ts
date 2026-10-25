import { it } from "node:test";
import { deepStrictEqual } from "node:assert";
import { compareArrivalDates } from "./shipment";

it("sorts dated arrivals earliest first with missing dates last", () => {
  const rows = [{ expectedDelivery: "2026-11-07" }, {}, { expectedDelivery: "2026-10-31" }];
  deepStrictEqual([...rows].sort((a, b) => compareArrivalDates(a, b, "asc")), [rows[2], rows[0], rows[1]]);
});
it("sorts dated arrivals latest first with missing dates still last", () => {
  const rows = [{ expectedDelivery: "2026-10-31" }, {}, { expectedDelivery: "2026-11-07" }];
  deepStrictEqual([...rows].sort((a, b) => compareArrivalDates(a, b, "desc")), [rows[2], rows[0], rows[1]]);
});
it("uses actual arrival rather than the old expected delivery date", () => {
  const rows = [{ expectedDelivery: "2026-10-01", arrivedOn: "2026-11-07" }, { expectedDelivery: "2026-10-31" }];
  deepStrictEqual([...rows].sort((a, b) => compareArrivalDates(a, b, "asc")), [rows[1], rows[0]]);
});