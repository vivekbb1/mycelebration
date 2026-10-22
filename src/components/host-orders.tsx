import { SubstitutionNote, useLatestSubstitutions } from "@/components/substitution-note";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ExternalLink, Package } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useSelectedEvent } from "@/lib/selected-event";
import { formFor, hasChart, MADE_TO_MEASURE, suggestSize, type ShopSize } from "@/lib/size-charts";
import { GroupedShopOrders } from "@/components/grouped-shop-orders";
import { OrderAlterations } from "@/components/order-alterations";
import { VendorInvoiceUpload } from "@/components/vendor-invoice-upload";
import { pendingOrderLook } from "@/lib/vendor-invoice";
import { memberMeasurements } from "@/lib/outfit-pick-progress";
import type { OrderItem } from "@/lib/shop-order";
import { Checkbox } from "@/components/ui/checkbox";
import { familyOrderReport, money, nf } from "@/lib/shop-order";
import { buildPreorderPdf, saveBlob } from "@/lib/shop-order-pdf";
import { FileDown, ShoppingBag } from "lucide-react";
import { OutfitSubstitution } from "@/components/outfit-substitution";
import { withPreorderAlternative } from "@/lib/outfit-substitution";

const PAYMENT = ["unpaid", "part paid", "paid", "refunded"] as const;
const SHIPPING = ["not shipped", "shipped", "in transit", "delivered", "returned"] as const;

type Draft = {
  order_reference: string;
  order_amount: string;
  order_currency: string;
  amount_paid: string;
  payment_status: string;
  shipping_carrier: string;
  tracking_number: string;
  tracking_url: string;
  shipping_status: string;
  order_note: string;
};

const FILTER_TABS = [
  ["all", "All looks"],
  ["ready", "Ready to order"],
  ["fit", "Size mismatch"],
  ["nomeas", "Missing measurements"],
  ["soldout", "Sold out"],
  ["placed", "Ordered"],
] as const;

/**
 * Orders: once a guest has reserved their look and sent measurements, the
 * host places the order with the shop and tracks money and shipping here.
 */
