import { describe, it } from "node:test";
import { deepStrictEqual, ok, strictEqual, throws } from "node:assert";
import { sameWearer, setWearerNote, wearerLookLine } from "./wearer-order";
import type { OrderItem } from "./shop-order";

const base: OrderItem = { reservationId: "r1", wearer: "Tobias", family: "Heckh", event: "Wedding", title: "Ivory suit", designer: "D", sku: "SKU1", size: "M", shop: "https://shop/x", image: "img", price: 50000, discount: 5000, measurements: null, notes: "" };

describe("wearer notes", () => {
  it("changes only the targeted look's note", () => {
    const other = { ...base, reservationId: "r2", wearerNote: "Keep" };
    const next = setWearerNote([base, other], "r1", "  Please carry your white shirt ");
    strictEqual(next[0]?.wearerNote, "Please carry your white shirt");
    strictEqual(next[0]?.price, 50000);
    strictEqual(next[1], other);
  });
  it("refuses to save a note for a look no longer in the order", () => {
    throws(() => setWearerNote([base], "gone", "x"));
  });
  it("puts the note in the PDF line without price, model number or shop", () => {
    const line = wearerLookLine({ ...base, wearerNote: "Carry your shirt" }, "Tobias");
    strictEqual(line.note, "Carry your shirt");
    ok(!/SKU1|50000|shop\/x/.test(JSON.stringify(line)));
  });
  it("treats the same name in another family as a different person", () => {
    strictEqual(sameWearer({ wearer: "Tobias", family: "Heckh" }, { wearer: " tobias", family: "heckh" }), true);
    strictEqual(sameWearer({ wearer: "Tobias", family: "Heckh" }, { wearer: "Tobias", family: "Ruf" }), false);
  });
});
