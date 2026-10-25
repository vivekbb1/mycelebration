import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileDown, MessageCircle, StickyNote, Truck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { setShipment } from "@/lib/shipment";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buildFamilyLooksPdf, saveBlob, type FamilyLookLine } from "@/lib/shop-order-pdf";
import { setWearerNote } from "@/lib/wearer-order";
import { makeSequencer } from "@/lib/order-sequence";
import type { OrderItem } from "@/lib/shop-order";

/** Invitation people (order + phone) and the event schedule for sequencing and sharing. */
export function useOrderPeople(inviteId: string) {
  return useQuery({ queryKey: ["order-people", inviteId], enabled: Boolean(inviteId), queryFn: async () => {
    const [people, events] = await Promise.all([
      supabase.from("invite_codes").select("guest_name, household, phone, created_at").eq("invite_id", inviteId),
      supabase.from("events").select("name, sort_order, event_date").eq("invite_id", inviteId),
    ]);
    if (people.error) throw people.error; if (events.error) throw events.error;
    const phones = new Map<string, string>();
    for (const p of people.data ?? []) { const d = String(p.phone ?? "").replace(/\D/g, ""); if (d.length >= 8 && p.guest_name) phones.set(p.guest_name.trim().toLowerCase(), d); }
    return { phones, seq: makeSequencer(people.data ?? [], events.data ?? []), events: [...(events.data ?? [])].sort((a, b) => a.sort_order - b.sort_order || (a.event_date ?? "").localeCompare(b.event_date ?? "")).map((e) => e.name) };
  } });
}

export const pdfFileName = (name: string) => `${name.replace(/[^a-z0-9-]/gi, "-")}-looks.pdf`;

/** Phones get the PDF through the share sheet; computers download it and open WhatsApp to attach it. Never sends by itself. */
export async function sharePdfOnWhatsApp(makeBlob: () => Promise<Blob>, fileName: string, text: string, phone = "") {
  const touch = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
  const tab = touch ? null : window.open("", "_blank");
  try {
    const blob = await makeBlob();
    const file = new File([blob], fileName, { type: "application/pdf" });
    if (touch && navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], text }); return; } catch (e) { if ((e as DOMException).name === "AbortError") return; } }
    saveBlob(blob, fileName);
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    if (tab) tab.location.href = url; else window.location.href = url;
    toast.success("PDF downloaded — attach it in the WhatsApp chat that opened");
  } catch { tab?.close(); toast.error("Couldn't create the PDF"); }
}

/** One person's outfits (all events) as a PDF, plus WhatsApp sharing. */
export function IndividualShare({ wearer, celebration, lines, phone }: { wearer: string; celebration: string; lines: FamilyLookLine[]; phone?: string | undefined }) {
  const [busy, setBusy] = useState(false);
  const make = () => buildFamilyLooksPdf(wearer, celebration, lines);
  const text = `Hello ${wearer}, please find attached the outfits ordered for you for ${celebration}, with notes on anything to carry. Kindly check each look and size and let us know of any last-minute changes.`;
  return <>
    <Button size="sm" variant="outline" aria-label={`Individual PDF for ${wearer}`} disabled={busy || !lines.length} onClick={async () => { setBusy(true); try { saveBlob(await make(), pdfFileName(wearer)); } catch { toast.error("Couldn't create the PDF"); } finally { setBusy(false); } }}><FileDown className="size-4" /> PDF</Button>
    <Button size="sm" variant="outline" disabled={busy || !lines.length} aria-label={`WhatsApp ${wearer}'s outfits`} onClick={async () => { setBusy(true); try { await sharePdfOnWhatsApp(make, pdfFileName(wearer), text, phone); } finally { setBusy(false); } }}><MessageCircle className="size-4" /> WhatsApp</Button>
  </>;
}

