import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { WearerNoteButton } from "@/components/wearer-order-actions";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { OrderItem } from "@/lib/shop-order";
import { menSetStatus, setSetHandled, type PairingLook } from "@/lib/trouser-pairing";

type Order = { id: string; reference: string; seller_reference: string; shop_name: string; status: string; items: OrderItem[] };
type Filter = "" | "incomplete" | "linked" | "handled";

/** Men's non-set looks: are trousers linked, handled offline, or covered by a wearer note? */
export function OrderMenSetsView({ inviteId, orders, wardrobe, current, matches, onOpen }: { inviteId: string; orders: Order[]; wardrobe: PairingLook[]; current: (i: OrderItem) => { wearer: string; family: string }; matches: (i: OrderItem, o: Order) => boolean; onOpen: (id: string) => void }) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("incomplete");
  const [busy, setBusy] = useState("");
  const rows = orders.filter((o) => o.status !== "cancelled").flatMap((o) => o.items.filter((i) => matches(i, o)).flatMap((i) => { const st = menSetStatus(i, wardrobe); return st ? [{ o, i, st, ...current(i) }] : []; }))
    .sort((a, b) => a.family.localeCompare(b.family) || a.wearer.localeCompare(b.wearer) || a.i.event.localeCompare(b.i.event));
  const count = (f: Filter) => rows.filter((r) => f === "" || (f === "incomplete" ? !r.st.complete : f === "linked" ? r.st.pantsLinked : !r.st.pantsLinked && r.st.complete)).length;
  const shown = rows.filter((r) => filter === "" || (filter === "incomplete" ? !r.st.complete : filter === "linked" ? r.st.pantsLinked : !r.st.pantsLinked && r.st.complete));
  async function toggle(o: Order, i: OrderItem, v: boolean) {
    setBusy(i.reservationId);
    try {
      const cur = await supabase.from("wardrobe_orders").select("items, updated_at").eq("id", o.id).eq("invite_id", inviteId).single();
      if (cur.error) throw cur.error;
      const next = setSetHandled(cur.data.items as unknown as OrderItem[], i.reservationId, v);
      const saved = await supabase.from("wardrobe_orders").update({ items: next as unknown as Json }).eq("id", o.id).eq("invite_id", inviteId).eq("updated_at", cur.data.updated_at).select("id").maybeSingle();
      if (saved.error) throw saved.error; if (!saved.data) throw new Error("The order changed while saving. Try again");
      await qc.invalidateQueries({ queryKey: ["wardrobe-orders"] });
    } catch (e) { toast.error(e && typeof e === "object" && "message" in e ? String(e.message) : "Couldn't save"); } finally { setBusy(""); }
  }
  const Mark = ({ ok, label }: { ok: boolean; label: string }) => <span className={`inline-flex items-center gap-1 text-xs ${ok ? "text-primary" : "text-destructive"}`}>{ok ? <Check className="size-3.5" /> : <X className="size-3.5" />}{label}</span>;
  return <div className="space-y-3">
    <p className="text-sm text-muted-foreground">Men's outfits that aren't sold as a set. A look counts as complete when trousers are linked as an extra, you tick "Managed offline", or a wearer note tells them what to wear.</p>
    <div className="flex flex-wrap gap-1.5">{([["incomplete", "Not complete"], ["linked", "Trousers linked"], ["handled", "Offline / note"], ["", "All"]] as const).map(([k, l]) => <Button key={k || "all"} size="sm" variant={filter === k ? "default" : "outline"} onClick={() => setFilter(k)}>{l} ({count(k)})</Button>)}</div>
    <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">{shown.map(({ o, i, st, wearer, family }) => <li key={`${o.id}-${i.reservationId}`} className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-card p-3 text-sm">
      <div className="min-w-0"><p className="break-words font-medium">{wearer} <span className="font-normal text-muted-foreground">· {family} · {i.event}</span></p><p className="line-clamp-2 text-xs">{i.alternative?.title || i.title}{i.orderedSize ? ` · size ${i.orderedSize}` : ""}</p></div>
      <div className="flex flex-col gap-1">
        <Mark ok={st.pantsLinked} label={st.pantsLinked ? `Trousers linked: ${st.pants.join(", ")}` : "No trousers linked"} />
        <Mark ok={st.noted} label={st.noted ? `Wearer note: ${i.wearerNote}` : "No wearer note"} />
        <label className="flex items-center gap-2 text-xs"><Checkbox checked={st.handled} disabled={busy === i.reservationId} onCheckedChange={(v) => void toggle(o, i, v === true)} aria-label={`Managed offline for ${wearer} — ${i.event}`} />Managed offline by buyer (made into a set)</label>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2"><span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{o.reference}</span><OrderStatusBadge status={o.status} /><WearerNoteButton inviteId={inviteId} orderId={o.id} item={i} wearer={wearer} /><Button size="sm" variant="ghost" onClick={() => onOpen(o.id)}>Open order</Button></div>
    </li>)}{!shown.length ? <li className="text-sm text-muted-foreground">Nothing here.</li> : null}</ul>
  </div>;
}
