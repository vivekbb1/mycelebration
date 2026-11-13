import { describe, it } from "node:test";
import { strictEqual, deepStrictEqual } from "node:assert";
import { fillSubstitutionPhotos, type PhotoSnapshot, type WardrobePhoto } from "./substitution-photo";

const upload = "/api/public/outfit-image/celebration/custom/look.jpg";
const outfit: WardrobePhoto = { id: "custom", title: "Custom suit", source_sku: null, image_url: upload, boutique_url: null, designer: null };
describe("replacement photo resolution", () => {
  it("uses an uploaded wardrobe photo by ID even without a model reference and with a stale web snapshot", () => {
    const snap: PhotoSnapshot = { outfitId: "custom", image: "https://shop.example/old.jpg" };
    fillSubstitutionPhotos([snap], [outfit]);
    strictEqual(snap.image, upload);
  });
  it("supports web photos for web-sourced replacements", () => {
    const snap: PhotoSnapshot = { outfitId: "custom" };
    fillSubstitutionPhotos([snap], [{ ...outfit, image_url: "https://shop.example/current.jpg" }]);
    strictEqual(snap.image, "https://shop.example/current.jpg");
  });
  it("resolves a legacy model reference to the uploaded photo", () => {
    const snap: PhotoSnapshot = { sku: "ALT1", image: "https://shop.example/old.jpg" };
    fillSubstitutionPhotos([snap], [{ ...outfit, source_sku: "ALT1" }]);
    strictEqual(snap.image, upload);
  });
  it("does not guess between duplicate references or fall back from a mismatched stable ID", () => {
    const snaps: PhotoSnapshot[] = [{ sku: "ALT1", image: "saved" }, { outfitId: "missing", sku: "ALT1", image: "saved" }];
    fillSubstitutionPhotos(snaps, [{ ...outfit, source_sku: "ALT1" }, { ...outfit, id: "other", source_sku: "ALT1" }]);
    deepStrictEqual(snaps.map(s => s.image), ["saved", "saved"]);
  });
  it("keeps the saved photo when the collection photo is absent", () => {
    const snap = { outfitId: "custom", image: "saved" };
    fillSubstitutionPhotos([snap], [{ ...outfit, image_url: null }]);
    strictEqual(snap.image, "saved");
  });
});