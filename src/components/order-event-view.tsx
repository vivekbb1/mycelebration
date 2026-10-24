import { useState } from "react";
import { FileDown, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import type { LatestSub } from "@/components/substitution-note";
import { Button } from "@/components/ui/button";
import { familyOrderLooks, type ReportOrder } from "@/lib/family-order-looks";
import { alphabetical, type Sequencer } from "@/lib/order-sequence";
import type { OrderItem } from "@/lib/shop-order";
import { buildFamilyLooksPdf, saveBlob } from "@/lib/shop-order-pdf";
import { wearerLookLine } from "@/lib/wearer-order";
import { IndividualShare, WearerNoteButton, pdfFileName, sharePdfOnWhatsApp } from "@/components/wearer-order-actions";

const ALL = "__all__";
type Row = ReturnType<typeof familyOrderLooks>[number]["rows"][number];

/** One event (or all events stacked) with each family's outfits side by side — for couple pairing and colour coordination. */
export function OrderEventView({ inviteId, orders, candidates, substitutions, matches, events, seq = alphabetical, onOpen, celebrationName = "", phones }: {
  inviteId: string; orders: ReportOrder[]; candidates: OrderItem[]; substitutions?: Map<string, LatestSub> | undefined; matches?: (item: OrderItem, order: ReportOrder) => boolean;
  events: string[]; seq?: Sequencer; onOpen: (id: string) => void; celebrationName?: string; phones?: Map<string, string> | undefined;
}) {
  const families = familyOrderLooks(orders, candidates, matches);
  const present = new Set(families.flatMap((f) => f.rows.map((r) => r.item.event)));
  const list = [...events.filter((e) => present.has(e)), ...[...present].filter((e) => !events.includes(e)).sort((a, b) => seq.event(a) - seq.event(b) || a.localeCompare(b))];
  const [chosen, setChosen] = useState("");
  const event = chosen === ALL ? ALL : list.includes(chosen) ? chosen : list[0] ?? "";
  const shownEvents = event === ALL ? list : [event];
  const byPerson = (a: Row, b: Row) => seq.compare({ wearer: a.wearer, event: a.item.event }, { wearer: b.wearer, event: b.item.event });
  const shown = families.map((f) => ({ ...f, all: [...f.rows].sort(byPerson), byEvent: shownEvents.map((e) => ({ event: e, rows: f.rows.filter((r) => r.item.event === e).sort(byPerson) })).filter((g) => g.rows.length) })).filter((f) => f.byEvent.length);
  const lines = (rows: Row[]) => rows.map(({ item, wearer }) => wearerLookLine(item, wearer, substitutions?.get(item.reservationId)));
  const phoneOf = (w: string) => phones?.get(w.trim().toLowerCase());
  const familyBlob = (name: string, rows: Row[]) => buildFamilyLooksPdf(name, celebrationName, lines(rows));
  if (!list.length) return <p className="text-sm text-muted-foreground">No active orders match this search.</p>;
  const count = shown.reduce((n, f) => n + f.byEvent.reduce((m, g) => m + g.rows.length, 0), 0);
  return <div className="space-y-4" aria-label="Orders by event">
    <div role="group" aria-label="Choose event" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
      <Button size="sm" className="shrink-0" variant={event === ALL ? "default" : "outline"} aria-pressed={event === ALL} onClick={() => setChosen(ALL)}>All events</Button>
      {list.map((e) => <Button key={e} size="sm" className="shrink-0" variant={e === event ? "default" : "outline"} aria-pressed={e === event} onClick={() => setChosen(e)}>{e || "No event"}</Button>)}
    </div>
    <p className="text-sm text-muted-foreground">{event === ALL ? "All events" : event}: {count} outfits across {shown.length} {shown.length === 1 ? "family" : "families"}</p>
    {shown.map((f) => {
      const people = [...new Set(f.all.map((r) => r.wearer))];
      return <section key={f.family} className="space-y-3 rounded-xl border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-medium">{f.family}</h4>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={async () => { try { saveBlob(await familyBlob(f.family, f.all), pdfFileName(f.family)); } catch { toast.error("Couldn't create the family PDF"); } }}><FileDown className="size-4" /> Family PDF</Button>
            <Button size="sm" variant="outline" aria-label={`WhatsApp ${f.family} family PDF`} onClick={() => void sharePdfOnWhatsApp(() => familyBlob(f.family, f.all), pdfFileName(f.family), `Hello ${f.family}, please find attached the outfits ordered for you for ${celebrationName}. Kindly check each look and size and let us know of any last-minute changes.`, people.map(phoneOf).find(Boolean) ?? "")}><MessageCircle className="size-4" /> WhatsApp</Button>
          </div>
        </div>
        <div className="flex flex-col gap-1.5 border-b border-border pb-3">{people.map((w) => <div key={w} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="font-medium">{w}</span><span className="flex flex-wrap gap-2"><IndividualShare wearer={w} celebration={celebrationName} lines={lines(f.all.filter((r) => r.wearer === w))} phone={phoneOf(w)} /></span></div>)}</div>
        {f.byEvent.map((g) => <div key={g.event} className="space-y-2">
          {event === ALL ? <p className="text-sm font-medium text-primary">{g.event || "No event"}</p> : null}
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{g.rows.map(({ order, item, wearer }) => {
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
              {item.wearerNote ? <p className="line-clamp-3 text-xs text-muted-foreground">Note: {item.wearerNote}</p> : null}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {order.status !== "cancelled" ? <WearerNoteButton inviteId={inviteId} orderId={order.id} item={item} wearer={wearer} /> : null}
                <button type="button" className="text-xs text-primary underline-offset-2 hover:underline" onClick={() => onOpen(order.id)}>{order.reference}</button>
              </div>
            </li>;
          })}</ul>
        </div>)}
      </section>;
    })}
  </div>;
}
