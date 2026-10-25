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
      return <section key={f.family} className="space-y-3 rounded-xl border border-border p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-medium">{f.family}</h4>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={async () => { try { saveBlob(await familyBlob(f.family, f.all), pdfFileName(f.family)); } catch { toast.error("Couldn't create the family PDF"); } }}><FileDown className="size-4" /> Family PDF</Button>
            <Button size="sm" variant="outline" aria-label={`WhatsApp ${f.family} family PDF`} onClick={() => void sharePdfOnWhatsApp(() => familyBlob(f.family, f.all), pdfFileName(f.family), `Hello ${f.family}, please find attached the outfits ordered for you for ${celebrationName}. Kindly check each look and size and let us know of any last-minute changes.`, people.map(phoneOf).find(Boolean) ?? "")}><MessageCircle className="size-4" /> WhatsApp</Button>
          </div>
        </div>
        {f.byEvent.map((g) => <div key={g.event} className="space-y-2">
          {event === ALL ? <p className="text-sm font-medium text-primary">{g.event || "No event"}</p> : null}
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">{g.rows.map(({ order, item, wearer }) => {
            const sub = substitutions?.get(item.reservationId);
            const title = item.alternative?.title || sub?.replacement.title || item.title;
            const image = item.alternative ? item.alternative.image : sub ? sub.replacement.image ?? "" : item.image;
            const swapped = Boolean(item.alternative || sub);
            return <li key={`${order.id}-${item.reservationId}`} className={`flex min-w-0 flex-col rounded-xl border border-border bg-card ${order.status === "cancelled" ? "opacity-60" : ""}`}>
              <div className="flex min-w-0 flex-1 gap-3 p-4">
                {image ? <img src={image} alt={title} referrerPolicy="no-referrer" loading="lazy" className="aspect-[3/4] w-20 shrink-0 self-start rounded-md object-cover" /> : <div className="flex aspect-[3/4] w-20 shrink-0 items-center justify-center self-start rounded-md bg-muted text-xs text-muted-foreground">No photo</div>}
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="break-words font-medium">{wearer}</p>
                  <p className="break-words text-xs text-muted-foreground">{item.event}</p>
                  <p className="line-clamp-2 text-sm">{title}{swapped ? <span className="text-primary"> · substitute</span> : null}</p>
                  <p className="text-xs">Size {item.size || "—"} → ordered {item.orderedSize || "—"}</p>
                  {(item.addOns ?? []).map((a) => <p key={a.id} className="break-words text-xs">Extra: {a.label || "Extra item"}{a.size ? ` · ${a.size}` : ""}</p>)}
                  {item.wearerNote ? <p className="line-clamp-3 text-xs"><span className="text-muted-foreground">Note: </span>{item.wearerNote}</p> : null}
                </div>
              </div>
              <div className="space-y-2 border-t border-border p-3">
                <div className="flex items-center justify-between gap-2"><span className="min-w-0 truncate text-xs capitalize text-muted-foreground">{order.reference} · {order.status}</span><Button size="sm" variant="ghost" className="h-7 shrink-0 px-2 text-xs" onClick={() => onOpen(order.id)}>Open order</Button></div>
                {order.status !== "cancelled" ? <div className="grid grid-cols-3 gap-1.5 [&>button]:h-8 [&>button]:w-full [&>button]:min-w-0 [&>button]:px-1.5 [&>button]:text-xs [&_svg]:shrink-0"><WearerNoteButton inviteId={inviteId} orderId={order.id} item={item} wearer={wearer} /><IndividualShare wearer={wearer} celebration={celebrationName} lines={lines(f.all.filter((r) => r.wearer === wearer))} phone={phoneOf(wearer)} /></div> : null}
              </div>
            </li>;
          })}</ul>
        </div>)}
      </section>;
    })}
  </div>;
}
