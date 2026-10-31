/** Can a look be made and couriered before its event? Mirrors the
 *  `enforce_outfit_delivery` database trigger. Looks with no delivery info
 *  (no production or courier days and not ready to ship) stay eligible. */
export type DeliveryLook = {
  production_days?: number | null;
  courier_days?: number | null;
  sizes?: unknown;
};
export type DeliverySettings = { default_courier_days?: number | null; delivery_buffer_days?: number | null };

export function productionDays(o: DeliveryLook): number | null {
  if (o.production_days != null) return o.production_days;
  if (Array.isArray(o.sizes)) {
    const ready = o.sizes.some(
      (s: any) => s && s.available !== false && s.ready_to_ship === true,
    );
    if (ready) return 0;
  }
  return null;
}

export function hasDeliveryInfo(o: DeliveryLook) {
  return productionDays(o) != null || o.courier_days != null;
}

function dayNumber(d: string | Date) {
  const s = typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10);
  return Math.floor(Date.parse(s + "T00:00:00Z") / 86400000);
}

/** Earliest arrival as days from today, or null when unknown. */
export function daysNeeded(o: DeliveryLook, s: DeliverySettings): number | null {
  if (!hasDeliveryInfo(o)) return null;
  return (productionDays(o) ?? 0) + (o.courier_days ?? s.default_courier_days ?? 0) + (s.delivery_buffer_days ?? 0);
}

/** `target` is the event date, or `{ cutoff, eventDate }`: a host-set delivery
 *  cut-off replaces the event date and the fitting buffer (already built in). */
export function canArriveInTime(
  o: DeliveryLook,
  target: string | null | undefined | { cutoff?: string | null; eventDate?: string | null },
  s: DeliverySettings,
  today: string | Date = new Date(),
): boolean {
  const t = typeof target === "object" && target ? target : { eventDate: target ?? null, cutoff: null };
  const date = t.cutoff || t.eventDate;
  if (!date) return true;
  const need = daysNeeded(o, t.cutoff ? { ...s, delivery_buffer_days: 0 } : s);
  if (need == null) return true;
  return dayNumber(today) + need <= dayNumber(date);
}
