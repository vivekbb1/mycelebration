import { describe, expect, it } from "vitest";
import { sameWearer, setWearerNote, wearerLookLine } from "./wearer-order";
import type { OrderItem } from "./shop-order";

const base: OrderItem = { reservationId: "r1", wearer: "Tobias", family: "Heckh", event: "Wedding", title: "Ivory suit", designer: "D", sku: "SKU1", size: "M", shop: "https://shop/x", image: "img", price: 50000, discount: 5000, measurements: null, notes: "" };

describe("wearer notes", () => {
  it("changes only the targeted look's note", () => {
    const other = { ...base, reservationId: "r2", wearerNote: "Keep" };
    const next = setWearerNote([base, other], "r1", "  Please carry your white shirt ");
    expect(next[0].wearerNote).toBe("Please carry your white shirt");
    expect(next[0].price).toBe(50000);
    expect(next[1]).toBe(other);
  });
  it("refuses to save a note for a look no longer in the order", () => {
    expect(() => setWearerNote([base], "gone", "x")).toThrow();
  });
  it("puts the note in the PDF line without price, model number or shop", () => {
    const line = wearerLookLine({ ...base, wearerNote: "Carry your shirt" }, "Tobias");
    expect(line.note).toBe("Carry your shirt");
    expect(JSON.stringify(line)).not.toMatch(/SKU1|50000|shop\/x/);
  });
  it("treats the same name in another family as a different person", () => {
    expect(sameWearer({ wearer: "Tobias", family: "Heckh" }, { wearer: " tobias", family: "heckh" })).toBe(true);
    expect(sameWearer({ wearer: "Tobias", family: "Heckh" }, { wearer: "Tobias", family: "Ruf" })).toBe(false);
  });
});
