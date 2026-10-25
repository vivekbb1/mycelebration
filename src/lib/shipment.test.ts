import { describe, expect, it } from "vitest";
import { arrivalStage, setShipment } from "./shipment";
import type { OrderItem } from "./shop-order";

const item = (id: string): OrderItem => ({ reservationId: id, wearer: "A", family: "F", event: "Wedding", title: "T", designer: "", sku: "", size: "M", shop: "", image: "", price: 100, discount: 0, measurements: null, notes: "", wearerNote: "keep" });
const s = { expectedDelivery: "2026-11-01", arrivedOn: "", tracking: " AWB1 ", courierName: "DHL", trackingUrl: "https://dhl.com/x" };

describe("shipment", () => {
  it("updates only chosen looks and keeps other fields", () => {
    const out = setShipment([item("a"), item("b")], ["a"], s);
    expect(out[0]).toMatchObject({ tracking: "AWB1", courierName: "DHL", expectedDelivery: "2026-11-01", wearerNote: "keep", price: 100 });
    expect(out[1]!.courierName).toBeUndefined();
  });
  it("rejects a tracking link without https", () => {
    expect(() => setShipment([item("a")], ["a"], { ...s, trackingUrl: "dhl.com/x" })).toThrow();
  });
  it("stages: arrived beats overdue; past date overdue; no date undated", () => {
    expect(arrivalStage({ expectedDelivery: "2026-01-01", arrivedOn: "2026-01-05" }, "2026-02-01")).toBe("arrived");
    expect(arrivalStage({ expectedDelivery: "2026-01-01" }, "2026-02-01")).toBe("overdue");
    expect(arrivalStage({ expectedDelivery: "2026-03-01" }, "2026-02-01")).toBe("due");
    expect(arrivalStage({}, "2026-02-01")).toBe("undated");
  });
});
