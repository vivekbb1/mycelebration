import type { OrderItem } from "./shop-order";

const normalSize = (value?: string) => {
  const s = (value ?? "").trim().toLowerCase().replace(/[ _-]+/g, " ");
  if (["mtm", "custom", "custom size", "custom made", "made to measure", "made to measurement"].includes(s)) return "mtm";
  return s.replace(/\s/g, "").replace(/^2xl$/, "xxl").replace(/^xxxl$/, "3xl");
};

/** Review signals, not proof of an error: designers may intentionally recommend a different size. */
export function orderSizeWarnings(item: Pick<OrderItem, "size" | "orderedSize" | "measurements">): string[] {
  const requested = normalSize(item.size), ordered = normalSize(item.orderedSize);
  const warnings: string[] = [];
  if (!requested) warnings.push("Requested size not recorded");
  if (!ordered) warnings.push("Actual ordered size not recorded");
  if (requested && ordered && requested !== ordered) warnings.push(requested === "mtm" || ordered === "mtm" ? "Requested and ordered sizing differ: made to measure vs standard size" : "Ordered size differs from requested size");
  const hasMeasurements = Object.entries(item.measurements ?? {}).some(([key, value]) => !["unit", "notes", "preferred_size", "gender", "member_name"].includes(key) && Number.isFinite(Number(value)) && Number(value) > 0);
  if ((requested === "mtm" || ordered === "mtm") && !hasMeasurements) warnings.push("Made to measure: no measurements recorded in the order");
  return warnings;
}