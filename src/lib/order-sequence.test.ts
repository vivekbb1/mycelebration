import { describe, it } from "node:test";
import { deepStrictEqual, ok, strictEqual, throws } from "node:assert";
import { makeSequencer } from "./order-sequence";

const seq = makeSequencer(
  [{ guest_name: "Dennis", created_at: "2026-01-02" }, { guest_name: "Tobias", created_at: "2026-01-01" }],
  [{ name: "Wedding", sort_order: 2 }, { name: "Mehendi", sort_order: 1 }, { name: "Sangeet", sort_order: 1, event_date: "2026-12-02" }],
);

describe("order sequencing", () => {
  it("groups each person together in invitation order, then their events in schedule order", () => {
    const rows = [{ wearer: "Dennis", event: "Mehendi" }, { wearer: "Tobias", event: "Wedding" }, { wearer: "Tobias", event: "Mehendi" }, { wearer: "Dennis", event: "Wedding" }];
    deepStrictEqual([...rows].sort(seq.compare).map((r) => `${r.wearer}/${r.event}`), ["Tobias/Mehendi", "Tobias/Wedding", "Dennis/Mehendi", "Dennis/Wedding"]);
  });
  it("matches names regardless of case or spacing and puts unknown people last", () => {
    strictEqual(seq.person(" tobias "), 0);
    ok(seq.compare({ wearer: "Zed", event: "Mehendi" }, { wearer: "Dennis", event: "Wedding" }) > 0);
  });
});
