import { describe, it } from "node:test";
import { deepStrictEqual, strictEqual } from "node:assert";
import { missingOutfitEvents, memberLook, memberMeasurements } from "./outfit-pick-progress";

const events = [{ id: "wedding", outfit_selection: true }, { id: "sangeet", outfit_selection: true }, { id: "own", outfit_selection: false }];
const members = [
  { guest_name: "Federico", household: "Michelini", claimed_by: "federico", gender: "men" },
  { guest_name: "Annalisa", household: "Michelini", claimed_by: null, gender: "women" },
  { guest_name: "Grant", household: "Fleming", claimed_by: "grant", gender: "men" },
] as const;
describe("outfit reminders", () => {
  it("credits a spouse's proxy selection and measurements to the wearer without an account", () => {
    const look = { guest_id: "federico", guest_name: "Annalisa", outfits: { event_id: "wedding" } };
    strictEqual(memberLook(members[1], [...members], [look], "wedding"), look);
    strictEqual(memberLook(members[0], [...members], [look], "wedding"), undefined);
    const measurement = { guest_id: "federico", guest_name: "Annalisa", waist: 72 };
    strictEqual(memberMeasurements(members[1], [...members], [measurement])?.waist, 72);
  });
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
});describe("code-linked records", () => {
  const fam = [{ id: "c-alla", guest_name: "Alla Ferreiro", household: "F", claimed_by: "u1", gender: "women" }, { id: "c-alb", guest_name: "Alberto Ferreiro", household: "F", claimed_by: null, gender: "men" }];
  it("keeps a look with its person after a rename", () => {
    const look = { guest_id: "u1", guest_name: "Alla", member_code_id: "c-alla", outfits: { event_id: "wedding" } };
    strictEqual(memberLook({ ...fam[0], guest_name: "Alla F. Renamed" }, fam, [look], "wedding"), look);
  });
  it("the code wins over a mismatched name", () => {
    const look = { guest_id: "u1", guest_name: "Alberto Ferreiro", member_code_id: "c-alla", outfits: { event_id: "wedding" } };
    strictEqual(memberLook(fam[1], fam, [look], "wedding"), undefined);
    strictEqual(memberLook(fam[0], fam, [look], "wedding"), look);
  });
});
