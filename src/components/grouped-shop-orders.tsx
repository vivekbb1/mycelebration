import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, FileDown, FileUp, Plus, Repeat, Save, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { addAddOn, familyOrderReport, nf, orderTotals, removeAddOn, setAlternative, setOrderedSize, setRevisedPrice, substituteItem, updateAddOn, type OrderAddOn, validateOrder, type DocKind, type OrderDocument, type OrderItem, type OrderPayment, type PaymentKind } from "@/lib/shop-order";
import { downloadShopOrderPdf } from "@/lib/shop-order-pdf";
import type { Json } from "@/integrations/supabase/types";

const BUCKET = "alteration-photos"; // private, host-only, celebration-prefixed
const DOC_LABEL: Record<DocKind, string> = { proforma: "Proforma", invoice: "Invoice", bill: "Bill", receipt: "Receipt", other: "Other" };

/** Orders built from pre-order selections. `startWith` opens a new order prefilled with looks. */
export function GroupedShopOrders({ inviteId, candidates, startWith, onStarted, listHidden, preorder = [] }: {
  inviteId: string; candidates: OrderItem[]; preorder?: OrderItem[]; startWith?: OrderItem[] | null; onStarted?: () => void; listHidden?: boolean;
}) {
  const qc = useQueryClient();
  const orders = useQuery({ queryKey: ["wardrobe-orders", inviteId], enabled: Boolean(inviteId), queryFn: async () => {
    const { data, error } = await supabase.from("wardrobe_orders").select("*").eq("invite_id", inviteId).order("created_at", { ascending: false });
    if (error) throw error; return data ?? [];
  } });
  const wardrobe = useQuery({ queryKey: ["order-wardrobe", inviteId], enabled: Boolean(inviteId), queryFn: async () => {
    const { data, error } = await supabase.from("outfits").select("id, title, designer, source_sku, boutique_url, image_url, price_inr, gender").eq("invite_id", inviteId).order("title");
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
    await qc.invalidateQueries({ queryKey: ["reservations"] });
    await qc.invalidateQueries({ queryKey: ["confirm-looks"] });
    await qc.invalidateQueries({ queryKey: ["host-orders"] });
    return result.data.id as string;
  }
  async function run(fn: () => Promise<unknown>, ok: string, close = true) {
    setBusy(true);
    try { await fn(); toast.success(ok); if (close) setOpen(false); }
    catch (e) {
      // Data API errors are plain objects, not Error instances. Keep the actual
      // rejection visible (measurements, duplicate order, etc.).
      const message = e && typeof e === "object" && "message" in e && typeof e.message === "string"
        ? e.message : "Couldn't save order";
      toast.error(message);
    }
    finally { setBusy(false); }
  }

  async function saveOrderedSize(item: OrderItem) {
    if (!id) throw new Error("Save the order first");
    // Read the latest order so a size-only change never overwrites payments or other edits.
    const current = await supabase.from("wardrobe_orders").select("items, status, updated_at").eq("id", id).eq("invite_id", inviteId).single();
    if (current.error) throw current.error;
    if (!["placed", "shipped", "delivered"].includes(current.data.status)) throw new Error("Reopen the order — its status has changed");
    const latest = current.data.items as unknown as OrderItem[];
    if (!latest.some((i) => i.reservationId === item.reservationId)) throw new Error("This look is no longer in the order. Reopen it to continue");
    const next = setOrderedSize(latest, item.reservationId, (item.orderedSize ?? "").trim());
    const saved = await supabase.from("wardrobe_orders").update({ items: next as unknown as Json }).eq("id", id).eq("invite_id", inviteId).eq("updated_at", current.data.updated_at).select("id").maybeSingle();
    if (saved.error) throw saved.error;
    if (!saved.data) throw new Error("The order changed while saving. Try again");
    await Promise.all(["wardrobe-orders", "reservations", "confirm-looks", "host-orders"].map((key) => qc.invalidateQueries({ queryKey: [key] })));
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
  const [orderSearch, setOrderSearch] = useState(""); const [showReport, setShowReport] = useState(false);
  const q = orderSearch.trim().toLowerCase();
  const itemHit = (i: OrderItem) => !q || `${i.wearer} ${i.family} ${i.event} ${i.title} ${i.sku} ${i.alternative?.title ?? ""} ${i.alternative?.sku ?? ""}`.toLowerCase().includes(q);
  const shownOrders = (orders.data ?? []).filter((o) => !q || `${o.reference} ${o.seller_reference} ${o.shop_name}`.toLowerCase().includes(q) || (o.items as unknown as OrderItem[]).some(itemHit));
  const currentFamily = new Map(candidates.map((c) => [c.reservationId, c.family]));
  const orderedReport = familyOrderReport(active.map((o) => o.items as unknown as OrderItem[]), (i) => currentFamily.get(i.reservationId) || undefined);
  const preReport = new Map(familyOrderReport([preorder]).map((f) => [f.family, f]));
  const familyReport = [...new Set([...orderedReport.map((f) => f.family), ...preReport.keys()])].map((family) => {
    const o = orderedReport.find((f) => f.family === family); const p = preReport.get(family);
    return { family, people: [...new Set([...(o?.people ?? []), ...(p?.people ?? [])])].sort(), looks: o?.looks ?? 0, extras: o?.extras ?? 0, amount: o?.amount ?? 0, preLooks: p?.looks ?? 0, preAmount: p?.amount ?? 0 };
  }).sort((a, b) => b.amount + b.preAmount - a.amount - a.preAmount);
  const sum = active.reduce((acc, o) => { const t = orderTotals(o.items as unknown as OrderItem[], o.payments as unknown as OrderPayment[], Number(o.courier_charges ?? 0)); acc.total += t.total; acc.paid += t.paid; return acc; }, { total: 0, paid: 0 });

  return <section className={listHidden ? "contents" : "space-y-3"}>
    {listHidden ? null : <>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl">Shop orders</h2>{active.length ? <p className="text-sm text-muted-foreground">{active.length} active · total {sum.total.toLocaleString(...nf(currency))} · paid {sum.paid.toLocaleString(...nf(currency))} · balance {(sum.total - sum.paid).toLocaleString(...nf(currency))}</p> : null}</div>
      <Button onClick={() => reset()} disabled={!inviteId}><Plus className="size-4" /> New order</Button>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <Input className="sm:max-w-sm" placeholder="Search orders by person, family, event, outfit or reference" aria-label="Search orders" value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)} />
      <Button size="sm" variant="outline" onClick={() => setShowReport((v) => !v)}>{showReport ? "Hide" : "Show"} amount by family</Button>
    </div>
    {showReport ? <div className="overflow-x-auto rounded-md border border-border"><table className="w-full text-sm">
      <thead><tr className="text-left text-muted-foreground"><th className="p-2">Family</th><th className="p-2">People</th><th className="p-2 text-right">Looks</th><th className="p-2 text-right">Extra items</th><th className="p-2 text-right">Amount ordered</th><th className="p-2 text-right">Still in pre-order</th><th className="p-2 text-right">Family total</th></tr></thead>
      <tbody>{familyReport.map((f) => <tr key={f.family} className="border-t border-border"><td className="p-2 font-medium">{f.family}</td><td className="p-2">{f.people.join(", ")}</td><td className="p-2 text-right">{f.looks}</td><td className="p-2 text-right">{f.extras}</td><td className="p-2 text-right">{f.amount.toLocaleString(...nf(currency))}</td><td className="p-2 text-right">{f.preAmount.toLocaleString(...nf(currency))}{f.preLooks ? ` (${f.preLooks})` : ""}</td><td className="p-2 text-right font-medium">{(f.amount + f.preAmount).toLocaleString(...nf(currency))}</td></tr>)}
      <tr className="border-t border-border font-medium"><td className="p-2" colSpan={4}>Total (excludes courier charges)</td><td className="p-2 text-right">{familyReport.reduce((s, f) => s + f.amount, 0).toLocaleString(...nf(currency))}</td><td className="p-2 text-right">{familyReport.reduce((s, f) => s + f.preAmount, 0).toLocaleString(...nf(currency))}</td><td className="p-2 text-right">{familyReport.reduce((s, f) => s + f.amount + f.preAmount, 0).toLocaleString(...nf(currency))}</td></tr></tbody>
    </table><p className="p-2 text-xs text-muted-foreground">Amount ordered = active orders after discounts. Still in pre-order = looks not yet in an order, at shop price (number of looks in brackets). To move a person into another family, open their family page and use the move-members button beside Add member; new orders then show the new family.</p></div> : null}
    {shownOrders.map((o) => { const t = orderTotals(o.items as unknown as OrderItem[], o.payments as unknown as OrderPayment[], Number(o.courier_charges ?? 0)); return (
      <div key={o.id} className={`flex flex-wrap items-center justify-between gap-3 border-b border-border py-3 ${o.status === "cancelled" ? "opacity-60" : ""}`}>
        <div>
          <p className="font-medium">{o.reference}{o.seller_reference ? ` · shop ref ${o.seller_reference}` : ""} · {o.shop_name || "Shop not set"}</p>
          <p className="text-sm">{[...new Set((o.items as unknown as OrderItem[]).map((i) => i.wearer))].join(" · ")}</p>
          {q ? <p className="text-xs text-primary">{(o.items as unknown as OrderItem[]).filter(itemHit).map((i) => `${i.wearer} · ${i.event} · ${i.alternative?.title || i.title}`).join(" | ")}</p> : null}
          <p className="text-sm text-muted-foreground">{o.status} · {(o.items as unknown as OrderItem[]).length} looks · {o.currency} {t.total.toLocaleString(...nf(o.currency))} · advance {t.advance.toLocaleString(...nf(o.currency))} · paid {t.paid.toLocaleString(...nf(o.currency))} · balance {t.balance.toLocaleString(...nf(o.currency))}{o.salesperson_name ? ` · stylist ${o.salesperson_name}` : ""}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => openOrder(o)}>Open order</Button>
      </div>); })}
    {orders.isSuccess && !(orders.data ?? []).length ? <p className="text-sm text-muted-foreground">No shop orders yet. Tick looks in Pre-orders and choose "Convert to one order", or start a new order here.</p> : null}
    {orders.isError ? <p className="text-destructive">Couldn't load shop orders.</p> : null}
    </>}

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
          <div className="min-w-0 flex-1"><p className="font-medium">{item.wearer} · {item.event}</p><p className="text-sm">{item.title}</p><p className="text-sm text-muted-foreground">{item.designer} · size {item.size || "—"} · {item.sku}</p>{item.alternative ? <p className="text-sm font-medium text-primary">Shop order: {item.alternative.title || item.alternative.sku}{item.alternative.sku && item.alternative.title ? ` (${item.alternative.sku})` : ""}</p> : null}{item.addOns?.length ? <p className="text-sm text-muted-foreground">+ {item.addOns.map((a) => a.label).join(", ")}</p> : null}</div>
          {!cancelled ? <div className="flex shrink-0 flex-col gap-1">
            <Button variant="ghost" size="sm" title="Substitute another outfit" onClick={() => { setSwapFor(item.reservationId); setAdding(false); }}><Repeat className="size-4" /> Substitute</Button>
            <Button variant="ghost" size="sm" title="Remove from order" onClick={() => setItems((a) => a.filter((i) => i.reservationId !== item.reservationId))}><Trash2 className="size-4" /> Remove</Button>
          </div> : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <label className="text-sm">Actual size ordered<div className="flex items-center gap-2"><Input aria-label={`Actual size ordered for ${item.wearer} — ${item.event}`} value={item.orderedSize ?? ""} disabled={busy || cancelled} placeholder={item.size ? `Guest selected: ${item.size}` : "Size / made to measure"} onChange={(e) => setItems((all) => setOrderedSize(all, item.reservationId, e.target.value))} />
            {id && ["placed", "shipped", "delivered"].includes(status) ? <Button type="button" variant="outline" size="icon" disabled={busy} title={`Save ordered size for ${item.wearer}`} aria-label={`Save ordered size for ${item.wearer} — ${item.event}`} onClick={() => void run(() => saveOrderedSize(item), `Ordered size saved for ${item.wearer}`, false)}><Save className="size-4" /></Button> : null}</div></label>
            <p className="text-xs text-muted-foreground">Guest requested size: {item.size || "Not recorded"}</p>
          </div>
          <p className="text-sm">Original uploaded price<br /><strong>{item.originalPrice != null ? `${currency} ${item.originalPrice.toLocaleString(...nf(currency))}` : "Not recorded"}</strong></p>
          <label className="text-sm">Revised price ({currency})<Input aria-label={`Revised price for ${item.wearer} — ${item.event}`} type="number" min="0" step="0.01" value={item.price} onChange={(e) => setItems((all) => setRevisedPrice(all, item.reservationId, Number(e.target.value)))} /></label>
          <label className="text-sm">Discount ({currency})<Input type="number" min="0" max={item.price} value={item.discount} onChange={(e) => changeItem(item.reservationId, { discount: Number(e.target.value) })} /></label>
          <p className="self-end pb-2 text-sm font-medium">Discounted price {currency} {(item.price - item.discount).toLocaleString(...nf(currency))}</p>
        </div>
        <h3 className="text-sm font-medium">Wearer measurements</h3>
        <dl className="grid gap-2 text-xs sm:grid-cols-3">{item.measurements ? Object.entries(item.measurements).map(([k, v]) => <div key={k}><dt className="text-muted-foreground">{k.replaceAll("_", " ")}</dt><dd>{v}</dd></div>) : <p className="text-destructive">No measurements supplied</p>}</dl>
        <div className="space-y-2 rounded-md border border-border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium">Alternative for the shop order <span className="font-normal text-muted-foreground">(guest still sees their own choice)</span></h3>
            {!cancelled ? (item.alternative
              ? <Button size="sm" variant="ghost" onClick={() => setItems((all) => setAlternative(all, item.reservationId, null))}>Remove alternative</Button>
              : <Button size="sm" variant="outline" onClick={() => setItems((all) => setAlternative(all, item.reservationId, { title: "", sku: "", designer: "", shop: "", image: "" }))}><Repeat className="size-4" /> Order an alternative</Button>) : null}
          </div>
          {item.alternative ? <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-sm sm:col-span-2">Pick from wardrobe<select aria-label={`Wardrobe alternative for ${item.wearer} — ${item.event}`} className="field-select w-full" value={item.alternative.outfitId ?? ""} disabled={cancelled} onChange={(e) => { const o = (wardrobe.data ?? []).find((w) => w.id === e.target.value); if (!o) { setItems((all) => setAlternative(all, item.reservationId, { ...item.alternative!, outfitId: null })); return; } setItems((all) => { const next = setAlternative(all, item.reservationId, { outfitId: o.id, title: o.title, sku: o.source_sku ?? "", designer: o.designer ?? "", shop: o.boutique_url ?? "", image: o.image_url ?? "" }); return o.price_inr != null ? setRevisedPrice(next, item.reservationId, Number(o.price_inr)) : next; }); }}>
              <option value="">Type it in by hand below</option>
              {(wardrobe.data ?? []).map((w) => <option key={w.id} value={w.id}>{w.title}{w.source_sku ? ` (${w.source_sku})` : ""}{w.designer ? ` · ${w.designer}` : ""} · {w.gender}</option>)}
            </select></label>
            <label className="text-sm">Outfit name<Input value={item.alternative.title} disabled={cancelled} onChange={(e) => setItems((all) => setAlternative(all, item.reservationId, { ...item.alternative!, title: e.target.value }))} /></label>
            <label className="text-sm">Model number<Input value={item.alternative.sku} disabled={cancelled} onChange={(e) => setItems((all) => setAlternative(all, item.reservationId, { ...item.alternative!, sku: e.target.value }))} /></label>
            <label className="text-sm">Designer<Input value={item.alternative.designer} disabled={cancelled} onChange={(e) => setItems((all) => setAlternative(all, item.reservationId, { ...item.alternative!, designer: e.target.value }))} /></label>
            <label className="text-sm">Shop link<Input value={item.alternative.shop} disabled={cancelled} onChange={(e) => setItems((all) => setAlternative(all, item.reservationId, { ...item.alternative!, shop: e.target.value }))} /></label>
            <p className="text-xs text-muted-foreground sm:col-span-2">Set the alternative's price in "Revised price" above.</p>
          </div> : null}
        </div>
        <div className="space-y-2 rounded-md border border-border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium">Extra items for this look <span className="font-normal text-muted-foreground">(e.g. trousers · hosts only)</span></h3>
            {!cancelled ? <Button size="sm" variant="outline" onClick={() => setItems((all) => addAddOn(all, item.reservationId, { id: crypto.randomUUID(), label: "Trousers", sku: "", size: "", shop: "", price: 0, discount: 0, notes: "" }))}><Plus className="size-4" /> Add extra item</Button> : null}
          </div>
          {(item.addOns ?? []).map((a) => { const up = (patch: Partial<OrderAddOn>) => setItems((all) => updateAddOn(all, item.reservationId, a.id, patch)); return <div key={a.id} className="grid gap-2 border-t border-border pt-2 sm:grid-cols-4">
            <label className="text-sm">Item<Input aria-label={`Extra item for ${item.wearer}`} value={a.label} disabled={cancelled} onChange={(e) => up({ label: e.target.value })} /></label>
            <label className="text-sm">Model number<Input value={a.sku} disabled={cancelled} onChange={(e) => up({ sku: e.target.value })} /></label>
            <label className="text-sm">Size<Input value={a.size} disabled={cancelled} onChange={(e) => up({ size: e.target.value })} /></label>
            <label className="text-sm">Shop link<Input value={a.shop} disabled={cancelled} onChange={(e) => up({ shop: e.target.value })} /></label>
            <label className="text-sm">Price ({currency})<Input type="number" min="0" step="0.01" value={a.price} disabled={cancelled} onChange={(e) => up({ price: Number(e.target.value) })} /></label>
            <label className="text-sm">Discount ({currency})<Input type="number" min="0" value={a.discount} disabled={cancelled} onChange={(e) => up({ discount: Number(e.target.value) })} /></label>
            <p className="self-end pb-2 text-sm font-medium">{currency} {(a.price - a.discount).toLocaleString(...nf(currency))}</p>
            {!cancelled ? <Button className="self-end" variant="ghost" size="sm" onClick={() => setItems((all) => removeAddOn(all, item.reservationId, a.id))}><Trash2 className="size-4" /> Remove</Button> : null}
          </div>; })}
        </div>
        <label className="block text-sm">Customisations / availability questions<Textarea value={item.notes} onChange={(e) => changeItem(item.reservationId, { notes: e.target.value })} /></label>
      </div>)}

      <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-3">
        <label className="text-sm">Courier charges ({currency})<Input type="number" min="0" value={courierCharges} onChange={(e) => setCourierCharges(e.target.value)} /></label>
        <label className="text-sm">Seller's quoted total ({currency})<Input type="number" min="0" placeholder="From proforma / invoice" value={sellerTotal} onChange={(e) => setSellerTotal(e.target.value)} /></label>
        <div className="self-end pb-2 text-sm">{sellerTotal && Number(sellerTotal) !== totals.total ? <span className="text-destructive">Differs from our total by {(Number(sellerTotal) - totals.total).toLocaleString(...nf(currency))}</span> : null}</div>
      </div>
      <label className="text-sm">Discount / delivery discussion notes<Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></label>

      <div className="border-t border-border pt-4">
        <h3 className="font-medium">Advance and payments</h3>
        {payments.map((p, index) => <div key={index} className="flex items-center justify-between gap-2 py-2 text-sm"><span>{p.kind === "advance" ? "Advance" : "Payment"} · {p.date} · {currency} {p.amount.toLocaleString(...nf(currency))}{p.reference ? ` · ${p.reference}` : ""}</span><Button variant="ghost" size="icon" title="Remove payment record" onClick={() => setPayments((a) => a.filter((_, i) => i !== index))}><Trash2 className="size-4" /></Button></div>)}
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
        {docs.map((d) => <div key={d.path} className="flex items-center justify-between gap-2 py-2 text-sm"><button type="button" className="text-left hover:text-primary hover:underline" onClick={() => void openDoc(d.path)}>{DOC_LABEL[d.kind]}{d.number ? ` #${d.number}` : ""} · {d.date}{d.amount != null ? ` · ${currency} ${d.amount.toLocaleString(...nf(currency))}` : ""} · {d.name}</button><Button variant="ghost" size="icon" title="Remove document" disabled={busy} onClick={() => void removeDoc(d.path)}><Trash2 className="size-4" /></Button></div>)}
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
      <p className="font-medium">Order value {currency} {totals.total.toLocaleString(...nf(currency))} <span className="font-normal text-muted-foreground">(outfits {totals.gross.toLocaleString(...nf(currency))} − discount {totals.discount.toLocaleString(...nf(currency))} + courier {totals.courier.toLocaleString(...nf(currency))})</span> · advance {totals.advance.toLocaleString(...nf(currency))} · paid {totals.paid.toLocaleString(...nf(currency))} · balance {totals.balance.toLocaleString(...nf(currency))}</p>

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
