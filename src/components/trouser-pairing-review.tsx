import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { money, validateOrder, type OrderItem, type OrderPayment } from "@/lib/shop-order";
import { needsTrouserReview, pairWhitePants, modelKey, WHITE_PANTS_SKU, type PairingLook } from "@/lib/trouser-pairing";

type PairOrder = { id: string; reference: string; currency: string; status: string; updated_at: string; items: unknown };
type WardrobeLook = PairingLook & { image_url?: string | null; boutique_url?: string | null; price_inr?: number | null };
export function TrouserPairingReview({ inviteId, orders, wardrobe, candidates }: { inviteId: string; orders: PairOrder[]; wardrobe: WardrobeLook[]; candidates: OrderItem[] }) {
  const qc = useQueryClient();
  const [review, setReview] = useState<{ order: PairOrder; item: OrderItem; wearer: string } | null>(null);
  const [size, setSize] = useState(""); const [price, setPrice] = useState(""); const [busy, setBusy] = useState(false);
  const pants = wardrobe.find((w) => modelKey(w.source_sku) === WHITE_PANTS_SKU);
  const rows = orders.filter((o) => o.status !== "cancelled").flatMap((order) => (order.items as OrderItem[]).filter((i) => needsTrouserReview(i, wardrobe)).map((item) => ({ order, item, wearer: candidates.find((c) => c.reservationId === item.reservationId)?.wearer ?? item.wearer })));
  async function save() {
    if (!review || !pants) return;
    setBusy(true);
    try {
      const current = await supabase.from("wardrobe_orders").select("items,payments,courier_charges,currency,status,updated_at").eq("id", review.order.id).eq("invite_id", inviteId).single();
      if (current.error) throw current.error;
      if (current.data.status === "cancelled" || current.data.updated_at !== review.order.updated_at || current.data.currency !== "INR") throw new Error("The order changed. Close and reopen the pairing review.");
      const next = pairWhitePants(current.data.items as unknown as OrderItem[], review.item.reservationId, { id: crypto.randomUUID(), label: pants.title || "White pyjama pants", sku: WHITE_PANTS_SKU, size: size.trim(), shop: pants.boutique_url ?? "", price: Number(price), discount: 0, notes: "" }, wardrobe);
      validateOrder(next, current.data.payments as unknown as OrderPayment[], Number(current.data.courier_charges ?? 0));
      const saved = await supabase.from("wardrobe_orders").update({ items: next as unknown as Json }).eq("id", review.order.id).eq("invite_id", inviteId).eq("updated_at", current.data.updated_at).select("id").maybeSingle();
      if (saved.error) throw saved.error;
      if (!saved.data) throw new Error("The order changed while saving. Reopen the pairing review.");
      await Promise.all(["wardrobe-orders", "host-orders", "reservations"].map((key) => qc.invalidateQueries({ queryKey: [key] })));
      setReview(null); toast.success("White pyjama pants added to this look");
    } catch (e) { toast.error(e && typeof e === "object" && "message" in e ? String(e.message) : "Couldn't save pairing"); } finally { setBusy(false); }
  }
  if (!rows.length) return null;
  return <>
    <section aria-label="Trouser review" className="space-y-2 rounded-xl border border-border p-4">
      <h3 className="font-medium">Trousers to review · {rows.length}</h3>
      {rows.map((r) => <div key={`${r.order.id}-${r.item.reservationId}`} className="flex flex-col gap-2 border-t border-border pt-2 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 break-words"><p className="font-medium">{r.wearer} · {r.item.event}</p><p>{r.item.alternative?.title || r.item.title}</p><p className="text-xs text-muted-foreground">{r.order.reference} · Kurta-only look — no trousers recorded</p></div>
        <Button size="sm" variant="outline" className="shrink-0" disabled={!pants || r.order.currency !== "INR"} onClick={() => { setReview(r); setSize(""); setPrice(String(pants?.price_inr ?? "")); }}>Review white pants</Button>
      </div>)}
    </section>
    <Dialog open={Boolean(review)} onOpenChange={(v) => { if (!v && !busy) setReview(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto">
      <DialogHeader><DialogTitle>Review white pants pairing</DialogTitle></DialogHeader>
      {review && pants ? <div className="space-y-4">
        <p className="break-words font-medium">{review.wearer} · {review.item.event}</p>
        <p className="break-words text-sm">{review.item.alternative?.title || review.item.title} · {review.order.reference}</p>
        <div className="flex items-start gap-3">{pants.image_url ? <img src={pants.image_url} alt={pants.title ?? "White pyjama pants"} className="h-36 w-24 shrink-0 rounded object-cover" /> : null}<div className="min-w-0"><p>{pants.title}</p><p className="text-sm text-emerald">✓ In wardrobe · {WHITE_PANTS_SKU}</p>{pants.boutique_url ? <a href={pants.boutique_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">Shop details</a> : null}</div></div>
        <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-sm">Pants size to order<Input aria-label="Pants size to order" value={size} onChange={(e) => setSize(e.target.value)} /></label><label className="space-y-1 text-sm">Pants price · INR<Input aria-label="Pants price" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} /></label></div>
        <p className="text-sm">Order total and balance increase by INR {money(Number(price) || 0)}. Recorded payments stay unchanged.</p>
        <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setReview(null)}>Cancel</Button><Button disabled={busy || !size.trim() || !price.trim() || !Number.isFinite(Number(price)) || Number(price) < 0} onClick={() => void save()}>{busy ? "Saving…" : "Save pants to this look"}</Button></div>
      </div> : null}
    </DialogContent></Dialog>
  </>;
}