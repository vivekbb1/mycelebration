export type PhotoSnapshot = { outfitId?: string | null; title?: string; sku?: string; image?: string; shop?: string; designer?: string };
export type WardrobePhoto = { id: string; title: string; source_sku: string | null; image_url: string | null; boutique_url: string | null; designer: string | null };

/** Stable wardrobe ID wins; legacy model references resolve only when unambiguous. */
export function fillSubstitutionPhotos(snaps: PhotoSnapshot[], wardrobe: WardrobePhoto[]) {
  for (const snap of snaps) {
    const matches = snap.outfitId
      ? wardrobe.filter(o => o.id === snap.outfitId)
      : wardrobe.filter(o => Boolean(snap.sku?.trim()) && o.source_sku?.trim().toUpperCase() === snap.sku?.trim().toUpperCase());
    if (matches.length !== 1) continue;
    const outfit = matches[0];
    if (!outfit) continue;
    // Current collection photo can be an uploaded repository URL or a vendor URL.
    // Keep the saved fallback when the collection has no photo.
    if (outfit.image_url?.trim()) snap.image = outfit.image_url;
    if ((!snap.title?.trim() || /^alternative\s/i.test(snap.title.trim()) || snap.title.trim() === snap.sku?.trim()) && outfit.title) snap.title = outfit.title;
    if (!snap.shop && outfit.boutique_url) snap.shop = outfit.boutique_url;
    if (!snap.designer && outfit.designer) snap.designer = outfit.designer;
  }
}