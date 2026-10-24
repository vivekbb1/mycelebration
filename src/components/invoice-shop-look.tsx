import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { fetchPerniaLook, importPerniaLooks, type PerniaLook } from "@/lib/pernia.functions";
import { validateInvoiceShopModel } from "@/lib/vendor-invoice";

export function InvoiceShopLook({ inviteId, sku, onFetched }: { inviteId: string; sku: string; onFetched: (look: PerniaLook) => void }) {
  const [url, setUrl] = useState("");
  const [look, setLook] = useState<PerniaLook | null>(null);
  const [eventId, setEventId] = useState("");
  const [busy, setBusy] = useState(false);
  const fetchLook = useServerFn(fetchPerniaLook);
  const importLooks = useServerFn(importPerniaLooks);
  const qc = useQueryClient();
  const events = useQuery({ queryKey: ["invoice-events", inviteId], queryFn: async () => {
    const result = await supabase.from("events").select("id,name").eq("invite_id", inviteId).eq("outfit_selection", true).order("name");
    if (result.error) throw result.error;
    return result.data;
  }});
  async function fetch() {
    setBusy(true); setLook(null);
    try {
      const result = await fetchLook({ data: { url: url.trim() } });
      validateInvoiceShopModel(sku, result.sku);
      setLook(result); onFetched(result);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not fetch this outfit"); }
    finally { setBusy(false); }
  }
  async function add() {
    if (!look || !eventId) return;
    setBusy(true);
    try {
      const existing = await supabase.from("outfits").select("id,event_id,retired_at").eq("invite_id", inviteId).eq("boutique_url", look.url);
      if (existing.error) throw existing.error;
      if (existing.data.length && !existing.data.some(o => o.event_id === eventId && !o.retired_at)) throw new Error("This look already belongs to another event or is retired. Check Wardrobe before assigning it.");
      const result = await importLooks({ data: { inviteId, eventId, slugs: [look.slug] } });
      if (result.failed) throw new Error("Could not add this outfit. Please try again.");
      await qc.invalidateQueries();
      toast.success(result.imported ? "Outfit and photos added to the event wardrobe" : "Outfit is already in this event's wardrobe");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not add outfit"); }
    finally { setBusy(false); }
  }
  return <div className="space-y-2">
    <div className="flex gap-2"><Input aria-label={`Pernia link for ${sku}`} type="url" placeholder="Pernia product link" value={url} onChange={e => setUrl(e.target.value)} /><Button variant="outline" disabled={busy || !url.trim()} onClick={() => void fetch()}><Link2 className="size-4" />Fetch</Button></div>
    {look ? <div className="flex flex-wrap items-center gap-3">
      {look.images[0] ? <img src={look.images[0]} alt={look.title} className="h-24 w-18 rounded object-cover" /> : null}
      <div className="min-w-0 flex-1"><a href={look.url} target="_blank" rel="noreferrer" className="text-sm underline">{look.title}</a><p className="text-xs text-muted-foreground">{look.sku} · {look.designer}</p></div>
      <select aria-label={`Wardrobe event for ${sku}`} className="field-select max-w-full" value={eventId} onChange={e => setEventId(e.target.value)}><option value="">Choose event</option>{events.data?.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
      <Button variant="outline" size="sm" disabled={busy || !eventId} onClick={() => void add()}><Plus className="size-4" />Add to wardrobe</Button>
    </div> : null}
    {events.isError ? <p className="text-xs text-destructive">Could not load wardrobe events.</p> : null}
  </div>;
}