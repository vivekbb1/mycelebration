type Member = { guest_name: string; household: string | null; claimed_by: string | null; gender: string | null };
type Event = { id: string; outfit_selection: boolean | null };
type Access = { household: string; event_id: string; outfit_selection: boolean | null };
type Look = { guest_id: string; guest_name: string | null; outfits: { event_id: string | null } | null };
const normalize = (name: string | null) => (name ?? "").trim().toLowerCase();

/** Match the wearer, not just the account that reserved the look. */
export function memberLook<T extends Look>(member: Member, family: Member[], looks: T[], eventId: string) {
  const ids = new Set(family.map((m) => m.claimed_by).filter(Boolean));
  return looks.find((look) => {
    if (!ids.has(look.guest_id) || look.outfits?.event_id !== eventId) return false;
    if (normalize(look.guest_name)) return normalize(look.guest_name) === normalize(member.guest_name);
    return Boolean(member.claimed_by && look.guest_id === member.claimed_by);
  });
}

export function missingOutfitEvents<T extends Event>(member: Member, members: Member[], events: T[], access: Access[], looks: Look[], kids: Set<string>) {
  const family = members.filter((m) => m.household === member.household);
  const rows = access.filter((r) => r.household === member.household);
  return events.filter((event) => {
    if (event.outfit_selection === false) return false;
    if (rows.length && !rows.some((r) => r.event_id === event.id && r.outfit_selection !== false)) return false;
    const look = memberLook(member, family, looks, event.id);
    const child = member.gender === "boy" || member.gender === "girl";
    return (!child || kids.has(`${event.id}|${member.gender}`)) && !look;
  });
}