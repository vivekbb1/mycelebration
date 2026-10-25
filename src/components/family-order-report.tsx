import { useState } from "react";
import { FileDown, MessageCircle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { buildFamilyLooksPdf, saveBlob } from "@/lib/shop-order-pdf";
import { SubstitutionNote, type LatestSub } from "@/components/substitution-note";
import { familyOrderLooks, type ReportOrder } from "@/lib/family-order-looks";
import { WardrobeFlag } from "@/components/grouped-shop-orders";
import { useInvites } from "@/components/host-invites";
import { money, orderTotals, type OrderItem } from "@/lib/shop-order";
import { alphabetical, type Sequencer } from "@/lib/order-sequence";
import { wearerLookLine } from "@/lib/wearer-order";
import { IndividualShare, ShipmentButton, WearerNoteButton, pdfFileName, sharePdfOnWhatsApp } from "@/components/wearer-order-actions";
import { OrderStatusBadge } from "@/components/order-status-badge";

function ShopLook({ title, image, shop, sku }: { title: string; image?: string; shop?: string; sku?: string }) {
  const url = shop && /^https?:\/\//i.test(shop) ? shop : null;
  const content = <>{image ? <img src={image} alt={title} loading="lazy" className="h-28 w-20 shrink-0 rounded object-cover" /> : null}<span className="min-w-0 break-words"><span className="block font-medium">{title}</span>{sku ? <span className="block text-xs text-muted-foreground">{sku}</span> : null}</span></>;
  return url ? <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 hover:text-primary">{content}</a> : <div className="flex items-start gap-3">{content}</div>;
}

type Row = ReturnType<typeof familyOrderLooks>[number]["rows"][number];

export function useCelebrationName(inviteId: string) {
  const invites = useInvites();
  return invites.data?.find((i) => i.id === inviteId)?.name?.trim() || "Our Wedding";
}

export function FamilyOrderReport({ inviteId, wardrobeSkus = null, orders, candidates, substitutions, onOpen, matches, seq = alphabetical, phones }: {
  inviteId: string; wardrobeSkus?: Set<string> | null; orders: ReportOrder[]; candidates: OrderItem[]; substitutions?: Map<string, LatestSub> | undefined; onOpen: (id: string) => void; matches?: (item: OrderItem, order: ReportOrder) => boolean;
  seq?: Sequencer; phones?: Map<string, string> | undefined;
}) {
  const families = familyOrderLooks(orders, candidates, matches).map((f) => ({ ...f, rows: [...f.rows].sort((a, b) => seq.compare({ wearer: a.wearer, event: a.item.event }, { wearer: b.wearer, event: b.item.event })) }));
  const celebrationName = useCelebrationName(inviteId);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const phoneOf = (wearer: string) => phones?.get(wearer.trim().toLowerCase());
  const lines = (rows: Row[]) => rows.map(({ item, wearer }) => wearerLookLine(item, wearer, substitutions?.get(item.reservationId)));
  const familyBlob = (name: string, rows: Row[]) => buildFamilyLooksPdf(name, celebrationName, lines(rows));
  const shareText = (name: string) => `Hello ${name}, please find attached the outfits ordered for you for ${celebrationName}. Kindly check each look and size and let us know of any last-minute changes.`;
  async function bulkDownload() {
    setBulkBusy(true);
    try {
      const { default: JSZip } = await import("jszip"); const zip = new JSZip();
      for (const f of families.filter((f) => picked.has(f.family))) zip.file(pdfFileName(f.family), await familyBlob(f.family, f.rows));
      saveBlob(await zip.generateAsync({ type: "blob", compression: "STORE" }), `${celebrationName.replace(/[^a-z0-9-]/gi, "-")}-family-pdfs.zip`);
    } catch { toast.error("Couldn't create the family PDFs"); } finally { setBulkBusy(false); }
  }
  async function familyPdf(name: string, rows: Row[]) {
    try { saveBlob(await familyBlob(name, rows), pdfFileName(name)); } catch { toast.error("Couldn't create the family PDF"); }
  }
  const active = [...new Map(families.flatMap((family) => family.rows.map(({ order }) => [order.id, order] as const))).values()];
  const currencies = [...new Set(active.map((o) => o.currency))];
  return <div className="space-y-5" aria-label="Orders by family">
    <h3 className="text-lg font-medium">Orders by family</h3>
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3 text-sm">
      <label className="inline-flex items-center gap-2"><Checkbox aria-label="Select all families" checked={families.length > 0 && picked.size === families.length} onCheckedChange={(v) => setPicked(v ? new Set(families.map((f) => f.family)) : new Set())} /> Select all families</label>
      <span className="text-muted-foreground">{picked.size} selected</span>
      <Button size="sm" disabled={!picked.size || bulkBusy} onClick={() => void bulkDownload()}><FileDown className="size-4" /> {bulkBusy ? "Preparing…" : "Download selected PDFs"}</Button>
    </div>
    <div className="flex flex-wrap gap-4">{currencies.map((currency) => {
      const total = active.filter((o) => o.currency === currency).reduce((s, o) => { const t = orderTotals(o.items, o.payments, o.courier_charges); return { value: s.value + t.total, paid: s.paid + t.paid, balance: s.balance + t.balance }; }, { value: 0, paid: 0, balance: 0 });
      return <p key={currency} className="text-sm"><strong>{currency} {money(total.value, currency)}</strong> · Amount paid {money(total.paid, currency)} · Balance to pay {money(total.balance, currency)}</p>;
    })}</div>
    {families.map((family) => {
      const people = [...new Map(family.rows.map((r) => [r.wearer, [] as Row[]])).entries()];
      for (const r of family.rows) people.find(([w]) => w === r.wearer)?.[1].push(r);
      return <section key={family.family} className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2"><label className="flex min-w-0 items-center gap-2"><Checkbox aria-label={`Select ${family.family}`} checked={picked.has(family.family)} onCheckedChange={(v) => setPicked((p) => { const n = new Set(p); if (v) n.add(family.family); else n.delete(family.family); return n; })} /><h4 className="text-lg font-medium">{family.family}</h4></label><div className="flex flex-wrap items-center gap-2"><p className="text-sm">Outfits & extras: {[...family.amounts].map(([currency, amount]) => `${currency} ${money(amount, currency)}`).join(" · ")}</p><Button size="sm" variant="outline" onClick={() => void familyPdf(family.family, family.rows)}><FileDown className="size-4" /> Family PDF</Button><Button size="sm" variant="outline" onClick={() => void sharePdfOnWhatsApp(() => familyBlob(family.family, family.rows), pdfFileName(family.family), shareText(family.family), family.rows.map((r) => phoneOf(r.wearer)).find(Boolean) ?? "")}><MessageCircle className="size-4" /> WhatsApp</Button></div></div>
      {people.map(([wearer, rows]) => <div key={wearer} className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-1"><p className="font-medium">{wearer} <span className="text-xs font-normal text-muted-foreground">· {rows.length} {rows.length === 1 ? "look" : "looks"}</span></p><div className="flex flex-wrap gap-2"><IndividualShare wearer={wearer} celebration={celebrationName} lines={lines(rows)} phone={phoneOf(wearer)} /></div></div>
      {rows.map(({ order, item }) => {
        const sub = substitutions?.get(item.reservationId);
        const comparison = sub ? { ...sub, replacement: { ...sub.replacement, ...(item.alternative ?? {}), size: item.orderedSize ?? sub.replacement.size ?? "" } } : item.alternative ? { original: { title: item.title, sku: item.sku, image: item.image, shop: item.shop, size: item.size }, replacement: { ...item.alternative, size: item.orderedSize ?? "" }, order: true, at: "" } : undefined;
        return <article key={`${order.id}-${item.reservationId}`} className="space-y-3 rounded-lg bg-surface p-3">
          <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="break-words font-medium">{wearer} · {item.event}</p><div className="mt-1 flex flex-wrap items-center gap-2"><span className="break-words text-xs text-muted-foreground">{order.reference}{order.seller_reference ? ` · ${order.seller_reference}` : ""}</span><OrderStatusBadge status={order.status} /></div></div><div className="flex flex-wrap gap-2"><WearerNoteButton inviteId={inviteId} orderId={order.id} item={item} wearer={wearer} />{order.status !== "cancelled" ? <ShipmentButton inviteId={inviteId} orderId={order.id} items={[item]} label={`${wearer} — ${item.event}`} /> : null}<Button size="sm" variant="outline" onClick={() => onOpen(order.id)}>Open order</Button></div></div>
          {item.wearerNote ? <p className="rounded-md border border-border bg-background p-2 text-sm"><span className="text-xs text-muted-foreground">Note for {wearer}: </span>{item.wearerNote}</p> : null}
          <div className="grid gap-4 sm:grid-cols-2"><div className="min-w-0 space-y-2"><p className="text-xs text-muted-foreground">Original selection</p><ShopLook title={item.title} image={item.image} shop={item.shop} sku={item.sku} /><WardrobeFlag sku={item.sku} skus={wardrobeSkus} /><p className="text-xs">Guest requested size: {item.size || "Not recorded"} · Actual ordered size: {item.orderedSize || "Not recorded"}</p>
          {comparison && !comparison.at ? <div className="space-y-2 border-t border-border pt-2"><p className="text-xs text-primary">Replacement</p><ShopLook {...comparison.replacement} title={comparison.replacement.title || "Replacement"} /><WardrobeFlag sku={comparison.replacement.sku} skus={wardrobeSkus} /><p className="text-xs">Size: {item.orderedSize || "Not recorded"}</p></div> : comparison ? <><SubstitutionNote sub={comparison} /><p className="text-xs">Replacement <WardrobeFlag sku={comparison.replacement.sku} skus={wardrobeSkus} /></p></> : null}
          <p className="text-sm">Outfit after discount: {order.currency} {money(item.price - item.discount, order.currency)}</p></div>
          <div className="min-w-0 space-y-2">{item.addOns?.length ? <><h5 className="text-sm font-medium">Extra items for {wearer}</h5>{item.addOns.map((extra) => <div key={extra.id} className="border-b border-border py-2 text-sm"><ShopLook title={extra.label} shop={extra.shop} sku={extra.sku} /><WardrobeFlag sku={extra.sku} skus={wardrobeSkus} /><p>Size: {extra.size || "Not recorded"} · {order.currency} {money(extra.price - extra.discount, order.currency)}</p>{extra.notes ? <p className="text-xs text-muted-foreground">{extra.notes}</p> : null}</div>)}</> : <p className="text-xs text-muted-foreground">No extra items</p>}</div></div>
        </article>;
      })}</div>)}
      {[...new Map(family.rows.map(({ order }) => [order.id, order])).values()].map((order) => {
        const t = orderTotals(order.items, order.payments, order.courier_charges);
        const shared = familyOrderLooks([order], candidates).length > 1;
        return <div key={order.id} className="space-y-1 text-sm"><p className="font-medium">{order.reference} · {shared ? "Whole order · includes other families" : "Whole order"}</p><p>{order.currency} {money(t.total, order.currency)} · Amount paid {money(t.paid, order.currency)} · Balance to pay {money(t.balance, order.currency)} · Courier {money(t.courier, order.currency)}</p>{order.payments.map((payment, i) => <p key={i} className="text-xs text-muted-foreground">{payment.kind === "advance" ? "Advance" : "Payment"} · {payment.date} · {order.currency} {money(payment.amount, order.currency)}{payment.reference ? ` · ${payment.reference}` : ""}</p>)}</div>;
      })}
    </section>; })}
    {!families.length ? <p className="text-sm text-muted-foreground">No active orders match this search.</p> : null}
  </div>;
}
