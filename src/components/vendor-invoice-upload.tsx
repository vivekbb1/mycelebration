import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { money, type OrderItem } from "@/lib/shop-order";
import { invoiceMatches, invoiceOrderItems, parseVendorInvoice, type VendorInvoice } from "@/lib/vendor-invoice";

export function VendorInvoiceUpload({ inviteId, candidates }: { inviteId: string; candidates: OrderItem[] }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [invoice, setInvoice] = useState<VendorInvoice | null>(null);
  const [matches, setMatches] = useState<string[][]>([]);
  async function read(file: File) {
    setBusy(true);
    try {
      const { readInvoicePdf } = await import("@/lib/vendor-invoice-reader");
      const parsed = parseVendorInvoice(await readInvoicePdf(file));
      const existing = await supabase.from("wardrobe_orders").select("id").eq("invite_id", inviteId).eq("seller_reference", parsed.reference);
      if (existing.error) throw existing.error;
      if (existing.data.length) throw new Error(`Invoice ${parsed.reference} is already recorded`);
      setFile(file); setInvoice(parsed);
      setMatches(parsed.lines.map((line) => { const options = invoiceMatches(line, candidates); return options.length === line.quantity ? options.map((o) => o.reservationId) : []; }));
    } catch (e) { toast.error(e && typeof e === "object" && "message" in e ? String(e.message) : "Couldn't read invoice"); }
    finally { setBusy(false); }
  }
  let valid = false;
  if (invoice) { try { invoiceOrderItems(invoice, candidates, matches); valid = true; } catch { /* unresolved matches */ } }
  async function save() {
    if (!invoice || !file) return;
    setBusy(true);
    const id = crypto.randomUUID();
    const path = `${inviteId}/orders/${id}/${file.name.replace(/[^a-z0-9.-]/gi, "_")}`;
    let uploaded = false;
    try {
      const items = invoiceOrderItems(invoice, candidates, matches);
      const up = await supabase.storage.from("alteration-photos").upload(path, file, { contentType: "application/pdf" });
      if (up.error) throw up.error;
      uploaded = true;
      const result = await supabase.from("wardrobe_orders").insert({
        id, invite_id: inviteId, reference: `PERNIA-${invoice.reference}`, seller_reference: invoice.reference,
        shop_name: "Pernia's Pop-Up Studio", salesperson_name: invoice.stylist, currency: "INR",
        status: "placed", placed_at: `${invoice.date}T12:00:00Z`, seller_total: invoice.total,
        items: items as unknown as Json,
        payments: invoice.paid > 0 ? [{ amount: invoice.paid, date: invoice.date, reference: `Vendor invoice ${invoice.reference} — stated paid`, kind: "payment" }] : [],
        documents: [{ kind: "invoice", path, name: file.name, number: invoice.reference, amount: invoice.total, date: invoice.date }],
        notes: "Imported from vendor invoice. Payment reflects the vendor's stated paid amount.",
      });
      if (result.error) throw result.error;
      uploaded = false;
      await qc.invalidateQueries({ queryKey: ["wardrobe-orders"] });
      setInvoice(null); setFile(null);
      toast.success(`Invoice ${invoice.reference} recorded — ${items.length} looks moved to Orders`);
    } catch (e) {
      if (uploaded) await supabase.storage.from("alteration-photos").remove([path]);
      toast.error(e && typeof e === "object" && "message" in e ? String(e.message) : "Couldn't import invoice");
    } finally { setBusy(false); }
  }
  return <>
    <Button variant="outline" disabled={busy || !inviteId} onClick={() => document.getElementById("vendor-invoice-file")?.click()}><Upload className="size-4" />{busy ? "Reading invoice…" : "Upload vendor invoice"}</Button>
    <input id="vendor-invoice-file" type="file" accept="application/pdf" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void read(f); }} />
    <Dialog open={Boolean(invoice)} onOpenChange={(open) => { if (!open && !busy) { setInvoice(null); setFile(null); } }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader><DialogTitle>Review invoice {invoice?.reference}</DialogTitle></DialogHeader>
        {invoice ? <>
          <p className="text-sm">{invoice.date} · {invoice.stylist} · {invoice.lines.length} invoice lines</p>
          <div className="grid grid-cols-3 gap-2 text-sm"><p>Total<br /><strong>INR {money(invoice.total)}</strong></p><p>Stated paid<br /><strong>INR {money(invoice.paid)}</strong></p><p>Due<br /><strong>INR {money(invoice.due)}</strong></p></div>
          {invoice.lines.map((line, index) => { const options = invoiceMatches(line, candidates); return <div key={`${line.sku}-${index}`} className="space-y-2 border-t border-border pt-3">
            <p className="font-medium">{line.sku} · ordered size {line.orderedSize}</p>
            <p className="text-sm text-muted-foreground">Price INR {money(line.price)} − discount {money(line.discount)} = {money(line.net)}</p>
            {Array.from({ length: line.quantity }, (_, slot) => <label key={slot} className="block text-sm">Wearer{line.quantity > 1 ? ` ${slot + 1}` : ""}
              <select aria-label={`Wearer for ${line.sku}${line.quantity > 1 ? ` ${slot + 1}` : ""}`} className="field-select w-full" value={matches[index]?.[slot] ?? ""} onChange={(e) => setMatches((all) => all.map((ids, i) => { if (i !== index) return ids; const next = [...ids]; next[slot] = e.target.value; return next; }))}>
                <option value="">{options.length ? "Choose the matching person and event" : "No matching pending look — check model number"}</option>
                {options.map((o) => <option key={o.reservationId} value={o.reservationId}>{o.wearer} · {o.event} · {o.family} · selected size {o.size || "—"}</option>)}
              </select>
            </label>)}
          </div>; })}
          {!valid ? <p className="text-sm text-destructive">Every invoice line needs a unique matching pending look before saving.</p> : null}
          <Button disabled={busy || !valid} onClick={() => void save()}>{busy ? "Saving…" : "Confirm invoice and move to Orders"}</Button>
        </> : null}
      </DialogContent>
    </Dialog>
  </>;
}