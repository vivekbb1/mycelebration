import { missingOutfitEvents } from "@/lib/outfit-pick-progress";

export type InvoiceMember = { id: string; guest_name: string; household: string | null; claimed_by: string | null; gender: string | null };
export type InvoiceEvent = { id: string; name: string; outfit_selection: boolean | null };
type Look = { guest_id: string; guest_name: string | null; member_code_id: string | null; outfits: { event_id: string | null } | null };
export function missingInvoiceWearers(members: InvoiceMember[], events: InvoiceEvent[], access: { household: string; event_id: string; outfit_selection: boolean | null }[], looks: Look[], kids: Set<string>) {
  return members.flatMap(member => missingOutfitEvents(member, members, events, access, looks, kids).map(event => ({ key: `member:${member.id}:${event.id}`, member, event })));
}