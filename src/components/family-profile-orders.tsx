import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { useCelebrationName } from "@/components/family-order-report";
import { useLatestSubstitutions } from "@/components/substitution-note";
import { IndividualShare, ShipmentLine, useOrderPeople, pdfFileName } from "@/components/wearer-order-actions";
import { profileOrderItems } from "@/lib/family-profile-orders";
import { wearerLookLine } from "@/lib/wearer-order";
import { buildFamilyLooksPdf, saveBlob } from "@/lib/shop-order-pdf";
import type { OrderItem } from "@/lib/shop-order";

/** Host-only family overview, resolved through current reservation/member links. */
export function FamilyProfileOrders({ inviteId, household }: { inviteId: string; household: string }) {
  const celebration = useCelebrationName(inviteId);
  const people = useOrderPeople(inviteId);
  const [busy, setBusy] = useState(false);
  const query = useQuery({ queryKey: ["family-profile-orders", inviteId, household], queryFn: async () => {
    const [orders, reservations, members] = await Promise.all([
      supabase.from("wardrobe_orders").select("id, reference, status, items").eq("invite_id", inviteId).neq("status", "cancelled"),
      supabase.from("reservations").select("id, member_code_id, guest_name, guest_id").eq("invite_id", inviteId),
      supabase.from("invite_codes").select("id, guest_name, household, claimed_by").eq("invite_id", inviteId),
    ]);
    if (orders.error) throw orders.error;
    if (reservations.error) throw reservations.error;
    if (members.error) throw members.error;
    return orders.data.flatMap((order) => profileOrderItems(order.items as unknown as OrderItem[], reservations.data, members.data, household).map((item) => ({ order, item })));
  } });
  const rows = [...(query.data ?? [])].sort((a, b) => people.data?.seq.compare(a.item, b.item) ?? a.item.wearer.localeCompare(b.item.wearer));
  const subs = useLatestSubstitutions(rows.map(({ item }) => item.reservationId));
  const lines = rows.map(({ item }) => wearerLookLine(item, item.wearer, subs.data?.get(item.reservationId)));
  const wearers = [...new Set(rows.map(({ item }) => item.wearer))];
  return <section id="family-orders" className="min-w-0 scroll-mt-28 sm:scroll-mt-6 border-t border-border py-6">
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0"><h2 className="text-xl">Outfits Ordered</h2><p className="text-sm text-muted-foreground">{rows.length} looks · {wearers.length} wearers</p></div>
      <Button variant="outline" disabled={busy || !rows.length || query.isPending || subs.isPending || !people.data} onClick={async () => {
        setBusy(true);
        try { saveBlob(await buildFamilyLooksPdf(household, celebration, lines), pdfFileName(household)); }
        catch { toast.error("Couldn't create the family PDF"); } finally { setBusy(false); }
      }}><FileDown className="size-4" />{busy ? "Preparing…" : "Family wardrobe PDF"}</Button>
    </div>
    {query.isPending ? <p className="mt-3 text-sm text-muted-foreground">Loading ordered outfits…</p> : query.isError ? <p role="alert" className="mt-3 text-sm text-destructive">Couldn't load family orders.</p> : !rows.length ? <p className="mt-3 text-sm text-muted-foreground">No active ordered outfits for this family yet.</p> : null}
    {wearers.map((wearer) => <div key={wearer} className="mt-5 min-w-0">
      <div className="grid gap-2 border-b border-border pb-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><h3 className="break-words font-medium">{wearer}</h3><div className="grid grid-cols-2 gap-2"><IndividualShare wearer={wearer} celebration={celebration} lines={lines.filter((line) => line.wearer === wearer)} phone={people.data?.phones.get(wearer.trim().toLowerCase())} /></div></div>
      <ul className="mt-3 grid gap-3 lg:grid-cols-2">{rows.filter(({ item }) => item.wearer === wearer).map(({ item, order }) => {
        const sub = subs.data?.get(item.reservationId); const replacement = item.alternative ?? sub?.replacement;
        return <li key={`${order.id}-${item.reservationId}`} className="min-w-0 rounded-lg border border-border p-3">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2"><h4 className="break-words font-medium">{item.event}</h4><OrderStatusBadge status={order.status} /></div>
          <div className="mt-3 flex min-w-0 gap-3">{[item.image, replacement?.image].filter(Boolean).map((image, index) => <img key={`${index}-${image}`} src={image ?? ""} alt={index ? "Substitute outfit" : "Selected outfit"} className="h-24 w-16 shrink-0 rounded object-cover" loading="lazy" />)}<div className="min-w-0 space-y-1 text-xs"><p className="break-words">Selected: {item.title}</p>{replacement ? <p className="break-words text-primary">Substitute: {replacement.title}</p> : null}<p>Requested: {item.size || "Not recorded"}</p><p>Ordered: {item.orderedSize || "Not recorded"}</p></div></div>
          {item.addOns?.map((extra) => <p key={extra.id} className="mt-2 break-words text-xs">Extra: {extra.label || "Additional piece"} · size {extra.size || "Not recorded"}</p>)}
          {item.wearerNote ? <p className="mt-2 break-words text-sm"><span className="text-muted-foreground">Wearer note: </span>{item.wearerNote}</p> : null}
          <div className="mt-2"><ShipmentLine item={item} /></div><p className="mt-2 break-words text-xs text-muted-foreground">{order.reference}</p>
        </li>;
      })}</ul>
    </div>)}
  </section>;
}