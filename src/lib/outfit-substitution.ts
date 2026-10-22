import type { OrderAlternative, OrderItem } from './shop-order';

export type SubstitutionSnapshot = { title?: string; sku?: string; designer?: string; image?: string; size?: string; wearer?: string; event?: string };
export type PreorderAlternative = { alternative: unknown; ordered_size: string; revised_price: number };
type EmailMember = { id: string; email: string | null; guest_name: string; household: string | null; claimed_by: string | null };

/** A linked wearer wins; ambiguous legacy names never notify a possibly unrelated account. */
export function substitutionRecipient(reservation: { member_code_id: string | null; guest_id: string; guest_name: string | null }, codes: EmailMember[]) {
  const linked = reservation.member_code_id ? codes.find(c => c.id === reservation.member_code_id) : undefined;
  const primary = codes.filter(c => c.claimed_by === reservation.guest_id && (!linked || c.household === linked.household));
  const legacy = !reservation.member_code_id && reservation.guest_name ? codes.filter(c => c.guest_name.trim().toLowerCase() === reservation.guest_name?.trim().toLowerCase() && primary.some(p => p.household === c.household)) : [];
  const wearer = linked ?? (legacy.length === 1 ? legacy[0] : undefined);
  if (!wearer) return null;
  if (wearer.email?.trim()) return wearer.email.trim();
  const familyEmails = [...new Set(primary.filter(c => c.household === wearer.household).map(c => c.email?.trim()).filter((e): e is string => Boolean(e)))];
  return familyEmails.length === 1 ? familyEmails[0] ?? null : null;
}

/** Carry a pre-order vendor choice into ordering, without rewriting the original choice. */
export function withPreorderAlternative(item: OrderItem, pending?: PreorderAlternative): OrderItem {
  if (!pending) return item;
  return { ...item, alternative: pending.alternative as OrderAlternative, orderedSize: pending.ordered_size, price: Number(pending.revised_price) };
}

/** Guest email data is explicitly projected: never forward prices, notes or shop URLs. */
export function guestSubstitutionComparison(original: SubstitutionSnapshot, replacement: SubstitutionSnapshot) {
  return {
    wearer: original.wearer || 'Guest', event: original.event || '',
    originalTitle: original.title || 'Original look', originalSku: original.sku || '', originalSize: original.size || 'Not recorded',
    replacementTitle: replacement.title || 'Replacement look', replacementSku: replacement.sku || '', replacementSize: replacement.size || 'Not recorded',
  };
}