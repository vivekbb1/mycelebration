import { useId, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { money, type OrderItem, type OrderAlternative } from "@/lib/shop-order";
import { AssignGuestLook } from "@/components/assign-guest-look";
import { InvoiceShopLook } from "@/components/invoice-shop-look";
import { InvoiceAssignLook } from "@/components/invoice-assign-look";
import { missingInvoiceWearers } from "@/lib/invoice-wearers";
import type { PerniaLook } from "@/lib/pernia.functions";
import { defaultSlotMode, invoiceMatches, invoiceOrderItems, parseVendorInvoice, type SlotMode, type VendorInvoice } from "@/lib/vendor-invoice";

export function VendorInvoiceUpload({ inviteId, candidates: pendingCandidates }: { inviteId: string; candidates: OrderItem[] }) {
  const qc = useQueryClient();
  const fileId = useId();
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [invoice, setInvoice] = useState<VendorInvoice | null>(null);
  const [matches, setMatches] = useState<string[][]>([]);
  const [modes, setModes] = useState<SlotMode[][]>([]);
  const [details, setDetails] = useState<Record<number, OrderAlternative>>({});
  const [fetched, setFetched] = useState<Record<number, PerniaLook>>({});
  const [assigned, setAssigned] = useState<OrderItem[]>([]);
  const [draft, setDraft] = useState<{ id: string; path: string } | null>(null);
  const drafts = useQuery({ queryKey: ["invoice-drafts", inviteId], enabled: Boolean(inviteId), queryFn: async () => {
    const r = await supabase.from("invoice_drafts").select("id,reference,file_path,file_name,state,updated_at").eq("invite_id", inviteId).order("updated_at", { ascending: false });
    if (r.error) throw r.error; return r.data;
  }});
  type DraftState = { invoice: VendorInvoice; matches: string[][]; modes: SlotMode[][]; details: Record<number, OrderAlternative>; fetched: Record<number, PerniaLook>; assigned: OrderItem[] };
  async function resume(d: { id: string; file_path: string; file_name: string; state: Json }) {
    setBusy(true);
    try {
      const dl = await supabase.storage.from("alteration-photos").download(d.file_path);
      if (dl.error) throw dl.error;
      const s = d.state as unknown as DraftState;
      setFile(new File([dl.data], d.file_name, { type: "application/pdf" }));
      setDraft({ id: d.id, path: d.file_path });
      setDetails(s.details ?? {}); setFetched(s.fetched ?? {}); setAssigned(s.assigned ?? []);
      setMatches(s.matches); setModes(s.modes); setInvoice(s.invoice);
    } catch (e) { toast.error(e && typeof e === "object" && "message" in e ? String(e.message) : "Couldn't open draft"); }
    finally { setBusy(false); }
  }
  async function saveDraft() {
    if (!invoice || !file) return;
    setBusy(true);
    try {
      const id = draft?.id ?? crypto.randomUUID();
      let path = draft?.path;
      if (!path) {
        path = `${inviteId}/invoice-drafts/${id}/${file.name.replace(/[^a-z0-9.-]/gi, "_")}`;
        const up = await supabase.storage.from("alteration-photos").upload(path, file, { contentType: "application/pdf", upsert: true });
        if (up.error) throw up.error;
      }
      const state: DraftState = { invoice, matches, modes, details, fetched, assigned };
      const r = await supabase.from("invoice_drafts").upsert({ id, invite_id: inviteId, reference: invoice.reference, file_path: path, file_name: file.name, state: state as unknown as Json });
      if (r.error) throw r.error;
      setDraft({ id, path });
      await qc.invalidateQueries({ queryKey: ["invoice-drafts", inviteId] });
      toast.success(`Draft saved for invoice ${invoice.reference}`);
    } catch (e) { toast.error(e && typeof e === "object" && "message" in e ? String(e.message) : "Couldn't save draft"); }
    finally { setBusy(false); }
  }
  async function deleteDraft(d: { id: string; file_path: string }) {
    const r = await supabase.from("invoice_drafts").delete().eq("id", d.id);
    if (r.error) { toast.error(r.error.message); return; }
    await supabase.storage.from("alteration-photos").remove([d.file_path]);
    await qc.invalidateQueries({ queryKey: ["invoice-drafts", inviteId] });
  }
  const candidates = [...pendingCandidates, ...assigned.filter(a => !pendingCandidates.some(c => c.reservationId === a.reservationId))];
  const missing = useQuery({ queryKey: ["invoice-missing-wearers", inviteId], enabled: Boolean(invoice), queryFn: async () => {
    const [members, events, access, looks, outfits] = await Promise.all([
      supabase.from("invite_codes").select("id,guest_name,household,claimed_by,gender").eq("invite_id", inviteId).order("guest_name"),
      supabase.from("events").select("id,name,outfit_selection").eq("invite_id", inviteId).eq("outfit_selection", true).order("name"),
      supabase.from("household_event_invites").select("household,event_id,outfit_selection").eq("invite_id", inviteId),
      supabase.from("reservations").select("guest_id,guest_name,member_code_id,outfits(event_id)").eq("invite_id", inviteId),
      supabase.from("outfits").select("event_id,gender").eq("invite_id", inviteId).in("gender", ["boy", "girl"]).is("retired_at", null),
    ]);
    if (members.error) throw members.error; if (events.error) throw events.error; if (access.error) throw access.error; if (looks.error) throw looks.error; if (outfits.error) throw outfits.error;
    return missingInvoiceWearers(members.data, events.data, access.data, looks.data, new Set(outfits.data.map(o => `${o.event_id}|${o.gender}`)));
  }});
  const wardrobeSkus = useQuery({ queryKey: ["invoice-wardrobe-skus", inviteId], enabled: Boolean(invoice), queryFn: async () => {
    const r = await supabase.from("outfits").select("source_sku").eq("invite_id", inviteId).is("retired_at", null).not("source_sku", "is", null);
    if (r.error) throw r.error;
    return new Set(r.data.map(o => (o.source_sku ?? "").trim().toUpperCase()));
  }});
  async function read(file: File) {
    setBusy(true);
    try {
      const { readInvoicePdf } = await import("@/lib/vendor-invoice-reader");
      const parsed = parseVendorInvoice(await readInvoicePdf(file));
      const existing = await supabase.from("wardrobe_orders").select("id").eq("invite_id", inviteId).eq("seller_reference", parsed.reference);
      if (existing.error) throw existing.error;
      if (existing.data.length) throw new Error(`Invoice ${parsed.reference} is already recorded`);
      const saved = drafts.data?.find(d => d.reference === parsed.reference);
      if (saved) { toast.info(`Opening your saved draft for invoice ${parsed.reference}`); setBusy(false); await resume(saved); return; }
      setDraft(null);
      setFile(file); setInvoice(parsed); setDetails({}); setFetched({}); setAssigned([]);
      setMatches(parsed.lines.map((line) => { const options = invoiceMatches(line, pendingCandidates); return options.length === line.quantity ? options.map((o) => o.reservationId) : Array.from({ length: line.quantity }, () => ""); }));
      setModes(parsed.lines.map((line) => Array.from({ length: line.quantity }, () => defaultSlotMode(line, pendingCandidates))));
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
      const items = invoiceOrderItems(invoice, candidates, matches, modes, details);
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
      if (draft) { await supabase.from("invoice_drafts").delete().eq("id", draft.id); await supabase.storage.from("alteration-photos").remove([draft.path]); await qc.invalidateQueries({ queryKey: ["invoice-drafts", inviteId] }); }
      setInvoice(null); setFile(null); setDraft(null);
      toast.success(`Invoice ${invoice.reference} recorded — ${items.length} looks moved to Orders`);
    } catch (e) {
      if (uploaded) await supabase.storage.from("alteration-photos").remove([path]);
      toast.error(e && typeof e === "object" && "message" in e ? String(e.message) : "Couldn't import invoice");
    } finally { setBusy(false); }
  }
  return <>
    <Button variant="outline" disabled={busy || !inviteId} onClick={() => document.getElementById(fileId)?.click()}><Upload className="size-4" />{busy ? "Reading invoice…" : "Upload vendor invoice"}</Button>
    <input id={fileId} type="file" accept="application/pdf" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void read(f); }} />
    {drafts.data?.length ? <span className="inline-flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">Invoice drafts:</span>
      {drafts.data.map(d => <span key={d.id} className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5">
        <button type="button" className="hover:text-primary hover:underline" disabled={busy} onClick={() => void resume(d)}>{d.reference} · {new Date(d.updated_at).toLocaleDateString("en-GB")}</button>
        <button type="button" aria-label={`Delete draft ${d.reference}`} className="text-muted-foreground hover:text-destructive" onClick={() => { if (confirm(`Delete draft for invoice ${d.reference}?`)) void deleteDraft(d); }}>×</button>
      </span>)}
    </span> : null}
    <Dialog open={Boolean(invoice)} onOpenChange={(open) => { if (!open && !busy) { setInvoice(null); setFile(null); setDraft(null); } }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader><DialogTitle>Review invoice {invoice?.reference}</DialogTitle></DialogHeader>
        {invoice ? <>
          <p className="text-sm">{invoice.date} · {invoice.stylist} · {invoice.lines.length} invoice lines</p>
          <div className="grid grid-cols-3 gap-2 text-sm"><p>Total<br /><strong>INR {money(invoice.total)}</strong></p><p>Stated paid<br /><strong>INR {money(invoice.paid)}</strong></p><p>Due<br /><strong>INR {money(invoice.due)}</strong></p></div>
          <AssignGuestLook inviteId={inviteId} onAssigned={() => { toast.success("Guest's confirmed look is now available for invoice matching"); }} />
          {missing.isError ? <p className="text-sm text-destructive">Could not load guests without selections. Please reopen invoice review.</p> : null}
          {invoice.lines.map((line, index) => { const exact = invoiceMatches(line, candidates); return <div key={`${line.sku}-${index}`} className="space-y-2 border-t border-border pt-3">
            <p className="font-medium">{line.sku} · ordered size {line.orderedSize} {wardrobeSkus.data ? (wardrobeSkus.data.has(line.sku.trim().toUpperCase()) ? <span className="text-xs text-primary">✓ In wardrobe</span> : <span className="text-xs text-destructive">✗ Not in wardrobe — paste the shop link below</span>) : null}</p>
            <p className="text-sm text-muted-foreground">Revised price INR {money(line.price)} − discount {money(line.discount)} = discounted price INR {money(line.net)}</p>
            <InvoiceShopLook inviteId={inviteId} sku={line.sku} onFetched={look => { setFetched(all => ({ ...all, [index]: look })); setDetails(all => ({ ...all, [index]: { title: look.title, sku: look.sku, designer: look.designer, shop: look.url, image: look.images[0] ?? "" } })); }} />
            {!exact.length ? <p className="text-xs text-muted-foreground">No pending look matches this model. Assign a guest's look, use an alternative, or add an extra item.</p> : null}
            {Array.from({ length: line.quantity }, (_, slot) => {
              const mode = modes[index]?.[slot] ?? defaultSlotMode(line, candidates);
              const lookIds = new Set(invoice.lines.flatMap((l, i) => (matches[i] ?? []).filter((id, s) => id && (modes[i]?.[s] ?? defaultSlotMode(l, candidates)) !== "addon")));
              const options = mode === "addon" ? candidates.filter((c) => lookIds.has(c.reservationId)) : candidates;
              const missingWearer = missing.data?.find(w => w.key === matches[index]?.[slot]);
              const chosen = candidates.find((c) => c.reservationId === matches[index]?.[slot]);
              const setSlot = (id: string, m: SlotMode = mode) => {
                setMatches((all) => all.map((ids, i) => { if (i !== index) return ids; const next = [...ids]; next[slot] = id; return next; }));
                setModes((all) => all.map((ms, i) => { if (i !== index) return ms; const next = [...ms]; next[slot] = m; return next; }));
              };
              return <div key={slot} className="grid gap-2 sm:grid-cols-[minmax(0,14rem)_1fr]">
                <label className="text-sm">Use as{line.quantity > 1 ? ` (${slot + 1})` : ""}
                  <select aria-label={`Use ${line.sku} as`} className="field-select w-full" value={mode} onChange={(e) => setSlot("", e.target.value as SlotMode)}>
                    {exact.length ? <option value="look">Their chosen look</option> : null}
                    <option value="assign">Assign to guest without selection</option>
                    <option value="alternative">Alternative to their look</option>
                    <option value="addon">Extra item (e.g. trousers)</option>
                  </select>
                </label>
                <label className="text-sm">{mode === "addon" ? "Add to whose look on this invoice" : "Person"}
                  <select aria-label={`Wearer for ${line.sku}${line.quantity > 1 ? ` ${slot + 1}` : ""}`} className="field-select w-full" value={matches[index]?.[slot] ?? ""} onChange={(e) => {
                    const id = e.target.value;
                    if (id.startsWith("member:")) setSlot(id, "assign");
                    else setSlot(id, mode === "addon" ? "addon" : exact.some(c => c.reservationId === id) ? "look" : "alternative");
                  }}>
                    <option value="">{options.length ? "Choose a person and event" : mode === "addon" ? "Assign the main looks first" : "No matching pending look"}</option>
                    <optgroup label="Pending outfit orders">{options.map((o) => <option key={o.reservationId} value={o.reservationId}>{o.wearer} · {o.event} · {o.title}{o.sku ? ` (${o.sku})` : ""} · selected size {o.size || "—"}</option>)}</optgroup>
                    {mode !== "addon" ? <optgroup label="No outfit selected">{missing.data?.map(w => <option key={w.key} value={w.key}>{w.member.guest_name} · {w.event.name} · {w.member.household} · No selection</option>)}</optgroup> : null}
                  </select>
                </label>
                {missingWearer ? <div className="sm:col-span-2"><InvoiceAssignLook inviteId={inviteId} member={missingWearer.member} event={missingWearer.event} line={line} fetched={fetched[index]} onAssigned={item => { setAssigned(all => [...all.filter(a => a.reservationId !== item.reservationId), item]); setSlot(item.reservationId, "look"); }} /></div> : null}
                {chosen && mode !== "addon" ? <p className="text-xs text-muted-foreground sm:col-span-2">Original uploaded price: {chosen.originalPrice != null ? `INR ${money(chosen.originalPrice)}` : "Not recorded"}{mode === "alternative" ? " · Guest still sees their own choice" : ""}</p> : null}
              </div>;
            })}
          </div>; })}
          {!valid ? <p className="text-sm text-destructive">Every invoice line needs a person. Each person's look can be used once; extra items must go with a look on this invoice.</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={busy} onClick={() => void saveDraft()}>{draft ? "Update draft" : "Save as draft"}</Button>
            <Button disabled={busy || !valid} onClick={() => void save()}>{busy ? "Saving…" : "Confirm invoice and move to Orders"}</Button>
          </div>
          <p className="text-xs text-muted-foreground">A draft keeps the PDF, every person and event you picked, substitutions and fetched outfits. Nothing moves to Orders until you confirm.</p>
        </> : null}
      </DialogContent>
    </Dialog>
  </>;
}