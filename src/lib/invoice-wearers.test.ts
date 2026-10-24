import { it } from "node:test";
import { deepStrictEqual } from "node:assert";
import { missingInvoiceWearers, type InvoiceMember } from "./invoice-wearers";

const oscar: InvoiceMember = { id: "oscar", guest_name: "Oscar", household: "Family", claimed_by: null, gender: "men" };
const spouse: InvoiceMember = { ...oscar, id: "spouse", guest_name: "Spouse", claimed_by: "account" };
const events = [{ id: "bollywood", name: "The Big Bollywood Night", outfit_selection: true }, { id: "wedding", name: "Wedding", outfit_selection: true }];
it("lists Oscar Bollywood with no selection, even when his spouse chose a look", () => {
  const result = missingInvoiceWearers([oscar, spouse], events, [], [{ guest_id: "account", guest_name: "Spouse", member_code_id: "spouse", outfits: { event_id: "bollywood" } }], new Set());
  deepStrictEqual(result.filter(w => w.member.id === "oscar").map(w => w.event.id), ["bollywood", "wedding"]);
});
it("excludes an existing wearer-linked look but includes another missing event", () => {
  const result = missingInvoiceWearers([oscar, spouse], events, [], [{ guest_id: "account", guest_name: "Old name", member_code_id: "oscar", outfits: { event_id: "bollywood" } }], new Set());
  deepStrictEqual(result.filter(w => w.member.id === "oscar").map(w => w.event.id), ["wedding"]);
});
it("does not offer events excluded by household wardrobe access", () => {
  const result = missingInvoiceWearers([oscar], events, [{ household: "Family", event_id: "wedding", outfit_selection: true }], [], new Set());
  deepStrictEqual(result.map(w => w.event.id), ["wedding"]);
});
it("a reservation removes only its member/event pair, retaining guests without selections for other events", () => {
  const result = missingInvoiceWearers([oscar], events, [], [{ guest_id: "host", guest_name: "Oscar", member_code_id: "oscar", outfits: { event_id: "bollywood" } }], new Set());
  deepStrictEqual(result.map(w => w.key), ["member:oscar:wedding"]);
});