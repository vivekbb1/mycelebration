import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Rss, Trash2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { importFeedPage } from "@/lib/feed.functions";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LiveFeed } from "@/components/live-feed";
import { PERNIA_COLOURS, PERNIA_SHIP_TIMES } from "@/lib/pernia.functions";

const CATEGORIES: Record<string, { path: string; label: string }[]> = {
  women: [
    { path: "clothing/lehenga", label: "Lehengas" },
    { path: "clothing/lehenga/bridesmaid", label: "Lehengas — bridesmaid" },
    { path: "clothing/saree", label: "Sarees" },
    { path: "clothing/saree/pre-stitched-saree", label: "Sarees — pre-stitched" },
    { path: "clothing/anarkali", label: "Anarkalis" },
    { path: "clothing/sharara-sets", label: "Sharara sets" },
    { path: "clothing/kurta-sets-salwar-kameez", label: "Kurta sets" },
    { path: "clothing/gown", label: "Gowns" },
    { path: "clothing/kaftan", label: "Kaftans" },
  ],
  men: [
    { path: "mens-shop/sherwani", label: "Sherwanis" },
    { path: "mens-shop/bandhgala", label: "Bandhgalas" },
    { path: "mens-shop/jodhpuri-suit", label: "Jodhpuri suits" },
    { path: "mens-shop/indowestern", label: "Indo-western" },
    { path: "mens-shop/nehru-jacket", label: "Nehru jackets" },
    { path: "mens-shop/kurta-set", label: "Kurta sets" },
    { path: "mens-shop/kurtas", label: "Kurtas" },
    { path: "mens-shop/suits", label: "Suits" },
    { path: "mens-shop/tuxedo", label: "Tuxedos" },
  ],
  kids: [],
};

const AUD_LABEL: Record<string, string> = { women: "Women's", men: "Men's", kids: "Children's" };

