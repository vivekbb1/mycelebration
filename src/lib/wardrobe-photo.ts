export type PhotoSnapshot = { outfitId?: string | null; title?: string; sku?: string; image?: string; shop?: string; designer?: string };
export type WardrobePhoto = { id: string; title: string; source_sku: string | null; image_url: string | null; boutique_url: string | null; designer: string | null };

const key = (s?: string | null) => s?.trim().toUpperCase() ?? "";
const shopKey = (s?: string | null) => s?.trim().split(/[?#]/)[0]?.replace(/\/$/, "") ?? "";
const generic = (s: PhotoSnapshot) => !s.title?.trim() || /^alternative\s/i.test(s.title.trim()) || key(s.title) === key(s.sku);

/** Resolve within one celebration. Stable IDs win; legacy matches must be unambiguous. */
export function resolveWardrobePhoto<T extends PhotoSnapshot>(snapshot: T, wardrobe: WardrobePhoto[]): T {
  let matches = snapshot.outfitId ? wardrobe.filter(o => o.id === snapshot.outfitId) : [];
  // An explicit missing ID must never silently resolve to another look with the same SKU.
  if (!snapshot.outfitId) {
    if (key(snapshot.sku)) matches = wardrobe.filter(o => key(o.source_sku) === key(snapshot.sku));
    if (matches.length !== 1 && shopKey(snapshot.shop)) {
      const linked = wardrobe.filter(o => shopKey(o.boutique_url) === shopKey(snapshot.shop));
      if (key(snapshot.sku)) matches = linked.filter(o => key(o.source_sku) === key(snapshot.sku));
      else matches = linked;
    }
  }
  const outfit = matches.length === 1 ? matches[0] : undefined;
  if (!outfit) return { ...snapshot };
  return { ...snapshot, image: outfit.image_url || snapshot.image || "", title: generic(snapshot) ? outfit.title : snapshot.title,
    shop: snapshot.shop || outfit.boutique_url || "", designer: snapshot.designer || outfit.designer || "" };
}