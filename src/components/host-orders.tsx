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

/**
 * Orders: once a guest has confirmed their look and sent measurements, the
 * host places the order with the shop and tracks money and shipping here.
 */
export function HostOrders() {
  const qc = useQueryClient();
  const { inviteId } = useSelectedEvent();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [filter, setFilter] = useState<"ready" | "placed" | "all" | "fit" | "nomeas">("ready");

  const data = useQuery({
    queryKey: ["host-orders", inviteId],
    queryFn: async () => {
      const [res, meas, codes] = await Promise.all([
        supabase
          .from("reservations")
          .select(
            "*, outfits(title, designer, boutique_url, image_url, event_id, gender, sizes, events(name, invite_id))",
          ),
        supabase.from("measurements").select("guest_id, guest_name, unit, bust, chest, waist, hip, neck, usual_size, height"),
        supabase.from("invite_codes").select("claimed_by, household, guest_name, invite_id"),
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
          const mine = (meas.data ?? []).filter((m) => m.guest_id === r.guest_id);
          const key = (r.guest_name ?? "").trim().toLowerCase();
          const m = mine.find((x) => (x.guest_name ?? "").trim().toLowerCase() === key) ?? (mine.length === 1 ? mine[0] : undefined);
          const gender = (r.outfits as { gender?: string } | null)?.gender ?? null;
          const suggested = m && hasChart(gender) ? (suggestSize(m, formFor(gender))?.size ?? m.usual_size ?? null) : null;
          const size = r.size_choice ?? null;
          const shopSizes = ((r.outfits as { sizes?: unknown } | null)?.sizes as ShopSize[] | null) ?? [];
          return {
            ...r,
            guest: guests.get(r.guest_id)!,
            measured: Boolean(m),
            confirmed: r.status === "confirmed",
            suggested,
            misfit: Boolean(size && suggested && size !== MADE_TO_MEASURE && size !== suggested),
            soldOut: Boolean(size && shopSizes.find((x) => x.label === size && !x.available)),
          };
        })
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    },
  });

  type Row = NonNullable<typeof data.data>[number];

  const rows = useMemo(() => {
    const all = data.data ?? [];
    if (filter === "placed") return all.filter((r) => r.order_placed_at);
    if (filter === "fit") return all.filter((r) => r.misfit || r.soldOut);
    if (filter === "nomeas") return all.filter((r) => !r.measured);
    if (filter === "ready") return all.filter((r) => !r.order_placed_at && r.confirmed && r.measured);
    return all;
  }, [data.data, filter]);

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
          ...(place ? { order_placed_at: new Date().toISOString(), order_status: "in progress" } : {}),
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

  const counts = {
    ready: (data.data ?? []).filter((r) => !r.order_placed_at && r.confirmed && r.measured).length,
    placed: (data.data ?? []).filter((r) => r.order_placed_at).length,
    all: (data.data ?? []).length,
    fit: (data.data ?? []).filter((r) => r.misfit || r.soldOut).length,
    nomeas: (data.data ?? []).filter((r) => !r.measured).length,
  };

  const field = (r: Row, k: keyof Draft, v: string) =>
    setDrafts((p) => ({ ...p, [r.id]: { ...draftOf(r), [k]: v } }));

  const select = "field-select h-9 w-full rounded-md border border-border bg-background px-2 text-sm";

  return (
    <div className="space-y-5">
      <div className="panel-wrap p-5">
        <h2 className="font-display text-xl">Orders</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Once a guest has confirmed their look and sent measurements, place the order with the
          shop and keep the reference, amount, payment and shipping here.
        </p>
        {totals.length ? (
          <div className="mt-4 flex flex-wrap gap-3">
            {totals.map(([cur, t]) => (
              <div key={cur} className="rounded-md border border-border px-3 py-2 text-sm">
                <span className="font-medium">
                  {cur} {t.due.toLocaleString()}
                </span>{" "}
                ordered · {cur} {t.paid.toLocaleString()} paid ·{" "}
                <span className="text-primary">
                  {cur} {Math.max(t.due - t.paid, 0).toLocaleString()} outstanding
                </span>
              </div>
            ))}
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {(
            [
              ["ready", "Ready to order"],
              ["placed", "Ordered"],
              ["all", "All looks"],
              ["fit", "Size may not fit"],
              ["nomeas", "No measurements yet"],
            ] as const
          ).map(([k, label]) => (
            <Button
              key={k}
              size="sm"
              variant={filter === k ? "default" : "outline"}
              onClick={() => setFilter(k)}
            >
              {label} ({counts[k]})
            </Button>
          ))}
        </div>
      </div>

      {data.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="panel-wrap p-5 text-sm text-muted-foreground">
          {filter === "ready"
            ? "Nothing ready yet — looks appear here once the guest has confirmed and sent measurements."
            : "Nothing here yet."}
        </p>
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => {
            const d = draftOf(r);
            const o = r.outfits;
            const canPlace = r.confirmed && r.measured;
            return (
              <li key={r.id} className="panel-wrap p-5">
                <div className="flex flex-wrap items-start gap-4">
                  {o?.image_url ? (
                    <img
                      src={o.image_url}
                      alt={o.title}
                      referrerPolicy="no-referrer"
                      className="h-24 w-20 rounded-md object-cover"
                    />
                  ) : (
                    <div className="grid h-24 w-20 place-items-center rounded-md bg-muted">
                      <Package className="size-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{o?.title ?? "Look"}</p>
                    <p className="text-sm text-muted-foreground">
                      {r.guest_name && r.guest_name.trim().toLowerCase() !== (r.guest.guest_name ?? "").trim().toLowerCase()
                        ? `${r.guest_name} (by ${r.guest.guest_name})`
                        : r.guest_name || r.guest.guest_name}
                      {r.guest.household ? ` · ${r.guest.household}` : ""}
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

                <div className="mt-4 flex flex-wrap items-center gap-2">
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
                      Can be ordered once the look is confirmed and measurements are in.
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
