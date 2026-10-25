import { SubstitutionNote, fillSnapsFromWardrobe, useLatestSubstitutions } from "@/components/substitution-note";
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
import { addAddOn, enrichOrderAlternative, familyOrderReport, nf, orderTotals, removeAddOn, setAlternative, setOrderedSize, setRevisedPrice, substituteItem, updateAddOn, type OrderAddOn, validateOrder, type DocKind, type OrderDocument, type OrderItem, type OrderPayment, type PaymentKind } from "@/lib/shop-order";
import { downloadShopOrderPdf } from "@/lib/shop-order-pdf";
import type { Json } from "@/integrations/supabase/types";
import { OutfitSubstitution } from "@/components/outfit-substitution";
import { FamilyOrderReport } from "@/components/family-order-report";
import { OrderInvoiceLines } from "@/components/order-invoice-lines";
import { OrderFamilyView } from "@/components/order-family-view";
import { AssignGuestLook } from "@/components/assign-guest-look";
import { useServerFn } from "@tanstack/react-start";
import { fetchPerniaLook } from "@/lib/pernia.functions";
import { fetchKoraLook } from "@/lib/kora.functions";
import { TrouserPairingReview } from "@/components/trouser-pairing-review";
import { OrderEventView } from "@/components/order-event-view";
import { IndividualShare, ShipmentButton, ShipmentLine, WearerNoteButton, useOrderPeople } from "@/components/wearer-order-actions";
import { OrderArrivalsView } from "@/components/order-arrivals-view";
import { OrderMenSetsView } from "@/components/order-men-sets-view";
import { useCelebrationName } from "@/components/family-order-report";
import { alphabetical } from "@/lib/order-sequence";
import { sameWearer, wearerLookLine } from "@/lib/wearer-order";
import { OrderStatusBadge } from "@/components/order-status-badge";

const BUCKET = "alteration-photos"; // private, host-only, celebration-prefixed
const DOC_LABEL: Record<DocKind, string> = { proforma: "Proforma", invoice: "Invoice", bill: "Bill", receipt: "Receipt", other: "Other" };

