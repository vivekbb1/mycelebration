import { describe, it, expect } from "bun:test";
import { missingOutfitEvents } from "./outfit-pick-progress";

const events = [{ id: "wedding", outfit_selection: true }, { id: "sangeet", outfit_selection: true }, { id: "own", outfit_selection: false }];
const members = [
  { guest_name: "Federico", household: "Michelini", claimed_by: "federico", gender: "men" },
  { guest_name: "Annalisa", household: "Michelini", claimed_by: null, gender: "women" },
  { guest_name: "Grant", household: "Fleming", claimed_by: "grant", gender: "men" },
];
describe("outfit reminders", () => {
  it("includes Annalisa with one of two outfits missing even without her own account", () => {
    const looks = [{ guest_id: "federico", guest_name: "Annalisa", outfits: { event_id: "wedding" } }];
    expect(missingOutfitEvents(members[1], members, events, [], looks, new Set()).map((e) => e.id)).toEqual(["sangeet"]);
  });
  it("does not credit Grant with another member's reservation", () => {
    const looks = [{ guest_id: "grant", guest_name: "Other member", outfits: { event_id: "wedding" } }];
    expect(missingOutfitEvents(members[2], members, events, [], looks, new Set()).length).toBe(2);
  });
  it("excludes own-outfit and uninvited events", () => {
    const access = [{ household: "Fleming", event_id: "wedding", outfit_selection: false }];
    expect(missingOutfitEvents(members[2], members, events, access, [], new Set())).toEqual([]);
  });
  it("excludes children without a matching gallery", () => {
    const child = { ...members[2], gender: "boy" };
    expect(missingOutfitEvents(child, [child], events, [], [], new Set())).toEqual([]);
    expect(missingOutfitEvents(child, [child], events, [], [], new Set(["wedding|boy"])).length).toBe(1);
  });
});