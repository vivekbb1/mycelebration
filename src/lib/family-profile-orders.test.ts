import { describe, expect, it } from "vitest";
import { profileOrderItems } from "./family-profile-orders";
import type { OrderItem } from "./shop-order";

const look = { reservationId: "r", wearer: "Old name", family: "Old family" } as OrderItem;
const people = [{ id: "p", guest_name: "Renamed wearer", household: "New family", claimed_by: "u" }];
describe("family profile orders", () => {
  it("follows linked membership after a family move and rename", () => {
    const reservations = [{ id: "r", member_code_id: "p", guest_name: "Old name", guest_id: "proxy" }];
    expect(profileOrderItems([look], reservations, people, "New family")[0]?.wearer).toBe("Renamed wearer");
    expect(profileOrderItems([look], reservations, people, "Old family")).toEqual([]);
  });
  it("does not guess an ambiguous legacy wearer", () => {
    const members = [{ ...people[0], guest_name: "Old name", household: "Old family" }, { ...people[0], id: "other", guest_name: "Old name", household: "Old family" }];
    expect(profileOrderItems([look], [], members, "Old family")).toEqual([]);
  });
});