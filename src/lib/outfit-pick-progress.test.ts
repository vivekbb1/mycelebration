import { describe, it } from "node:test";
import { deepStrictEqual, strictEqual } from "node:assert";
import { missingOutfitEvents } from "./outfit-pick-progress";

const events = [{ id: "wedding", outfit_selection: true }, { id: "sangeet", outfit_selection: true }, { id: "own", outfit_selection: false }];
const members = [
  { guest_name: "Federico", household: "Michelini", claimed_by: "federico", gender: "men" },
  { guest_name: "Annalisa", household: "Michelini", claimed_by: null, gender: "women" },
  { guest_name: "Grant", household: "Fleming", claimed_by: "grant", gender: "men" },
] as const;
describe("outfit reminders", () => {
  it("includes Annalisa with one of two outfits missing even without her own account", () => {
    const looks = [{ guest_id: "federico", guest_name: "Annalisa", outfits: { event_id: "wedding" } }];
    deepStrictEqual(missingOutfitEvents(members[1], [...members], events, [], looks, new Set()).map((e) => e.id), ["sangeet"]);
  });
  it("does not credit Grant with another member's reservation", () => {
    const looks = [{ guest_id: "grant", guest_name: "Other member", outfits: { event_id: "wedding" } }];
    strictEqual(missingOutfitEvents(members[2], [...members], events, [], looks, new Set()).length, 2);
  });
  it("excludes own-outfit and uninvited events", () => {
    const access = [{ household: "Fleming", event_id: "wedding", outfit_selection: false }];
    deepStrictEqual(missingOutfitEvents(members[2], [...members], events, access, [], new Set()), []);
  });
  it("excludes children without a matching gallery", () => {
    const child = { ...members[2], gender: "boy" };
    deepStrictEqual(missingOutfitEvents(child, [child], events, [], [], new Set()), []);
    strictEqual(missingOutfitEvents(child, [child], events, [], [], new Set(["wedding|boy"])).length, 1);
  });
});