import type { OrderItem } from "./shop-order";

export type Shipment = { expectedDelivery: string; arrivedOn: string; tracking: string; courierName: string; trackingUrl: string };

/** Replace shipment fields only on the chosen looks; every other field and look stays as saved. */
export function setShipment(items: OrderItem[], reservationIds: string[], s: Shipment): OrderItem[] {
  const ids = new Set(reservationIds);
  if (!items.some((i) => ids.has(i.reservationId))) throw new Error("These looks are no longer in the order. Reopen it to continue");
  const url = s.trackingUrl.trim();
  if (url && !/^https?:\/\//i.test(url)) throw new Error("Tracking link must start with https://");
  return items.map((i) => ids.has(i.reservationId) ? { ...i, expectedDelivery: s.expectedDelivery, arrivedOn: s.arrivedOn, tracking: s.tracking.trim(), courierName: s.courierName.trim(), trackingUrl: url } : i);
}

export type ArrivalStage = "arrived" | "overdue" | "due" | "undated";
/** Arrived beats any date; past expected date without arrival is overdue. Dates are YYYY-MM-DD. */
export function arrivalStage(i: Pick<OrderItem, "expectedDelivery" | "arrivedOn">, today: string): ArrivalStage {
  if (i.arrivedOn) return "arrived";
  if (!i.expectedDelivery) return "undated";
  return i.expectedDelivery < today ? "overdue" : "due";
}
