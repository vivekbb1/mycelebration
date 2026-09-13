/**
 * The four stages an atelier order moves through, from the host placing it to
 * the finished outfit leaving the boutique.
 */
export const ORDER_STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In progress" },
  { value: "ready", label: "Ready" },
  { value: "picked_up", label: "Picked up" },
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number]["value"];

export function orderStatusLabel(value: string | null | undefined) {
  return ORDER_STATUSES.find((s) => s.value === value)?.label ?? "Pending";
}

export function orderStatusVariant(
  value: string | null | undefined,
): "default" | "secondary" | "outline" {
  if (value === "picked_up") return "outline";
  if (value === "ready") return "default";
  return "secondary";
}
