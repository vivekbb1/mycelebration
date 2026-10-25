import { it } from "node:test";
import { strictEqual } from "node:assert";
import { matchesArrivalSearch } from "./arrival-search";

const fields = ["Oscar", "Bhatia", "Big Bollywood Night", "Selected kurta", "ORIG123", "Replacement jacket", "SUB456", "ORD-2026-19", "SELL-887", "DHL", "AWB992", "Carry a shirt", "White pants", "KASB082443"];
it("finds names and families regardless of case or surrounding spaces", () => {
  strictEqual(matchesArrivalSearch(" osCAR ", fields), true);
  strictEqual(matchesArrivalSearch("bhatia", fields), true);
  strictEqual(matchesArrivalSearch("unrelated family", fields), false);
});
it("finds original, substitute and trouser outfit codes", () => {
  for (const code of ["orig123", "sub456", "kasb082443"]) strictEqual(matchesArrivalSearch(code, fields), true);
  strictEqual(matchesArrivalSearch("missing-code", fields), false);
});
it("finds platform and seller order numbers", () => {
  strictEqual(matchesArrivalSearch("ord-2026-19", fields), true);
  strictEqual(matchesArrivalSearch("sell-887", fields), true);
  strictEqual(matchesArrivalSearch("ord-2026-20", fields), false);
});
it("finds events, courier, tracking and notes and handles missing fields", () => {
  for (const query of ["bollywood", "dhl", "awb992", "carry a shirt"]) strictEqual(matchesArrivalSearch(query, fields), true);
  strictEqual(matchesArrivalSearch("", [undefined, null]), true);
  strictEqual(matchesArrivalSearch("Oscar", [undefined, null]), false);
});