import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, FileDown, FileUp, Plus, Repeat, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { orderTotals, substituteItem, validateOrder, type DocKind, type OrderDocument, type OrderItem, type OrderPayment, type PaymentKind } from "@/lib/shop-order";
import { downloadShopOrderPdf } from "@/lib/shop-order-pdf";
import type { Json } from "@/integrations/supabase/types";

const BUCKET = "alteration-photos"; // private, host-only, celebration-prefixed
const DOC_LABEL: Record<DocKind, string> = { proforma: "Proforma", invoice: "Invoice", bill: "Bill", receipt: "Receipt", other: "Other" };

/** Orders built from pre-order selections. `startWith` opens a new order prefilled with looks. */
export function GroupedShopOrders({ inviteId, candidates, startWith, onStarted }: {
  inviteId: string; candidates: OrderItem[]; startWith?: OrderItem[] | null; onStarted?: () => void;
}) {
  const qc = useQueryClient();
  const orders = useQuery({ queryKey: ["wardrobe-orders", inviteId], enabled: Boolean(inviteId), queryFn: async () => {
    const { data, error } = await supabase.from("wardrobe_orders").select("*").eq("invite_id", inviteId).order("created_at", { ascending: false });
    if (error) throw error; return data ?? [];
  } });
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false);
  const [id, setId] = useState<string | null>(null); const [reference, setReference] = useState("");
  const [shop, setShop] = useState(""); const [currency, setCurrency] = useState("INR"); const [notes, setNotes] = useState("");
  const [sellerRef, setSellerRef] = useState(""); const [stylist, setStylist] = useState(""); const [stylistMobile, setStylistMobile] = useState("");
  const [sellerTotal, setSellerTotal] = useState(""); const [courierCharges, setCourierCharges] = useState("0");
  const [items, setItems] = useState<OrderItem[]>([]); const [payments, setPayments] = useState<OrderPayment[]>([]);
  const [docs, setDocs] = useState<OrderDocument[]>([]);
  const [status, setStatus] = useState("draft"); const [courier, setCourier] = useState(""); const [tracking, setTracking] = useState("");
  const [amount, setAmount] = useState(""); const [payKind, setPayKind] = useState<PaymentKind>("advance"); const [payReference, setPayReference] = useState(""); const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [docKind, setDocKind] = useState<DocKind>("proforma"); const [docNumber, setDocNumber] = useState(""); const [docAmount, setDocAmount] = useState("");
  const [search, setSearch] = useState(""); const [groupBy, setGroupBy] = useState("people"); const [adding, setAdding] = useState(false);
  const [swapFor, setSwapFor] = useState<string | null>(null);

  const used = new Set((orders.data ?? []).filter((o) => o.id !== id && o.status !== "cancelled").flatMap((o) => (o.items as unknown as OrderItem[]).map((i) => i.reservationId)));
  const available = candidates.filter((c) => !used.has(c.reservationId) && !items.some((i) => i.reservationId === c.reservationId) && `${c.wearer} ${c.title} ${c.family}`.toLowerCase().includes(search.toLowerCase()));
  const groups = new Map<string, OrderItem[]>();
  for (const c of available) { const key = groupBy === "people" ? `${c.wearer} · ${c.family}` : c.title; groups.set(key, [...(groups.get(key) ?? []), c]); }
  const courierNum = Number(courierCharges || 0);
  const totals = orderTotals(items, payments, courierNum);
  const cancelled = status === "cancelled";

  function reset(start: OrderItem[] = []) {
    setId(null); setReference(`ORDER-${new Date().toISOString().slice(0, 10)}`); setShop(""); setCurrency("INR"); setNotes("");
    setSellerRef(""); setStylist(""); setStylistMobile(""); setSellerTotal(""); setCourierCharges("0");
    setItems(start); setPayments([]); setDocs([]); setStatus("draft"); setCourier(""); setTracking(""); setAdding(start.length === 0); setSwapFor(null); setOpen(true);
  }
  useEffect(() => { if (startWith?.length) { reset(startWith); onStarted?.(); } }, [startWith]); // eslint-disable-line react-hooks/exhaustive-deps

  function openOrder(o: NonNullable<typeof orders.data>[number]) {
    setId(o.id); setReference(o.reference); setShop(o.shop_name); setCurrency(o.currency); setNotes(o.notes);
    setSellerRef(o.seller_reference); setStylist(o.salesperson_name); setStylistMobile(o.salesperson_mobile);
    setSellerTotal(o.seller_total?.toString() ?? ""); setCourierCharges(String(o.courier_charges ?? 0));
    setItems(o.items as unknown as OrderItem[]); setPayments(o.payments as unknown as OrderPayment[]); setDocs((o.documents as unknown as OrderDocument[]) ?? []);
    setStatus(o.status); setCourier(o.courier); setTracking(o.tracking_number); setAdding(false); setSwapFor(null); setOpen(true);
  }
  const changeItem = (rid: string, patch: Partial<OrderItem>) => setItems((all) => all.map((i) => i.reservationId === rid ? { ...i, ...patch } : i));

  async function persist(nextStatus: string, extra: Record<string, unknown> = {}) {
    if (nextStatus !== "cancelled") validateOrder(items, payments, courierNum);
    if (!reference.trim()) throw new Error("Enter an order reference");
    const values = {
      invite_id: inviteId, reference: reference.trim(), shop_name: shop, currency: currency.toUpperCase(), notes,
      seller_reference: sellerRef, salesperson_name: stylist, salesperson_mobile: stylistMobile,
      seller_total: sellerTotal.trim() === "" ? null : Number(sellerTotal), courier_charges: courierNum,
      items: items as unknown as Json, payments: payments as unknown as Json, documents: docs as unknown as Json,
      status: nextStatus, courier, tracking_number: tracking, ...extra,
    };
    const result = id
      ? await supabase.from("wardrobe_orders").update(values).eq("id", id).eq("invite_id", inviteId).select("id").single()
      : await supabase.from("wardrobe_orders").insert(values).select("id").single();
    if (result.error) throw result.error;
    setId(result.data.id); setStatus(nextStatus);
    await qc.invalidateQueries({ queryKey: ["wardrobe-orders"] });
    return result.data.id as string;
  }
  async function run(fn: () => Promise<unknown>, ok: string, close = true) {
    setBusy(true);
    try { await fn(); toast.success(ok); if (close) setOpen(false); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't save order"); }
    finally { setBusy(false); }
  }

  async function uploadDoc(file: File) {
    await run(async () => {
      const orderId = id ?? (await persist(status));
      const path = `${inviteId}/orders/${orderId}/${Date.now()}-${file.name.replace(/[^a-z0-9.-]/gi, "_")}`;
      const up = await supabase.storage.from(BUCKET).upload(path, file); if (up.error) throw up.error;
      const next = [...docs, { kind: docKind, path, name: file.name, number: docNumber, amount: docAmount ? Number(docAmount) : null, date }];
      const r = await supabase.from("wardrobe_orders").update({ documents: next as unknown as Json }).eq("id", orderId).eq("invite_id", inviteId);
      if (r.error) { await supabase.storage.from(BUCKET).remove([path]); throw r.error; }
      setDocs(next); setDocNumber(""); setDocAmount("");
      await qc.invalidateQueries({ queryKey: ["wardrobe-orders"] });
    }, `${DOC_LABEL[docKind]} attached`, false);
  }
  async function openDoc(path: string) {
    const r = await supabase.storage.from(BUCKET).createSignedUrl(path, 600);
    if (r.data) window.open(r.data.signedUrl, "_blank", "noopener"); else toast.error("Couldn't open document");
  }
  async function removeDoc(path: string) {
    await run(async () => {
      const next = docs.filter((d) => d.path !== path);
      if (id) { const r = await supabase.from("wardrobe_orders").update({ documents: next as unknown as Json }).eq("id", id).eq("invite_id", inviteId); if (r.error) throw r.error; }
      await supabase.storage.from(BUCKET).remove([path]); setDocs(next);
    }, "Document removed", false);
  }

  async function pdf() { setBusy(true); try { validateOrder(items, payments, courierNum); await downloadShopOrderPdf(reference || "enquiry", shop, currency, items, payments, notes); } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't generate PDF"); } finally { setBusy(false); } }

  const active = (orders.data ?? []).filter((o) => o.status !== "cancelled");
  const sum = active.reduce((acc, o) => { const t = orderTotals(o.items as unknown as OrderItem[], o.payments as unknown as OrderPayment[], Number(o.courier_charges ?? 0)); acc.total += t.total; acc.paid += t.paid; return acc; }, { total: 0, paid: 0 });

  return <section className="space-y-3 border-b border-border pb-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl">Shop orders</h2>{active.length ? <p className="text-sm text-muted-foreground">{active.length} active · total {sum.total.toLocaleString()} · paid {sum.paid.toLocaleString()} · balance {(sum.total - sum.paid).toLocaleString()}</p> : null}</div>
      <Button onClick={() => reset()} disabled={!inviteId}><Plus className="size-4" /> New order</Button>
    </div>
    {(orders.data ?? []).map((o) => { const t = orderTotals(o.items as unknown as OrderItem[], o.payments as unknown as OrderPayment[], Number(o.courier_charges ?? 0)); return (
      <div key={o.id} className={`flex flex-wrap items-center justify-between gap-3 border-b border-border py-3 ${o.status === "cancelled" ? "opacity-60" : ""}`}>
        <div>
          <p className="font-medium">{o.reference}{o.seller_reference ? ` · shop ref ${o.seller_reference}` : ""} · {o.shop_name || "Shop not set"}</p>
          <p className="text-sm text-muted-foreground">{o.status} · {(o.items as unknown as OrderItem[]).length} looks · {o.currency} {t.total.toLocaleString()} · advance {t.advance.toLocaleString()} · paid {t.paid.toLocaleString()} · balance {t.balance.toLocaleString()}{o.salesperson_name ? ` · stylist ${o.salesperson_name}` : ""}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => openOrder(o)}>Open order</Button>
      </div>); })}
    {orders.isError ? <p className="text-destructive">Couldn't load shop orders.</p> : null}

    <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl">
      <DialogHeader><DialogTitle>{id ? `Order ${reference}` : "New order"}{cancelled ? " (cancelled)" : ""}</DialogTitle></DialogHeader>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">Our order reference<Input value={reference} onChange={(e) => setReference(e.target.value)} /></label>
        <label className="text-sm">Shop<Input value={shop} onChange={(e) => setShop(e.target.value)} /></label>
        <label className="text-sm">Currency<Input maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value)} /></label>
        <label className="text-sm">Seller's order reference<Input value={sellerRef} onChange={(e) => setSellerRef(e.target.value)} /></label>
        <label className="text-sm">Stylist / salesperson<Input value={stylist} onChange={(e) => setStylist(e.target.value)} /></label>
        <label className="text-sm">Stylist mobile<Input type="tel" value={stylistMobile} onChange={(e) => setStylistMobile(e.target.value)} /></label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
        <h3 className="font-medium">Outfits in this order ({items.length})</h3>
        {!cancelled ? <Button size="sm" variant="outline" onClick={() => { setAdding((v) => !v); setSwapFor(null); }}><Plus className="size-4" /> Add outfits</Button> : null}
      </div>
      {adding || swapFor ? <div className="space-y-3 rounded-md border border-border p-3">
        <p className="text-sm">{swapFor ? `Choose the substitute for ${items.find((i) => i.reservationId === swapFor)?.title ?? "this outfit"}` : "Tick outfits to add"}</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={groupBy === "people" ? "default" : "outline"} onClick={() => setGroupBy("people")}>Group by people</Button>
          <Button size="sm" variant={groupBy === "outfits" ? "default" : "outline"} onClick={() => setGroupBy("outfits")}>Group by outfits</Button>
          <Input className="sm:max-w-xs" placeholder="Search people or outfits" value={search} onChange={(e) => setSearch(e.target.value)} />
          {!swapFor && available.length ? <Button size="sm" variant="outline" onClick={() => setItems((a) => [...a, ...available])}>Select all ({available.length})</Button> : null}
          {swapFor ? <Button size="sm" variant="ghost" onClick={() => setSwapFor(null)}>Cancel swap</Button> : null}
        </div>
        <div className="max-h-60 space-y-1 overflow-y-auto">
          {swapFor ? available.map((c) => <button key={c.reservationId} type="button" className="block w-full border-b border-border py-2 text-left text-sm hover:text-primary" onClick={() => { try { setItems((a) => substituteItem(a, swapFor, c)); setSwapFor(null); } catch (e) { toast.error((e as Error).message); } }}>{c.title}<span className="block text-xs text-muted-foreground">{c.wearer} · {c.family} · {c.event}</span></button>)
          : [...groups].map(([label, list]) => <label key={label} className="flex items-start gap-2 border-b border-border py-2 text-sm"><Checkbox aria-label={`Add ${label}`} checked={false} onCheckedChange={(v) => v && setItems((all) => [...all, ...list])} /><span>{label}<span className="block text-xs text-muted-foreground">{list.length} look{list.length === 1 ? "" : "s"}</span></span></label>)}
          {!available.length ? <p className="text-sm text-muted-foreground">No other outfits waiting to be ordered.</p> : null}
        </div>
      </div> : null}

      {items.map((item) => <div key={item.reservationId} className="space-y-3 border-t border-border pt-4">
        <div className="flex gap-3">
          {item.image ? <img src={item.image} alt={item.title} className="h-24 w-20 shrink-0 object-cover" /> : null}
          <div className="min-w-0 flex-1"><p className="font-medium">{item.wearer} · {item.event}</p><p className="text-sm">{item.title}</p><p className="text-sm text-muted-foreground">{item.designer} · size {item.size || "—"} · {item.sku}</p></div>
          {!cancelled ? <div className="flex shrink-0 flex-col gap-1">
            <Button variant="ghost" size="sm" title="Substitute another outfit" onClick={() => { setSwapFor(item.reservationId); setAdding(false); }}><Repeat className="size-4" /> Substitute</Button>
            <Button variant="ghost" size="sm" title="Remove from order" onClick={() => setItems((a) => a.filter((i) => i.reservationId !== item.reservationId))}><Trash2 className="size-4" /> Remove</Button>
          </div> : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">Shop price ({currency})<Input type="number" min="0" value={item.price} onChange={(e) => changeItem(item.reservationId, { price: Number(e.target.value) })} /></label>
          <label className="text-sm">Discount ({currency})<Input type="number" min="0" max={item.price} value={item.discount} onChange={(e) => changeItem(item.reservationId, { discount: Number(e.target.value) })} /></label>
          <p className="self-end pb-2 text-sm">Net {currency} {(item.price - item.discount).toLocaleString()}</p>
        </div>
        <h3 className="text-sm font-medium">Wearer measurements</h3>
        <dl className="grid gap-2 text-xs sm:grid-cols-3">{item.measurements ? Object.entries(item.measurements).map(([k, v]) => <div key={k}><dt className="text-muted-foreground">{k.replaceAll("_", " ")}</dt><dd>{v}</dd></div>) : <p className="text-destructive">No measurements supplied</p>}</dl>
        <label className="block text-sm">Customisations / availability questions<Textarea value={item.notes} onChange={(e) => changeItem(item.reservationId, { notes: e.target.value })} /></label>
      </div>)}

      <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-3">
        <label className="text-sm">Courier charges ({currency})<Input type="number" min="0" value={courierCharges} onChange={(e) => setCourierCharges(e.target.value)} /></label>
        <label className="text-sm">Seller's quoted total ({currency})<Input type="number" min="0" placeholder="From proforma / invoice" value={sellerTotal} onChange={(e) => setSellerTotal(e.target.value)} /></label>
        <div className="self-end pb-2 text-sm">{sellerTotal && Number(sellerTotal) !== totals.total ? <span className="text-destructive">Differs from our total by {(Number(sellerTotal) - totals.total).toLocaleString()}</span> : null}</div>
      </div>
      <label className="text-sm">Discount / delivery discussion notes<Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></label>

      <div className="border-t border-border pt-4">
        <h3 className="font-medium">Advance and payments</h3>
        {payments.map((p, index) => <div key={index} className="flex items-center justify-between gap-2 py-2 text-sm"><span>{p.kind === "advance" ? "Advance" : "Payment"} · {p.date} · {currency} {p.amount.toLocaleString()}{p.reference ? ` · ${p.reference}` : ""}</span><Button variant="ghost" size="icon" title="Remove payment record" onClick={() => setPayments((a) => a.filter((_, i) => i !== index))}><Trash2 className="size-4" /></Button></div>)}
        <div className="grid gap-2 sm:grid-cols-5">
          <select className="field-select h-9 rounded-md border border-border bg-background px-2 text-sm" aria-label="Payment type" value={payKind} onChange={(e) => setPayKind(e.target.value as PaymentKind)}><option value="advance">Advance</option><option value="payment">Payment</option></select>
          <Input type="number" min="0" placeholder="Amount" aria-label="Payment amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Input type="date" aria-label="Payment date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input placeholder="Reference / method" value={payReference} onChange={(e) => setPayReference(e.target.value)} />
          <Button variant="outline" onClick={() => { const p = { amount: Number(amount), date, reference: payReference, kind: payKind }; try { validateOrder(items, [...payments, p], courierNum); setPayments((a) => [...a, p]); setAmount(""); setPayReference(""); } catch (e) { toast.error(e instanceof Error ? e.message : "Invalid payment"); } }}>Add</Button>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <h3 className="font-medium">Proforma, invoices and bills</h3>
        {docs.map((d) => <div key={d.path} className="flex items-center justify-between gap-2 py-2 text-sm"><button type="button" className="text-left hover:text-primary hover:underline" onClick={() => void openDoc(d.path)}>{DOC_LABEL[d.kind]}{d.number ? ` #${d.number}` : ""} · {d.date}{d.amount != null ? ` · ${currency} ${d.amount.toLocaleString()}` : ""} · {d.name}</button><Button variant="ghost" size="icon" title="Remove document" disabled={busy} onClick={() => void removeDoc(d.path)}><Trash2 className="size-4" /></Button></div>)}
        <div className="grid gap-2 sm:grid-cols-5">
          <select className="field-select h-9 rounded-md border border-border bg-background px-2 text-sm" aria-label="Document type" value={docKind} onChange={(e) => setDocKind(e.target.value as DocKind)}>{(Object.keys(DOC_LABEL) as DocKind[]).map((k) => <option key={k} value={k}>{DOC_LABEL[k]}</option>)}</select>
          <Input placeholder="Document number" value={docNumber} onChange={(e) => setDocNumber(e.target.value)} />
          <Input type="number" min="0" placeholder="Amount" value={docAmount} onChange={(e) => setDocAmount(e.target.value)} />
          <Input type="date" aria-label="Document date" value={date} onChange={(e) => setDate(e.target.value)} />
          <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-border px-3 text-sm hover:bg-muted"><FileUp className="size-4" /> Attach file<input type="file" accept="application/pdf,image/*" className="sr-only" disabled={busy || !items.length} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void uploadDoc(f); }} /></label>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">Order status<select className="field-select w-full" value={status} disabled={cancelled} onChange={(e) => setStatus(e.target.value)}>{["draft", "placed", "shipped", "delivered"].map((s) => <option key={s}>{s}</option>)}{cancelled ? <option>cancelled</option> : null}</select></label>
        <label className="text-sm">Courier<Input value={courier} onChange={(e) => setCourier(e.target.value)} /></label>
        <label className="text-sm">Tracking number<Input value={tracking} onChange={(e) => setTracking(e.target.value)} /></label>
      </div>
      <p className="font-medium">Order value {currency} {totals.total.toLocaleString()} <span className="font-normal text-muted-foreground">(outfits {totals.gross.toLocaleString()} − discount {totals.discount.toLocaleString()} + courier {totals.courier.toLocaleString()})</span> · advance {totals.advance.toLocaleString()} · paid {totals.paid.toLocaleString()} · balance {totals.balance.toLocaleString()}</p>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={busy || !items.length} onClick={() => void pdf()}><FileDown className="size-4" /> Shop PDF</Button>
        {!cancelled ? <Button variant="outline" disabled={busy} onClick={() => void run(() => persist(status), "Order saved")}>Save order</Button> : null}
        {status === "draft" ? <Button disabled={busy || !items.length || items.some((i) => !i.measurements)} onClick={() => void run(() => persist("placed", { placed_at: new Date().toISOString() }), "Order recorded as placed with the shop")}>Record order placed</Button> : null}
        {id && !cancelled ? <Button variant="ghost" disabled={busy} onClick={() => { const reason = window.prompt("Cancel this order? Its outfits go back to pre-orders. Reason (optional):"); if (reason === null) return; void run(() => persist("cancelled", { cancel_reason: reason }), "Order cancelled — outfits are back in pre-orders"); }}><Ban className="size-4" /> Cancel order</Button> : null}
        {id && cancelled ? <Button variant="outline" disabled={busy} onClick={() => void run(() => persist("draft", { cancel_reason: "" }), "Order reinstated as draft", false)}><Undo2 className="size-4" /> Reinstate as draft</Button> : null}
      </div>
    </DialogContent></Dialog>
  </section>;
}