/** Quick note for one wearer's look; saves only that look against the latest order version. */
export function WearerNoteButton({ inviteId, orderId, item, wearer, disabled }: { inviteId: string; orderId: string; item: OrderItem; wearer: string; disabled?: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false); const [note, setNote] = useState(""); const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      const current = await supabase.from("wardrobe_orders").select("items, updated_at").eq("id", orderId).eq("invite_id", inviteId).single();
      if (current.error) throw current.error;
      const next = setWearerNote(current.data.items as unknown as OrderItem[], item.reservationId, note);
      const saved = await supabase.from("wardrobe_orders").update({ items: next as unknown as Json }).eq("id", orderId).eq("invite_id", inviteId).eq("updated_at", current.data.updated_at).select("id").maybeSingle();
      if (saved.error) throw saved.error;
      if (!saved.data) throw new Error("The order changed while saving. Try again");
      await qc.invalidateQueries({ queryKey: ["wardrobe-orders"] });
      toast.success(`Note saved for ${wearer}`); setOpen(false);
    } catch (e) { toast.error(e && typeof e === "object" && "message" in e ? String(e.message) : "Couldn't save the note"); } finally { setBusy(false); }
  }
  return <>
    <Button size="sm" variant="outline" disabled={disabled} aria-label={`${item.wearerNote ? "Edit wearer note" : "Add wearer note"} for ${wearer} — ${item.event}`} onClick={() => { setNote(item.wearerNote ?? ""); setOpen(true); }}><StickyNote className="size-4" /> {item.wearerNote ? "Edit note" : "Add note"}</Button>
    <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}><DialogContent className="sm:max-w-md">
      <DialogHeader><DialogTitle className="pr-8 text-base leading-snug sm:text-lg">Wearer note<span className="block text-sm font-normal text-muted-foreground">Shown to guest and printed in PDFs</span></DialogTitle></DialogHeader>
      <div className="min-w-0 space-y-0.5 rounded-md bg-muted/50 p-2 text-sm"><p className="break-words font-medium">{wearer}</p><p className="break-words text-xs text-muted-foreground">{item.event} · {item.alternative?.title || item.title}</p></div>
      <Textarea aria-label={`Wearer note for ${wearer} — ${item.event}`} rows={4} value={note} placeholder="e.g. It's a suit — please carry your own white shirt" onChange={(e) => setNote(e.target.value)} />
      <div className="flex flex-wrap justify-end gap-2"><Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button><Button disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save note"}</Button></div>
    </DialogContent></Dialog>
  </>;
}

