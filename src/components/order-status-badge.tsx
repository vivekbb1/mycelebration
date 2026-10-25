import { Badge, type BadgeProps } from "@/components/ui/badge";

const statuses: Record<string, { label: string; variant: BadgeProps["variant"] }> = {
  draft: { label: "Draft", variant: "secondary" },
  placed: { label: "Placed", variant: "default" },
  shipped: { label: "Shipped", variant: "outline" },
  delivered: { label: "Delivered", variant: "default" },
  cancelled: { label: "Cancelled", variant: "destructive" },
};

export function OrderStatusBadge({ status }: { status: string }) {
  const display = statuses[status] ?? { label: status.replaceAll("_", " "), variant: "outline" };
  return <Badge variant={display.variant} className="shrink-0 whitespace-nowrap capitalize" aria-label={`Order status: ${display.label}`}>{display.label}</Badge>;
}