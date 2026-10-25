import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ExternalLink, FileDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { IndividualShare, ShipmentButton, WearerNoteButton, pdfFileName } from "@/components/wearer-order-actions";
import { ArrivalLookReview } from "@/components/arrival-look-review";
import { OutfitSubstitution } from "@/components/outfit-substitution";
import { orderSizeWarnings } from "@/lib/order-size-review";
import { sameWearer, wearerLookLine } from "@/lib/wearer-order";
import { arrivalStage, type ArrivalStage } from "@/lib/shipment";
import { compareArrivals, type ArrivalSort } from "@/lib/arrival-sort";
import { alphabetical, type Sequencer } from "@/lib/order-sequence";
import { money, type OrderItem } from "@/lib/shop-order";
import type { LatestSub } from "@/components/substitution-note";
import { buildArrivalsPdf, buildFamilyLooksPdf, saveBlob, type ArrivalLine } from "@/lib/shop-order-pdf";

type Order = { id: string; reference: string; seller_reference: string; shop_name: string; status: string; currency: string; items: OrderItem[] };
const STAGES: [ArrivalStage, string][] = [["overdue", "Overdue"], ["due", "Expected"], ["undated", "No delivery date"], ["arrived", "Arrived"]];
const fmt = (d?: string) => d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";

