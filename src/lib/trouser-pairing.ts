import { addAddOn, type OrderAddOn, type OrderItem } from "./shop-order";

export const WHITE_PANTS_SKU = "KASB082443";
export type PairingLook = { id?: string; title?: string | null; source_sku?: string | null; gender?: string | null; garment_type?: string | null; notes?: string | null };
export const modelKey = (sku?: string | null) => (sku ?? "").trim().toUpperCase();
const bottoms = /\b(pants?|trousers?|pyjamas?|pajamas?|churidars?|dhotis?|salwars?)\b/i;

/** A trouser extra complements a men's main look, never a set or a look already supplied with pants. */
export function canPairTrouserExtra(item: OrderItem, wardrobe: PairingLook[], replacement?: { sku?: string; title?: string; outfitId?: string | null } | null) {
  const effective = replacement ?? item.alternative ?? item;
  const look = wardrobe.find((w) => ("outfitId" in effective && effective.outfitId === w.id) || (modelKey(effective.sku) !== "" && modelKey(w.source_sku) === modelKey(effective.sku)));
  if (!look || !/^(men|man|male)$/i.test(look.gender ?? "")) return false;
  const title = look.title || effective.title || "";
  if (/\bset\b/i.test(title)) return false;
  const excluded = /\b(without|excluding|excludes|not included)\b/i.test(title);
  if (!excluded && bottoms.test(title)) return false;
  if (!excluded && /\b(paired|comes|supplied|includes?|with)\s+(?:a\s+)?(?:matching\s+)?(?:pants?|trousers?|pyjamas?|pajamas?|churidars?|dhotis?)\b/i.test((look.notes ?? "").split(/style|accentuate/i)[0] ?? "")) return false;
  return !(item.addOns ?? []).some((a) => modelKey(a.sku) === WHITE_PANTS_SKU || bottoms.test(a.label) || bottoms.test(wardrobe.find((w) => modelKey(w.source_sku) !== "" && modelKey(w.source_sku) === modelKey(a.sku))?.title ?? ""));
}

/** Product copy suggesting styling with trousers does not mean trousers are included. */
export function needsTrouserReview(item: OrderItem, wardrobe: PairingLook[], replacement?: { sku?: string; title?: string; outfitId?: string | null } | null) {
  const effective = item.alternative ?? replacement ?? item;
  const look = wardrobe.find((w) => ("outfitId" in effective && effective.outfitId === w.id) || (modelKey(effective.sku) !== "" && modelKey(w.source_sku) === modelKey(effective.sku)));
  if (!look || !/^(men|man|male)$/i.test(look.gender ?? "")) return false;
  const title = look.title || effective.title || "";
  if (!/\bkurta\b/i.test(title)) return false;
  const excluded = /\b(without|excluding|excludes|not included)\b/i.test(title);
  if (!excluded && (bottoms.test(title) || /\bset\b/i.test(title))) return false;
  if (/\b(paired|comes|supplied|includes?|with)\s+(?:a\s+)?(?:matching\s+)?(?:pants?|trousers?|pyjamas?|pajamas?|churidars?|dhotis?)\b/i.test((look.notes ?? "").split(/style|accentuate/i)[0] ?? "")) return false;
  return !(item.addOns ?? []).some((a) => modelKey(a.sku) === WHITE_PANTS_SKU || bottoms.test(a.label) || bottoms.test(wardrobe.find((w) => modelKey(w.source_sku) !== "" && modelKey(w.source_sku) === modelKey(a.sku))?.title ?? ""));
}

/** Pair only the reviewed look, never the guest's choice or another wearer's extras. */
export function pairWhitePants(items: OrderItem[], reservationId: string, extra: OrderAddOn, wardrobe: PairingLook[]) {
  const item = items.find((i) => i.reservationId === reservationId);
  if (!item) throw new Error("This look is no longer in the order");
  if (!needsTrouserReview(item, wardrobe)) throw new Error("This look has changed or trousers are already included. Reopen the review.");
  if (modelKey(extra.sku) !== WHITE_PANTS_SKU) throw new Error("Review the white pyjama pants before saving");
  if (!extra.size.trim()) throw new Error("Enter the size to order for the pants");
  return addAddOn(items, reservationId, extra);
}