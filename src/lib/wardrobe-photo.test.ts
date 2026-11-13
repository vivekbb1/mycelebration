import { test } from "node:test";
import { strictEqual, deepStrictEqual } from "node:assert";
import { resolveWardrobePhoto, type WardrobePhoto } from "./wardrobe-photo";

const uploaded = "/api/public/outfit-image/celebration/custom/0.jpg";
const look: WardrobePhoto = { id: "custom", title: "Custom suit", source_sku: null, image_url: uploaded, boutique_url: null, designer: null };

test("a linked custom substitute with no SKU uses the uploaded photo instead of the saved URL", () => {
  const snapshot = { outfitId: "custom", title: "Custom suit", image: "https://shop.example/old.jpg" };
  strictEqual(resolveWardrobePhoto(snapshot, [look]).image, uploaded);
  strictEqual(snapshot.image, "https://shop.example/old.jpg");
});
test("legacy substitutes resolve a unique SKU even when their saved photo is non-empty", () => {
  strictEqual(resolveWardrobePhoto({ sku: " suit1 ", image: "stale.jpg" }, [{ ...look, source_sku: "SUIT1" }]).image, uploaded);
});
test("ambiguous models do not pick a different outfit's uploaded photo", () => {
  strictEqual(resolveWardrobePhoto({ sku: "SUIT1", image: "saved.jpg" }, [{ ...look, source_sku: "SUIT1" }, { ...look, id: "other", source_sku: "SUIT1", image_url: "other.jpg" }]).image, "saved.jpg");
});
test("an explicit missing outfit ID never falls back to another model match", () => {
  strictEqual(resolveWardrobePhoto({ outfitId: "missing", sku: "SUIT1", image: "saved.jpg" }, [{ ...look, source_sku: "SUIT1" }]).image, "saved.jpg");
});
test("photo refresh leaves the order's prices, discount and selected size unchanged", () => {
  const snapshot = { outfitId: "custom", image: "old.jpg", price: 6000, discount: 500, orderedSize: "L" };
  deepStrictEqual(resolveWardrobePhoto(snapshot, [look]), { ...snapshot, image: uploaded, title: look.title, shop: "", designer: "" });
});