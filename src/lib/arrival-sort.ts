import { compareArrivalDates } from "./shipment";
import type { OrderItem } from "./shop-order";
import type { Sequencer } from "./order-sequence";

export type ArrivalSort = "asc" | "desc" | "individual" | "family" | "event";
type Row = { i: Pick<OrderItem, "expectedDelivery" | "arrivedOn" | "event">; wearer: string; family: string };

export function compareArrivals(a: Row, b: Row, mode: ArrivalSort, seq: Sequencer): number {
  const personEvent = () => seq.compare({ wearer: a.wearer, event: a.i.event }, { wearer: b.wearer, event: b.i.event });
  if (mode === "family") return a.family.localeCompare(b.family) || personEvent() || compareArrivalDates(a.i, b.i, "asc");
  if (mode === "individual") return personEvent() || compareArrivalDates(a.i, b.i, "asc");
  if (mode === "event") return seq.event(a.i.event) - seq.event(b.i.event) || a.i.event.localeCompare(b.i.event) || a.family.localeCompare(b.family) || personEvent() || compareArrivalDates(a.i, b.i, "asc");
  return compareArrivalDates(a.i, b.i, mode) || personEvent();
}