/** Shipment details (dates, courier, tracking) for one or more looks of one order; saves only those looks against the latest version. */
export function ShipmentButton({ inviteId, orderId, items, label, compact }: { inviteId: string; orderId: string; items: OrderItem[]; label: string; compact?: boolean }) {
  const qc = useQueryClient();
  const first = items[0];
  const blank = { expectedDelivery: first?.expectedDelivery ?? "", arrivedOn: first?.arrivedOn ?? "", tracking: first?.tracking ?? "", courierName: first?.courierName ?? "", trackingUrl: first?.trackingUrl ?? "" };
  const [open, setOpen] = useState(false); const [s, setS] = useState(blank); const [busy, setBusy] = useState(false);
  const recorded = items.some((i) => i.arrivedOn || i.expectedDelivery || i.tracking || i.courierName);
  async function save() {
    if (!Object.values(s).some((v) => v.trim()) && !recorded) { toast.error("Enter at least one shipment detail. If a date won't take, pick it from the calendar"); return; }
    setBusy(true);
    try {
      const current = await supabase.from("wardrobe_orders").select("items, updated_at").eq("id", orderId).eq("invite_id", inviteId).single();
      if (current.error) throw current.error;
      const next = setShipment(current.data.items as unknown as OrderItem[], items.map((i) => i.reservationId), s);
      const saved = await supabase.from("wardrobe_orders").update({ items: next as unknown as Json }).eq("id", orderId).eq("invite_id", inviteId).eq("updated_at", current.data.updated_at).select("id").maybeSingle();
      if (saved.error) throw saved.error;
      if (!saved.data) throw new Error("The order changed while saving. Try again");
      await qc.invalidateQueries({ queryKey: ["wardrobe-orders"] });
      toast.success(`Shipment saved for ${label}`, { description: shipmentSummary(s) || "Details cleared" }); setOpen(false);
    } catch (e) { toast.error(e && typeof e === "object" && "message" in e ? String(e.message) : "Couldn't save shipment"); } finally { setBusy(false); }
  }
  const f = (k: keyof typeof s) => (e: React.ChangeEvent<HTMLInputElement>) => setS((p) => ({ ...p, [k]: e.target.value }));
  return <>
    <Button size="sm" variant={compact ? "ghost" : "outline"} className={compact ? "h-7 shrink-0 px-2 text-xs" : undefined} disabled={!items.length} aria-label={`Shipment for ${label}`} onClick={() => { setS(blank); setOpen(true); }}><Truck className="size-4" /> {first?.arrivedOn ? "Arrived" : recorded ? "Shipment" : "Add shipment"}</Button>
    <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
      <DialogHeader><DialogTitle className="pr-8 text-base leading-snug sm:text-lg">Shipment<span className="block text-sm font-normal text-muted-foreground">Private — host only</span></DialogTitle></DialogHeader>
      <div className="min-w-0 rounded-md bg-muted/50 p-2 text-sm"><p className="break-words font-medium">{label}</p>{items.length > 1 ? <p className="text-xs text-muted-foreground">Applies to all {items.length} looks in this order</p> : <p className="break-words text-xs text-muted-foreground">{first?.event} · {first?.alternative?.title || first?.title}</p>}</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Estimated delivery<Input type="date" value={s.expectedDelivery} onChange={f("expectedDelivery")} /></label>
        <label className="text-sm">Arrived on<div className="flex gap-1"><Input type="date" value={s.arrivedOn} onChange={f("arrivedOn")} /><Button type="button" size="sm" variant="outline" className="h-10 shrink-0" onClick={() => setS((p) => ({ ...p, arrivedOn: new Date().toISOString().slice(0, 10) }))}>Today</Button></div></label>
        <label className="text-sm">Courier company<Input value={s.courierName} placeholder="e.g. DHL, Blue Dart" onChange={f("courierName")} /></label>
        <label className="text-sm">Tracking reference<Input value={s.tracking} placeholder="AWB / consignment no." onChange={f("tracking")} /></label>
        <label className="text-sm sm:col-span-2">Tracking link<Input type="url" value={s.trackingUrl} placeholder="https://…" onChange={f("trackingUrl")} /></label>
      </div>
      <div className="flex flex-wrap justify-end gap-2"><Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button><Button disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save shipment"}</Button></div>
    </DialogContent></Dialog>
  </>;
}

const fmtDate = (d?: string) => d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "";
export function shipmentSummary(i: { expectedDelivery?: string; arrivedOn?: string; tracking?: string; courierName?: string }) {
  return [i.arrivedOn ? `Arrived ${fmtDate(i.arrivedOn)}` : i.expectedDelivery ? `Expected ${fmtDate(i.expectedDelivery)}` : "", i.courierName, i.tracking].filter(Boolean).join(" · ");
}
/** Saved shipment details on an order card; host-only. */
export function ShipmentLine({ item }: { item: OrderItem }) {
  const text = shipmentSummary(item);
  if (!text && !item.trackingUrl) return null;
  return <p className="break-words text-xs"><Truck className="mr-1 inline size-3.5 text-muted-foreground" />{text}{item.trackingUrl ? <> · <a className="text-primary underline-offset-2 hover:underline" href={item.trackingUrl} target="_blank" rel="noreferrer">Track</a></> : null}</p>;
}
