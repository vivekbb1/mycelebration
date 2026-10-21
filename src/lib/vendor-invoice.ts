import type { OrderItem } from "./shop-order";

export type InvoiceLine = { sku: string; orderedSize: string; quantity: number; price: number; discount: number; net: number };
export type VendorInvoice = { reference: string; date: string; stylist: string; total: number; paid: number; due: number; lines: InvoiceLine[] };
const amount = (s: string) => Number(s.replaceAll(",", ""));
const round = (n: number) => Math.round(n * 100) / 100;

/** Pernia's text PDFs: model suffix is the ordered size, not the guest's choice. */
export function parseVendorInvoice(text: string): VendorInvoice {
  const flat = text.replace(/\s+/g, " ");
  const reference = flat.match(/ORDER\s+NO\s*:\s*(\d+)/i)?.[1];
  const date = flat.match(/DATE\s*:\s*(\d{2})-(\d{2})-(\d{4})/i);
  const total = flat.match(/TOTAL PAYABLE\s*₹\s*([\d,.]+)/i)?.[1];
  const paid = flat.match(/TOTAL PAID\s*₹\s*([\d,.]+)/i)?.[1];
  const due = flat.match(/AMOUNT DUE\s*₹\s*([\d,.]+)/i)?.[1];
  const lines: InvoiceLine[] = [];
  const rows = /([A-Z]+\d+)-(?:BO-([A-Z\d]+)|(Custom\s+Tailored))\s+(?:.*?\s)??(\d+)\s+₹\s*([\d,.]+)\s+₹\s*([\d,.]+)\s+₹\s*([\d,.]+)/g;
  for (const m of flat.matchAll(rows)) {
    const [, sku, boSize, custom, quantity, price, discount, net] = m;
    const orderedSize = boSize ?? (custom ? "Custom tailored" : undefined);
    if (!sku || !orderedSize || !quantity || !price || !discount || !net) continue;
    lines.push({ sku, orderedSize, quantity: Number(quantity), price: amount(price), discount: amount(discount), net: amount(net) });
  }
  if (!reference || !date || !total || !paid || !due || !lines.length) throw new Error("Couldn't read this invoice. Upload a Pernia invoice PDF with selectable text.");
  const invoice = { reference, date: `${date[3]}-${date[2]}-${date[1]}`, stylist: flat.match(/ORDER TAKEN BY\s+(.+?)\s+TOTAL AMOUNT/i)?.[1]?.trim() ?? "", total: amount(total), paid: amount(paid), due: amount(due), lines };
  if (Math.abs(round(lines.reduce((s, l) => s + l.net, 0)) - invoice.total) > 0.02 || Math.abs(round(invoice.total - invoice.paid) - invoice.due) > 0.02) throw new Error("Invoice totals don't reconcile. Please check the vendor document before importing.");
  if (lines.some((l) => Math.abs(round(l.price - l.discount) - l.net) > 0.02)) throw new Error("An invoice line's price and discount don't match its net amount.");
  return invoice;
}

export function invoiceMatches(line: InvoiceLine, candidates: OrderItem[]) {
  return candidates.filter((item) => item.sku.trim().toUpperCase().replace(/-BO-.*$/, "") === line.sku.toUpperCase());
}

export function invoiceOrderItems(invoice: VendorInvoice, candidates: OrderItem[], matches: string[][]): OrderItem[] {
  const used = new Set<string>();
  return invoice.lines.flatMap((line, index) => {
    const ids = matches[index] ?? [];
    if (ids.length !== line.quantity) throw new Error(`Match all ${line.quantity} wearer(s) for ${line.sku}`);
    return ids.map((id) => {
      const item = invoiceMatches(line, candidates).find((c) => c.reservationId === id);
      if (!item || used.has(id)) throw new Error("Each invoice outfit must match a different pending look with the same model number");
      used.add(id);
      return { ...item, originalPrice: item.originalPrice ?? null, orderedSize: line.orderedSize, price: line.price, discount: line.discount };
    });
  });
}

export function pendingOrderLook(reservationId: string, legacyPlaced: string | null, activeOrders: ReadonlyMap<string, string>) {
  return !legacyPlaced && !activeOrders.has(reservationId);
}