export function HostOrders({ view = "pre" }: { view?: "pre" | "orders" | "alterations" }) {
  const qc = useQueryClient();
  const { inviteId } = useSelectedEvent();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [filter, setFilter] = useState<(typeof FILTER_TABS)[number][0]>("all");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [startWith, setStartWith] = useState<OrderItem[] | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const preorderAlternatives = useQuery({ queryKey: ["preorder-alternatives", inviteId], enabled: Boolean(inviteId), queryFn: async () => {
    const result = await supabase.from("wardrobe_preorder_alternatives").select("*").eq("invite_id", inviteId);
    if (result.error) throw result.error; return new Map(result.data.map(a => [a.reservation_id, a]));
  } });
  const orderList = useQuery({
    queryKey: ["wardrobe-orders", inviteId],
    enabled: Boolean(inviteId),
    queryFn: async () => {
      if (!inviteId) return [];
      const { data, error } = await supabase.from("wardrobe_orders").select("*").eq("invite_id", inviteId).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  /** Which active order (if any) each look already sits in. */
  const inOrder = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of orderList.data ?? []) if (o.status !== "cancelled") for (const i of o.items as unknown as OrderItem[]) m.set(i.reservationId, o.reference);
    return m;
  }, [orderList.data]);

  const alterations = useQuery({
    queryKey: ["alterations-list", inviteId],
    enabled: Boolean(inviteId) && view === "alterations",
    queryFn: async () => {
      const { data, error } = await supabase.from("wardrobe_alterations").select("reservation_id, status, photos, vendor_id, workman, workman_id, adjustments, tailor_workmen(name)").eq("invite_id", inviteId!);
      if (error) throw error;
      return new Map((data ?? []).map((a) => [a.reservation_id, { status: a.status, photos: Array.isArray(a.photos) ? a.photos.length : 0, workman: (a.tailor_workmen as { name: string } | null)?.name || a.workman, adjustments: a.adjustments }]));
    },
  });
  const data = useQuery({
    queryKey: ["host-orders", inviteId],
    queryFn: async () => {
      if (!inviteId) return [];
      const [res, meas, codes] = await Promise.all([
        supabase
          .from("reservations")
          .select(
            "*, outfits(title, designer, boutique_url, image_url, event_id, gender, sizes, is_available, price_inr, price_note, notes, source_sku, events(name, invite_id))",
          ).eq("invite_id", inviteId),
        supabase.from("measurements").select("*").eq("invite_id", inviteId),
        supabase.from("invite_codes").select("id, claimed_by, household, guest_name, invite_id").eq("invite_id", inviteId),
      ]);
      if (res.error) throw res.error;
      if (meas.error) throw meas.error;
      if (codes.error) throw codes.error;
      const measured = new Set((meas.data ?? []).map((m) => m.guest_id));
      const guests = new Map(
        (codes.data ?? [])
          .filter((c) => c.claimed_by && (!inviteId || c.invite_id === inviteId))
          .map((c) => [c.claimed_by as string, c]),
      );
      return (res.data ?? [])
        .filter((r) => guests.has(r.guest_id))
        .map((r) => {
          const key = (r.guest_name ?? "").trim().toLowerCase();
          const guest = guests.get(r.guest_id);
          const family = (codes.data ?? []).filter((c) => c.household === guest?.household);
          const coded = r.member_code_id ? (codes.data ?? []).find((c) => c.id === r.member_code_id) : undefined;
          const member = coded ?? family.find((c) => c.guest_name.trim().toLowerCase() === key) ?? guest;
          const m = member ? memberMeasurements(member, family, meas.data ?? []) : undefined;
          const measurementValues: Record<string, string | number> = {};
          if (m) for (const k of ["unit", "usual_size", "height", "chest", "bust", "under_bust", "waist", "hip", "shoulder", "armhole", "neck", "sleeve_length", "top_length", "bottom_length", "inseam", "notes"] as const) { const v = m[k]; if(v !== null && v !== "") measurementValues[k] = v; }
          const gender = (r.outfits as { gender?: string } | null)?.gender ?? null;
          const suggested = m && hasChart(gender) ? (suggestSize(m, formFor(gender))?.size ?? m.usual_size ?? null) : null;
          const size = r.size_choice ?? null;
          const shopSizes = ((r.outfits as { sizes?: unknown } | null)?.sizes as ShopSize[] | null) ?? [];
          return {
            ...r,
            guest_name: coded?.guest_name ?? r.guest_name,
            guest,
            wearerFamily: coded?.household ?? member?.household ?? guest?.household ?? "",
            measurementValues: m ? measurementValues : null,
            measured: Boolean(m),
            confirmed: r.status === "confirmed",
            suggested,
            misfit: Boolean(size && suggested && size !== MADE_TO_MEASURE && size !== suggested),
            soldOut: Boolean(size && shopSizes.find((x) => x.label === size && !x.available)) || (shopSizes.length > 0 && shopSizes.every((s) => !s.available)),
          };
        })
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    },
  });
  const subs = useLatestSubstitutions((data.data ?? []).map((r) => r.id));


  type Row = NonNullable<typeof data.data>[number];

  const [dim, setDim] = useState({ person: "", family: "", event: "", gender: "" });
  const [outfitSearch, setOutfitSearch] = useState("");
  const wearerOf = (r: Row) => r.guest_name || r.guest?.guest_name || "Guest";
  const genderOf = (r: Row) => (r.outfits as { gender?: string } | null)?.gender ?? "";
  const options = useMemo(() => {
    const all = data.data ?? [];
    const uniq = (f: (r: Row) => string) => [...new Set(all.map(f).filter(Boolean))].sort();
    return { person: uniq(wearerOf), family: uniq((r) => r.guest?.household ?? ""), event: uniq((r) => r.outfits?.events?.name ?? ""), gender: uniq(genderOf) };
  }, [data.data]);
  const base = useMemo(() => (data.data ?? []).filter((r) =>
    (!dim.person || wearerOf(r) === dim.person) && (!dim.family || r.guest?.household === dim.family) &&
    (!dim.event || r.outfits?.events?.name === dim.event) && (!dim.gender || genderOf(r) === dim.gender)), [data.data, dim]);
  const [sort, setSort] = useState("recent");
  const [workmanFilter, setWorkmanFilter] = useState("");
  const [altFilter, setAltFilter] = useState<"all" | "needed" | "with vendor" | "complete" | "none">("all");
  const tabRows = useMemo(() => {
    const sorted = (list: Row[]) => {
      if (sort === "recent") return list;
      const [key, dir] = sort.split("-"); const m = dir === "desc" ? -1 : 1;
      const val = (r: Row) => key === "name" ? wearerOf(r).toLowerCase() : key === "size" ? (r.size_choice || r.build_size || "~") : Number(r.order_amount ?? r.outfits?.price_inr ?? 0);
      return [...list].sort((a, b) => { const x = val(a), y = val(b); return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })) * m; });
    };
    return sorted(pick());
    function pick() {
    if (view !== "pre") return base;
    if (filter === "placed") return base.filter((r) => !pendingOrderLook(r.id, r.order_placed_at, inOrder));
    const all = base.filter((r) => pendingOrderLook(r.id, r.order_placed_at, inOrder));
    if (filter === "soldout") return all.filter((r) => r.soldOut);
    if (filter === "fit") return all.filter((r) => r.misfit || r.soldOut);
    if (filter === "nomeas") return all.filter((r) => !r.measured);
    if (filter === "ready") return all.filter((r) => !r.order_placed_at && r.measured);
    return all;
    }
  }, [base, filter, sort, inOrder, view]);
  const rows = useMemo(() => tabRows.filter((r) =>
    view !== "pre" || !outfitSearch.trim() || [r.outfits?.title, r.outfits?.designer, r.outfits?.source_sku, r.outfits?.boutique_url]
      .some((value) => value?.toLowerCase().includes(outfitSearch.trim().toLowerCase()))), [tabRows, outfitSearch, view]);

  const draftOf = (r: Row): Draft =>
    drafts[r.id] ?? {
      order_reference: r.order_reference ?? "",
      order_amount: r.order_amount?.toString() ?? "",
      order_currency: r.order_currency ?? "INR",
      amount_paid: r.amount_paid?.toString() ?? "0",
      payment_status: r.payment_status ?? "unpaid",
      shipping_carrier: r.shipping_carrier ?? "",
      tracking_number: r.tracking_number ?? "",
      tracking_url: r.tracking_url ?? "",
      shipping_status: r.shipping_status ?? "not shipped",
      order_note: r.order_note ?? "",
    };

  const save = useMutation({
    mutationFn: async ({ r, place }: { r: Row; place?: boolean }) => {
      const d = draftOf(r);
      const num = (v: string) => (v.trim() === "" ? null : Number(v));
      const url = d.tracking_url.trim();
      if (url && !/^https?:\/\//i.test(url)) throw new Error("Tracking link must start with https://");
      const { error } = await supabase
        .from("reservations")
        .update({
          order_reference: d.order_reference.trim() || null,
          order_amount: num(d.order_amount),
          order_currency: d.order_currency.trim().toUpperCase() || "INR",
          amount_paid: num(d.amount_paid) ?? 0,
          payment_status: d.payment_status,
          shipping_carrier: d.shipping_carrier.trim() || null,
          tracking_number: d.tracking_number.trim() || null,
          tracking_url: url || null,
          shipping_status: d.shipping_status,
          order_note: d.order_note.trim() || null,
          ...(place ? { status: "confirmed", order_placed_at: new Date().toISOString(), order_status: "in progress" } : {}),
          ...(d.shipping_status === "delivered" ? { order_status: "ready" } : {}),
          order_status_updated_at: new Date().toISOString(),
        })
        .eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      setDrafts((p) => {
        const n = { ...p };
        delete n[v.r.id];
        return n;
      });
      toast.success(v.place ? "Order placed." : "Saved.");
      qc.invalidateQueries({ queryKey: ["host-orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totals = useMemo(() => {
    const byCur = new Map<string, { due: number; paid: number }>();
    for (const r of data.data ?? []) {
      if (!r.order_placed_at) continue;
      const t = byCur.get(r.order_currency) ?? { due: 0, paid: 0 };
      t.due += Number(r.order_amount ?? 0);
      t.paid += Number(r.amount_paid ?? 0);
      byCur.set(r.order_currency, t);
    }
    return [...byCur.entries()];
  }, [data.data]);

  const pending = base.filter((r) => pendingOrderLook(r.id, r.order_placed_at, inOrder));
  const counts = {
    ready: pending.filter((r) => r.measured).length,
    placed: base.length - pending.length,
    all: pending.length,
    fit: pending.filter((r) => r.misfit || r.soldOut).length,
    nomeas: pending.filter((r) => !r.measured).length,
    soldout: pending.filter((r) => r.soldOut).length,
  };

  const field = (r: Row, k: keyof Draft, v: string) =>
    setDrafts((p) => ({ ...p, [r.id]: { ...draftOf(r), [k]: v } }));

  const toItem = (r: Row): OrderItem => withPreorderAlternative({ reservationId: r.id, wearer: r.guest_name || r.guest?.guest_name || "Guest", family: r.wearerFamily || r.guest?.household || "", event: r.outfits?.events?.name || "", title: r.outfits?.title || "Look", designer: r.outfits?.designer || "", sku: r.outfits?.source_sku || "", size: r.size_choice || r.build_size || "", shop: r.outfits?.boutique_url || "", image: r.outfits?.image_url || "", originalPrice: r.outfits?.price_inr != null ? Number(r.outfits.price_inr) : null, price: Number(r.order_amount ?? r.outfits?.price_inr ?? 0), discount: 0, measurements: r.measurementValues, notes: r.build_fabric || "" }, preorderAlternatives.data?.get(r.id));
  const [pdfReady, setPdfReady] = useState<{ blob: Blob; name: string } | null>(null);
  async function releaseFromOrder(rid: string) {
    const o = (orderList.data ?? []).find((x) => x.status !== "cancelled" && (x.items as unknown as OrderItem[]).some((i) => i.reservationId === rid));
    if (!o) return;
    const items = (o.items as unknown as OrderItem[]).filter((i) => i.reservationId !== rid);
    if (!items.length) { toast.error(`It's the only look in order ${o.reference} — cancel that order instead`); return; }
    if (!window.confirm(`Release this look from order ${o.reference} back to pre-orders?`)) return;
    const { error } = await supabase.from("wardrobe_orders").update({ items: items as never }).eq("id", o.id);
    if (error) { toast.error(error.message); return; }
    await supabase.from("reservations").update({ order_placed_at: null }).eq("id", rid);
    toast.success("Released back to pre-orders");
    qc.invalidateQueries({ queryKey: ["wardrobe-orders"] }); qc.invalidateQueries({ queryKey: ["host-orders"] });
  }
  const pickedRows = tabRows.filter((r) => picked.has(r.id));
  const convertible = pickedRows.filter((r) => !inOrder.has(r.id));
  async function preorderPdf() {
    setPdfBusy(true);
    try {
      const list = picked.size ? pickedRows : rows;
      const tab = FILTER_TABS.find(([k]) => k === filter)?.[1] ?? "All looks";
      const blob = await buildPreorderPdf("Pre-Order", `${tab}${picked.size ? " (selected)" : ""}`, list.map((r) => { const item = toItem(r); return ({
        wearer: r.guest_name || r.guest?.guest_name || "Guest", family: r.guest?.household || "", event: r.outfits?.events?.name || "",
        title: item.alternative?.title || item.title, designer: item.alternative?.designer || item.designer, sku: item.alternative?.sku || item.sku,
        size: r.size_choice || r.build_size || "", suggested: r.suggested ?? "",
        status: [r.confirmed ? "Confirmed" : "Reserved", r.soldOut ? "size sold out" : "", inOrder.has(r.id) ? `in order ${inOrder.get(r.id)}` : ""].filter(Boolean).join(", "),
        price: item.alternative || r.outfits?.price_inr != null ? `INR ${money(item.price, "INR")}` : r.outfits?.price_note || "Not supplied",
        amount: item.alternative || r.outfits?.price_inr != null ? item.price : null,
        measurements: r.measurementValues ? Object.entries(r.measurementValues).map(([k, v]) => `${k.replaceAll("_", " ")} ${v}`).join(", ") : "",
        shop: item.alternative?.shop || item.shop, image: item.alternative?.image || item.image, notes: [r.build_fabric, item.alternative ? `Original selection: ${item.title} (${item.sku}), requested size ${item.size || "Not recorded"}. Replacement size: ${item.orderedSize || "Not recorded"}` : ""].filter(Boolean).join(". "),
      }); }));
      setPdfReady({ blob, name: `pre-order-${tab.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.pdf` });
    } catch (e) { console.error(e); toast.error("Couldn't create the PDF"); } finally { setPdfBusy(false); }
  }
  const select = "field-select h-9 w-full rounded-md border border-border bg-background px-2 text-sm";

  const candidates = (data.data ?? []).map(toItem);
  const filterBar = (<div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {([["gender", "All looks"], ["event", "All events"], ["family", "All families"], ["person", "All people"]] as const).map(([k, all]) => (
            <select key={k} aria-label={all} className="field-select h-9 w-full rounded-md border border-border bg-background px-2 text-sm" value={dim[k]}
              onChange={(e) => { setDim((d) => ({ ...d, [k]: e.target.value })); setPicked(new Set()); setPdfReady(null); }}>
              <option value="">{all}</option>
              {options[k].map((v) => <option key={v} value={v}>{k === "gender" ? ({ men: "Man", women: "Woman", boy: "Boy", girl: "Girl", man: "Man", woman: "Woman" } as Record<string, string>)[v] ?? v : v}</option>)}
            </select>
          ))}
          <select aria-label="Sort" className="field-select col-span-2 h-9 w-full rounded-md border border-border bg-background px-2 text-sm sm:col-span-4" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="recent">Sort: newest first</option>
            <option value="name-asc">Name A–Z</option><option value="name-desc">Name Z–A</option>
            <option value="size-asc">Size ascending</option><option value="size-desc">Size descending</option>
            <option value="price-asc">Price low to high</option><option value="price-desc">Price high to low</option>
          </select>
        </div>);
  if (view === "alterations") return (
    <div className="space-y-4">
      <div className="panel-wrap p-4 sm:p-5">
        <h2 className="font-display text-xl">Alterations</h2>
        <p className="mt-1 text-sm text-muted-foreground">For the tailor: record each person's look with fitting photos, notes, revised measurements and any extra measurements.</p>
        <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {([["all", "All"], ["needed", "Needed"], ["with vendor", "With tailor"], ["complete", "Complete"], ["none", "Not started"]] as const).map(([k, l]) => (
            <Button key={k} size="sm" className="shrink-0" variant={altFilter === k ? "default" : "outline"} onClick={() => setAltFilter(k)}>{l}</Button>
          ))}
        </div>
        {filterBar}
        {(() => { const names = [...new Set([...(alterations.data?.values() ?? [])].map((a) => a.workman).filter(Boolean))].sort(); return names.length ? (
          <select aria-label="Workman" className="field-select mt-2 h-9 w-full rounded-md border border-border bg-background px-2 text-sm" value={workmanFilter} onChange={(e) => setWorkmanFilter(e.target.value)}>
            <option value="">All workmen</option>{names.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>) : null; })()}
      </div>
      {data.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      <ul className="space-y-3">
        {rows.filter((r) => { const a = alterations.data?.get(r.id); return (!workmanFilter || a?.workman === workmanFilter) && (altFilter === "all" || (altFilter === "none" ? !a : a?.status === altFilter)); }).map((r) => {
          const a = alterations.data?.get(r.id);
          return (
            <li key={r.id} className="panel-wrap grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 p-3 sm:flex sm:items-center sm:p-4">
              {r.outfits?.image_url ? <img src={r.outfits.image_url} alt={r.outfits.title} referrerPolicy="no-referrer" className="h-20 w-16 shrink-0 rounded-md object-cover" /> : <div className="grid h-20 w-16 shrink-0 place-items-center rounded-md bg-muted"><Package className="size-5 text-muted-foreground" /></div>}
              <div className="min-w-0 sm:flex-1">
                <p className="truncate font-medium">{wearerOf(r)}</p>
                <p className="truncate text-sm text-muted-foreground">{r.outfits?.title ?? "Look"} · {r.outfits?.events?.name ?? ""}</p>
                <p className="text-xs text-muted-foreground">{r.guest?.household ?? ""} · size {r.size_choice || r.build_size || "not chosen"}</p>
                {a?.adjustments ? <p className="mt-1 line-clamp-2 text-xs">Adjustments: {a.adjustments}</p> : null}
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Badge variant={a?.status === "complete" ? "default" : a ? "secondary" : "outline"}>{a ? (a.status === "with vendor" ? "With tailor" : a.status.charAt(0).toUpperCase() + a.status.slice(1)) : "Not started"}</Badge>
                  {a?.workman ? <Badge variant="outline">By {a.workman}</Badge> : null}
                  {a?.photos ? <Badge variant="outline">{a.photos} photo{a.photos === 1 ? "" : "s"}</Badge> : null}
                  <Badge variant="outline">{r.measured ? "Measurements in" : "No measurements"}</Badge>
                </div>
              </div>
              <div className="col-span-2 sm:col-span-1 sm:shrink-0">
                <OrderAlterations inviteId={inviteId!} reservationId={r.id} wearer={wearerOf(r)} measurements={r.measurementValues} label={a ? "Open alteration" : "Record alteration"} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
  if (view === "orders") return (
    <div className="space-y-5">
      <GroupedShopOrders inviteId={inviteId} candidates={candidates} preorder={pending.map(toItem)} />
      <VendorInvoiceUpload inviteId={inviteId} candidates={candidates.filter((c) => !inOrder.has(c.reservationId) && !(data.data ?? []).find((r) => r.id === c.reservationId)?.order_placed_at)} />
    </div>
  );
  return (
    <div className="space-y-5">
      <GroupedShopOrders listHidden inviteId={inviteId} startWith={startWith} onStarted={() => { setStartWith(null); setPicked(new Set()); }} candidates={candidates} />
      <VendorInvoiceUpload inviteId={inviteId} candidates={candidates.filter((c) => !inOrder.has(c.reservationId) && !(data.data ?? []).find((r) => r.id === c.reservationId)?.order_placed_at)} />
      {rows.length ? <PreorderFamilyTotals items={rows.map(toItem)} /> : null}
      {rows.length ? (
        <div className="panel-wrap sticky top-2 z-10 flex flex-wrap items-center gap-x-3 gap-y-2 p-3">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              aria-label="Select all shown"
              checked={rows.length > 0 && rows.every((r) => picked.has(r.id))}
              onCheckedChange={(v) => { setPicked((p) => { const n = new Set(p); for (const r of rows) { if (v) n.add(r.id); else n.delete(r.id); } return n; }); setPdfReady(null); }}
            />
            Select all shown ({rows.length})
          </label>
          <span className="text-sm text-muted-foreground">
            {picked.size} selected · value INR {pickedRows.reduce((s, r) => s + toItem(r).price, 0).toLocaleString(...nf())}
          </span>
          <div className="grid w-full grid-cols-1 gap-2 sm:ml-auto sm:flex sm:w-auto sm:flex-wrap">
            <Button size="sm" variant="outline" disabled={pdfBusy || (!picked.size && !rows.length)} onClick={() => void preorderPdf()}>
              <FileDown className="size-4" /> {pdfBusy ? "Preparing…" : "Pre-order PDF"}{picked.size ? ` (${picked.size})` : ""}
            </Button>
            {pdfReady ? (
              <Button size="sm" onClick={() => { saveBlob(pdfReady.blob, pdfReady.name); setPdfReady(null); }}>
                <FileDown className="size-4" /> Download PDF
              </Button>
            ) : null}
            <Button size="sm" disabled={!convertible.length} onClick={() => setStartWith(convertible.map(toItem))}>
              <ShoppingBag className="size-4" /> Convert {convertible.length || ""} to one order
            </Button>
          </div>
        </div>
      ) : null}
      <div className="panel-wrap p-4 sm:p-5">
        <h2 className="font-display text-xl">Pre-orders</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Every look guests have chosen, waiting to be ordered. Tick several (or select all) to
          convert them into one shop order, or download a pre-order PDF for the stylist to review.
        </p>
        {totals.length ? (
          <div className="mt-4 flex flex-wrap gap-3">
            {totals.map(([cur, t]) => (
              <div key={cur} className="rounded-md border border-border px-3 py-2 text-sm">
                <span className="font-medium">
                  {cur} {t.due.toLocaleString(...nf(cur))}
                </span>{" "}
                ordered · {cur} {t.paid.toLocaleString(...nf(cur))} paid ·{" "}
                <span className="text-primary">
                  {cur} {Math.max(t.due - t.paid, 0).toLocaleString(...nf())} outstanding
                </span>
              </div>
            ))}
          </div>
        ) : null}
        <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          {(
            FILTER_TABS
          ).map(([k, label]) => (
            <Button
              key={k}
              size="sm"
              variant={filter === k ? "default" : "outline"}
              className="shrink-0"
              onClick={() => { setFilter(k); setPicked(new Set()); setPdfReady(null); }}
            >
              {label} ({counts[k]})
            </Button>
          ))}
        </div>
        {filterBar}
      </div>

      <Input
        type="search"
        aria-label="Search outfits"
        placeholder="Search outfit, model number, designer or shop link"
        value={outfitSearch}
        onChange={(e) => { setOutfitSearch(e.target.value); setPdfReady(null); }}
      />

      {data.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="panel-wrap p-5 text-sm text-muted-foreground">
          {filter === "ready"
            ? "Nothing ready yet — reserved looks appear here once measurements are in."
            : "Nothing here yet."}
        </p>
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => {
            const d = draftOf(r);
            const o = r.outfits;
            const canPlace = r.measured;
            return (
              <li key={r.id} className="panel-wrap p-4 sm:p-5">
                <div className="flex flex-wrap items-start gap-3 sm:gap-4">
                  <Checkbox
                    className="mt-1"
                    aria-label={`Select ${o?.title ?? "look"}`}
                    checked={picked.has(r.id)}
                    onCheckedChange={(v) => { setPicked((p) => { const n = new Set(p); if (v) n.add(r.id); else n.delete(r.id); return n; }); setPdfReady(null); }}
                  />
                  {o?.image_url ? (
                    <img
                      src={o.image_url}
                      alt={o.title}
                      referrerPolicy="no-referrer"
                      className="h-24 w-20 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <div className="grid h-24 w-20 place-items-center rounded-md bg-muted">
                      <Package className="size-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-[10.5rem] flex-1">
                    <p className="font-medium">{o?.title ?? "Look"}</p>
                    <p className="break-words text-sm text-muted-foreground">Model number: {o?.source_sku || "Not supplied"}</p>
                    <p className="text-sm text-muted-foreground">
                      {r.guest_name && r.guest_name.trim().toLowerCase() !== (r.guest?.guest_name ?? "").trim().toLowerCase()
                        ? `${r.guest_name} (by ${r.guest?.guest_name ?? "family"})`
                        : r.guest_name || r.guest?.guest_name}
                      {r.guest?.household ? ` · ${r.guest.household}` : ""}
                      {o?.events?.name ? ` · ${o.events.name}` : ""}
                    </p>
                    {r.created_at ? (
                      <p className="text-xs text-muted-foreground">
                        Reserved{" "}
                        {new Date(r.created_at).toLocaleString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    ) : null}
                    <p className="text-sm text-muted-foreground">
                      {[o?.designer, r.build_garment, r.build_size && `size ${r.build_size}`, r.build_fabric]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <p className="text-sm">Shop price: {o?.price_inr != null ? `INR ${money(Number(o.price_inr))}` : o?.price_note || "Not supplied"}</p>
                    {r.size_choice || r.suggested ? (
                      <p className="text-sm">
                        Size chosen: <span className="font-medium">{r.size_choice ?? "—"}</span>
                        {r.suggested ? <> · suggested <span className="font-medium">{r.suggested}</span></> : null}
                        {r.misfit ? <span className="text-destructive"> · may not fit</span> : null}
                        {r.soldOut ? <span className="text-destructive"> · chosen size sold out</span> : null}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge variant={r.confirmed ? "default" : "outline"}>
                        {r.confirmed ? "Look confirmed" : "Look not confirmed"}
                      </Badge>
                      <Badge variant={r.measured ? "default" : "outline"}>
                        {r.measured ? "Measurements in" : "No measurements"}
                      </Badge>
                      {inOrder.has(r.id) ? <><Badge variant="secondary">In order {inOrder.get(r.id)}</Badge><Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => void releaseFromOrder(r.id)}>Release to pre-order</Button></> : null}
                      {r.order_placed_at ? (
                        <>
                          <Badge variant="secondary">
                            Ordered {new Date(r.order_placed_at).toLocaleDateString()}
                          </Badge>
                          <Badge variant="secondary">{r.payment_status}</Badge>
                          <Badge variant="secondary">{r.shipping_status}</Badge>
                        </>
                      ) : null}
                    </div>
                  </div>
                  {o?.boutique_url ? (
                    <Button asChild size="sm" variant="outline">
                      <a href={o.boutique_url} target="_blank" rel="noreferrer">
                        Open in shop <ExternalLink className="size-3.5" />
                      </a>
                    </Button>
                  ) : null}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="space-y-1 text-xs text-muted-foreground">
                    Order reference
                    <Input value={d.order_reference} onChange={(e) => field(r, "order_reference", e.target.value)} placeholder="PPUS-12345" />
                  </label>
                  <label className="space-y-1 text-xs text-muted-foreground">
                    Amount
                    <div className="flex gap-2">
                      <Input className="w-20" value={d.order_currency} maxLength={3} onChange={(e) => field(r, "order_currency", e.target.value)} />
                      <Input inputMode="decimal" value={d.order_amount} onChange={(e) => field(r, "order_amount", e.target.value)} placeholder="0" />
                    </div>
                  </label>
                  <label className="space-y-1 text-xs text-muted-foreground">
                    Paid so far
                    <Input inputMode="decimal" value={d.amount_paid} onChange={(e) => field(r, "amount_paid", e.target.value)} />
                  </label>
                  <label className="space-y-1 text-xs text-muted-foreground">
                    Payment
                    <select className={select} value={d.payment_status} onChange={(e) => field(r, "payment_status", e.target.value)}>
                      {PAYMENT.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1 text-xs text-muted-foreground">
                    Courier
                    <Input value={d.shipping_carrier} onChange={(e) => field(r, "shipping_carrier", e.target.value)} placeholder="DHL, Aramex…" />
                  </label>
                  <label className="space-y-1 text-xs text-muted-foreground">
                    Tracking number
                    <Input value={d.tracking_number} onChange={(e) => field(r, "tracking_number", e.target.value)} />
                  </label>
                  <label className="space-y-1 text-xs text-muted-foreground">
                    Tracking link
                    <Input value={d.tracking_url} onChange={(e) => field(r, "tracking_url", e.target.value)} placeholder="https://…" />
                  </label>
                  <label className="space-y-1 text-xs text-muted-foreground">
                    Shipping
                    <select className={select} value={d.shipping_status} onChange={(e) => field(r, "shipping_status", e.target.value)}>
                      {SHIPPING.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </label>
                </div>
                <label className="mt-3 block space-y-1 text-xs text-muted-foreground">
                  Note
                  <Input value={d.order_note} onChange={(e) => field(r, "order_note", e.target.value)} placeholder="Alterations, delivery address…" />
                </label>

                <div className="mt-4 border-t border-border pt-3"><h3 className="text-sm font-medium">Wearer measurements</h3><dl className="mt-2 grid gap-2 text-xs sm:grid-cols-3 lg:grid-cols-5">{r.measurementValues ? Object.entries(r.measurementValues).map(([k, v]) => <div key={k}><dt className="text-muted-foreground">{k.replaceAll("_", " ")}</dt><dd>{v}</dd></div>) : <p className="text-muted-foreground">Not supplied</p>}</dl></div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {!inOrder.has(r.id) && !r.order_placed_at ? <OutfitSubstitution inviteId={inviteId} item={toItem(r)} onSaved={() => setPdfReady(null)} /> : null}
                  {preorderAlternatives.data?.get(r.id) ? <p className="w-full text-sm text-primary">Replacement: {toItem(r).alternative?.title} · size {toItem(r).orderedSize} · INR {money(toItem(r).price)}</p> : null}
                  <SubstitutionNote sub={subs.data?.get(r.id)} showOriginal />
                  <OrderAlterations inviteId={inviteId} reservationId={r.id} wearer={r.guest_name || r.guest?.guest_name || "Guest"} measurements={r.measurementValues} />
                  {r.order_placed_at ? (
                    <Button size="sm" disabled={save.isPending} onClick={() => save.mutate({ r })}>
                      Save
                    </Button>
                  ) : (
                    <Button size="sm" disabled={!canPlace || save.isPending} onClick={() => save.mutate({ r, place: true })}>
                      Place order
                    </Button>
                  )}
                  {r.tracking_url ? (
                    <Button asChild size="sm" variant="ghost">
                      <a href={r.tracking_url} target="_blank" rel="noreferrer">
                        Track parcel <ExternalLink className="size-3.5" />
                      </a>
                    </Button>
                  ) : null}
                  {!canPlace ? (
                    <span className="text-xs text-muted-foreground">
                      Measurements are needed before ordering.
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function PreorderFamilyTotals({ items }: { items: OrderItem[] }) {
  const [open, setOpen] = useState(false);
  const report = familyOrderReport([items]);
  const total = report.reduce((s, f) => s + f.amount, 0);
  return (
    <div className="panel-wrap p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">Amount by family (looks shown) · <span className="font-medium">INR {total.toLocaleString(...nf())}</span></p>
        <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>{open ? "Hide" : "Show"} amount by family</Button>
      </div>
      {open ? (
        <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[480px] text-sm">
          <thead className="text-left text-xs text-muted-foreground"><tr><th className="p-2 font-normal">Family</th><th className="p-2 font-normal">People</th><th className="p-2 text-right font-normal">Looks</th><th className="p-2 text-right font-normal">Amount</th></tr></thead>
          <tbody>{report.map((f) => <tr key={f.family} className="border-t border-border"><td className="p-2 font-medium">{f.family}</td><td className="p-2">{f.people.join(", ")}</td><td className="p-2 text-right">{f.looks}</td><td className="p-2 text-right">{f.amount.toLocaleString(...nf())}</td></tr>)}
          <tr className="border-t border-border font-medium"><td className="p-2" colSpan={3}>Total</td><td className="p-2 text-right">{total.toLocaleString(...nf())}</td></tr></tbody>
        </table></div>
      ) : null}
    </div>
  );
}
