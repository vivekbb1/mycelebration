import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { money, type OrderItem } from "@/lib/shop-order";
import { defaultSlotMode, invoiceMatches, invoiceOrderItems, parseVendorInvoice, type SlotMode, type VendorInvoice } from "@/lib/vendor-invoice";

export function VendorInvoiceUpload({ inviteId, candidates }: { inviteId: string; candidates: OrderItem[] }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [invoice, setInvoice] = useState<VendorInvoice | null>(null);
  const [matches, setMatches] = useState<string[][]>([]);
  const [modes, setModes] = useState<SlotMode[][]>([]);
  async function read(file: File) {
    setBusy(true);
    try {
      const { readInvoicePdf } = await import("@/lib/vendor-invoice-reader");
      const parsed = parseVendorInvoice(await readInvoicePdf(file));
      const existing = await supabase.from("wardrobe_orders").select("id").eq("invite_id", inviteId).eq("seller_reference", parsed.reference);
      if (existing.error) throw existing.error;
      if (existing.data.length) throw new Error(`Invoice ${parsed.reference} is already recorded`);
      setFile(file); setInvoice(parsed);
      setMatches(parsed.lines.map((line) => { const options = invoiceMatches(line, candidates); return options.length === line.quantity ? options.map((o) => o.reservationId) : Array.from({ length: line.quantity }, () => ""); }));
      setModes(parsed.lines.map((line) => Array.from({ length: line.quantity }, () => defaultSlotMode(line, candidates))));
    } catch (e) { toast.error(e && typeof e === "object" && "message" in e ? String(e.message) : "Couldn't read invoice"); }
    finally { setBusy(false); }
  }
  let valid = false;
  if (invoice) { try { invoiceOrderItems(invoice, candidates, matches, modes); valid = true; } catch { /* unresolved matches */ } }
  async function save() {
    if (!invoice || !file) return;
    setBusy(true);
    const id = crypto.randomUUID();
    const path = `${inviteId}/orders/${id}/${file.name.replace(/[^a-z0-9.-]/gi, "_")}`;
    let uploaded = false;
    try {
      const items = invoiceOrderItems(invoice, candidates, matches, modes);
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
      await qc.invalidateQueries({ queryKey: ["reservations"] });
      await qc.invalidateQueries({ queryKey: ["confirm-looks"] });
      await qc.invalidateQueries({ queryKey: ["host-orders"] });
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
          {invoice.lines.map((line, index) => { const exact = invoiceMatches(line, candidates); return <div key={`${line.sku}-${index}`} className="space-y-2 border-t border-border pt-3">
            <p className="font-medium">{line.sku} · ordered size {line.orderedSize}</p>
            <p className="text-sm text-muted-foreground">Revised price INR {money(line.price)} − discount {money(line.discount)} = discounted price INR {money(line.net)}</p>
            {!exact.length ? <p className="text-xs text-muted-foreground">No guest chose this model number. Assign it to a person as an alternative to their look, or as an extra item such as trousers.</p> : null}
            {Array.from({ length: line.quantity }, (_, slot) => {
              const mode = modes[index]?.[slot] ?? defaultSlotMode(line, candidates);
              const lookIds = new Set(invoice.lines.flatMap((l, i) => (matches[i] ?? []).filter((id, s) => id && (modes[i]?.[s] ?? defaultSlotMode(l, candidates)) !== "addon")));
              const options = mode === "look" ? exact : mode === "alternative" ? candidates : candidates.filter((c) => lookIds.has(c.reservationId));
              const chosen = candidates.find((c) => c.reservationId === matches[index]?.[slot]);
              const setSlot = (id: string, m: SlotMode = mode) => {
                setMatches((all) => all.map((ids, i) => { if (i !== index) return ids; const next = [...ids]; next[slot] = id; return next; }));
                setModes((all) => all.map((ms, i) => { if (i !== index) return ms; const next = [...ms]; next[slot] = m; return next; }));
              };
              return <div key={slot} className="grid gap-2 sm:grid-cols-[minmax(0,14rem)_1fr]">
                <label className="text-sm">Use as{line.quantity > 1 ? ` (${slot + 1})` : ""}
                  <select aria-label={`Use ${line.sku} as`} className="field-select w-full" value={mode} onChange={(e) => setSlot("", e.target.value as SlotMode)}>
                    {exact.length ? <option value="look">Their chosen look</option> : null}
                    <option value="alternative">Alternative to their look</option>
                    <option value="addon">Extra item (e.g. trousers)</option>
                  </select>
                </label>
                <label className="text-sm">{mode === "addon" ? "Add to whose look on this invoice" : "Person"}
                  <select aria-label={`Wearer for ${line.sku}${line.quantity > 1 ? ` ${slot + 1}` : ""}`} className="field-select w-full" value={matches[index]?.[slot] ?? ""} onChange={(e) => setSlot(e.target.value)}>
                    <option value="">{options.length ? "Choose a person and event" : mode === "addon" ? "Assign the main looks first" : "No matching pending look"}</option>
                    {options.map((o) => <option key={o.reservationId} value={o.reservationId}>{o.wearer} · {o.event} · {o.title}{o.sku ? ` (${o.sku})` : ""} · selected size {o.size || "—"}</option>)}
                  </select>
                </label>
                {chosen && mode !== "addon" ? <p className="text-xs text-muted-foreground sm:col-span-2">Original uploaded price: {chosen.originalPrice != null ? `INR ${money(chosen.originalPrice)}` : "Not recorded"}{mode === "alternative" ? " · Guest still sees their own choice" : ""}</p> : null}
              </div>;
            })}
          </div>; })}
          {!valid ? <p className="text-sm text-destructive">Every invoice line needs a person. Each person's look can be used once; extra items must go with a look on this invoice.</p> : null}
          <Button disabled={busy || !valid} onClick={() => void save()}>{busy ? "Saving…" : "Confirm invoice and move to Orders"}</Button>
        </> : null}
      </DialogContent>
    </Dialog>
  </>;
}