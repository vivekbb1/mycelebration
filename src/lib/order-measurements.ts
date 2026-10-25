import type { OrderItem } from "./shop-order";

export const ORDER_MEASUREMENT_FIELDS = ["height", "bust", "under_bust", "chest", "neck", "waist", "hip", "shoulder", "sleeve_length", "armhole", "top_length", "bottom_length", "inseam"] as const;

/** Changes only the selected order snapshot, not the wearer's submitted measurements. */
export function setOrderMeasurements(items: OrderItem[], reservationId: string, measurements: Record<string, string | number>): OrderItem[] {
  if (!items.some((item) => item.reservationId === reservationId)) throw new Error("This look is no longer in the order");
  if (!["cm", "in"].includes(String(measurements.unit))) throw new Error("Choose centimetres or inches");
  for (const field of ORDER_MEASUREMENT_FIELDS) {
    const value = measurements[field];
    if (value !== undefined && value !== "" && (!Number.isFinite(Number(value)) || Number(value) <= 0)) throw new Error(`${field.replaceAll("_", " ")} must be greater than zero`);
  }
  if (!ORDER_MEASUREMENT_FIELDS.some((field) => Number(measurements[field]) > 0)) throw new Error("Enter at least one measurement");
  return items.map((item) => item.reservationId === reservationId ? { ...item, measurements: { ...measurements } } : item);
}