import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useSelectedEvent } from "@/lib/selected-event";
import { KORA_COLLECTIONS, fetchKoraLook, importKoraLooks, searchKoraCollection, type KoraLook } from "@/lib/kora.functions";

export function HostKoraImport() {
  const qc = useQueryClient();
  const { inviteId } = useSelectedEvent();
  const search = useServerFn(searchKoraCollection);
  const fetchOne = useServerFn(fetchKoraLook);
  const importMany = useServerFn(importKoraLooks);

  const [collection, setCollection] = useState<string>(KORA_COLLECTIONS[0].handle);
  const [minPrice, setMinPrice] = useState("0");
  const [maxPrice, setMaxPrice] = useState("100000");
  const [query, setQuery] = useState("");
  const [inStock, setInStock] = useState(true);
  const [page, setPage] = useState(1);
  const [eventId, setEventId] = useState("");
  const [gender, setGender] = useState("men");
  const [link, setLink] = useState("");
  const [results, setResults] = useState<KoraLook[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const events = useQuery({
    queryKey: ["events", "kora", inviteId],
    enabled: Boolean(inviteId),
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("id, name").eq("invite_id", inviteId!).order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const run = async (p: number) => {
    setBusy(true);
    try {
      const r = await search({ data: { inviteId, collection, page: p, minPrice: Number(minPrice), maxPrice: Number(maxPrice), query, inStock } });
      setResults(r.looks);
      setHasMore(r.hasMore);
      setPage(p);
      setPicked([]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doImport = async (handles: string[]) => {
    if (!handles.length) return;
    setBusy(true);
    try {
      const r = await importMany({ data: { inviteId, handles, eventId: eventId || null, gender } });
      toast.success(`Added ${r.imported} · already there ${r.skipped}${r.failed ? ` · failed ${r.failed}` : ""}`);
      setPicked([]);
      await qc.invalidateQueries({ queryKey: ["outfits"] });
      await qc.invalidateQueries({ queryKey: ["boutiques"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const addLink = async () => {
    setBusy(true);
    try {
      const look = await fetchOne({ data: { inviteId, url: link } });
      setBusy(false);
      await doImport([look.handle]);
      setLink("");
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  };

  const select = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

  return (
    <section className="space-y-5 rounded-lg border border-border bg-card p-5">
      <div>
        <h3 className="text-lg">Import from Kora</h3>
        <p className="text-sm text-muted-foreground">Menswear from koranm.com. Looks are saved under the Kora atelier.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Event</Label>
          <select className={select} value={eventId} onChange={(e) => setEventId(e.target.value)}>
            <option value="">No event</option>
            {events.data?.map((ev) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
          </select>
        </div>
        <div>
          <Label>For</Label>
          <select className={select} value={gender} onChange={(e) => setGender(e.target.value)}>
            <option value="men">Men</option>
            <option value="boy">Boys</option>
          </select>
        </div>
      </div>

      <div className="flex gap-2">
        <Input placeholder="Paste a Kora product link" value={link} onChange={(e) => setLink(e.target.value)} />
        <Button disabled={busy || !link.trim()} onClick={addLink}>Add look</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-5">
        <div className="sm:col-span-2">
          <Label>Collection</Label>
          <select className={select} value={collection} onChange={(e) => setCollection(e.target.value)}>
            {KORA_COLLECTIONS.map((c) => <option key={c.handle} value={c.handle}>{c.label}</option>)}
          </select>
        </div>
        <div><Label>Min ₹</Label><Input inputMode="numeric" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} /></div>
        <div><Label>Max ₹</Label><Input inputMode="numeric" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} /></div>
        <div><Label>Colour or word</Label><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. ivory" /></div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={inStock} onCheckedChange={(v) => setInStock(Boolean(v))} /> In stock only
        </label>
        <Button disabled={busy || !inviteId} onClick={() => run(1)}>Search Kora</Button>
      </div>

      {results && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>{results.length} looks on page {page}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPicked(results.map((l) => l.handle))}>Select all</Button>
              <Button size="sm" disabled={busy || !picked.length} onClick={() => doImport(picked)}>Add {picked.length} selected</Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {results.map((l) => {
              const on = picked.includes(l.handle);
              return (
                <button
                  key={l.handle}
                  type="button"
                  onClick={() => setPicked((p) => (on ? p.filter((h) => h !== l.handle) : [...p, l.handle]))}
                  className={`overflow-hidden rounded-md border text-left ${on ? "border-primary ring-2 ring-primary" : "border-border"}`}
                >
                  {l.images[0] && <img src={`${l.images[0]}?width=400`} alt={l.title} loading="lazy" className="aspect-[3/4] w-full object-cover" />}
                  <div className="p-2 text-xs">
                    <p className="line-clamp-2 font-medium">{l.title}</p>
                    <p className="text-muted-foreground">₹{l.priceInr.toLocaleString("en-IN")}{l.soldOut ? " · sold out" : ""}</p>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex justify-center gap-2">
            <Button variant="outline" size="sm" disabled={busy || page <= 1} onClick={() => run(page - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={busy || !hasMore} onClick={() => run(page + 1)}>Next</Button>
          </div>
        </>
      )}
    </section>
  );
}
