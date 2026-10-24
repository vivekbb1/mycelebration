import type { LatestSub } from "@/components/substitution-note";
import { money, type OrderItem } from "@/lib/shop-order";

type Look = { label: string; title?: string; sku?: string; designer?: string; image?: string; shop?: string; sizes: string[] };

function LookCard({ look, accent }: { look: Look; accent?: boolean }) {
  const url = look.shop && /^https?:\/\//i.test(look.shop) ? look.shop : null;
  const img = look.image ? <img src={look.image} alt={look.title ?? look.label} loading="lazy" className="h-32 w-24 shrink-0 rounded object-cover" /> : <div className="flex h-32 w-24 shrink-0 items-center justify-center rounded bg-muted text-xs text-muted-foreground">No photo</div>;
  return <div className="flex min-w-0 gap-3">
    {url ? <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${look.title ?? look.label} in shop`}>{img}</a> : img}
    <div className="min-w-0 text-sm">
      <p className={`text-xs ${accent ? "text-primary" : "text-muted-foreground"}`}>{look.label}</p>
      {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="block break-words font-medium hover:text-primary hover:underline">{look.title || "Look"}</a> : <p className="break-words font-medium">{look.title || "Look"}</p>}
      {look.sku || look.designer ? <p className="text-xs text-muted-foreground">{[look.sku, look.designer].filter(Boolean).join(" · ")}</p> : null}
      {look.sizes.map((s) => <p key={s} className="text-xs">{s}</p>)}
    </div>
  </div>;
}

/** Order items grouped by family → wearer, with original, substitute and extra items. */
export function OrderFamilyView({ items, currency, subs }: { items: OrderItem[]; currency: string; subs?: Map<string, LatestSub> | undefined }) {
  const families = new Map<string, Map<string, OrderItem[]>>();
  for (const i of items) {
    const f = families.get(i.family || "No family") ?? new Map<string, OrderItem[]>();
    f.set(i.wearer, [...(f.get(i.wearer) ?? []), i]);
    families.set(i.family || "No family", f);
  }
  if (!items.length) return <p className="text-sm text-muted-foreground">No outfits in this order yet.</p>;
  return <div className="space-y-5" aria-label="Order by family">
    {[...families].sort(([a], [b]) => a.localeCompare(b)).map(([family, people]) => <section key={family} className="space-y-3 rounded-xl border border-border p-4">
      <h3 className="font-medium">{family} <span className="text-sm font-normal text-muted-foreground">· {people.size} {people.size === 1 ? "person" : "people"}</span></h3>
      {[...people].map(([wearer, looks]) => <div key={wearer} className="space-y-3 rounded-lg bg-surface p-3">
        <p className="font-medium">{wearer}</p>
        {looks.map((item) => {
          const sub = subs?.get(item.reservationId);
          const alt = item.alternative ?? (sub ? { title: sub.replacement.title ?? "", sku: sub.replacement.sku ?? "", designer: "", shop: sub.replacement.shop ?? "", image: sub.replacement.image ?? "" } : null);
          return <div key={item.reservationId} className="space-y-3 pl-0 sm:pl-3">
            <p className="text-sm text-muted-foreground">{item.event || "Event"} · after discount {currency} {money(item.price - item.discount, currency)}</p>
            <p className="text-xs">Estimated delivery: {item.expectedDelivery || "Not recorded"} · Arrived: {item.arrivedOn || "Not yet"}{item.tracking ? ` · Tracking: ${item.tracking}` : ""}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <LookCard look={{ label: "Guest's selection", title: item.title, sku: item.sku, designer: item.designer, image: item.image, shop: item.shop, sizes: [`Guest requested size: ${item.size || "Not recorded"}`, ...(alt ? [] : [`Actual size ordered: ${item.orderedSize || "Not recorded"}`])] }} />
              {alt ? <LookCard accent look={{ label: "Substitute ordered", title: alt.title, sku: alt.sku, designer: alt.designer, image: alt.image, shop: alt.shop, sizes: [`Actual size ordered: ${item.orderedSize || sub?.replacement.size || "Not recorded"}`] }} /> : <p className="self-center text-xs text-muted-foreground">No substitute — original look ordered</p>}
            </div>
            {item.addOns?.length ? <div className="space-y-1">
              <p className="text-xs font-medium">Extra items for {wearer}</p>
              {item.addOns.map((a) => { const url = a.shop && /^https?:\/\//i.test(a.shop) ? a.shop : null; return <div key={a.id} className="flex flex-wrap justify-between gap-2 border-b border-border py-1 text-sm">
                <span>{url ? <a href={url} target="_blank" rel="noopener noreferrer" className="font-medium hover:text-primary hover:underline">{a.label}</a> : <span className="font-medium">{a.label}</span>}{a.sku ? <span className="text-muted-foreground"> · {a.sku}</span> : null} · size {a.size || "Not recorded"}{a.notes ? <span className="block text-xs text-muted-foreground">{a.notes}</span> : null}</span>
                <span>{currency} {money(a.price - a.discount, currency)}</span>
              </div>; })}
            </div> : null}
          </div>;
        })}
      </div>)}
    </section>)}
  </div>;
}
