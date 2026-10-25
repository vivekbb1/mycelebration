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
export type MenSetStatus = { pantsLinked: boolean; pants: string[]; handled: boolean; noted: boolean; complete: boolean };
/** Men's main looks whose title isn't a set; complete when trousers are linked, handled offline, or a wearer note covers it. */
export function menSetStatus(item: OrderItem, wardrobe: PairingLook[]): MenSetStatus | null {
  const effective = item.alternative ?? item;
  const look = wardrobe.find((w) => ("outfitId" in effective && effective.outfitId && effective.outfitId === w.id) || (modelKey(effective.sku) !== "" && modelKey(w.source_sku) === modelKey(effective.sku)));
  if (!look || !/^(men|man|male)$/i.test(look.gender ?? "")) return null;
  if (/\bset\b/i.test(look.title || effective.title || "")) return null;
  // Unnamed invoice extras on a non-set men's look are taken as its trousers unless the wardrobe names them otherwise.
  const pants = (item.addOns ?? []).filter((a) => { const t = wardrobe.find((w) => modelKey(w.source_sku) !== "" && modelKey(w.source_sku) === modelKey(a.sku))?.title ?? ""; return modelKey(a.sku) === WHITE_PANTS_SKU || bottoms.test(a.label) || bottoms.test(t) || (!t && (!a.label.trim() || /^extra item$/i.test(a.label.trim()))); }).map((a) => `${a.label || a.sku}${a.size ? ` (${a.size})` : ""}`);
  const handled = Boolean(item.setHandled); const noted = Boolean((item.wearerNote ?? "").trim());
  return { pantsLinked: pants.length > 0, pants, handled, noted, complete: pants.length > 0 || handled || noted };
}

/** Toggle only one look's "set managed offline" mark. */
export function setSetHandled(items: OrderItem[], reservationId: string, handled: boolean): OrderItem[] {
  if (!items.some((i) => i.reservationId === reservationId)) throw new Error("This look is no longer in the order");
  return items.map((i) => i.reservationId === reservationId ? { ...i, setHandled: handled } : i);
}
