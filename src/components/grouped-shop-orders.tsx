import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileDown, Paperclip, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { orderTotals, validateOrder, type OrderItem, type OrderPayment } from "@/lib/shop-order";
import { downloadShopOrderPdf } from "@/lib/shop-order-pdf";
import type { Json } from "@/integrations/supabase/types";

export type OrderDocument = { path: string; name: string; kind: string };
const DOC_KINDS = ["Order", "Proforma", "Bill", "Other"];

/** Actual orders placed with sellers. New orders start from the Pre-orders tab via `pending`. */
export function GroupedShopOrders({ inviteId, pending, onPendingHandled }: { inviteId: string; pending: OrderItem[] | null; onPendingHandled: () => void }) {
  const qc = useQueryClient();
  const orders = useQuery({ queryKey: ["wardrobe-orders", inviteId], enabled: Boolean(inviteId), queryFn: async () => {
    const { data, error } = await supabase.from("wardrobe_orders").select("*").eq("invite_id", inviteId).order("created_at", { ascending: false });
    if (error) throw error; return data ?? [];
  } });
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false);
  const [id, setId] = useState<string | null>(null); const [reference, setReference] = useState("");
  const [shop, setShop] = useState(""); const [currency, setCurrency] = useState("INR"); const [notes, setNotes] = useState("");
  const [sellerRef, setSellerRef] = useState(""); const [salesName, setSalesName] = useState(""); const [salesMobile, setSalesMobile] = useState("");
  const [sellerTotal, setSellerTotal] = useState(""); const [advance, setAdvance] = useState("");
  const [docs, setDocs] = useState<OrderDocument[]>([]); const [docKind, setDocKind] = useState("Proforma");
  const [items, setItems] = useState<OrderItem[]>([]); const [payments, setPayments] = useState<OrderPayment[]>([]);
  const [status, setStatus] = useState("draft"); const [courier, setCourier] = useState(""); const [tracking, setTracking] = useState("");
  const [amount, setAmount] = useState(""); const [payReference, setPayReference] = useState(""); const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (!pending?.length) return;
    setId(null); setReference(`ORDER-${new Date().toISOString().slice(0, 10)}`); setShop(pending[0]?.designer ?? ""); setCurrency("INR"); setNotes("");
    setSellerRef(""); setSalesName(""); setSalesMobile(""); setSellerTotal(""); setAdvance(""); setDocs([]);
    setItems(pending); setPayments([]); setStatus("draft"); setCourier(""); setTracking(""); setOpen(true); onPendingHandled();
  }, [pending, onPendingHandled]);

  const computed = orderTotals(items, payments);
  const agreed = sellerTotal === "" ? computed.total : Number(sellerTotal);
  const advanceNum = Number(advance || 0);
  const balance = Math.round((agreed - advanceNum - computed.paid) * 100) / 100;
  const changeItem = (rid: string, patch: Partial<OrderItem>) => setItems((all) => all.map((i) => i.reservationId === rid ? { ...i, ...patch } : i));

  async function save(place = false) {
    setBusy(true);
    try {
      validateOrder(items, payments);
      if (!reference.trim()) throw new Error("Enter an order reference");
      if (!Number.isFinite(agreed) || agreed < 0 || !Number.isFinite(advanceNum) || advanceNum < 0) throw new Error("Amounts must be zero or more");
      if (advanceNum + computed.paid > agreed) throw new Error("Advance and payments cannot exceed the total amount");
      if (place && items.some((i) => !i.measurements)) throw new Error("Measurements are required for each wearer");
      const values = { invite_id: inviteId, reference: reference.trim(), shop_name: shop, currency: currency.toUpperCase(), notes, items: items as unknown as Json, payments: payments as unknown as Json, status: place ? "placed" : status, courier, tracking_number: tracking,
        seller_reference: sellerRef.trim(), salesperson_name: salesName.trim(), salesperson_mobile: salesMobile.trim(), seller_total: sellerTotal === "" ? null : agreed, advance_amount: advanceNum, documents: docs as unknown as Json,
        ...(place ? { placed_at: new Date().toISOString() } : {}) };
      const result = id ? await supabase.from("wardrobe_orders").update(values).eq("id", id).eq("invite_id", inviteId) : await supabase.from("wardrobe_orders").insert(values);
      if (result.error) throw result.error;
      toast.success(place ? "Order recorded as placed with the seller" : "Order saved"); setOpen(false); await qc.invalidateQueries({ queryKey: ["wardrobe-orders"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't save order"); } finally { setBusy(false); }
  }
  async function upload(file: File) {
    setBusy(true);
    try {
      const path = `${inviteId}/orders/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error } = await supabase.storage.from("order-documents").upload(path, file); if (error) throw error;
      const next = [...docs, { path, name: file.name, kind: docKind }]; setDocs(next);
      if (id) { const r = await supabase.from("wardrobe_orders").update({ documents: next as unknown as Json }).eq("id", id).eq("invite_id", inviteId); if (r.error) throw r.error; }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't upload file"); } finally { setBusy(false); }
  }
  async function openDoc(path: string) {
    const r = await supabase.storage.from("order-documents").createSignedUrl(path, 600);
    if (r.data) window.open(r.data.signedUrl, "_blank", "noopener"); else toast.error("Couldn't open file");
  }
  async function removeDoc(path: string) {
    setBusy(true);
    try { const next = docs.filter((d) => d.path !== path); if (id) { const r = await supabase.from("wardrobe_orders").update({ documents: next as unknown as Json }).eq("id", id).eq("invite_id", inviteId); if (r.error) throw r.error; } await supabase.storage.from("order-documents").remove([path]); setDocs(next); }
    catch { toast.error("Couldn't remove file"); } finally { setBusy(false); }
  }
  async function pdf() { setBusy(true); try { validateOrder(items, payments); await downloadShopOrderPdf(reference || "order", shop, currency, items, payments, notes); } catch(e) { toast.error(e instanceof Error ? e.message : "Couldn't generate PDF"); } finally { setBusy(false); } }

  return <section className="space-y-3">
    {orders.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : !(orders.data ?? []).length ? <p className="panel-wrap p-5 text-sm text-muted-foreground">No orders yet — tick looks on the Pre-orders tab and place a combined or individual order.</p> : null}
    {(orders.data ?? []).map((o) => { const t = orderTotals(o.items as unknown as OrderItem[], o.payments as unknown as OrderPayment[]); const total = o.seller_total ?? t.total; const bal = Number(total) - Number(o.advance_amount) - t.paid; return <div key={o.id} className="panel-wrap flex flex-wrap items-center justify-between gap-3 p-4"><div className="min-w-0"><p className="font-medium">{o.reference} · {o.shop_name || "Seller not set"}{o.seller_reference ? ` · seller ref ${o.seller_reference}` : ""}</p><p className="text-sm text-muted-foreground">{o.status} · {(o.items as unknown as OrderItem[]).length} looks · {o.currency} {Number(total).toLocaleString()} · advance {Number(o.advance_amount).toLocaleString()} · paid {t.paid.toLocaleString()} · balance {bal.toLocaleString()}{o.salesperson_name ? ` · ${o.salesperson_name}${o.salesperson_mobile ? ` (${o.salesperson_mobile})` : ""}` : ""}</p></div><Button variant="outline" size="sm" onClick={() => { setId(o.id); setReference(o.reference); setShop(o.shop_name); setCurrency(o.currency); setNotes(o.notes); setSellerRef(o.seller_reference); setSalesName(o.salesperson_name); setSalesMobile(o.salesperson_mobile); setSellerTotal(o.seller_total == null ? "" : String(o.seller_total)); setAdvance(Number(o.advance_amount) ? String(o.advance_amount) : ""); setDocs((o.documents as unknown as OrderDocument[]) ?? []); setItems(o.items as unknown as OrderItem[]); setPayments(o.payments as unknown as OrderPayment[]); setStatus(o.status); setCourier(o.courier); setTracking(o.tracking_number); setOpen(true); }}>Open order</Button></div>; })}
    {orders.isError ? <p className="text-destructive">Couldn't load orders.</p> : null}
    <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>{id ? "Order" : items.length > 1 ? "New combined order" : "New order"}</DialogTitle></DialogHeader>
      <div className="grid gap-3 sm:grid-cols-3"><label className="text-sm">Our reference<Input value={reference} onChange={(e) => setReference(e.target.value)} /></label><label className="text-sm">Seller / shop<Input value={shop} onChange={(e) => setShop(e.target.value)} /></label><label className="text-sm">Currency<Input maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value)} /></label></div>
      <div className="grid gap-3 sm:grid-cols-3"><label className="text-sm">Seller's order reference<Input value={sellerRef} onChange={(e) => setSellerRef(e.target.value)} /></label><label className="text-sm">Salesperson / stylist name<Input value={salesName} onChange={(e) => setSalesName(e.target.value)} /></label><label className="text-sm">Salesperson mobile<Input type="tel" value={salesMobile} onChange={(e) => setSalesMobile(e.target.value)} /></label></div>
      <div className="grid gap-3 sm:grid-cols-3"><label className="text-sm">Total amount agreed ({currency})<Input type="number" min="0" placeholder={String(computed.total)} value={sellerTotal} onChange={(e) => setSellerTotal(e.target.value)} /></label><label className="text-sm">Advance paid ({currency})<Input type="number" min="0" placeholder="0" value={advance} onChange={(e) => setAdvance(e.target.value)} /></label><p className="self-end pb-2 text-sm">Balance {currency} {balance.toLocaleString()}</p></div>

      <div className="border-t border-border pt-4"><h3 className="font-medium">Order, proforma and bill</h3>
        {docs.map((d) => <div key={d.path} className="flex items-center justify-between gap-2 py-1 text-sm"><button type="button" className="min-w-0 truncate text-left underline" onClick={() => void openDoc(d.path)}>{d.kind}: {d.name}</button><Button variant="ghost" size="icon" title="Remove file" disabled={busy} onClick={() => void removeDoc(d.path)}><Trash2 className="size-4" /></Button></div>)}
        <div className="mt-2 flex flex-wrap items-center gap-2"><select className="field-select h-9 rounded-md border border-border bg-background px-2 text-sm" aria-label="Document type" value={docKind} onChange={(e) => setDocKind(e.target.value)}>{DOC_KINDS.map((k) => <option key={k}>{k}</option>)}</select>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"><Paperclip className="size-4" /> Upload file<input type="file" className="sr-only" accept="image/*,application/pdf" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f); }} /></label></div></div>

      {items.map((item) => <div key={item.reservationId} className="space-y-3 border-t border-border pt-4"><div className="flex gap-3">{item.image ? <img src={item.image} alt={item.title} className="h-24 w-20 shrink-0 object-cover" /> : null}<div className="min-w-0 flex-1"><p className="font-medium">{item.wearer} · {item.event}</p><p className="text-sm">{item.title}</p><p className="text-sm text-muted-foreground">{item.designer} · size {item.size || "—"} · {item.sku}</p></div>{items.length > 1 ? <Button variant="ghost" size="icon" title="Remove from order" onClick={() => setItems((a) => a.filter((i) => i.reservationId !== item.reservationId))}><Trash2 className="size-4" /></Button> : null}</div>
      <div className="grid gap-3 sm:grid-cols-3"><label className="text-sm">Shop price ({currency})<Input type="number" min="0" value={item.price} onChange={(e) => changeItem(item.reservationId, { price: Number(e.target.value) })} /></label><label className="text-sm">Discount amount ({currency})<Input type="number" min="0" max={item.price} value={item.discount} onChange={(e) => changeItem(item.reservationId, { discount: Number(e.target.value) })} /></label><p className="self-end pb-2 text-sm">Net {currency} {(item.price - item.discount).toLocaleString()}</p></div>
      <h3 className="text-sm font-medium">Wearer measurements</h3><dl className="grid gap-2 text-xs sm:grid-cols-3">{item.measurements ? Object.entries(item.measurements).map(([k, v]) => <div key={k}><dt className="text-muted-foreground">{k.replaceAll("_", " ")}</dt><dd>{v}</dd></div>) : <p className="text-destructive">No measurements supplied</p>}</dl>
      <label className="block text-sm">Customisations / availability questions<Textarea value={item.notes} onChange={(e) => changeItem(item.reservationId, { notes: e.target.value })} /></label></div>)}
      <label className="text-sm">Discount / delivery discussion notes<Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      <div className="border-t border-border pt-4"><h3 className="font-medium">Further part-payments</h3>{payments.map((p, index) => <div key={index} className="flex items-center justify-between gap-2 py-2 text-sm"><span>{p.date} · {currency} {p.amount.toLocaleString()} · {p.reference}</span><Button variant="ghost" size="icon" title="Remove payment record" onClick={() => setPayments((a) => a.filter((_, i) => i !== index))}><Trash2 className="size-4" /></Button></div>)}<div className="grid gap-2 sm:grid-cols-4"><Input type="number" min="0" placeholder="Payment amount" aria-label="Payment amount" value={amount} onChange={(e) => setAmount(e.target.value)} /><Input type="date" aria-label="Payment date" value={date} onChange={(e) => setDate(e.target.value)} /><Input placeholder="Payment reference / method" value={payReference} onChange={(e) => setPayReference(e.target.value)} /><Button variant="outline" onClick={() => { const p = { amount: Number(amount), date, reference: payReference }; try { validateOrder(items, [...payments, p]); setPayments((a) => [...a, p]); setAmount(""); setPayReference(""); } catch(e) { toast.error(e instanceof Error ? e.message : "Invalid payment"); } }}>Add payment record</Button></div></div>
      <div className="grid gap-3 sm:grid-cols-3"><label className="text-sm">Order status<select className="field-select w-full" value={status} onChange={(e) => setStatus(e.target.value)}>{["draft", "placed", "shipped", "delivered"].map((s) => <option key={s}>{s}</option>)}</select></label><label className="text-sm">Courier<Input value={courier} onChange={(e) => setCourier(e.target.value)} /></label><label className="text-sm">Tracking number<Input value={tracking} onChange={(e) => setTracking(e.target.value)} /></label></div>
      <p className="font-medium">Total {currency} {agreed.toLocaleString()} · advance {advanceNum.toLocaleString()} · paid {computed.paid.toLocaleString()} · balance {balance.toLocaleString()}</p>
      <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy || !items.length} onClick={() => void pdf()}><FileDown className="size-4" /> Order PDF</Button><Button variant="outline" disabled={busy} onClick={() => void save()}>Save order</Button>{status === "draft" ? <Button disabled={busy || !items.length || items.some((i) => !i.measurements)} onClick={() => void save(true)}>Record order placed</Button> : null}{id && status === "draft" ? <Button variant="ghost" disabled={busy} onClick={async () => { if (!window.confirm("Delete this draft order and its payment records?")) return; setBusy(true); try { const r = await supabase.from("wardrobe_orders").delete().eq("id", id).eq("invite_id", inviteId).eq("status", "draft"); if(r.error) throw r.error; if (docs.length) await supabase.storage.from("order-documents").remove(docs.map((d) => d.path)); setOpen(false); await qc.invalidateQueries({ queryKey: ["wardrobe-orders"] }); } catch { toast.error("Couldn't delete draft"); } finally { setBusy(false); } }}><Trash2 className="size-4" /> Delete draft</Button> : null}</div>
    </DialogContent></Dialog>
  </section>;
}