/** Every active outfit by arrival: overdue, expected by date, undated, arrived. Host-only shipment details. */
export function OrderArrivalsView({ inviteId, celebrationName, orders, allOrders = orders, current, matches, substitutions, seq = alphabetical, onOpen }: { inviteId: string; celebrationName: string; orders: Order[]; allOrders?: Order[]; current: (i: OrderItem) => { wearer: string; family: string; measurements?: OrderItem["measurements"] | undefined }; matches: (i: OrderItem, o: Order) => boolean; substitutions?: Map<string, LatestSub> | undefined; seq?: Sequencer; onOpen: (id: string) => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [stage, setStage] = useState<ArrivalStage | "">("");
  const rows = orders.filter((o) => o.status !== "cancelled").flatMap((o) => o.items.filter((i) => matches(i, o)).map((i) => ({ o, i, ...current(i), stage: arrivalStage(i, today) })));
  const [dateSort, setDateSort] = useState<ArrivalSort>("asc");
  const sorted = [...rows].sort((a, b) => compareArrivals(a, b, dateSort, seq));
  const [byFamily, setByFamily] = useState(false);
  const [q, setQ] = useState("");
  const [reviewOnly, setReviewOnly] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const needle = q.trim().toLowerCase();
  const filtered = sorted.filter((r) => (!stage || r.stage === stage) && (!reviewOnly || orderSizeWarnings(r.i).length > 0) && (!needle || [r.wearer, r.family, r.i.event, r.i.title, r.i.alternative?.title, r.i.sku, r.o.reference, r.o.seller_reference, r.i.tracking, r.i.wearerNote, ...(r.i.addOns ?? []).flatMap((a) => [a.label, a.sku])].some((v) => v?.toLowerCase().includes(needle))));
  const shown = byFamily ? [...filtered].sort((a, b) => a.family.localeCompare(b.family) || seq.compare({ wearer: a.wearer, event: a.i.event }, { wearer: b.wearer, event: b.i.event })) : filtered;
  const groupOf = (r: (typeof shown)[number]) => byFamily || dateSort === "family" ? r.family || "No family" : dateSort === "individual" ? r.wearer : dateSort === "event" ? r.i.event : fmt(r.i.arrivedOn || r.i.expectedDelivery) || "No delivery date";
  const exportRows = allOrders.filter((o) => o.status !== "cancelled").flatMap((o) => o.items.map((i) => ({ i, ...current(i) })));
  const linesFor = (family: string, wearer?: string) => exportRows.filter((r) => wearer ? sameWearer(r, { wearer, family }) : r.family === family).sort((a, b) => seq.compare({ wearer: a.wearer, event: a.i.event }, { wearer: b.wearer, event: b.i.event })).map((r) => wearerLookLine(r.i, r.wearer, substitutions?.get(r.i.reservationId)));
  async function familyPdf(family: string) {
    setPdfBusy(true);
    try { saveBlob(await buildFamilyLooksPdf(family, celebrationName, linesFor(family)), pdfFileName(family)); }
    catch { toast.error("Couldn't create the family PDF"); } finally { setPdfBusy(false); }
  }
  const lineOf = (r: (typeof shown)[number]): ArrivalLine => {
    const sub = substitutions?.get(r.i.reservationId); const rep = r.i.alternative ?? sub?.replacement;
    return { group: groupOf(r), wearer: r.wearer, family: r.family, event: r.i.event, title: rep?.title || r.i.title, orderedSize: r.i.orderedSize ?? "", requestedSize: r.i.size ?? "", reference: r.o.seller_reference || r.o.reference, shop: r.o.shop_name, expected: fmt(r.i.expectedDelivery), arrived: fmt(r.i.arrivedOn), courier: r.i.courierName ?? "", tracking: r.i.tracking ?? "",
      originalTitle: r.i.title, originalImage: r.i.image, originalSku: r.i.sku, ...(rep ? { replacementTitle: rep.title || "Replacement", replacementImage: rep.image ?? "", replacementSku: rep.sku ?? "" } : {}),
      price: `${r.o.currency} ${money(r.i.price - r.i.discount, r.o.currency)}`, note: [r.i.wearerNote, ...orderSizeWarnings(r.i).map((w) => `Size review: ${w}`)].filter(Boolean).join(" · "),
      ...(byFamily ? { subgroup: r.wearer } : {}), extras: (r.i.addOns ?? []).map((e) => `${e.label || "Extra item"}${e.sku ? ` (${e.sku})` : ""}${e.size ? ` · size ${e.size}` : ""} · ${r.o.currency} ${money(e.price - e.discount, r.o.currency)}`) };
  };
  async function pdf() {
    try { saveBlob(await buildArrivalsPdf(byFamily ? `${celebrationName} - by family` : celebrationName, shown.map(lineOf)), byFamily ? "outfit-arrivals-by-family.pdf" : "outfit-arrivals.pdf"); } catch { toast.error("Couldn't create the PDF"); }
  }
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-1.5">
      {([["", "All"], ...STAGES] as const).map(([k, l]) => <Button key={k || "all"} size="sm" variant={stage === k ? "default" : "outline"} onClick={() => setStage(k)}>{l} ({k ? rows.filter((r) => r.stage === k).length : rows.length})</Button>)}
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, family, event, look, tracking…" aria-label="Search arrivals" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm sm:w-64" />
      <span className="ml-auto inline-flex gap-1"><Button size="sm" variant={byFamily ? "outline" : "default"} onClick={() => setByFamily(false)}>By date</Button><Button size="sm" variant={byFamily ? "default" : "outline"} onClick={() => setByFamily(true)}>By family</Button></span>
      {!byFamily ? <Select value={dateSort} onValueChange={(value) => { if (["asc", "desc", "individual", "family", "event"].includes(value)) setDateSort(value as ArrivalSort); }}><SelectTrigger aria-label="Sort arrivals" className="w-full sm:w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="asc">Date: earliest first</SelectItem><SelectItem value="desc">Date: latest first</SelectItem><SelectItem value="individual">By individual</SelectItem><SelectItem value="family">By family</SelectItem><SelectItem value="event">By event</SelectItem></SelectContent></Select> : null}
      <Button size="sm" variant="outline" disabled={!shown.length} onClick={() => void pdf()}><FileDown className="size-4" /> Arrivals PDF</Button>
    </div>
    <div className="flex flex-wrap items-center gap-2"><Button size="sm" variant={reviewOnly ? "default" : "outline"} onClick={() => setReviewOnly((v) => !v)}><AlertTriangle className="size-4" /> Size review ({rows.filter((r) => orderSizeWarnings(r.i).length > 0).length})</Button></div>
    <ul className="space-y-2">{shown.map((r, n) => { const previous = shown[n - 1]; const head = !previous || groupOf(previous) !== groupOf(r); const warnings = orderSizeWarnings(r.i); return <li key={`${r.o.id}-${r.i.reservationId}`}>
      {head ? <div className={`mb-1 mt-4 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 ${!byFamily && r.stage === "overdue" ? "text-destructive" : ""}`}><h3 className="min-w-0 break-words text-base font-medium">{byFamily && r.family ? <Link to="/family/$household" params={{ household: r.family }} className="text-primary hover:underline">{groupOf(r)}</Link> : groupOf(r)}{byFamily ? <span className="ml-2 text-xs font-normal text-muted-foreground">{shown.filter((x) => x.family === r.family).length} outfits</span> : null}</h3>{byFamily ? <Button size="sm" variant="outline" disabled={pdfBusy} onClick={() => void familyPdf(r.family)}><FileDown className="size-4" /> Family PDF</Button> : null}</div> : null}
      {byFamily && (head || previous?.wearer !== r.wearer) ? <div className="mb-1 mt-2 flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface px-2 py-2"><div className="min-w-0"><h4 className="break-words text-sm font-medium">{r.wearer}</h4><p className="break-words text-xs text-muted-foreground">{[...new Set(shown.filter((x) => x.family === r.family && x.wearer === r.wearer).map((x) => x.i.event))].join(" → ")}</p></div><div className="flex flex-wrap gap-2"><IndividualShare wearer={r.wearer} celebration={celebrationName} lines={linesFor(r.family, r.wearer)} /></div></div> : null}
      {(() => { const l = lineOf(r); const pic = (src: string | undefined, label: string) => <div className="w-14 shrink-0 text-center"><div className="aspect-[3/4] overflow-hidden rounded bg-muted">{src ? <img src={src} alt={label} loading="lazy" className="h-full w-full object-cover" /> : null}</div><p className="mt-0.5 text-[10px] text-muted-foreground">{label}</p></div>;
      return <div className="grid grid-cols-[minmax(0,1fr)] gap-3 rounded-lg border border-border bg-card p-3 sm:grid-cols-[7.5rem_minmax(0,1fr)]">
        <div className="flex w-[7.5rem] gap-1.5">{pic(l.originalImage, "Selected")}{l.replacementTitle ? pic(l.replacementImage, "Substitute") : null}</div>
        <div className="grid min-w-0 gap-x-4 gap-y-2 text-sm md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.8fr)]">
          <div className="min-w-0"><p className="break-words font-medium">{l.wearer}</p>{r.family ? <Link to="/family/$household" params={{ household: r.family }} className="break-words text-xs text-primary hover:underline">{l.family}</Link> : <p className="text-xs text-muted-foreground">No family</p>}<p className="text-xs">Requested: {l.requestedSize || "—"} · Ordered: <strong>{l.orderedSize || "—"}</strong></p></div>
          <div className="min-w-0"><p className="font-medium">{l.event}</p><p className="break-words text-xs">Selected: {l.originalTitle} <span className="text-muted-foreground">· {l.originalSku || "—"}</span></p>{l.replacementTitle ? <p className="break-words text-xs text-primary">Substitute: {l.replacementTitle} <span className="text-muted-foreground">· {l.replacementSku || "—"}</span></p> : null}<p className="text-xs font-medium">{l.price}</p></div>
          <div className="min-w-0 text-xs"><p className="font-medium text-sm">{l.reference}</p><p className="text-muted-foreground">{l.shop}</p><p>Expected: {l.expected || "—"} · Arrived: {l.arrived || "Not yet"}</p></div>
          <div className="min-w-0 text-xs"><p>{l.courier || "No courier"}{l.tracking ? ` · ${l.tracking}` : ""}</p>{r.i.trackingUrl ? <a className="inline-flex items-center gap-0.5 text-primary underline-offset-2 hover:underline" href={r.i.trackingUrl} target="_blank" rel="noreferrer">Track <ExternalLink className="size-3" /></a> : null}</div>
          {l.extras.length || r.i.wearerNote || warnings.length ? <div className="space-y-1 border-t border-border pt-2 text-xs md:col-span-2 xl:col-span-4">{l.extras.map((e) => <p key={e} className="break-words text-muted-foreground">+ Extra: {e}</p>)}{r.i.wearerNote ? <p className="break-words font-medium text-primary">Wearer note: {r.i.wearerNote}</p> : null}{warnings.length ? <div className="space-y-1 text-destructive"><p className="font-medium"><AlertTriangle className="mr-1 inline size-3.5" />{r.i.arrivedOn || ["shipped", "delivered"].includes(r.o.status) ? "Size review" : "Reconfirm size before dispatch"}</p>{warnings.map((w) => <p key={w} className="break-words">{w}</p>)}</div> : null}</div> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2 sm:col-span-2"><OrderStatusBadge status={r.o.status} /><ShipmentButton inviteId={inviteId} orderId={r.o.id} items={[r.i]} label={`${r.wearer} — ${r.i.event}`} /><ArrivalLookReview inviteId={inviteId} orderId={r.o.id} item={r.i} wearer={r.wearer} currentMeasurements={r.measurements} /><OutfitSubstitution inviteId={inviteId} orderId={r.o.id} item={{ ...r.i, wearer: r.wearer, family: r.family }} /><WearerNoteButton inviteId={inviteId} orderId={r.o.id} item={r.i} wearer={r.wearer} />{!byFamily ? <><Button size="sm" variant="outline" disabled={pdfBusy} onClick={() => void familyPdf(r.family)}><FileDown className="size-4" /> Family PDF</Button><IndividualShare wearer={r.wearer} celebration={celebrationName} lines={linesFor(r.family, r.wearer)} /></> : null}<Button size="sm" variant="ghost" onClick={() => onOpen(r.o.id)}>Open order</Button></div>
      </div>; })()}
    </li>; })}{!shown.length ? <li className="text-sm text-muted-foreground">No outfits match.</li> : null}</ul>
  </div>;
}
