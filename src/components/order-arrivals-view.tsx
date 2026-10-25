import { useState } from "react";
import { ExternalLink, FileDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { ShipmentButton } from "@/components/wearer-order-actions";
import { arrivalStage, type ArrivalStage } from "@/lib/shipment";
import { money, type OrderItem } from "@/lib/shop-order";
import type { LatestSub } from "@/components/substitution-note";
import { buildArrivalsPdf, saveBlob, type ArrivalLine } from "@/lib/shop-order-pdf";

type Order = { id: string; reference: string; seller_reference: string; shop_name: string; status: string; currency: string; items: OrderItem[] };
const STAGES: [ArrivalStage, string][] = [["overdue", "Overdue"], ["due", "Expected"], ["undated", "No delivery date"], ["arrived", "Arrived"]];
const fmt = (d?: string) => d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";

/** Every active outfit by arrival: overdue, expected by date, undated, arrived. Host-only shipment details. */
export function OrderArrivalsView({ inviteId, celebrationName, orders, current, matches, substitutions, onOpen }: { inviteId: string; celebrationName: string; orders: Order[]; current: (i: OrderItem) => { wearer: string; family: string }; matches: (i: OrderItem, o: Order) => boolean; substitutions?: Map<string, LatestSub> | undefined; onOpen: (id: string) => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [stage, setStage] = useState<ArrivalStage | "">("");
  const rows = orders.filter((o) => o.status !== "cancelled").flatMap((o) => o.items.filter((i) => matches(i, o)).map((i) => ({ o, i, ...current(i), stage: arrivalStage(i, today) })));
  const sorted = STAGES.flatMap(([k]) => rows.filter((r) => r.stage === k).sort((a, b) => (k === "arrived" ? (b.i.arrivedOn ?? "").localeCompare(a.i.arrivedOn ?? "") : (a.i.expectedDelivery ?? "").localeCompare(b.i.expectedDelivery ?? "")) || a.wearer.localeCompare(b.wearer)));
  const shown = sorted.filter((r) => !stage || r.stage === stage);
  async function pdf() {
    try {
      const lines: ArrivalLine[] = shown.map((r) => ({ group: STAGES.find(([k]) => k === r.stage)![1], wearer: r.wearer, family: r.family, event: r.i.event, title: r.i.alternative?.title || r.i.title, orderedSize: r.i.orderedSize ?? "", reference: r.o.seller_reference || r.o.reference, shop: r.o.shop_name, expected: fmt(r.i.expectedDelivery), arrived: fmt(r.i.arrivedOn), courier: r.i.courierName ?? "", tracking: r.i.tracking ?? "", originalTitle: r.i.title, originalImage: r.i.image, originalSku: r.i.sku, ...(() => { const sub = substitutions?.get(r.i.reservationId); const rep = r.i.alternative ?? sub?.replacement; return rep ? { replacementTitle: rep.title || "Replacement", replacementImage: rep.image ?? "", replacementSku: rep.sku ?? "" } : {}; })(), price: `${r.o.currency} ${money(r.i.price - r.i.discount, r.o.currency)}` }));
      saveBlob(await buildArrivalsPdf(celebrationName, lines), "outfit-arrivals.pdf");
    } catch { toast.error("Couldn't create the PDF"); }
  }
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-1.5">
      {([["", "All"], ...STAGES] as const).map(([k, l]) => <Button key={k || "all"} size="sm" variant={stage === k ? "default" : "outline"} onClick={() => setStage(k)}>{l} ({k ? rows.filter((r) => r.stage === k).length : rows.length})</Button>)}
      <Button size="sm" variant="outline" className="ml-auto" disabled={!shown.length} onClick={() => void pdf()}><FileDown className="size-4" /> Arrivals PDF</Button>
    </div>
    <ul className="space-y-2">{shown.map((r, n) => { const head = n === 0 || shown[n - 1]!.stage !== r.stage; return <li key={`${r.o.id}-${r.i.reservationId}`}>
      {head ? <p className={`mb-1 mt-3 text-sm font-medium ${r.stage === "overdue" ? "text-destructive" : ""}`}>{STAGES.find(([k]) => k === r.stage)![1]}</p> : null}
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1 text-sm">
          <p className="break-words font-medium">{r.wearer} <span className="font-normal text-muted-foreground">· {r.family} · {r.i.event}</span></p>
          <p className="line-clamp-1 text-xs">{r.i.alternative?.title || r.i.title}{r.i.orderedSize ? ` · size ${r.i.orderedSize}` : ""}</p>
          <p className="text-xs text-muted-foreground">{r.i.arrivedOn ? `Arrived ${fmt(r.i.arrivedOn)}` : r.i.expectedDelivery ? `Expected ${fmt(r.i.expectedDelivery)}` : "No delivery date"}{r.i.courierName ? ` · ${r.i.courierName}` : ""}{r.i.tracking ? ` · ${r.i.tracking}` : ""}
            {r.i.trackingUrl ? <> · <a className="inline-flex items-center gap-0.5 text-primary underline-offset-2 hover:underline" href={r.i.trackingUrl} target="_blank" rel="noreferrer">Track <ExternalLink className="size-3" /></a></> : null}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2"><span className="text-xs text-muted-foreground">{r.o.reference}</span><OrderStatusBadge status={r.o.status} /><ShipmentButton inviteId={inviteId} orderId={r.o.id} items={[r.i]} label={`${r.wearer} — ${r.i.event}`} /><Button size="sm" variant="ghost" onClick={() => onOpen(r.o.id)}>Open order</Button></div>
      </div>
    </li>; })}{!shown.length ? <li className="text-sm text-muted-foreground">No outfits match.</li> : null}</ul>
  </div>;
}
