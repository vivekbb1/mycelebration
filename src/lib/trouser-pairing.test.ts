import { it } from "node:test";
import { strictEqual, throws } from "node:assert";
import { canPairTrouserExtra, needsTrouserReview, pairWhitePants, WHITE_PANTS_SKU } from "./trouser-pairing";
import { orderTotals, type OrderItem, type OrderAddOn } from "./shop-order";

const item = { reservationId: "a", title: "Black Embroidered Kurta", sku: "K1", size: "M", price: 10000, discount: 0 } as OrderItem;
const wardrobe = [{ source_sku: "K1", title: item.title, gender: "men", notes: "Style it with pants and mojaris." }, { source_sku: WHITE_PANTS_SKU, title: "White Egyptian Giza Cotton Pyjama Pants", gender: "men" }];
const pants: OrderAddOn = { id: "p", label: "White pyjama pants", sku: WHITE_PANTS_SKU, shop: "", size: "XL", price: 4598, discount: 0, notes: "" };
it("invoice trousers complement any men's non-set main look, not only kurtas", () => {
  strictEqual(canPairTrouserExtra(item, [{ ...wardrobe[0], title: "Embroidered Jacket" }]), true);
});
it("invoice trousers exclude sets and included pants", () => {
  strictEqual(canPairTrouserExtra(item, [{ ...wardrobe[0], title: "Kurta Set" }]), false);
  strictEqual(canPairTrouserExtra(item, [{ ...wardrobe[0], title: "Kurta with Pants" }]), false);
});
it("invoice trousers exclude women and unknown categories", () => {
  strictEqual(canPairTrouserExtra(item, [{ ...wardrobe[0], gender: "women" }]), false);
  strictEqual(canPairTrouserExtra(item, []), false);
});
it("invoice trousers exclude linked pants even with a generic extra label", () => {
  strictEqual(canPairTrouserExtra({ ...item, addOns: [pants] }, wardrobe), false);
  strictEqual(canPairTrouserExtra({ ...item, addOns: [{ ...pants, sku: "OTHER", label: "Cotton trousers" }] }, wardrobe), false);
});
it("invoice trousers evaluate the actual invoice replacement", () => {
  strictEqual(canPairTrouserExtra(item, [...wardrobe, { source_sku: "SET", title: "Kurta Set", gender: "men" }], { sku: "SET" }), false);
});
it("flags men's kurta-only looks but does not count styling suggestions as included trousers", () => {
  strictEqual(needsTrouserReview(item, wardrobe), true);
});
it("does not flag women's or unknown-gender kurtas", () => {
  strictEqual(needsTrouserReview(item, [{ ...wardrobe[0], gender: "women" }]), false);
  strictEqual(needsTrouserReview(item, []), false);
});
it("does not flag sets or kurtas already supplied with bottoms", () => {
  strictEqual(needsTrouserReview(item, [{ ...wardrobe[0], title: "Kurta Set" }]), false);
  strictEqual(needsTrouserReview(item, [{ ...wardrobe[0], title: "Kurta with Pants" }]), false);
  strictEqual(needsTrouserReview(item, [{ ...wardrobe[0], notes: "Comes with matching trousers." }]), false);
});
it("all KASB082443 extras count as included trousers despite generic invoice labels", () => {
  strictEqual(needsTrouserReview({ ...item, addOns: [{ ...pants, label: "Extra item", sku: " kasb082443 " }] }, wardrobe), false);
});
it("evaluates the supplied replacement rather than the original choice", () => {
  strictEqual(needsTrouserReview({ ...item, alternative: { title: "Kurta Set", sku: "SET", image: "", designer: "", shop: "" } }, [...wardrobe, { source_sku: "SET", title: "Kurta Set", gender: "men" }]), false);
});
it("review is immutable and adds INR 4598 only to the confirmed person's look, preserving choices and actual payments", () => {
  const original = [item, { ...item, reservationId: "b" }];
  const next = pairWhitePants(original, "a", pants, wardrobe);
  strictEqual(original[0]?.addOns, undefined);
  strictEqual(next[0]?.size, "M"); strictEqual(next[0]?.addOns?.[0]?.size, "XL"); strictEqual(next[1]?.addOns, undefined);
  const total = orderTotals(next, [{ amount: 3000, date: "2026-10-24", reference: "" }]);
  strictEqual(total.total, 24598); strictEqual(total.paid, 3000); strictEqual(total.balance, 21598);
  throws(() => pairWhitePants(next, "a", pants, wardrobe));
  throws(() => pairWhitePants(original, "a", { ...pants, size: "" }, wardrobe));
});
import { menSetStatus, setSetHandled } from "./trouser-pairing";
describe("men's set report", () => {
  const wd = [{ id: "k", title: "Ivory Kurta", source_sku: "K1", gender: "men" }, { id: "s", title: "Kurta Set", source_sku: "S1", gender: "men" }, { id: "p", title: "White Pyjama Pants", source_sku: "KASB082443", gender: "men" }];
  const base = { reservationId: "r", wearer: "Oscar", family: "F", event: "Wedding", title: "Ivory Kurta", designer: "", sku: "K1", size: "L", shop: "", image: "", price: 1, discount: 0, measurements: null, notes: "" };
  it("sets are excluded; kurta without pants is incomplete", () => {
    strictEqual(menSetStatus({ ...base, sku: "S1", title: "Kurta Set" }, wd), null);
    strictEqual(menSetStatus(base, wd)!.complete, false);
  });
  it("linked pants, offline mark or wearer note each make it complete", () => {
    strictEqual(menSetStatus({ ...base, addOns: [{ id: "a", label: "", sku: "KASB082443", size: "L", shop: "", price: 1, discount: 0, notes: "" }] }, wd)!.pantsLinked, true);
    strictEqual(menSetStatus(setSetHandled([base], "r", true)[0]!, wd)!.complete, true);
    strictEqual(menSetStatus({ ...base, wearerNote: "carry white churidar" }, wd)!.complete, true);
  });
});
