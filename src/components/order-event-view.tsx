import { useState } from "react";
import type { LatestSub } from "@/components/substitution-note";
import { Button } from "@/components/ui/button";
import { familyOrderLooks, type ReportOrder } from "@/lib/family-order-looks";
import { alphabetical, type Sequencer } from "@/lib/order-sequence";
import type { OrderItem } from "@/lib/shop-order";

/** One event at a time, each family's outfits side by side — for couple pairing and colour coordination. */
export function OrderEventView({ orders, candidates, substitutions, matches, events, seq = alphabetical, onOpen }: {
  orders: ReportOrder[]; candidates: OrderItem[]; substitutions?: Map<string, LatestSub> | undefined; matches?: (item: OrderItem, order: ReportOrder) => boolean;
  events: string[]; seq?: Sequencer; onOpen: (id: string) => void;
}) {
  const families = familyOrderLooks(orders, candidates, matches);
  const present = new Set(families.flatMap((f) => f.rows.map((r) => r.item.event)));
  const list = [...events.filter((e) => present.has(e)), ...[...present].filter((e) => !events.includes(e)).sort((a, b) => seq.event(a) - seq.event(b) || a.localeCompare(b))];
  const [chosen, setChosen] = useState("");
  const event = list.includes(chosen) ? chosen : list[0] ?? "";
  const shown = families.map((f) => ({ ...f, rows: f.rows.filter((r) => r.item.event === event).sort((a, b) => seq.compare({ wearer: a.wearer, event }, { wearer: b.wearer, event })) })).filter((f) => f.rows.length);
  if (!list.length) return <p className="text-sm text-muted-foreground">No active orders match this search.</p>;
  return <div className="space-y-4" aria-label="Orders by event">
    <div role="group" aria-label="Choose event" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {list.map((e) => <Button key={e} size="sm" className="shrink-0" variant={e === event ? "default" : "outline"} aria-pressed={e === event} onClick={() => setChosen(e)}>{e || "No event"}</Button>)}
    </div>
    <p className="text-sm text-muted-foreground">{event}: {shown.reduce((n, f) => n + f.rows.length, 0)} outfits across {shown.length} {shown.length === 1 ? "family" : "families"}</p>
    {shown.map((f) => <section key={f.family} className="space-y-3 rounded-xl border border-border p-4">
      <h4 className="font-medium">{f.family} <span className="text-sm font-normal text-muted-foreground">· {f.rows.length} {f.rows.length === 1 ? "outfit" : "outfits"}</span></h4>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{f.rows.map(({ order, item, wearer }) => {
        const sub = substitutions?.get(item.reservationId);
        const title = item.alternative?.title || sub?.replacement.title || item.title;
        const image = item.alternative ? item.alternative.image : sub ? sub.replacement.image ?? "" : item.image;
        const swapped = Boolean(item.alternative || sub);
        return <li key={`${order.id}-${item.reservationId}`} className="min-w-0 space-y-1 rounded-lg bg-surface p-2">
          {image ? <img src={image} alt={title} referrerPolicy="no-referrer" loading="lazy" className="aspect-[3/4] w-full rounded object-cover" /> : <div className="flex aspect-[3/4] w-full items-center justify-center rounded bg-muted text-xs text-muted-foreground">No photo</div>}
          <p className="truncate text-sm font-medium">{wearer}</p>
          <p className="line-clamp-2 text-xs">{title}{swapped ? <span className="text-primary"> · substitute</span> : null}</p>
          <p className="text-xs text-muted-foreground">Size {item.orderedSize || item.size || "—"}</p>
          {(item.addOns ?? []).map((a) => <p key={a.id} className="truncate text-xs">+ {a.label || "Extra item"}</p>)}
          {item.wearerNote ? <p className="line-clamp-2 text-xs text-muted-foreground">Note: {item.wearerNote}</p> : null}
          <button type="button" className="text-xs text-primary underline-offset-2 hover:underline" onClick={() => onOpen(order.id)}>{order.reference}</button>
        </li>;
      })}</ul>
    </section>)}
  </div>;
}
