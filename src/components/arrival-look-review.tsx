import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Ruler } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { setOrderedSize, type OrderItem } from "@/lib/shop-order";
import { ORDER_MEASUREMENT_FIELDS, setOrderMeasurements } from "@/lib/order-measurements";

export function ArrivalLookReview({ inviteId, orderId, item, wearer, currentMeasurements }: { inviteId: string; orderId: string; item: OrderItem; wearer: string; currentMeasurements?: OrderItem["measurements"] | undefined }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [size, setSize] = useState("");
  const [editingMeasurements, setEditingMeasurements] = useState(false);
  const [draft, setDraft] = useState<Record<string, string | number>>({ unit: "cm" });
  async function save(measurementsOnly = false) {
    if (!measurementsOnly && !size.trim()) { toast.error("Enter the actual size ordered"); return; }
    setBusy(true);
    try {
      const latest = await supabase.from("wardrobe_orders").select("items, updated_at, status").eq("id", orderId).eq("invite_id", inviteId).single();
      if (latest.error) throw latest.error;
      if (latest.data.status === "cancelled") throw new Error("This order is cancelled");
      const items = latest.data.items as unknown as OrderItem[];
      if (!items.some((i) => i.reservationId === item.reservationId)) throw new Error("This look is no longer in the order");
      const next = measurementsOnly ? setOrderMeasurements(items, item.reservationId, draft) : setOrderedSize(items, item.reservationId, size.trim());
      const saved = await supabase.from("wardrobe_orders").update({ items: next as unknown as Json }).eq("id", orderId).eq("invite_id", inviteId).eq("updated_at", latest.data.updated_at).select("id").maybeSingle();
      if (saved.error) throw saved.error;
      if (!saved.data) throw new Error("The order changed while saving. Try again");
      await Promise.all(["wardrobe-orders", "reservations", "confirm-looks", "host-orders", "latest-substitutions"].map((key) => qc.invalidateQueries({ queryKey: [key] })));
      toast.success(`${measurementsOnly ? "Order measurements" : "Ordered size"} saved for ${wearer}`); setOpen(false);
    } catch (e) { toast.error(e && typeof e === "object" && "message" in e ? String(e.message) : "Couldn't save changes"); } finally { setBusy(false); }
  }
  const measurements = (values: OrderItem["measurements"]) => values && Object.keys(values).length ? <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">{Object.entries(values).map(([key, value]) => <div key={key} className="min-w-0"><dt className="break-words text-xs text-muted-foreground">{key.replaceAll("_", " ")}</dt><dd className="break-words">{String(value)}</dd></div>)}</dl> : <p className="text-sm text-destructive">No measurements recorded</p>;
  return <>
    <Button size="sm" variant="outline" aria-label={`Measurements and size for ${wearer} — ${item.event}`} onClick={() => { setSize(item.orderedSize ?? ""); setEditingMeasurements(false); setDraft({ ...(item.measurements ?? currentMeasurements ?? {}), unit: item.measurements?.unit ?? currentMeasurements?.unit ?? "cm" }); setOpen(true); }}><Ruler className="size-4" /> Measurements / size</Button>
    <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
      <DialogHeader><DialogTitle>Measurements & ordered size</DialogTitle></DialogHeader>
      <div className="min-w-0 text-sm"><p className="break-words font-medium">{wearer}</p><p className="break-words text-muted-foreground">{item.event} · {item.alternative?.title || item.title}</p></div>
      <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-medium">Measurements recorded with this order</h4><Button size="sm" variant="outline" disabled={busy} onClick={() => setEditingMeasurements((v) => !v)}><Pencil className="size-4" />{editingMeasurements ? "View measurements" : "Edit measurements"}</Button></div>
      {editingMeasurements ? <div className="space-y-3">
        <p className="text-xs text-muted-foreground">For this outfit's order only. Guest-submitted measurements remain unchanged.</p>
        <label className="block space-y-1 text-sm">Measurement unit<select aria-label="Measurement unit" value={String(draft.unit)} onChange={(e) => setDraft((v) => ({ ...v, unit: e.target.value }))} className="h-9 w-full rounded-md border border-input bg-background px-3"><option value="cm">Centimetres</option><option value="in">Inches</option></select></label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{ORDER_MEASUREMENT_FIELDS.map((field) => <label key={field} className="min-w-0 space-y-1 text-xs capitalize">{field.replaceAll("_", " ")}<Input aria-label={`Order measurement ${field.replaceAll("_", " ")}`} type="number" min="0.1" step="any" value={draft[field] ?? ""} onChange={(e) => setDraft((v) => { const next = { ...v }; if (e.target.value === "") delete next[field]; else next[field] = Number(e.target.value); return next; })} /></label>)}</div>
        <Button disabled={busy} onClick={() => void save(true)}>{busy ? "Saving…" : "Save order measurements"}</Button>
      </div> : measurements(item.measurements)}
      {currentMeasurements !== undefined ? <><h4 className="text-sm font-medium">Current wearer measurements</h4>{measurements(currentMeasurements)}</> : null}
      <p className="text-sm">Guest requested size: <strong>{item.size || "Not recorded"}</strong></p>
      <label className="space-y-1 text-sm">Actual size ordered<Input aria-label="Actual size ordered" value={size} onChange={(e) => setSize(e.target.value)} placeholder="Size / Made to measure" /></label>
      <div className="flex flex-wrap justify-end gap-2"><Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button><Button disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save ordered size"}</Button></div>
    </DialogContent></Dialog>
  </>;
}