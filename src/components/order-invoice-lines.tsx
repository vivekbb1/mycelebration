import { money, type OrderItem } from "@/lib/shop-order";

type Line = { key: string; desc: string; sub: string; sku: string; size: string; price: number; discount: number };

/** Invoice-style read-only table of an order: one line per outfit and per extra item. */
export function OrderInvoiceLines({ items, currency }: { items: OrderItem[]; currency: string }) {
  const lines: Line[] = items.flatMap((i) => [
    { key: i.reservationId, desc: i.alternative?.title || i.title, sub: `${i.wearer} · ${i.event}${i.alternative ? ` · replaces ${i.title}` : ""}`, sku: i.alternative?.sku || i.sku, size: i.orderedSize || i.size, price: i.price, discount: i.discount },
    ...(i.addOns ?? []).map((a) => ({ key: `${i.reservationId}-${a.id}`, desc: a.label || "Extra item", sub: `${i.wearer} · ${i.event} · extra`, sku: a.sku, size: a.size, price: a.price, discount: a.discount })),
  ]);
  const sum = (f: (l: Line) => number) => lines.reduce((s, l) => s + f(l), 0);
  const m = (v: number) => money(v, currency);
  return <div className="overflow-x-auto rounded-xl border border-border">
    <table className="w-full min-w-[640px] text-sm">
      <thead className="bg-surface text-xs text-muted-foreground"><tr>
        <th className="p-2 text-left">#</th><th className="p-2 text-left">Description</th><th className="p-2 text-left">Model ref</th><th className="p-2 text-left">Size</th>
        <th className="p-2 text-right">Price</th><th className="p-2 text-right">Discount</th><th className="p-2 text-right">Amount ({currency})</th>
      </tr></thead>
      <tbody>{lines.map((l, n) => <tr key={l.key} className="border-t border-border align-top">
        <td className="p-2 text-muted-foreground">{n + 1}</td>
        <td className="p-2"><span className="block font-medium">{l.desc}</span><span className="block text-xs text-muted-foreground">{l.sub}</span></td>
        <td className="p-2">{l.sku || "—"}</td><td className="p-2">{l.size || "—"}</td>
        <td className="p-2 text-right tabular-nums">{m(l.price)}</td><td className="p-2 text-right tabular-nums">{l.discount ? `-${m(l.discount)}` : "—"}</td>
        <td className="p-2 text-right font-medium tabular-nums">{m(l.price - l.discount)}</td>
      </tr>)}</tbody>
      <tfoot className="border-t-2 border-border font-medium"><tr>
        <td className="p-2" colSpan={4}>Subtotal · {lines.length} lines</td>
        <td className="p-2 text-right tabular-nums">{m(sum((l) => l.price))}</td><td className="p-2 text-right tabular-nums">-{m(sum((l) => l.discount))}</td><td className="p-2 text-right tabular-nums">{m(sum((l) => l.price - l.discount))}</td>
      </tr></tfoot>
    </table>
  </div>;
}
