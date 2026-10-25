import { useState } from "react";
import { ExternalLink, FileDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { ShipmentButton } from "@/components/wearer-order-actions";
import { arrivalStage, type ArrivalStage } from "@/lib/shipment";
import { alphabetical, type Sequencer } from "@/lib/order-sequence";
import { money, type OrderItem } from "@/lib/shop-order";
import type { LatestSub } from "@/components/substitution-note";
import { buildArrivalsPdf, saveBlob, type ArrivalLine } from "@/lib/shop-order-pdf";

type Order = { id: string; reference: string; seller_reference: string; shop_name: string; status: string; currency: string; items: OrderItem[] };
const STAGES: [ArrivalStage, string][] = [["overdue", "Overdue"], ["due", "Expected"], ["undated", "No delivery date"], ["arrived", "Arrived"]];
const fmt = (d?: string) => d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";

/** Every active outfit by arrival: overdue, expected by date, undated, arrived. Host-only shipment details. */
export function OrderArrivalsView({ inviteId, celebrationName, orders, current, matches, substitutions, seq = alphabetical, onOpen }: { inviteId: string; celebrationName: string; orders: Order[]; current: (i: OrderItem) => { wearer: string; family: string }; matches: (i: OrderItem, o: Order) => boolean; substitutions?: Map<string, LatestSub> | undefined; seq?: Sequencer; onOpen: (id: string) => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [stage, setStage] = useState<ArrivalStage | "">("");
  const rows = orders.filter((o) => o.status !== "cancelled").flatMap((o) => o.items.filter((i) => matches(i, o)).map((i) => ({ o, i, ...current(i), stage: arrivalStage(i, today) })));
  const sorted = STAGES.flatMap(([k]) => rows.filter((r) => r.stage === k).sort((a, b) => (k === "arrived" ? (b.i.arrivedOn ?? "").localeCompare(a.i.arrivedOn ?? "") : (a.i.expectedDelivery ?? "").localeCompare(b.i.expectedDelivery ?? "")) || a.wearer.localeCompare(b.wearer)));
  const [byFamily, setByFamily] = useState(false);
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const filtered = sorted.filter((r) => (!stage || r.stage === stage) && (!needle || [r.wearer, r.family, r.i.event, r.i.title, r.i.alternative?.title, r.i.sku, r.o.reference, r.o.seller_reference, r.i.tracking, r.i.wearerNote].some((v) => v?.toLowerCase().includes(needle))));
  const shown = byFamily ? [...filtered].sort((a, b) => a.family.localeCompare(b.family) || seq.compare({ wearer: a.wearer, event: a.i.event }, { wearer: b.wearer, event: b.i.event })) : filtered;
  const groupOf = (r: (typeof shown)[number]) => byFamily ? r.family : STAGES.find(([k]) => k === r.stage)![1];
  const lineOf = (r: (typeof shown)[number]): ArrivalLine => {
    const sub = substitutions?.get(r.i.reservationId); const rep = r.i.alternative ?? sub?.replacement;
    return { group: groupOf(r), wearer: r.wearer, family: r.family, event: r.i.event, title: rep?.title || r.i.title, orderedSize: r.i.orderedSize ?? "", requestedSize: r.i.size ?? "", reference: r.o.seller_reference || r.o.reference, shop: r.o.shop_name, expected: fmt(r.i.expectedDelivery), arrived: fmt(r.i.arrivedOn), courier: r.i.courierName ?? "", tracking: r.i.tracking ?? "",
      originalTitle: r.i.title, originalImage: r.i.image, originalSku: r.i.sku, ...(rep ? { replacementTitle: rep.title || "Replacement", replacementImage: rep.image ?? "", replacementSku: rep.sku ?? "" } : {}),
      price: `${r.o.currency} ${money(r.i.price - r.i.discount, r.o.currency)}`, note: r.i.wearerNote ?? "",
      subgroup: byFamily ? r.wearer : undefined, extras: (r.i.addOns ?? []).map((e) => `${e.label || "Extra item"}${e.sku ? ` (${e.sku})` : ""}${e.size ? ` · size ${e.size}` : ""} · ${r.o.currency} ${money(e.price - e.discount, r.o.currency)}`) };
  };
  async function pdf() {
    try { saveBlob(await buildArrivalsPdf(byFamily ? `${celebrationName} - by family` : celebrationName, shown.map(lineOf)), byFamily ? "outfit-arrivals-by-family.pdf" : "outfit-arrivals.pdf"); } catch { toast.error("Couldn't create the PDF"); }
  }
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-1.5">
      {([["", "All"], ...STAGES] as const).map(([k, l]) => <Button key={k || "all"} size="sm" variant={stage === k ? "default" : "outline"} onClick={() => setStage(k)}>{l} ({k ? rows.filter((r) => r.stage === k).length : rows.length})</Button>)}
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, family, event, look, tracking…" aria-label="Search arrivals" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm sm:w-64" />
      <span className="ml-auto inline-flex gap-1"><Button size="sm" variant={byFamily ? "outline" : "default"} onClick={() => setByFamily(false)}>By date</Button><Button size="sm" variant={byFamily ? "default" : "outline"} onClick={() => setByFamily(true)}>By family</Button></span>
      <Button size="sm" variant="outline" disabled={!shown.length} onClick={() => void pdf()}><FileDown className="size-4" /> Arrivals PDF</Button>
    </div>
    <ul className="space-y-2">{shown.map((r, n) => { const head = n === 0 || groupOf(shown[n - 1]!) !== groupOf(r); return <li key={`${r.o.id}-${r.i.reservationId}`}>
      {head ? <p className={`mb-1 mt-4 border-b border-border pb-1 text-base font-medium ${!byFamily && r.stage === "overdue" ? "text-destructive" : ""}`}>{groupOf(r)}{byFamily ? <span className="ml-2 text-xs font-normal text-muted-foreground">{shown.filter((x) => x.family === r.family).length} outfits</span> : null}</p> : null}
      {byFamily && (head || shown[n - 1]!.wearer !== r.wearer) ? <p className="mb-1 mt-2 rounded-md bg-surface px-2 py-1 text-sm font-medium">{r.wearer} <span className="text-xs font-normal text-muted-foreground">· {shown.filter((x) => x.family === r.family && x.wearer === r.wearer).map((x) => x.i.event).join(" → ")}</span></p> : null}
      {(() => { const l = lineOf(r); const pic = (src: string | undefined, label: string) => <div className="w-14 shrink-0 text-center"><div className="aspect-[3/4] overflow-hidden rounded bg-muted">{src ? <img src={src} alt={label} loading="lazy" className="h-full w-full object-cover" /> : null}</div><p className="mt-0.5 text-[10px] text-muted-foreground">{label}</p></div>;
      return <div className="grid grid-cols-[minmax(0,1fr)] gap-3 rounded-xl border border-border bg-card p-3 sm:grid-cols-[7.5rem_minmax(0,1fr)] lg:grid-cols-[7.5rem_minmax(0,1fr)_8.5rem]">
        <div className="flex w-[7.5rem] gap-1.5">{pic(l.originalImage, "Selected")}{l.replacementTitle ? pic(l.replacementImage, "Substitute") : null}</div>
        <div className="grid min-w-0 gap-x-4 gap-y-2 text-sm md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.8fr)]">
          <div className="min-w-0"><p className="break-words font-medium">{l.wearer}</p><p className="text-xs text-muted-foreground">{l.family}</p><p className="text-xs">Requested: {l.requestedSize || "—"} · Ordered: <strong>{l.orderedSize || "—"}</strong></p></div>
          <div className="min-w-0"><p className="font-medium">{l.event}</p><p className="break-words text-xs">Selected: {l.originalTitle} <span className="text-muted-foreground">· {l.originalSku || "—"}</span></p>{l.replacementTitle ? <p className="break-words text-xs text-primary">Substitute: {l.replacementTitle} <span className="text-muted-foreground">· {l.replacementSku || "—"}</span></p> : null}<p className="text-xs font-medium">{l.price}</p></div>
          <div className="min-w-0 text-xs"><p className="font-medium text-sm">{l.reference}</p><p className="text-muted-foreground">{l.shop}</p><p>Expected: {l.expected || "—"} · Arrived: {l.arrived || "Not yet"}</p></div>
          <div className="min-w-0 text-xs"><p>{l.courier || "No courier"}{l.tracking ? ` · ${l.tracking}` : ""}</p>{r.i.trackingUrl ? <a className="inline-flex items-center gap-0.5 text-primary underline-offset-2 hover:underline" href={r.i.trackingUrl} target="_blank" rel="noreferrer">Track <ExternalLink className="size-3" /></a> : null}</div>
          {l.extras.length || l.note ? <div className="space-y-0.5 border-t border-border pt-2 text-xs md:col-span-2 xl:col-span-4">{l.extras.map((e) => <p key={e} className="text-muted-foreground">+ Extra: {e}</p>)}{l.note ? <p className="font-medium text-primary">Wearer note: {l.note}</p> : null}</div> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-1 lg:flex-col lg:items-stretch"><OrderStatusBadge status={r.o.status} /><ShipmentButton inviteId={inviteId} orderId={r.o.id} items={[r.i]} label={`${r.wearer} — ${r.i.event}`} /><Button size="sm" variant="ghost" onClick={() => onOpen(r.o.id)}>Open order</Button></div>
      </div>; })()}
    </li>; })}{!shown.length ? <li className="text-sm text-muted-foreground">No outfits match.</li> : null}</ul>
  </div>;
}