/** Orders built from pre-order selections. `startWith` opens a new order prefilled with looks. */
export function GroupedShopOrders({ inviteId, candidates, startWith, onStarted, listHidden, preorder = [], actions }: {
  inviteId: string; candidates: OrderItem[]; preorder?: OrderItem[]; startWith?: OrderItem[] | null; onStarted?: () => void; listHidden?: boolean; actions?: import("react").ReactNode;
}) {
  const qc = useQueryClient();
  const pernia = useServerFn(fetchPerniaLook); const kora = useServerFn(fetchKoraLook);
  const [assignedId, setAssignedId] = useState<string | null>(null);
  useEffect(() => {
    const candidate = candidates.find(c => c.reservationId === assignedId);
    if (!candidate) return;
    setItems(all => all.some(i => i.reservationId === candidate.reservationId) ? all : [...all, candidate]);
    setAssignedId(null);
  }, [assignedId, candidates]);
  async function fetchAlternative(item: OrderItem) {
    const url = item.alternative?.shop?.trim();
    if (!url) { toast.error("Enter the replacement shop link first"); return; }
    setBusy(true);
    try {
      const host = new URL(url).hostname;
      const look = host === "perniaspopupshop.com" || host === "www.perniaspopupshop.com" ? await pernia({ data: { url } }) : host === "koranm.com" || host === "www.koranm.com" ? await kora({ data: { inviteId, url } }) : null;
      if (!look) throw new Error("For this shop, enter the outfit details and photo URL manually");
      setItems(all => setAlternative(all, item.reservationId, { title: look.title, sku: look.sku, designer: look.designer, shop: look.url, image: look.images[0] ?? "" }));
      toast.success("Replacement details and photo fetched");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not fetch outfit"); } finally { setBusy(false); }
  }
  const orders = useQuery({ queryKey: ["wardrobe-orders", inviteId], enabled: Boolean(inviteId), queryFn: async () => {
    const { data, error } = await supabase.from("wardrobe_orders").select("*").eq("invite_id", inviteId).order("created_at", { ascending: false });
    if (error) throw error;
    await fillSnapsFromWardrobe((data ?? []).flatMap((o) => (o.items as unknown as OrderItem[]).map((i) => i.alternative).filter((a): a is NonNullable<OrderItem["alternative"]> => Boolean(a))));
    return data ?? [];
  } });
  const wardrobe = useQuery({ queryKey: ["order-wardrobe", inviteId], enabled: Boolean(inviteId), queryFn: async () => {
    const { data, error } = await supabase.from("outfits").select("id, title, designer, source_sku, boutique_url, image_url, price_inr, gender, garment_type, notes").eq("invite_id", inviteId).order("title");
    if (error) throw error; return data ?? [];
  } });
  const subs = useLatestSubstitutions((orders.data ?? []).flatMap((o) => (o.items as unknown as OrderItem[]).map((i) => i.reservationId)));
  const wardrobeSkus = wardrobe.data ? new Set(wardrobe.data.map((o) => (o.source_sku ?? "").trim().toUpperCase()).filter(Boolean)) : null;
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
  const [orderVersion, setOrderVersion] = useState<string | null>(null);
  const [familyView, setFamilyView] = useState(false);
  const [invoiceView, setInvoiceView] = useState(false);

  const used = new Set((orders.data ?? []).filter((o) => o.id !== id && o.status !== "cancelled").flatMap((o) => (o.items as unknown as OrderItem[]).map((i) => i.reservationId)));
  const available = candidates.filter((c) => !used.has(c.reservationId) && !items.some((i) => i.reservationId === c.reservationId) && `${c.wearer} ${c.title} ${c.family}`.toLowerCase().includes(search.toLowerCase()));
  const groups = new Map<string, OrderItem[]>();
  for (const c of available) { const key = groupBy === "people" ? `${c.wearer} · ${c.family}` : c.title; groups.set(key, [...(groups.get(key) ?? []), c]); }
  const courierNum = Number(courierCharges || 0);
  const totals = orderTotals(items, payments, courierNum);
  const cancelled = status === "cancelled";

  function reset(start: OrderItem[] = []) { setInvoiceView(false);
    setOrderVersion(null);
    setId(null); setReference(`ORDER-${new Date().toISOString().slice(0, 10)}`); setShop(""); setCurrency("INR"); setNotes("");
    setSellerRef(""); setStylist(""); setStylistMobile(""); setSellerTotal(""); setCourierCharges("0");
    setItems(start); setPayments([]); setDocs([]); setStatus("draft"); setCourier(""); setTracking(""); setAdding(start.length === 0); setSwapFor(null); setOpen(true);
  }
  useEffect(() => { if (startWith?.length) { reset(startWith); onStarted?.(); } }, [startWith]); // eslint-disable-line react-hooks/exhaustive-deps

  function openOrder(o: NonNullable<typeof orders.data>[number]) {
    setOrderVersion(o.updated_at); setInvoiceView(true); setFamilyView(false);
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
    const collectedItems = nextStatus === "cancelled" ? items : await Promise.all(items.map(item => enrichOrderAlternative(item, async url => {
      const host = url.hostname;
      return host === "perniaspopupshop.com" || host === "www.perniaspopupshop.com" ? await pernia({ data: { url: url.href } }) : host === "koranm.com" || host === "www.koranm.com" ? await kora({ data: { inviteId, url: url.href } }) : null;
    })));
    const values = {
      invite_id: inviteId, reference: reference.trim(), shop_name: shop, currency: currency.toUpperCase(), notes,
      seller_reference: sellerRef, salesperson_name: stylist, salesperson_mobile: stylistMobile,
      seller_total: sellerTotal.trim() === "" ? null : Number(sellerTotal), courier_charges: courierNum,
      items: collectedItems as unknown as Json, payments: payments as unknown as Json, documents: docs as unknown as Json,
      status: nextStatus, courier, tracking_number: tracking, ...extra,
    };
    const result = id
      ? await supabase.from("wardrobe_orders").update(values).eq("id", id).eq("invite_id", inviteId).eq("updated_at", orderVersion ?? "").select("id,updated_at").maybeSingle()
      : await supabase.from("wardrobe_orders").insert(values).select("id,updated_at").single();
    if (result.error) throw result.error;
    if (!result.data) throw new Error("The order changed. Reopen it before saving to preserve the latest changes.");
    setOrderVersion(result.data.updated_at);
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
    const version = await supabase.from("wardrobe_orders").select("updated_at").eq("id", id).single();
    if (version.data) setOrderVersion(version.data.updated_at);
    await Promise.all(["wardrobe-orders", "reservations", "confirm-looks", "host-orders"].map((key) => qc.invalidateQueries({ queryKey: [key] })));
  }

  /** Save one outfit's designer delivery/arrival dates without touching the rest of the order. */
  async function saveDelivery(item: OrderItem) {
    if (!id) throw new Error("Save the order first");
    const current = await supabase.from("wardrobe_orders").select("items, updated_at").eq("id", id).eq("invite_id", inviteId).single();
    if (current.error) throw current.error;
    const latest = current.data.items as unknown as OrderItem[];
    if (!latest.some((i) => i.reservationId === item.reservationId)) throw new Error("This look is no longer in the order. Reopen it to continue");
    const next = latest.map((i) => i.reservationId === item.reservationId ? { ...i, expectedDelivery: item.expectedDelivery ?? "", arrivedOn: item.arrivedOn ?? "", tracking: (item.tracking ?? "").trim(), courierName: (item.courierName ?? "").trim(), trackingUrl: (item.trackingUrl ?? "").trim() } : i);
    const saved = await supabase.from("wardrobe_orders").update({ items: next as unknown as Json }).eq("id", id).eq("invite_id", inviteId).eq("updated_at", current.data.updated_at).select("updated_at").maybeSingle();
    if (saved.error) throw saved.error;
    if (!saved.data) throw new Error("The order changed while saving. Try again");
    setOrderVersion(saved.data.updated_at);
    await qc.invalidateQueries({ queryKey: ["wardrobe-orders"] });
  }

  async function uploadDoc(file: File) {
    await run(async () => {
      const orderId = id ?? (await persist(status));
      const path = `${inviteId}/orders/${orderId}/${Date.now()}-${file.name.replace(/[^a-z0-9.-]/gi, "_")}`;
      const up = await supabase.storage.from(BUCKET).upload(path, file); if (up.error) throw up.error;
      const next = [...docs, { kind: docKind, path, name: file.name, number: docNumber, amount: docAmount ? Number(docAmount) : null, date }];
      const r = await supabase.from("wardrobe_orders").update({ documents: next as unknown as Json }).eq("id", orderId).eq("invite_id", inviteId).select("updated_at").maybeSingle();
      if (r.error) { await supabase.storage.from(BUCKET).remove([path]); throw r.error; }
      // Keep the save check in step with the document change so the next save isn't rejected.
      if (r.data) setOrderVersion(r.data.updated_at);
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
      if (id) {
        const r = await supabase.from("wardrobe_orders").update({ documents: next as unknown as Json }).eq("id", id).eq("invite_id", inviteId).select("updated_at").maybeSingle();
        if (r.error) throw r.error;
        if (r.data) setOrderVersion(r.data.updated_at);
      }
      await supabase.storage.from(BUCKET).remove([path]); setDocs(next);
    }, "Document removed", false);
  }

  async function pdf() { setBusy(true); try { validateOrder(items, payments, courierNum); await downloadShopOrderPdf(reference || "enquiry", shop, currency, items, payments, notes); } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't generate PDF"); } finally { setBusy(false); } }

  const active = (orders.data ?? []).filter((o) => o.status !== "cancelled");
  const [orderSearch, setOrderSearch] = useState("");
  const [listView, setListView] = useState<"order" | "person" | "family" | "event" | "arrivals" | "sets" | "amounts">("order");
  const [statusFilter, setStatusFilter] = useState("");
  const showReport = listView === "amounts"; const showLooks = listView === "family";
  const peopleInfo = useOrderPeople(inviteId);
  const seq = peopleInfo.data?.seq ?? alphabetical; const phones = peopleInfo.data?.phones;
  const celebrationName = useCelebrationName(inviteId);
  const q = orderSearch.trim().toLowerCase();
  const openById = (orderId: string) => { const order = orders.data?.find((o) => o.id === orderId); if (order) openOrder(order); };
  const itemHit = (i: OrderItem) => {
    const current = candidates.find((c) => c.reservationId === i.reservationId);
    return !q || `${current?.wearer ?? i.wearer} ${current?.family ?? i.family} ${i.event} ${i.title} ${i.sku} ${i.alternative?.title ?? ""} ${i.alternative?.sku ?? ""} ${(i.addOns ?? []).map((a) => `${a.label} ${a.sku}`).join(" ")}`.toLowerCase().includes(q);
  };
  const dupes = (() => {
    const m = new Map<string, { wearer: string; event: string; refs: string[]; titles: string[] }>();
    for (const o of active) for (const i of o.items as unknown as OrderItem[]) {
      const cur = candidates.find((c) => c.reservationId === i.reservationId);
      const wearer = (cur?.wearer ?? i.wearer).trim(); const key = `${wearer.toLowerCase()}|${i.event.toLowerCase()}`;
      const e = m.get(key) ?? { wearer, event: i.event, refs: [], titles: [] };
      e.refs.push(o.reference); e.titles.push(i.alternative?.title || i.title); m.set(key, e);
    }
    return [...m.entries()].filter(([, e]) => e.refs.length > 1);
  })();
  const dupeKeys = new Set(dupes.map(([k]) => k));
  const isDupe = (wearer: string, event: string) => dupeKeys.has(`${wearer.trim().toLowerCase()}|${event.toLowerCase()}`);
  const statuses = [...new Set((orders.data ?? []).map((o) => o.status))];
  const shownOrders = (orders.data ?? []).filter((o) => !statusFilter || o.status === statusFilter).filter((o) => !q || `${o.reference} ${o.seller_reference} ${o.shop_name}`.toLowerCase().includes(q) || (o.items as unknown as OrderItem[]).some(itemHit));
  const reportOrders = shownOrders.map((o) => ({ ...o, courier_charges: Number(o.courier_charges ?? 0), items: o.items as unknown as OrderItem[], payments: o.payments as unknown as OrderPayment[] }));
  const reportMatches = (item: OrderItem, order: { reference: string; seller_reference: string; shop_name: string }) => !q || `${order.reference} ${order.seller_reference} ${order.shop_name}`.toLowerCase().includes(q) || itemHit(item);
  const currentFamily = new Map(candidates.map((c) => [c.reservationId, c.family]));
  const orderedReport = familyOrderReport(shownOrders.filter((o) => o.status !== "cancelled").map((o) => (o.items as unknown as OrderItem[]).filter((i) => !q || itemHit(i) || `${o.reference} ${o.seller_reference} ${o.shop_name}`.toLowerCase().includes(q))), (i) => currentFamily.get(i.reservationId) || undefined);
  const preReport = new Map(familyOrderReport([statusFilter ? [] : preorder.filter(itemHit)]).map((f) => [f.family, f]));
  const familyReport = [...new Set([...orderedReport.map((f) => f.family), ...preReport.keys()])].map((family) => {
    const o = orderedReport.find((f) => f.family === family); const p = preReport.get(family);
    return { family, people: [...new Set([...(o?.people ?? []), ...(p?.people ?? [])])].sort(), looks: o?.looks ?? 0, extras: o?.extras ?? 0, amount: o?.amount ?? 0, preLooks: p?.looks ?? 0, preAmount: p?.amount ?? 0 };
  }).sort((a, b) => b.amount + b.preAmount - a.amount - a.preAmount);
  const sum = active.reduce((acc, o) => { const t = orderTotals(o.items as unknown as OrderItem[], o.payments as unknown as OrderPayment[], Number(o.courier_charges ?? 0)); acc.total += t.total; acc.paid += t.paid; return acc; }, { total: 0, paid: 0 });

  return <section className={listHidden ? "contents" : "space-y-3"}>
    {listHidden ? <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">{actions}<Button onClick={() => reset()} disabled={!inviteId} className="w-full sm:w-auto"><Plus className="size-4" /> New order</Button></div> : <>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0"><h2 className="text-xl">Shop orders</h2>{active.length ? <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:flex sm:flex-wrap">
        {([["Active orders", String(active.length)], ["Total", sum.total.toLocaleString(...nf(currency))], ["Paid", sum.paid.toLocaleString(...nf(currency))], ["Balance", (sum.total - sum.paid).toLocaleString(...nf(currency))]] as const).map(([l, v]) => <div key={l} className="rounded-md border border-border px-3 py-1.5"><p className="text-xs text-muted-foreground">{l}</p><p className="font-medium tabular-nums">{v}</p></div>)}
      </div> : null}</div>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">{actions}<Button onClick={() => reset()} disabled={!inviteId} className="w-full sm:w-auto"><Plus className="size-4" /> New order</Button></div>
    </div>
    {dupes.length ? <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
      <p className="font-medium text-destructive">Possible duplicate orders: {dupes.length} {dupes.length === 1 ? "person has" : "people have"} more than one main outfit for the same event</p>
      <ul className="mt-1 space-y-0.5 text-xs">{dupes.map(([k, e]) => <li key={k}><button className="text-left underline-offset-2 hover:underline" onClick={() => { setOrderSearch(e.wearer); setListView("person"); }}><strong>{e.wearer}</strong> · {e.event}: {e.titles.map((t, n) => `${t} (${e.refs[n]})`).join(" + ")}</button></li>)}</ul>
      <p className="mt-1 text-xs text-muted-foreground">Extra items like trousers don't count. Tap a name to see their outfits.</p>
    </div> : null}
    <div className="sticky top-0 z-10 -mx-1 space-y-2 bg-background/95 px-1 py-2 backdrop-blur">
      <div role="tablist" aria-label="View orders" className="grid grid-cols-4 gap-1 rounded-lg border border-border p-1 sm:grid-cols-7">
        {([["order", "By order"], ["person", "By person"], ["family", "By family"], ["event", "By event"], ["arrivals", "Arrivals"], ["sets", "Men's sets"], ["amounts", "Amounts"]] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={listView === k} onClick={() => setListView(k)} className={`rounded-md px-2 py-1.5 text-xs font-medium sm:text-sm ${listView === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>{l}</button>)}
      </div>
      <Input placeholder="Search name, family, event, outfit, ref" aria-label="Search orders" value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)} />
      {statuses.length > 1 ? <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {["", ...statuses].map((st) => <Button key={st || "all"} size="sm" className="shrink-0 capitalize" variant={statusFilter === st ? "default" : "outline"} onClick={() => setStatusFilter(st)}>{st || "All"} ({st ? (orders.data ?? []).filter((o) => o.status === st).length : (orders.data ?? []).length})</Button>)}
      </div> : null}
    </div>
    <TrouserPairingReview inviteId={inviteId} orders={shownOrders} wardrobe={wardrobe.data ?? []} candidates={candidates} />
    {listView === "person" ? (() => {
      const rows = shownOrders.flatMap((o) => (o.items as unknown as OrderItem[]).filter(itemHit).map((i) => ({ o, i, cur: candidates.find((c) => c.reservationId === i.reservationId) })))
        .sort((a, b) => (a.cur?.family ?? a.i.family).localeCompare(b.cur?.family ?? b.i.family) || seq.compare({ wearer: a.cur?.wearer ?? a.i.wearer, event: a.i.event }, { wearer: b.cur?.wearer ?? b.i.wearer, event: b.i.event }));
      // Individual PDFs cover every active look of that person, not only the search hits.
      const allActive = active.flatMap((o) => (o.items as unknown as OrderItem[]).map((i) => { const cur = candidates.find((c) => c.reservationId === i.reservationId); return { i, wearer: cur?.wearer ?? i.wearer, family: cur?.family ?? i.family }; }));
      const linesFor = (wearer: string, family: string) => allActive.filter((r) => sameWearer(r, { wearer, family })).sort((a, b) => seq.event(a.i.event) - seq.event(b.i.event)).map((r) => wearerLookLine(r.i, r.wearer, subs.data?.get(r.i.reservationId)));
      return <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">{rows.map(({ o, i, cur }) => { const look = i.alternative?.title ? i.alternative : i; const wearer = cur?.wearer ?? i.wearer; const family = cur?.family ?? i.family; return (
        <li key={`${o.id}-${i.reservationId}`} className={`flex min-w-0 flex-col rounded-xl border border-border bg-card ${o.status === "cancelled" ? "opacity-60" : ""}`}>
          <div className="flex min-w-0 flex-1 gap-3 p-4">
          {look.image || i.image ? <img src={look.image || i.image} alt={look.title} referrerPolicy="no-referrer" loading="lazy" className="aspect-[3/4] w-20 shrink-0 self-start rounded-md object-cover" /> : <div className="flex aspect-[3/4] w-20 shrink-0 items-center justify-center self-start rounded-md bg-muted text-xs text-muted-foreground">No photo</div>}
          <div className="min-w-0 flex-1 space-y-1">
            <p className="truncate font-medium">{wearer}</p>
            {o.status !== "cancelled" && isDupe(wearer, i.event) ? <p className="text-xs font-medium text-destructive">Duplicate: another main outfit for this event</p> : null}
            <p className="truncate text-xs text-muted-foreground">{family} · {i.event}</p>
            <p className="line-clamp-2 text-sm">{look.title}{i.alternative?.title ? <span className="text-primary"> · substitute</span> : null}</p>
            <p className="text-xs"><WardrobeFlag sku={look.sku} skus={wardrobeSkus} />{i.alternative ? <span className="text-muted-foreground"> · original <WardrobeFlag sku={i.sku} skus={wardrobeSkus} /></span> : null}</p>
            <p className="text-xs">Size {i.size || "—"} → ordered {i.orderedSize || "—"}</p>
            {(i.addOns ?? []).map((a) => <p key={a.id} className="truncate text-xs">Extra: {a.label || a.sku || "item"}{a.sku ? <> · <WardrobeFlag sku={a.sku} skus={wardrobeSkus} /></> : null}</p>)}
            {i.wearerNote ? <p className="line-clamp-3 text-xs"><span className="text-muted-foreground">Note: </span>{i.wearerNote}</p> : null}<ShipmentLine item={i} />
          </div>
          </div>
          <div className="space-y-2 border-t border-border p-3">
            <div className="flex flex-wrap items-center gap-2"><span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={o.reference}>{o.reference}</span><OrderStatusBadge status={o.status} />{o.status !== "cancelled" ? <ShipmentButton compact inviteId={inviteId} orderId={o.id} items={[i]} label={`${wearer} — ${i.event}`} /> : null}<Button size="sm" variant="ghost" className="h-7 shrink-0 px-2 text-xs" onClick={() => openOrder(o)}>Open order</Button></div>
            {o.status !== "cancelled" ? <div className="grid grid-cols-3 gap-1.5 [&>button]:h-8 [&>button]:w-full [&>button]:min-w-0 [&>button]:px-1.5 [&>button]:text-xs [&_svg]:shrink-0"><WearerNoteButton inviteId={inviteId} orderId={o.id} item={i} wearer={wearer} /><IndividualShare wearer={wearer} celebration={celebrationName} lines={linesFor(wearer, family)} phone={phones?.get(wearer.trim().toLowerCase())} /></div> : null}
          </div>
        </li>); })}{!rows.length ? <li className="text-sm text-muted-foreground">No outfits match.</li> : null}</ul>;
    })() : null}
    {showLooks ? <FamilyOrderReport inviteId={inviteId} wardrobeSkus={wardrobeSkus} seq={seq} phones={phones} orders={reportOrders} candidates={candidates} substitutions={subs.data} matches={reportMatches} onOpen={openById} /> : null}
    {listView === "sets" ? <OrderMenSetsView inviteId={inviteId} orders={reportOrders} wardrobe={wardrobe.data ?? []} current={(i) => { const c = candidates.find((x) => x.reservationId === i.reservationId); return { wearer: c?.wearer ?? i.wearer, family: c?.family ?? i.family }; }} matches={reportMatches} onOpen={openById} /> : null}
    {listView === "arrivals" ? <OrderArrivalsView inviteId={inviteId} celebrationName={celebrationName} orders={reportOrders} current={(i) => { const c = candidates.find((x) => x.reservationId === i.reservationId); return { wearer: c?.wearer ?? i.wearer, family: c?.family ?? i.family }; }} substitutions={subs.data} matches={reportMatches} onOpen={openById} /> : null}
    {listView === "event" ? <OrderEventView inviteId={inviteId} celebrationName={celebrationName} phones={phones} orders={reportOrders} candidates={candidates} substitutions={subs.data} matches={reportMatches} events={peopleInfo.data?.events ?? []} seq={seq} onOpen={openById} /> : null}
    {showReport ? <ul className="space-y-2 md:hidden">{familyReport.map((f) => <li key={f.family} className="rounded-xl border border-border p-4 text-sm">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"><p className="truncate font-medium">{f.family}</p><p className="font-medium tabular-nums">{(f.amount + f.preAmount).toLocaleString(...nf(currency))}</p></div>
      <p className="text-xs text-muted-foreground">{f.people.join(", ")}</p>
      <p className="mt-1 text-xs">{f.looks} looks · {f.extras} extras · ordered {f.amount.toLocaleString(...nf(currency))} · pre-order {f.preAmount.toLocaleString(...nf(currency))}{f.preLooks ? ` (${f.preLooks})` : ""}</p>
    </li>)}<li className="rounded-md bg-muted p-3 text-sm font-medium">Total {familyReport.reduce((t, f) => t + f.amount + f.preAmount, 0).toLocaleString(...nf(currency))} <span className="block text-xs font-normal text-muted-foreground">Ordered {familyReport.reduce((t, f) => t + f.amount, 0).toLocaleString(...nf(currency))} · pre-order {familyReport.reduce((t, f) => t + f.preAmount, 0).toLocaleString(...nf(currency))} · excludes courier</span></li>{!familyReport.length ? <li className="text-sm text-muted-foreground">Nothing matches.</li> : null}</ul> : null}
    {showReport ? <div className="hidden overflow-x-auto rounded-md border border-border md:block"><table className="w-full text-sm">
      <thead><tr className="text-left text-muted-foreground"><th className="p-2">Family</th><th className="p-2">People</th><th className="p-2 text-right">Looks</th><th className="p-2 text-right">Extra items</th><th className="p-2 text-right">Amount ordered</th><th className="p-2 text-right">Still in pre-order</th><th className="p-2 text-right">Family total</th></tr></thead>
      <tbody>{familyReport.map((f) => <tr key={f.family} className="border-t border-border"><td className="p-2 font-medium">{f.family}</td><td className="p-2">{f.people.join(", ")}</td><td className="p-2 text-right">{f.looks}</td><td className="p-2 text-right">{f.extras}</td><td className="p-2 text-right">{f.amount.toLocaleString(...nf(currency))}</td><td className="p-2 text-right">{f.preAmount.toLocaleString(...nf(currency))}{f.preLooks ? ` (${f.preLooks})` : ""}</td><td className="p-2 text-right font-medium">{(f.amount + f.preAmount).toLocaleString(...nf(currency))}</td></tr>)}
      <tr className="border-t border-border font-medium"><td className="p-2" colSpan={4}>Total (excludes courier charges)</td><td className="p-2 text-right">{familyReport.reduce((s, f) => s + f.amount, 0).toLocaleString(...nf(currency))}</td><td className="p-2 text-right">{familyReport.reduce((s, f) => s + f.preAmount, 0).toLocaleString(...nf(currency))}</td><td className="p-2 text-right">{familyReport.reduce((s, f) => s + f.amount + f.preAmount, 0).toLocaleString(...nf(currency))}</td></tr></tbody>
    </table><p className="p-2 text-xs text-muted-foreground">Amount ordered = active orders after discounts. Still in pre-order = looks not yet in an order, at shop price (number of looks in brackets). To move a person into another family, open their family page and use the move-members button beside Add member; new orders then show the new family.</p></div> : null}
    {listView === "order" ? <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">{shownOrders.map((o) => { const t = orderTotals(o.items as unknown as OrderItem[], o.payments as unknown as OrderPayment[], Number(o.courier_charges ?? 0)); return (
      <div key={o.id} className={`flex flex-col gap-2 rounded-xl border border-border p-4 sm:flex-row sm:items-start sm:justify-between ${o.status === "cancelled" ? "opacity-60" : ""}`}>
        <div className="min-w-0 break-words">
          <p className="font-medium">{o.reference}{o.seller_reference ? ` · shop ref ${o.seller_reference}` : ""} · {o.shop_name || "Shop not set"}</p>
          <p className="text-sm">{[...new Set((o.items as unknown as OrderItem[]).map((i) => i.wearer))].join(" · ")}</p>
          {q ? <p className="text-xs text-primary">{(o.items as unknown as OrderItem[]).filter(itemHit).map((i) => `${i.wearer} · ${i.event} · ${i.alternative?.title || i.title}`).join(" | ")}</p> : null}
          <p className="text-sm text-muted-foreground">{o.status} · {(o.items as unknown as OrderItem[]).length} looks · {o.currency} {t.total.toLocaleString(...nf(o.currency))} · advance {t.advance.toLocaleString(...nf(o.currency))} · paid {t.paid.toLocaleString(...nf(o.currency))} · balance {t.balance.toLocaleString(...nf(o.currency))}{o.salesperson_name ? ` · stylist ${o.salesperson_name}` : ""}</p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:items-end"><Button variant="outline" size="sm" className="w-full shrink-0 sm:w-auto" onClick={() => openOrder(o)}>Open order</Button>{o.status !== "cancelled" ? <ShipmentButton inviteId={inviteId} orderId={o.id} items={o.items as unknown as OrderItem[]} label={o.reference} /> : null}{(o.items as unknown as OrderItem[]).some((i) => i.expectedDelivery || i.arrivedOn) ? <p className="text-xs text-muted-foreground">{(o.items as unknown as OrderItem[]).filter((i) => i.arrivedOn).length}/{(o.items as unknown as OrderItem[]).length} arrived</p> : null}</div>
      </div>); })}</div> : null}
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
        <div className="flex flex-wrap items-center gap-2"><h3 className="font-medium">Outfits in this order ({items.length})</h3><div className="inline-flex flex-wrap gap-1">{([["invoice", "Invoice view"], ["edit", "Edit view"], ["family", "Family view"]] as const).map(([k, l]) => { const on = k === "invoice" ? invoiceView : k === "family" ? familyView && !invoiceView : !familyView && !invoiceView; return <Button key={k} size="sm" variant={on ? "default" : "outline"} onClick={() => { setInvoiceView(k === "invoice"); setFamilyView(k === "family"); }}>{l}</Button>; })}</div></div>
        {!cancelled ? <div className="flex flex-wrap gap-2"><AssignGuestLook inviteId={inviteId} onAssigned={setAssignedId} /><Button size="sm" variant="outline" onClick={() => { setAdding((v) => !v); setSwapFor(null); }}><Plus className="size-4" /> Add outfits</Button></div> : null}
      </div>
      {adding || swapFor ? <div className="space-y-3 rounded-xl border border-border p-4">
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

      {invoiceView ? <OrderInvoiceLines items={items} currency={currency} /> : null}
      {familyView && !invoiceView ? <OrderFamilyView items={items} currency={currency} subs={subs.data} seq={seq} /> : null}
      {familyView || invoiceView ? null : items.map((item) => <div key={item.reservationId} className="space-y-3 rounded-xl border border-border p-4">
        <div className="flex flex-wrap gap-3 sm:flex-nowrap">
          {item.image ? <img src={item.image} alt={item.title} className="h-24 w-20 shrink-0 object-cover" /> : null}
          <div className="min-w-0 flex-1 basis-40 sm:basis-auto"><p className="font-medium">{item.wearer} · {item.event}</p><p className="text-sm">{item.title}</p><p className="text-sm text-muted-foreground">{item.designer} · size {item.size || "—"} · {item.sku} <WardrobeFlag sku={item.sku} skus={wardrobeSkus} /></p>{item.alternative ? <p className="text-sm font-medium text-primary">Shop order: {item.alternative.title || item.alternative.sku}{item.alternative.sku && item.alternative.title ? ` (${item.alternative.sku})` : ""} {id && !cancelled && wardrobeSkus && !(item.alternative.outfitId) && (!item.alternative.sku?.trim() || !wardrobeSkus.has(item.alternative.sku.trim().toUpperCase())) ? <OutfitSubstitution inviteId={inviteId} item={item} orderId={id} disabled={busy} trigger={(go, off) => <button type="button" disabled={off} onClick={go} title="Paste the shop link to fetch it, add it to the wardrobe and link it to this person" className="whitespace-nowrap text-xs text-destructive underline underline-offset-2 hover:opacity-80">✗ Not in wardrobe · paste link to add</button>} onSaved={async () => {
            const latest = await supabase.from("wardrobe_orders").select("items,updated_at").eq("id", id).eq("invite_id", inviteId).single();
            if (latest.data) { const updated = (latest.data.items as unknown as OrderItem[]).find(i => i.reservationId === item.reservationId); if (updated) setItems(all => all.map(i => i.reservationId === updated.reservationId ? updated : i)); setOrderVersion(latest.data.updated_at); }
            await qc.invalidateQueries({ queryKey: ["order-wardrobe", inviteId] });
          }} /> : <WardrobeFlag sku={item.alternative.sku} skus={wardrobeSkus} />}</p> : null}{item.addOns?.length ? <p className="text-sm text-muted-foreground">+ {item.addOns.map((a) => <span key={a.id} className="mr-2">{a.label}{a.sku ? <> ({a.sku}) <WardrobeFlag sku={a.sku} skus={wardrobeSkus} /></> : null}</span>)}</p> : null}<SubstitutionNote sub={subs.data?.get(item.reservationId)} showOriginal /></div>
          {!cancelled ? <div className="flex w-full shrink-0 flex-row flex-wrap gap-1 sm:w-auto sm:flex-col">
            <Button variant="ghost" size="sm" title="Replace this order item with another person's pending look" onClick={() => { setSwapFor(item.reservationId); setAdding(false); }}><Repeat className="size-4" /> Replace order item</Button>
            <Button variant="ghost" size="sm" title="Remove from order" onClick={() => setItems((a) => a.filter((i) => i.reservationId !== item.reservationId))}><Trash2 className="size-4" /> Remove</Button>
          </div> : null}
        </div>
        {id && !cancelled ? <OutfitSubstitution inviteId={inviteId} item={item} orderId={id} disabled={busy} onSaved={async () => {
          const latest = await supabase.from("wardrobe_orders").select("items,updated_at").eq("id", id).eq("invite_id", inviteId).single();
          if (latest.data) { const updated = (latest.data.items as unknown as OrderItem[]).find(i => i.reservationId === item.reservationId); if (updated) setItems(all => all.map(i => i.reservationId === updated.reservationId ? updated : i)); setOrderVersion(latest.data.updated_at); }
        }} /> : null}
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
        <div className="space-y-2 rounded-lg bg-surface p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium">Alternative for the shop order <span className="font-normal text-muted-foreground">(original selection retained)</span></h3>
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
            <Button variant="outline" disabled={busy || cancelled} onClick={() => void fetchAlternative(item)}>Fetch replacement photo & details</Button>
            <label className="text-sm">Replacement photo URL<Input value={item.alternative.image ?? ""} disabled={cancelled} onChange={e => setItems(all => setAlternative(all, item.reservationId, { ...item.alternative, title: item.alternative?.title ?? "", sku: item.alternative?.sku ?? "", designer: item.alternative?.designer ?? "", shop: item.alternative?.shop ?? "", image: e.target.value }))} /></label>
            {item.alternative.image ? <img src={item.alternative.image} alt={item.alternative.title} className="h-32 w-24 rounded object-cover" /> : null}
            <p className="text-xs text-muted-foreground sm:col-span-2">Set the alternative's price in "Revised price" above.</p>
          </div> : null}
        </div>
        <div className="space-y-2 rounded-lg bg-surface p-3">
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
        <div className="grid gap-3 sm:grid-cols-4">
          <p className="text-sm">Original size<br /><strong>{item.size || "Not recorded"}</strong></p>
          <label className="text-sm">Estimated delivery<Input type="date" aria-label={`Estimated delivery for ${item.wearer} — ${item.event}`} value={item.expectedDelivery ?? ""} onChange={(e) => changeItem(item.reservationId, { expectedDelivery: e.target.value })} /></label>
          <label className="text-sm">Arrived on<Input type="date" aria-label={`Arrival date for ${item.wearer} — ${item.event}`} value={item.arrivedOn ?? ""} onChange={(e) => changeItem(item.reservationId, { arrivedOn: e.target.value })} /></label>
          <label className="text-sm">Tracking reference<Input aria-label={`Tracking for ${item.wearer} — ${item.event}`} value={item.tracking ?? ""} placeholder="AWB / consignment no." onChange={(e) => changeItem(item.reservationId, { tracking: e.target.value })} /></label>
          <label className="text-sm">Courier company<Input aria-label={`Courier for ${item.wearer} — ${item.event}`} value={item.courierName ?? ""} placeholder="e.g. DHL" onChange={(e) => changeItem(item.reservationId, { courierName: e.target.value })} /></label>
          <label className="text-sm sm:col-span-2">Tracking link<Input type="url" aria-label={`Tracking link for ${item.wearer} — ${item.event}`} value={item.trackingUrl ?? ""} placeholder="https://…" onChange={(e) => changeItem(item.reservationId, { trackingUrl: e.target.value })} /></label>
          {id ? <Button type="button" size="sm" variant="outline" className="sm:col-span-4 sm:w-fit" disabled={busy} onClick={() => void run(() => saveDelivery(item), `Delivery dates saved for ${item.wearer} · ${item.event}`, false)}><Save className="size-4" /> Save shipment for this outfit</Button> : null}
        </div>
        <label className="block min-w-0 text-sm"><span className="block break-words font-medium leading-snug">Customisations / availability questions</span><span className="mb-2 mt-1 block break-words text-xs leading-relaxed text-muted-foreground">Private — host only. Never shown to guests or printed in family/individual PDFs.</span><Textarea aria-label={`Private customisations / availability questions for ${item.wearer} — ${item.event}`} value={item.notes} onChange={(e) => changeItem(item.reservationId, { notes: e.target.value })} /></label>
        <label className="block min-w-0 text-sm"><span className="block font-medium leading-snug">Wearer note</span><span className="mb-1 block text-xs leading-snug text-muted-foreground">Shown to {item.wearer} and printed in PDFs</span><Textarea aria-label={`Note for ${item.wearer} — ${item.event}`} value={item.wearerNote ?? ""} placeholder="e.g. Carry the matching mojaris and pocket square; pair with gold studs" onChange={(e) => changeItem(item.reservationId, { wearerNote: e.target.value })} /></label>
      </div>)}

      <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-3">
        <label className="text-sm">Courier charges ({currency})<Input type="number" min="0" value={courierCharges} onChange={(e) => setCourierCharges(e.target.value)} /></label>
        <label className="text-sm">Seller's quoted total ({currency})<Input type="number" min="0" placeholder="From proforma / invoice" value={sellerTotal} onChange={(e) => setSellerTotal(e.target.value)} /></label>
        <div className="self-end pb-2 text-sm">{sellerTotal && Number(sellerTotal) !== totals.total ? <span className="text-destructive">Differs from our total by {(Number(sellerTotal) - totals.total).toLocaleString(...nf(currency))}</span> : null}</div>
      </div>
      <label className="block min-w-0 text-sm"><span className="block break-words font-medium leading-snug">Order notes</span><span className="mb-2 mt-1 block break-words text-xs leading-relaxed text-muted-foreground">Private — host only. Discount and delivery discussions. Never shown to guests or printed in family/individual PDFs.</span><Textarea aria-label="Private order notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></label>

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

/** ✓ when the model number exists in this celebration's wardrobe, ✗ when it needs adding. */
export function WardrobeFlag({ sku, skus }: { sku?: string | null | undefined; skus: Set<string> | null }) {
  if (!skus || !sku?.trim()) return null;
  return skus.has(sku.trim().toUpperCase())
    ? <span className="whitespace-nowrap text-xs text-emerald">✓ In wardrobe</span>
    : <span className="whitespace-nowrap text-xs text-destructive">✗ Not in wardrobe</span>;
}
