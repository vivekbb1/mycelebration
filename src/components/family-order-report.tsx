import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileDown, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { buildFamilyLooksPdf, saveBlob, type FamilyLookLine } from "@/lib/shop-order-pdf";
import { SubstitutionNote, type LatestSub } from "@/components/substitution-note";
import { familyOrderLooks, type ReportOrder } from "@/lib/family-order-looks";
import { WardrobeFlag } from "@/components/grouped-shop-orders";
import { useInvites } from "@/components/host-invites";
import { money, orderTotals, type OrderItem } from "@/lib/shop-order";

function ShopLook({ title, image, shop, sku }: { title: string; image?: string; shop?: string; sku?: string }) {
  const url = shop && /^https?:\/\//i.test(shop) ? shop : null;
  const content = <>{image ? <img src={image} alt={title} loading="lazy" className="h-28 w-20 shrink-0 rounded object-cover" /> : null}<span className="min-w-0 break-words"><span className="block font-medium">{title}</span>{sku ? <span className="block text-xs text-muted-foreground">{sku}</span> : null}</span></>;
  return url ? <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 hover:text-primary">{content}</a> : <div className="flex items-start gap-3">{content}</div>;
}

export function FamilyOrderReport({ inviteId, wardrobeSkus = null, orders, candidates, substitutions, onOpen, matches }: {
  inviteId: string; wardrobeSkus?: Set<string> | null; orders: ReportOrder[]; candidates: OrderItem[]; substitutions?: Map<string, LatestSub> | undefined; onOpen: (id: string) => void; matches?: (item: OrderItem, order: ReportOrder) => boolean;
}) {
  const families = familyOrderLooks(orders, candidates, matches);
  const invites = useInvites();
  const celebrationName = invites.data?.find((i) => i.id === inviteId)?.name?.trim() || "Our Wedding";
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const phones = useQuery({ queryKey: ["family-pdf-phones", inviteId], queryFn: async () => {
    const r = await supabase.from("invite_codes").select("guest_name, phone").eq("invite_id", inviteId).not("phone", "is", null);
    if (r.error) throw r.error;
    const m = new Map<string, string>(); for (const c of r.data ?? []) { const d = String(c.phone ?? "").replace(/\D/g, ""); if (d.length >= 8 && c.guest_name) m.set(c.guest_name.trim().toLowerCase(), d); } return m;
  } });
  const fileName = (name: string) => `${name.replace(/[^a-z0-9-]/gi, "-")}-looks.pdf`;
  const shareText = (name: string) => `Hello ${name}, please find attached the outfits ordered for you for ${celebrationName}. Kindly check each look and size and let us know of any last-minute changes.`;
  async function bulkDownload() {
    setBulkBusy(true);
    try {
      const { default: JSZip } = await import("jszip"); const zip = new JSZip();
      for (const f of families.filter((f) => picked.has(f.family))) zip.file(fileName(f.family), await familyBlob(f.family, f.rows));
      saveBlob(await zip.generateAsync({ type: "blob", compression: "STORE" }), `${celebrationName.replace(/[^a-z0-9-]/gi, "-")}-family-pdfs.zip`);
    } catch { toast.error("Couldn't create the family PDFs"); } finally { setBulkBusy(false); }
  }
  async function whatsapp(name: string, rows: typeof families[number]["rows"]) {
    const phone = rows.map(({ wearer }) => phones.data?.get(wearer.trim().toLowerCase())).find(Boolean) ?? "";
    const touch = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
    const tab = touch ? null : window.open("", "_blank");
    try {
      const blob = await familyBlob(name, rows);
      const file = new File([blob], fileName(name), { type: "application/pdf" });
      if (touch && navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], text: shareText(name) }); return; } catch (e) { if ((e as DOMException).name === "AbortError") return; } }
      saveBlob(blob, fileName(name));
      const url = `https://wa.me/${phone}?text=${encodeURIComponent(shareText(name))}`;
      if (tab) tab.location.href = url; else window.location.href = url;
      toast.success("PDF downloaded — attach it in the WhatsApp chat that opened");
    } catch { tab?.close(); toast.error("Couldn't create the family PDF"); }
  }
  async function familyPdf(name: string, rows: typeof families[number]["rows"]) {
    try { saveBlob(await familyBlob(name, rows), fileName(name)); } catch { toast.error("Couldn't create the family PDF"); }
  }
  async function familyBlob(name: string, rows: typeof families[number]["rows"]) {
    {
      const lines: FamilyLookLine[] = rows.map(({ item, wearer }) => {
        const sub = substitutions?.get(item.reservationId);
        const alt = item.alternative ?? (sub ? { title: sub.replacement.title ?? "", image: sub.replacement.image ?? "" } : null);
        return { wearer, event: item.event, title: alt?.title || item.title, image: alt ? alt.image ?? "" : item.image, size: item.size, orderedSize: item.orderedSize ?? "", substituted: Boolean(alt), originalTitle: alt ? (item.alternative ? item.title : sub?.original.title || item.title) : "", extras: (item.addOns ?? []).map((a) => ({ label: !a.label || /^extra item$/i.test(a.label.trim()) ? "Additional piece to complete the look" : a.label, size: a.size })), note: item.wearerNote ?? "" };
      });
      return await buildFamilyLooksPdf(name, celebrationName, lines);
    }
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
    {families.map((family) => <section key={family.family} className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2"><label className="flex min-w-0 items-center gap-2"><Checkbox aria-label={`Select ${family.family}`} checked={picked.has(family.family)} onCheckedChange={(v) => setPicked((p) => { const n = new Set(p); if (v) n.add(family.family); else n.delete(family.family); return n; })} /><h4 className="text-lg font-medium">{family.family}</h4></label><div className="flex flex-wrap items-center gap-2"><p className="text-sm">Outfits & extras: {[...family.amounts].map(([currency, amount]) => `${currency} ${money(amount, currency)}`).join(" · ")}</p><Button size="sm" variant="outline" onClick={() => void familyPdf(family.family, family.rows)}><FileDown className="size-4" /> Family PDF</Button><Button size="sm" variant="outline" onClick={() => void whatsapp(family.family, family.rows)}><MessageCircle className="size-4" /> WhatsApp</Button></div></div>
      {family.rows.map(({ order, item, wearer }) => {
        const sub = substitutions?.get(item.reservationId);
        const comparison = sub ? { ...sub, replacement: { ...sub.replacement, ...(item.alternative ?? {}), size: item.orderedSize ?? sub.replacement.size ?? "" } } : item.alternative ? { original: { title: item.title, sku: item.sku, image: item.image, shop: item.shop, size: item.size }, replacement: { ...item.alternative, size: item.orderedSize ?? "" }, order: true, at: "" } : undefined;
        return <article key={`${order.id}-${item.reservationId}`} className="space-y-3 rounded-lg bg-surface p-3">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-medium">{wearer} · {item.event}</p><p className="text-xs text-muted-foreground">{order.reference}{order.seller_reference ? ` · ${order.seller_reference}` : ""} · {order.status}</p></div><Button size="sm" variant="outline" onClick={() => onOpen(order.id)}>Open order</Button></div>
          <div className="grid gap-4 sm:grid-cols-2"><div className="min-w-0 space-y-2"><p className="text-xs text-muted-foreground">Original selection</p><ShopLook title={item.title} image={item.image} shop={item.shop} sku={item.sku} /><WardrobeFlag sku={item.sku} skus={wardrobeSkus} /><p className="text-xs">Guest requested size: {item.size || "Not recorded"} · Actual ordered size: {item.orderedSize || "Not recorded"}</p>
          {comparison && !comparison.at ? <div className="space-y-2 border-t border-border pt-2"><p className="text-xs text-primary">Replacement</p><ShopLook {...comparison.replacement} title={comparison.replacement.title || "Replacement"} /><WardrobeFlag sku={comparison.replacement.sku} skus={wardrobeSkus} /><p className="text-xs">Size: {item.orderedSize || "Not recorded"}</p></div> : comparison ? <><SubstitutionNote sub={comparison} /><p className="text-xs">Replacement <WardrobeFlag sku={comparison.replacement.sku} skus={wardrobeSkus} /></p></> : null}
          <p className="text-sm">Outfit after discount: {order.currency} {money(item.price - item.discount, order.currency)}</p></div>
          <div className="min-w-0 space-y-2">{item.addOns?.length ? <><h5 className="text-sm font-medium">Extra items for {wearer}</h5>{item.addOns.map((extra) => <div key={extra.id} className="border-b border-border py-2 text-sm"><ShopLook title={extra.label} shop={extra.shop} sku={extra.sku} /><WardrobeFlag sku={extra.sku} skus={wardrobeSkus} /><p>Size: {extra.size || "Not recorded"} · {order.currency} {money(extra.price - extra.discount, order.currency)}</p>{extra.notes ? <p className="text-xs text-muted-foreground">{extra.notes}</p> : null}</div>)}</> : <p className="text-xs text-muted-foreground">No extra items</p>}</div></div>
        </article>;
      })}
      {[...new Map(family.rows.map(({ order }) => [order.id, order])).values()].map((order) => {
        const t = orderTotals(order.items, order.payments, order.courier_charges);
        const shared = familyOrderLooks([order], candidates).length > 1;
        return <div key={order.id} className="space-y-1 text-sm"><p className="font-medium">{order.reference} · {shared ? "Whole order · includes other families" : "Whole order"}</p><p>{order.currency} {money(t.total, order.currency)} · Amount paid {money(t.paid, order.currency)} · Balance to pay {money(t.balance, order.currency)} · Courier {money(t.courier, order.currency)}</p>{order.payments.map((payment, i) => <p key={i} className="text-xs text-muted-foreground">{payment.kind === "advance" ? "Advance" : "Payment"} · {payment.date} · {order.currency} {money(payment.amount, order.currency)}{payment.reference ? ` · ${payment.reference}` : ""}</p>)}</div>;
      })}
    </section>)}
    {!families.length ? <p className="text-sm text-muted-foreground">No active orders match this search.</p> : null}
  </div>;
}