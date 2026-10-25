import { describe, it } from "node:test";
import { strictEqual, throws } from "node:assert";
import { arrivalStage, setShipment } from "./shipment";
import type { OrderItem } from "./shop-order";

const item = (id: string): OrderItem => ({ reservationId: id, wearer: "A", family: "F", event: "Wedding", title: "T", designer: "", sku: "", size: "M", shop: "", image: "", price: 100, discount: 0, measurements: null, notes: "", wearerNote: "keep" });
const s = { expectedDelivery: "2026-11-01", arrivedOn: "", tracking: " AWB1 ", courierName: "DHL", trackingUrl: "https://dhl.com/x" };

describe("shipment", () => {
  it("updates only chosen looks and keeps other fields", () => {
    const out = setShipment([item("a"), item("b")], ["a"], s);
    strictEqual(out[0]!.tracking, "AWB1"); strictEqual(out[0]!.courierName, "DHL"); strictEqual(out[0]!.expectedDelivery, "2026-11-01"); strictEqual(out[0]!.wearerNote, "keep"); strictEqual(out[0]!.price, 100);
    strictEqual(out[1]!.courierName, undefined);
  });
  it("rejects a tracking link without https", () => {
    throws(() => setShipment([item("a")], ["a"], { ...s, trackingUrl: "dhl.com/x" }));
  });
  it("stages: arrived beats overdue; past date overdue; no date undated", () => {
    strictEqual(arrivalStage({ expectedDelivery: "2026-01-01", arrivedOn: "2026-01-05" }, "2026-02-01"), "arrived");
    strictEqual(arrivalStage({ expectedDelivery: "2026-01-01" }, "2026-02-01"), "overdue");
    strictEqual(arrivalStage({ expectedDelivery: "2026-03-01" }, "2026-02-01"), "due");
    strictEqual(arrivalStage({}, "2026-02-01"), "undated");
  });
});
