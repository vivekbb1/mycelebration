import { it } from "node:test";
import { strictEqual, throws } from "node:assert";
import { needsTrouserReview, pairWhitePants, WHITE_PANTS_SKU } from "./trouser-pairing";
import { orderTotals, type OrderItem, type OrderAddOn } from "./shop-order";

const item = { reservationId: "a", title: "Black Embroidered Kurta", sku: "K1", size: "M", price: 10000, discount: 0 } as OrderItem;
const wardrobe = [{ source_sku: "K1", title: item.title, gender: "men", notes: "Style it with pants and mojaris." }, { source_sku: WHITE_PANTS_SKU, title: "White Egyptian Giza Cotton Pyjama Pants", gender: "men" }];
const pants: OrderAddOn = { id: "p", label: "White pyjama pants", sku: WHITE_PANTS_SKU, shop: "", size: "XL", price: 4598, discount: 0, notes: "" };
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