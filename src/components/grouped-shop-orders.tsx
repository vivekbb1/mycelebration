import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileDown, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { orderTotals, validateOrder, type OrderItem, type OrderPayment } from "@/lib/shop-order";
import { downloadShopOrderPdf } from "@/lib/shop-order-pdf";
import type { Json } from "@/integrations/supabase/types";

export function GroupedShopOrders({ inviteId, candidates }: { inviteId: string; candidates: OrderItem[] }) {
  const qc = useQueryClient();
  const orders = useQuery({ queryKey: ["wardrobe-orders", inviteId], enabled: Boolean(inviteId), queryFn: async () => {
    const { data, error } = await supabase.from("wardrobe_orders").select("*").eq("invite_id", inviteId).order("created_at", { ascending: false });
    if (error) throw error; return data ?? [];
  } });
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false);
  const [id, setId] = useState<string | null>(null); const [reference, setReference] = useState("");
  const [shop, setShop] = useState(""); const [currency, setCurrency] = useState("INR"); const [notes, setNotes] = useState("");
  const [items, setItems] = useState<OrderItem[]>([]); const [payments, setPayments] = useState<OrderPayment[]>([]);
  const [status, setStatus] = useState("draft"); const [courier, setCourier] = useState(""); const [tracking, setTracking] = useState("");
  const [amount, setAmount] = useState(""); const [payReference, setPayReference] = useState(""); const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState(""); const [groupBy, setGroupBy] = useState("people");
  const used = new Set((orders.data ?? []).filter((o) => o.id !== id).flatMap((o) => (o.items as unknown as OrderItem[]).map((i) => i.reservationId)));
  const available = candidates.filter((c) => !used.has(c.reservationId) && `${c.wearer} ${c.title} ${c.family}`.toLowerCase().includes(search.toLowerCase()));
  const groups = Map.groupBy(available, (c) => groupBy === "people" ? `${c.wearer} · ${c.family}` : c.title);
  const totals = orderTotals(items, payments);
  function create() { setId(null); setReference(`ORDER-${new Date().toISOString().slice(0, 10)}`); setShop(""); setCurrency("INR"); setNotes(""); setItems([]); setPayments([]); setStatus("draft"); setCourier(""); setTracking(""); setOpen(true); }
  const changeItem = (rid: string, patch: Partial<OrderItem>) => setItems((all) => all.map((i) => i.reservationId === rid ? { ...i, ...patch } : i));
  async function save(place = false) {
    setBusy(true);
    try {
      validateOrder(items, payments);
      if (!reference.trim()) throw new Error("Enter an order reference");
      if (place && items.some((i) => !i.measurements)) throw new Error("Measurements are required for each wearer");
      const values = { invite_id: inviteId, reference: reference.trim(), shop_name: shop, currency: currency.toUpperCase(), notes, items: items as unknown as Json, payments: payments as unknown as Json, status: place ? "placed" : status, courier, tracking_number: tracking, ...(place ? { placed_at: new Date().toISOString() } : {}) };
      const result = id ? await supabase.from("wardrobe_orders").update(values).eq("id", id).eq("invite_id", inviteId) : await supabase.from("wardrobe_orders").insert(values);
      if (result.error) throw result.error;
      toast.success(place ? "Order recorded as placed with the shop" : "Order saved"); setOpen(false); await qc.invalidateQueries({ queryKey: ["wardrobe-orders"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't save order"); } finally { setBusy(false); }
  }
  async function pdf() { setBusy(true); try { validateOrder(items, payments); await downloadShopOrderPdf(reference || "enquiry", shop, currency, items, payments, notes); } catch(e) { toast.error(e instanceof Error ? e.message : "Couldn't generate PDF"); } finally { setBusy(false); } }
  return <section className="space-y-3 border-b border-border pb-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl">Shop orders</h2><Button onClick={create} disabled={!inviteId}><Plus className="size-4" /> Create grouped order</Button></div>
    {(orders.data ?? []).map((o) => { const t = orderTotals(o.items as unknown as OrderItem[], o.payments as unknown as OrderPayment[]); return <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3"><div><p className="font-medium">{o.reference} · {o.shop_name || "Shop not set"}</p><p className="text-sm text-muted-foreground">{o.status} · {(o.items as unknown as OrderItem[]).length} looks · {o.currency} {t.total.toLocaleString()} · paid {t.paid.toLocaleString()} · balance {t.balance.toLocaleString()}</p></div><Button variant="outline" size="sm" onClick={() => { setId(o.id); setReference(o.reference); setShop(o.shop_name); setCurrency(o.currency); setNotes(o.notes); setItems(o.items as unknown as OrderItem[]); setPayments(o.payments as unknown as OrderPayment[]); setStatus(o.status); setCourier(o.courier); setTracking(o.tracking_number); setOpen(true); }}>Open order</Button></div>; })}
    {orders.isError ? <p className="text-destructive">Couldn't load shop orders.</p> : null}
    <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>{id ? "Shop order" : "New grouped shop order"}</DialogTitle></DialogHeader>
      <div className="grid gap-3 sm:grid-cols-3"><label className="text-sm">Order reference<Input value={reference} onChange={(e) => setReference(e.target.value)} /></label><label className="text-sm">Shop<Input value={shop} onChange={(e) => setShop(e.target.value)} /></label><label className="text-sm">Currency<Input maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value)} /></label></div>
      {!id ? <div className="space-y-3"><div className="flex flex-wrap gap-2"><Button size="sm" variant={groupBy === "people" ? "default" : "outline"} onClick={() => setGroupBy("people")}>Group by people</Button><Button size="sm" variant={groupBy === "outfits" ? "default" : "outline"} onClick={() => setGroupBy("outfits")}>Group by outfits</Button><Input className="sm:max-w-xs" placeholder="Search people or outfits" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      <div className="max-h-60 space-y-2 overflow-y-auto">{[...groups].map(([label, list]) => <label key={label} className="flex items-start gap-2 border-b border-border py-2 text-sm"><Checkbox aria-label={`Select ${label}`} checked={list.every((i) => items.some((x) => x.reservationId === i.reservationId))} onCheckedChange={(v) => setItems((all) => v ? [...all, ...list.filter((i) => !all.some((x) => x.reservationId === i.reservationId))] : all.filter((x) => !list.some((i) => i.reservationId === x.reservationId)))} /><span>{label}<span className="block text-xs text-muted-foreground">{list.length} look{list.length === 1 ? "" : "s"}</span></span></label>)}</div></div> : null}
      {items.map((item) => <div key={item.reservationId} className="space-y-3 border-t border-border pt-4"><div className="flex gap-3">{item.image ? <img src={item.image} alt={item.title} className="h-24 w-20 shrink-0 object-cover" /> : null}<div className="min-w-0 flex-1"><p className="font-medium">{item.wearer} · {item.event}</p><p className="text-sm">{item.title}</p><p className="text-sm text-muted-foreground">{item.designer} · size {item.size || "—"} · {item.sku}</p></div><Button variant="ghost" size="icon" title="Remove from order" onClick={() => setItems((a) => a.filter((i) => i.reservationId !== item.reservationId))}><Trash2 className="size-4" /></Button></div>
      <div className="grid gap-3 sm:grid-cols-3"><label className="text-sm">Shop price ({currency})<Input type="number" min="0" value={item.price} onChange={(e) => changeItem(item.reservationId, { price: Number(e.target.value) })} /></label><label className="text-sm">Discount amount ({currency})<Input type="number" min="0" max={item.price} value={item.discount} onChange={(e) => changeItem(item.reservationId, { discount: Number(e.target.value) })} /></label><p className="self-end pb-2 text-sm">Net {currency} {(item.price - item.discount).toLocaleString()}</p></div>
      <dl className="grid gap-2 text-xs sm:grid-cols-3">{item.measurements ? Object.entries(item.measurements).map(([k, v]) => <div key={k}><dt className="text-muted-foreground">{k.replaceAll("_", " ")}</dt><dd>{v}</dd></div>) : <p className="text-destructive">No measurements supplied</p>}</dl>
      <label className="block text-sm">Customisations / availability questions<Textarea value={item.notes} onChange={(e) => changeItem(item.reservationId, { notes: e.target.value })} /></label></div>)}
      <label className="text-sm">Discount / delivery discussion notes<Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      <div className="border-t border-border pt-4"><h3 className="font-medium">Part-payments</h3>{payments.map((p, index) => <div key={index} className="flex items-center justify-between gap-2 py-2 text-sm"><span>{p.date} · {currency} {p.amount.toLocaleString()} · {p.reference}</span><Button variant="ghost" size="icon" title="Remove payment record" onClick={() => setPayments((a) => a.filter((_, i) => i !== index))}><Trash2 className="size-4" /></Button></div>)}<div className="grid gap-2 sm:grid-cols-4"><Input type="number" min="0" placeholder="Payment amount" aria-label="Payment amount" value={amount} onChange={(e) => setAmount(e.target.value)} /><Input type="date" aria-label="Payment date" value={date} onChange={(e) => setDate(e.target.value)} /><Input placeholder="Payment reference / method" value={payReference} onChange={(e) => setPayReference(e.target.value)} /><Button variant="outline" onClick={() => { const p = { amount: Number(amount), date, reference: payReference }; try { validateOrder(items, [...payments, p]); setPayments((a) => [...a, p]); setAmount(""); setPayReference(""); } catch(e) { toast.error(e instanceof Error ? e.message : "Invalid payment"); } }}>Add payment record</Button></div></div>
      <div className="grid gap-3 sm:grid-cols-3"><label className="text-sm">Order status<select className="field-select w-full" value={status} onChange={(e) => setStatus(e.target.value)}>{["draft", "placed", "shipped", "delivered"].map((s) => <option key={s}>{s}</option>)}</select></label><label className="text-sm">Courier<Input value={courier} onChange={(e) => setCourier(e.target.value)} /></label><label className="text-sm">Tracking number<Input value={tracking} onChange={(e) => setTracking(e.target.value)} /></label></div>
      <p className="font-medium">Total {currency} {totals.total.toLocaleString()} · discount {totals.discount.toLocaleString()} · paid {totals.paid.toLocaleString()} · balance {totals.balance.toLocaleString()}</p>
      <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy || !items.length} onClick={() => void pdf()}><FileDown className="size-4" /> Shop PDF</Button><Button variant="outline" disabled={busy} onClick={() => void save()}>Save order</Button>{status === "draft" ? <Button disabled={busy || !items.length || items.some((i) => !i.measurements)} onClick={() => void save(true)}>Record order placed</Button> : null}</div>
    </DialogContent></Dialog>
  </section>;
}