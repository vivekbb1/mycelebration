import type { OrderItem } from "./shop-order";

type Member = { id: string; guest_name: string; household: string | null; claimed_by: string | null };
type Reservation = { id: string; member_code_id: string | null; guest_name: string | null; guest_id: string };
const norm = (value: string | null) => (value ?? "").trim().toLowerCase();

/** Resolve current membership by person ID; legacy rows require an unambiguous wearer match. */
export function profileOrderItems(items: OrderItem[], reservations: Reservation[], members: Member[], household: string) {
  return items.flatMap((item) => {
    const reservation = reservations.find((r) => r.id === item.reservationId);
    const linked = reservation?.member_code_id;
    const matches = linked ? members.filter((m) => m.id === linked) : members.filter((m) =>
      norm(m.guest_name) === norm(reservation?.guest_name || item.wearer) &&
      (reservation ? m.claimed_by === reservation.guest_id : norm(m.household) === norm(item.family)));
    const person = matches.length === 1 ? matches[0] : undefined;
    if (!person || norm(person.household || person.guest_name) !== norm(household)) return [];
    return [{ ...item, wearer: person.guest_name, family: household }];
  });
}