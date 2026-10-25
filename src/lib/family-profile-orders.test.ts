import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { profileOrderItems } from "./family-profile-orders";
import type { OrderItem } from "./shop-order";

const look = { reservationId: "r", wearer: "Old name", family: "Old family" } as OrderItem;
const people = [{ id: "p", guest_name: "Renamed wearer", household: "New family", claimed_by: "u" }];
describe("family profile orders", () => {
  it("follows linked membership after a family move and rename", () => {
    const reservations = [{ id: "r", member_code_id: "p", guest_name: "Old name", guest_id: "proxy" }];
    assert.equal(profileOrderItems([look], reservations, people, "New family")[0]?.wearer, "Renamed wearer");
    assert.deepEqual(profileOrderItems([look], reservations, people, "Old family"), []);
  });
  it("does not guess an ambiguous legacy wearer", () => {
    const members = [{ id: "p", claimed_by: "u", guest_name: "Old name", household: "Old family" }, { id: "other", claimed_by: "u", guest_name: "Old name", household: "Old family" }];
    assert.deepEqual(profileOrderItems([look], [], members, "Old family"), []);
  });
});