/** Saved shop filters per event and audience, feeding the guests' lookbook live. */
export function HostFeeds() {
  const queryClient = useQueryClient();
  const [eventId, setEventId] = useState("");
  const [audience, setAudience] = useState("women");
  const [category, setCategory] = useState("clothing/lehenga");
  const [customPath, setCustomPath] = useState("");
  const [minPrice, setMinPrice] = useState("0");
  const [maxPrice, setMaxPrice] = useState("50000");
  const [colour, setColour] = useState("");
  const [shipIn, setShipIn] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  const events = useQuery({
    queryKey: ["feed-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, name, event_date, outfit_selection")
        .order("sort_order");
      if (error) throw error;
      return data.filter((e) => e.outfit_selection !== false);
    },
  });

  const feeds = useQuery({
    queryKey: ["outfit-feeds"],
    queryFn: async () => {
      const { data, error } = await supabase.from("outfit_feeds").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const eventName = (id: string) => events.data?.find((e) => e.id === id)?.name ?? "Event";
  const catLabel = (p: string) =>
    Object.values(CATEGORIES).flat().find((c) => c.path === p)?.label ?? p;

  const add = async () => {
    if (!eventId) { toast.error("Choose the event first."); return; }
    const path = (category === "custom" ? customPath : category).trim().replace(/^\/+|\/+$/g, "");
    if (!/^[a-z0-9\-]+(\/[a-z0-9\-]+){0,2}$/.test(path)) {
      { toast.error("That category path doesn't look right, e.g. clothing/lehenga"); return; }
    }
    setBusy(true);
    const { error } = await supabase.from("outfit_feeds").insert({
      event_id: eventId,
      audience,
      category: path,
      min_price: Math.max(0, Number(minPrice) || 0),
      max_price: Math.max(1, Number(maxPrice) || 50000),
      colour: colour || null,
      ship_in_days: shipIn || null,
      ready_to_ship: ready,
      sort_order: (feeds.data?.length ?? 0) + 1,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Feed saved — guests see these looks now.");
    await queryClient.invalidateQueries({ queryKey: ["outfit-feeds"] });
  };

  const importPage = useServerFn(importFeedPage);
  const [importing, setImporting] = useState<string | null>(null);
  const [progress, setProgress] = useState("");

  const importAll = async (id: string) => {
    setImporting(id);
    let total = 0;
    let skipped = 0;
    let failed = 0;
    try {
      for (let page = 1; page <= 50; page += 1) {
        setProgress(`Importing… ${total} saved so far`);
        const res = await importPage({ data: { feedId: id, page } });
        total += res.imported;
        skipped += res.skipped;
        failed += res.failed;
        if (!res.more) break;
      }
      toast.success(
        `${total} looks saved to your wardrobe${skipped ? `, ${skipped} already there` : ""}${failed ? `, ${failed} failed` : ""}.`,
      );
      await queryClient.invalidateQueries({ queryKey: ["outfits"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import stopped.");
    } finally {
      setImporting(null);
      setProgress("");
    }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("outfit_feeds").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    await queryClient.invalidateQueries({ queryKey: ["outfit-feeds"] });
  };

  const forEvent = (feeds.data ?? []).filter((f) => !eventId || f.event_id === eventId);

  return (
    <div className="grid gap-6">
      <section className="panel p-4 sm:p-6">
        <h2 className="flex items-center gap-2 text-xl">
          <Rss className="size-4 text-primary" /> Live feeds
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Save a shop category with your filters for an event. Guests browse the shop's current
          looks straight away — no importing. A look is only added to your wardrobe when a guest
          claims it. Guests never see prices or the shop.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="f-event">Event</Label>
            <select id="f-event" className="field-select" value={eventId} onChange={(e) => setEventId(e.target.value)}>
              <option value="">Choose an event</option>
              {(events.data ?? []).map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                  {e.event_date ? ` — ${e.event_date}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="f-aud">For</Label>
            <select
              id="f-aud"
              className="field-select"
              value={audience}
              onChange={(e) => {
                const a = e.target.value;
                setAudience(a);
                setCategory(CATEGORIES[a]?.[0]?.path ?? "custom");
              }}
            >
              <option value="women">Women's</option>
              <option value="men">Men's</option>
              <option value="kids">Children's</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="f-cat">Category</Label>
            <select id="f-cat" className="field-select" value={category} onChange={(e) => setCategory(e.target.value)}>
              {(CATEGORIES[audience] ?? []).map((c) => (
                <option key={c.path} value={c.path}>
                  {c.label}
                </option>
              ))}
              <option value="custom">Other — type the shop's category</option>
            </select>
          </div>
          {category === "custom" ? (
            <div className="space-y-2 sm:col-span-2 lg:col-span-3">
              <Label htmlFor="f-path">Shop category (from its web address)</Label>
              <Input
                id="f-path"
                placeholder="kids/girls"
                value={customPath}
                onChange={(e) => setCustomPath(e.target.value)}
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="f-min">Lowest price (₹)</Label>
            <Input id="f-min" inputMode="numeric" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="f-max">Highest price (₹)</Label>
            <Input id="f-max" inputMode="numeric" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="f-col">Colour</Label>
            <select id="f-col" className="field-select" value={colour} onChange={(e) => setColour(e.target.value)}>
              <option value="">Any colour</option>
              {PERNIA_COLOURS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="f-ship">Ships within</Label>
            <select id="f-ship" className="field-select" value={shipIn} onChange={(e) => setShipIn(e.target.value)}>
              <option value="">Any time</option>
              {PERNIA_SHIP_TIMES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" checked={ready} onChange={(e) => setReady(e.target.checked)} />
            Ready to ship only
          </label>
        </div>

        <Button className="mt-4" onClick={add} disabled={busy}>
          {busy ? "Saving…" : "Save feed"}
        </Button>

        <ul className="mt-6 divide-y divide-border">
          {forEvent.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <span className="min-w-0">
                <span className="text-foreground">{eventName(f.event_id)}</span> ·{" "}
                {AUD_LABEL[f.audience]} · {catLabel(f.category)} · ₹{f.min_price.toLocaleString()}–₹
                {f.max_price.toLocaleString()}
                {f.colour ? ` · ${PERNIA_COLOURS.find((c) => c.value === f.colour)?.label}` : ""}
                {f.ship_in_days ? ` · ${PERNIA_SHIP_TIMES.find((s) => s.value === f.ship_in_days)?.label}` : ""}
                {f.ready_to_ship ? " · ready to ship" : ""}
              </span>
              <span className="flex items-center gap-1">
              <Button size="sm" variant="outline" disabled={importing !== null} onClick={() => importAll(f.id)}>
                <Download className="size-4" />
                {importing === f.id ? progress : "Import this feed now"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => remove(f.id)} aria-label="Remove feed">
                <Trash2 className="size-4" />
              </Button>
              </span>
            </li>
          ))}
          {forEvent.length === 0 ? (
            <li className="py-3 text-sm text-muted-foreground">No feeds saved{eventId ? " for this event" : ""} yet.</li>
          ) : null}
        </ul>
      </section>

      {eventId ? (
        <section className="panel p-4 sm:p-6">
          <p className="text-sm text-muted-foreground">
            What guests see for {eventName(eventId)}. Hide any look you don't want offered.
          </p>
          <LiveFeed eventId={eventId} defaultAudience={audience} mode="host" />
        </section>
      ) : null}
    </div>
  );
}
