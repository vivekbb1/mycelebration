import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileDown, MessageCircle, StickyNote } from "lucide-react";
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
export function IndividualShare({ wearer, celebration, lines, phone }: { wearer: string; celebration: string; lines: FamilyLookLine[]; phone?: string }) {
  const [busy, setBusy] = useState(false);
  const make = () => buildFamilyLooksPdf(wearer, celebration, lines);
  const text = `Hello ${wearer}, please find attached the outfits ordered for you for ${celebration}, with notes on anything to carry. Kindly check each look and size and let us know of any last-minute changes.`;
  return <>
    <Button size="sm" variant="outline" disabled={busy || !lines.length} onClick={async () => { setBusy(true); try { saveBlob(await make(), pdfFileName(wearer)); } catch { toast.error("Couldn't create the PDF"); } finally { setBusy(false); } }}><FileDown className="size-4" /> Individual PDF</Button>
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
    <Button size="sm" variant="outline" disabled={disabled} onClick={() => { setNote(item.wearerNote ?? ""); setOpen(true); }}><StickyNote className="size-4" /> {item.wearerNote ? "Edit wearer note" : "Add wearer note"}</Button>
    <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}><DialogContent className="sm:max-w-md">
      <DialogHeader><DialogTitle>Note for {wearer} · {item.event}</DialogTitle></DialogHeader>
      <p className="text-sm text-muted-foreground">{item.alternative?.title || item.title}. Shown to {wearer} and printed in the family and individual PDFs.</p>
      <Textarea aria-label={`Wearer note for ${wearer} — ${item.event}`} rows={4} value={note} placeholder="e.g. It's a suit — please carry your own white shirt" onChange={(e) => setNote(e.target.value)} />
      <div className="flex flex-wrap justify-end gap-2"><Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button><Button disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save note"}</Button></div>
    </DialogContent></Dialog>
  </>;
}
