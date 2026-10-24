import { FileDown } from "lucide-react";
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
  async function familyPdf(name: string, rows: typeof families[number]["rows"]) {
    try {
      const lines: FamilyLookLine[] = rows.map(({ item, wearer }) => {
        const sub = substitutions?.get(item.reservationId);
        const alt = item.alternative ?? (sub ? { title: sub.replacement.title ?? "", image: sub.replacement.image ?? "" } : null);
        return { wearer, event: item.event, title: alt?.title || item.title, image: alt ? alt.image ?? "" : item.image, size: item.size, orderedSize: item.orderedSize ?? "", substituted: Boolean(alt), extras: (item.addOns ?? []).map((a) => ({ label: a.label, size: a.size })), note: item.wearerNote ?? "" };
      });
      saveBlob(await buildFamilyLooksPdf(name, celebrationName, lines), `${name.replace(/[^a-z0-9-]/gi, "-")}-looks.pdf`);
    } catch { toast.error("Couldn't create the family PDF"); }
  }
  const active = [...new Map(families.flatMap((family) => family.rows.map(({ order }) => [order.id, order] as const))).values()];
  const currencies = [...new Set(active.map((o) => o.currency))];
  return <div className="space-y-5" aria-label="Orders by family">
    <h3 className="text-lg font-medium">Orders by family</h3>
    <div className="flex flex-wrap gap-4">{currencies.map((currency) => {
      const total = active.filter((o) => o.currency === currency).reduce((s, o) => { const t = orderTotals(o.items, o.payments, o.courier_charges); return { value: s.value + t.total, paid: s.paid + t.paid, balance: s.balance + t.balance }; }, { value: 0, paid: 0, balance: 0 });
      return <p key={currency} className="text-sm"><strong>{currency} {money(total.value, currency)}</strong> · Amount paid {money(total.paid, currency)} · Balance to pay {money(total.balance, currency)}</p>;
    })}</div>
    {families.map((family) => <section key={family.family} className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2"><h4 className="text-lg font-medium">{family.family}</h4><div className="flex flex-wrap items-center gap-2"><p className="text-sm">Outfits & extras: {[...family.amounts].map(([currency, amount]) => `${currency} ${money(amount, currency)}`).join(" · ")}</p><Button size="sm" variant="outline" onClick={() => void familyPdf(family.family, family.rows)}><FileDown className="size-4" /> Family PDF</Button></div></div>
      {family.rows.map(({ order, item, wearer }) => {
        const sub = substitutions?.get(item.reservationId);
        const comparison = sub ? { ...sub, replacement: { ...sub.replacement, ...(item.alternative ?? {}), size: item.orderedSize ?? sub.replacement.size ?? "" } } : item.alternative ? { original: { title: item.title, sku: item.sku, image: item.image, shop: item.shop, size: item.size }, replacement: { ...item.alternative, size: item.orderedSize ?? "" }, order: true, at: "" } : undefined;
        return <article key={`${order.id}-${item.reservationId}`} className="space-y-3 rounded-lg bg-surface p-3">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-medium">{wearer} · {item.event}</p><p className="text-xs text-muted-foreground">{order.reference}{order.seller_reference ? ` · ${order.seller_reference}` : ""} · {order.status}</p></div><Button size="sm" variant="outline" onClick={() => onOpen(order.id)}>Open order</Button></div>
          <div className="grid gap-4 sm:grid-cols-2"><div className="min-w-0 space-y-2"><p className="text-xs text-muted-foreground">Original selection</p><ShopLook title={item.title} image={item.image} shop={item.shop} sku={item.sku} /><WardrobeFlag sku={item.sku} skus={wardrobeSkus} /><p className="text-xs">Guest requested size: {item.size || "Not recorded"} · Actual ordered size: {item.orderedSize || "Not recorded"}</p>
          {comparison && !comparison.at ? <div className="space-y-2 border-t border-border pt-2"><p className="text-xs text-primary">Replacement</p><ShopLook {...comparison.replacement} title={comparison.replacement.title || "Replacement"} /><WardrobeFlag sku={comparison.replacement.sku} skus={wardrobeSkus} /><p className="text-xs">Size: {item.orderedSize || "Not recorded"}</p></div> : <SubstitutionNote sub={comparison} />}
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