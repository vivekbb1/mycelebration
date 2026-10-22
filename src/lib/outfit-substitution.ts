import type { OrderAlternative, OrderItem } from './shop-order';

export type SubstitutionSnapshot = { title?: string; sku?: string; designer?: string; image?: string; size?: string; wearer?: string; event?: string };
export type PreorderAlternative = { alternative: unknown; ordered_size: string; revised_price: number };

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