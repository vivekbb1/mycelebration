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
/** Actual arrival date when recorded, otherwise expected delivery; undated looks stay last. */
export function compareArrivalDates(a: Pick<OrderItem, "expectedDelivery" | "arrivedOn">, b: Pick<OrderItem, "expectedDelivery" | "arrivedOn">, direction: "asc" | "desc") {
  const left = a.arrivedOn || a.expectedDelivery || "", right = b.arrivedOn || b.expectedDelivery || "";
  if (!left) return right ? 1 : 0;
  if (!right) return -1;
  return left.localeCompare(right) * (direction === "asc" ? 1 : -1);
}
/** Arrived beats any date; past expected date without arrival is overdue. Dates are YYYY-MM-DD. */
export function arrivalStage(i: Pick<OrderItem, "expectedDelivery" | "arrivedOn">, today: string): ArrivalStage {
  if (i.arrivedOn) return "arrived";
  if (!i.expectedDelivery) return "undated";
  return i.expectedDelivery < today ? "overdue" : "due";
}
