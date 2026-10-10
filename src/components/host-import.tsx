import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Search, Link2, Download } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import {
  fetchPerniaLook,
  importPerniaLooks,
  searchPerniaCategory,
  PERNIA_COLOURS,
  PERNIA_SHIP_TIMES,
  type PerniaLook,
} from "@/lib/pernia.functions";
import {
  cancelOutfitImport,
  listOutfitImports,
  startOutfitImport,
} from "@/lib/outfit-import.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSelectedEvent } from "@/lib/selected-event";

// The shop keeps womenswear and menswear in separate sections with their own
// category names, so each list is offered on its own.
const WOMEN_CATEGORIES = [
  { path: "clothing/lehenga", label: "Lehengas" },
  { path: "clothing/lehenga/bridal", label: "Lehengas — bridal" },
  { path: "clothing/lehenga/bridesmaid", label: "Lehengas — bridesmaid" },
  { path: "clothing/lehenga/traditional", label: "Lehengas — traditional" },
  { path: "clothing/lehenga/printed-lehenga", label: "Lehengas — printed" },
  { path: "clothing/saree", label: "Sarees" },
  { path: "clothing/saree/embroidered", label: "Sarees — embroidered" },
  { path: "clothing/saree/pre-stitched-saree", label: "Sarees — pre-stitched" },
  { path: "clothing/anarkali", label: "Anarkalis" },
  { path: "clothing/sharara-sets", label: "Sharara sets" },
  { path: "clothing/kurta-sets-salwar-kameez", label: "Kurta sets / salwar kameez" },
  { path: "clothing/gown", label: "Gowns" },
  { path: "clothing/kaftan", label: "Kaftans" },
];

const MEN_CATEGORIES = [
  { path: "mens-shop/sherwani", label: "Sherwanis" },
  { path: "mens-shop/bandhgala", label: "Bandhgalas" },
  { path: "mens-shop/jodhpuri-suit", label: "Jodhpuri suits" },
  { path: "mens-shop/indowestern", label: "Indo-western" },
  { path: "mens-shop/nehru-jacket", label: "Nehru jackets" },
  { path: "mens-shop/jackets", label: "Jackets" },
  { path: "mens-shop/waist-coat", label: "Waistcoats" },
  { path: "mens-shop/kurta-set", label: "Kurta sets" },
  { path: "mens-shop/kurta-pajama", label: "Kurta pyjamas" },
  { path: "mens-shop/kurtas", label: "Kurtas" },
  { path: "mens-shop/angrakha", label: "Angrakhas" },
  { path: "mens-shop/suit-set", label: "Suit sets" },
  { path: "mens-shop/suits", label: "Suits" },
  { path: "mens-shop/tuxedo", label: "Tuxedos" },
  { path: "mens-shop/ethnic", label: "Everything ethnic" },
  { path: "mens-shop/mens-dupatta", label: "Dupattas & stoles" },
];

type ListLook = {
  sku: string;
  slug: string;
  url: string;
  title: string;
  designer: string;
  price: string;
  images: string[];
  garmentType: string | null;
  soldOut: boolean;
};

export function HostImport() {
  const queryClient = useQueryClient();
  const fetchLook = useServerFn(fetchPerniaLook);
  const searchCategory = useServerFn(searchPerniaCategory);
  const importLooks = useServerFn(importPerniaLooks);

  const [eventId, setEventId] = useState("");
  const [boutiqueId, setBoutiqueId] = useState("");
  const [gender, setGender] = useState("auto");

  const [url, setUrl] = useState("");
  const [single, setSingle] = useState<PerniaLook | null>(null);
  const [singleBusy, setSingleBusy] = useState(false);

  const [category, setCategory] = useState("clothing/lehenga");

  // Choosing a menswear category also sets who the looks are for, so a host
  // never has to remember the "For" box.
  const chooseCategory = (path: string) => {
    setCategory(path);
    setPage(1);
    setResults(null);
    setPicked([]);
    setGender(path.startsWith("mens-shop/") ? "men" : "women");
  };
  const [minPrice, setMinPrice] = useState("0");
  const [maxPrice, setMaxPrice] = useState("30000");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState("12");
  const [readyToShip, setReadyToShip] = useState(false);
  const [shipTimes, setShipTimes] = useState<string[]>([]);
  const [colour, setColour] = useState("all");
  const [sort, setSort] = useState("listed");
  const [results, setResults] = useState<ListLook[] | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [importedTotal, setImportedTotal] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [listBusy, setListBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);

  // Everything already in the wardrobe, traced by shop link and SKU, so
  // duplicates are hidden from the results and never picked twice.
  const { inviteId } = useSelectedEvent();
  const scope = inviteId ? { invite_id: inviteId } : {};
  const owned = useQuery({
    queryKey: ["wardrobe-owned-links", inviteId],
    queryFn: async () => {
      const links = new Set<string>();
      const skus = new Set<string>();
      for (let from = 0; from < 20000; from += 1000) {
        const { data, error } = await supabase
          .from("outfits")
          .select("boutique_url, source_sku")
          .match(scope)
          .range(from, from + 999);
        if (error) throw error;
        for (const r of data) {
          if (r.boutique_url) links.add((r.boutique_url.split("?")[0] ?? "").replace(/^https?:\/\/[^/]+\//, ""));
          if (r.source_sku) skus.add(r.source_sku);
        }
        if (data.length < 1000) break;
      }
      return { links, skus };
    },
  });
  const isOwned = (l: { slug: string; sku?: string }) =>
    Boolean(owned.data?.links.has(l.slug) || (l.sku && owned.data?.skus.has(l.sku)));
  const shown = (results ?? []).filter((l) => !isOwned(l));
  const hiddenCount = (results?.length ?? 0) - shown.length;

  const events = useQuery({
    queryKey: ["events", "import", inviteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, name, sort_order")
        .match(scope)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const boutiques = useQuery({
    queryKey: ["boutiques", inviteId],
    queryFn: async () => {
      let q = supabase.from("boutiques").select("id, name").order("name");
      if (inviteId) {
        const links = await supabase.from("boutique_celebrations").select("boutique_id").eq("invite_id", inviteId);
        if (links.error) throw links.error;
        q = q.in("id", (links.data ?? []).map((l) => l.boutique_id));
      }
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const pageLinks: (number | null)[] = (() => {
    if (totalPages <= 9) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const out: (number | null)[] = [1];
    const from = Math.max(2, page - 2);
    const to = Math.min(totalPages - 1, page + 2);
    if (from > 2) out.push(null);
    for (let n = from; n <= to; n += 1) out.push(n);
    if (to < totalPages - 1) out.push(null);
    out.push(totalPages);
    return out;
  })();

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["outfits"] });
  };

  const searchPayload = (p: number, per: number) => ({
    category,
    minPrice: Number(minPrice) || 0,
    maxPrice: Number(maxPrice) || 30000,
    page: p,
    perPage: per,
    readyToShip,
    shipInDays: shipTimes.length ? shipTimes : null,
    colour: colour === "all" ? null : colour,
    sort,
  });

  const runSearch = async (nextPage = 1) => {
    setListBusy(true);
    try {
      const res = await searchCategory({
        data: searchPayload(nextPage, Number(perPage) || 12),
      });
      setResults(res.looks);
      setTotal(res.total);
      setTotalPages(res.totalPages);
      setPage(res.page);
      // Keep picks while paging; a fresh search starts over.
      if (nextPage === 1) setPicked([]);
      if (res.looks.length === 0) toast.info("No looks in that price range — widen it a little.");
    } catch {
      toast.error("Pernia's didn't answer just now. Try again in a moment.");
    } finally {
      setListBusy(false);
    }
  };

  const [allBusy, setAllBusy] = useState(false);
  const SELECT_ALL_CAP = 1000;
  const selectAllPages = async () => {
    setAllBusy(true);
    try {
      const per = 48;
      const pages = Math.min(200, Math.ceil(Math.min(total, SELECT_ALL_CAP) / per));
      const slugs = new Set<string>(picked);
      for (let p = 1; p <= pages; p += 1) {
        const res = await searchCategory({ data: searchPayload(p, per) });
        res.looks.forEach((l) => {
          if (!isOwned(l)) slugs.add(l.slug);
        });
        if (res.looks.length < per) break;
      }
      const list = [...slugs].slice(0, SELECT_ALL_CAP);
      setPicked(list);
      toast.success(
        total > SELECT_ALL_CAP
          ? `Picked the first ${list.length.toLocaleString()} looks — narrow the filters to reach the rest.`
          : `Picked all ${list.length.toLocaleString()} looks.`,
      );
    } catch {
      toast.error("Pernia's didn't answer just now. Try again in a moment.");
    } finally {
      setAllBusy(false);
    }
  };

  const importProgress: string | null = null;
  void importLooks;
  const startImport = useServerFn(startOutfitImport);
  const listImports = useServerFn(listOutfitImports);
  const cancelImport = useServerFn(cancelOutfitImport);
  const jobs = useQuery({
    queryKey: ["outfit-import-jobs", inviteId],
    queryFn: () => listImports({ data: { inviteId: inviteId || null } }),
    refetchInterval: (q) =>
      (q.state.data ?? []).some((j) => j.status === "running") ? 4000 : false,
  });
  const running = (jobs.data ?? []).filter((j) => j.status === "running");
  const [seenDone, setSeenDone] = useState(0);
  const doneTotal = (jobs.data ?? []).reduce((n, j) => n + j.imported, 0);
  if (doneTotal !== seenDone) {
    setSeenDone(doneTotal);
    void refresh();
    void owned.refetch();
  }

  // Looks are queued and added on our side, so the browser can be closed.
  const saveSelection = async (slugs: string[]) => {
    if (!slugs.length) return;
    setImportBusy(true);
    try {
      const res = await startImport({
        data: {
          slugs,
          inviteId: inviteId || null,
          eventId: eventId || null,
          boutiqueId: boutiqueId || null,
          gender: gender === "auto" ? null : gender,
        },
      });
      toast.success(
        `Adding ${res.total} looks in the background. You can close this page — they'll keep coming in.`,
      );
      setPicked([]);
      await jobs.refetch();
    } catch {
      toast.error("We couldn't start adding those looks. Please try again.");
    } finally {
      setImportBusy(false);
    }
  };

  const finished = (jobs.data ?? []).filter((j) => j.status !== "running" && j.imported > 0);
  const jobsPanel = running.length || finished.length ? (
    <div className="panel space-y-2 p-4">
      {running.map((j) => {
        const done = j.imported + j.skipped + j.failed;
        const pct = j.total ? Math.round((done / j.total) * 100) : 0;
        return (
          <div key={j.id} className="space-y-1 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>Adding looks in the background · {j.imported} added so far</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await cancelImport({ data: { id: j.id } });
                  void jobs.refetch();
                }}
              >
                Stop
              </Button>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded bg-muted">
              <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
      {running.length ? (
        <p className="text-xs text-muted-foreground">This carries on even if you close the page.</p>
      ) : null}
      {finished.length ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">Import log ({finished.length})</summary>
          <ul className="mt-2 space-y-1">
            {finished.map((j) => (
              <li key={j.id} className="flex justify-between gap-3 text-xs text-muted-foreground">
                <span>
                  {new Date(j.finished_at ?? j.created_at).toLocaleString("en-GB", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span>
                  {j.imported} {j.imported === 1 ? "look" : "looks"} added
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  ) : null;

  return (
    <div className="space-y-8">
      <section className="panel p-4 sm:p-6">
        <h2 className="text-xl">Where should imported looks go?</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Applied to everything you add below. You can change it per look afterwards in Outfits.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Event</Label>
            <Select value={eventId} onValueChange={setEventId}>
              <SelectTrigger>
                <SelectValue placeholder="Leave unassigned" />
              </SelectTrigger>
              <SelectContent>
                {(events.data ?? []).map((ev) => (
                  <SelectItem key={ev.id} value={ev.id}>
                    {ev.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Boutique / atelier</Label>
            <Select value={boutiqueId} onValueChange={setBoutiqueId}>
              <SelectTrigger>
                <SelectValue placeholder="Leave unassigned" />
              </SelectTrigger>
              <SelectContent>
                {(boutiques.data ?? []).map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>For</Label>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">As the shop lists it</SelectItem>
                <SelectItem value="women">Women</SelectItem>
                <SelectItem value="men">Men</SelectItem>
                <SelectItem value="unisex">Anyone</SelectItem>
                <SelectItem value="boy">Boy</SelectItem>
                <SelectItem value="girl">Girl</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Guests only see the wardrobe that matches them, so set this when the shop guesses
              wrong.
            </p>
          </div>
        </div>
      </section>

      <section className="panel p-4 sm:p-6">
        <h2 className="text-xl">Add one look from its link</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Paste the outfit's page link — the name, designer, colour, fabric details, price and all of
          its photos come across automatically.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.perniaspopupshop.com/…-lehenga-set-tsbg082606.html"
            className="min-w-[260px] flex-1"
          />
          <Button
            variant="outline"
            disabled={singleBusy || !url.trim()}
            onClick={async () => {
              setSingleBusy(true);
              setSingle(null);
              try {
                setSingle(await fetchLook({ data: { url } }));
              } catch {
                toast.error("We couldn't read that link. Check it's an outfit page.");
              } finally {
                setSingleBusy(false);
              }
            }}
          >
            {singleBusy ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
            Fetch details
          </Button>
        </div>

        {single ? (
          <div className="mt-6 rounded-lg border border-border p-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex gap-2">
                {single.images.slice(0, 4).map((src) => (
                  <img
                    key={src}
                    src={src}
                    alt={single.title}
                    loading="lazy"
                    width={80}
                    height={107}
                    className="h-[107px] w-20 rounded-md object-cover"
                  />
                ))}
              </div>
              <div className="min-w-[220px] flex-1">
                <p className="text-eyebrow">{single.designer}</p>
                <p className="mt-2 text-lg">{single.title}</p>
                <p className="mt-1 text-sm text-primary">₹{single.price}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {[
                    single.color,
                    single.garmentType,
                    single.silhouette,
                    `${single.images.length} photos`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {single.soldOut ? (
                  <Badge variant="secondary" className="mt-3">
                    Sold out on the shop
                  </Badge>
                ) : null}
                <Button
                  className="mt-4"
                  disabled={importBusy}
                  onClick={() => saveSelection([single.slug])}
                >
                  <Download className="size-4" /> Add to the wardrobe
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="panel p-4 sm:p-6">
        <h2 className="text-xl">Browse a category in your price range</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Pick everything you like and add it in one go. Prices are in rupees.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={chooseCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>For women</SelectLabel>
                  {WOMEN_CATEGORIES.map((c) => (
                    <SelectItem key={c.path} value={c.path}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>For men</SelectLabel>
                  {MEN_CATEGORIES.map((c) => (
                    <SelectItem key={c.path} value={c.path}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Looks per page</Label>
            <Select value={perPage} onValueChange={setPerPage}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["6", "12", "24", "36", "48", "100", "200", "300", "400", "500"].map((n) => (
                  <SelectItem key={n} value={n}>
                    {n} per page
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="min-price">From ₹</Label>
            <Input
              id="min-price"
              inputMode="numeric"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="max-price">To ₹</Label>
            <Input
              id="max-price"
              inputMode="numeric"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value.replace(/\D/g, ""))}
            />
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>Colour</Label>
            <Select value={colour} onValueChange={setColour}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any colour</SelectItem>
                {PERNIA_COLOURS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Sort the looks shown</Label>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="listed">As the shop lists them</SelectItem>
                <SelectItem value="price_asc">Price: low to high</SelectItem>
                <SelectItem value="price_desc">Price: high to low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>
              How soon it ships{" "}
              <span className="text-xs font-normal text-muted-foreground">
                {shipTimes.length ? "· " + shipTimes.length + " picked" : "· any shipping time"}
              </span>
            </Label>
            <div className="flex flex-wrap gap-2">
              {PERNIA_SHIP_TIMES.map((s) => {
                const on = shipTimes.includes(s.value);
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() =>
                      setShipTimes((prev) =>
                        prev.includes(s.value)
                          ? prev.filter((v) => v !== s.value)
                          : [...prev, s.value],
                      )
                    }
                    className={
                      "rounded-full border px-3 py-1 text-xs transition " +
                      (on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:bg-muted")
                    }
                  >
                    {s.label}
                  </button>
                );
              })}
              {shipTimes.length ? (
                <button
                  type="button"
                  onClick={() => setShipTimes([])}
                  className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>
          <label className="flex items-end gap-2 pb-2">
            <Checkbox
              checked={readyToShip}
              onCheckedChange={(v) => setReadyToShip(v === true)}
            />
            <span className="text-sm">Ready to ship only (no tailoring wait)</span>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button disabled={listBusy} onClick={() => runSearch(1)}>
            {listBusy ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            Show looks
          </Button>
          {results ? (
            <p className="text-xs text-muted-foreground">
              {total.toLocaleString()} looks match · page {page} of {totalPages.toLocaleString()}
            </p>
          ) : null}
          {jobsPanel ? <div className="w-full">{jobsPanel}</div> : null}
          {importedTotal ? (
            <Badge variant="secondary">{importedTotal} added to the wardrobe so far</Badge>
          ) : null}
          {hiddenCount ? (
            <Badge variant="outline">{hiddenCount} already in the wardrobe — hidden</Badge>
          ) : null}
          {shown.length ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setPicked((p) => {
                  const here = shown.map((l) => l.slug);
                  return here.every((x) => p.includes(x))
                    ? p.filter((x) => !here.includes(x))
                    : [...new Set([...p, ...here])];
                })
              }
            >
              {shown.every((l) => picked.includes(l.slug)) ? "Clear this page" : "Select all on this page"}
            </Button>
          ) : null}
          {results && results.length && total > results.length ? (
            <Button variant="ghost" size="sm" disabled={allBusy} onClick={selectAllPages}>
              {allBusy ? <Loader2 className="size-4 animate-spin" /> : null}
              Select all {Math.min(total, SELECT_ALL_CAP).toLocaleString()} across every page
            </Button>
          ) : null}
          {picked.length ? (
            <Button variant="ghost" size="sm" onClick={() => setPicked([])}>
              Clear all ({picked.length})
            </Button>
          ) : null}
          {picked.length ? (
            <Button
              variant="outline"
              disabled={importBusy}
              onClick={() => saveSelection(picked)}
            >
              {importBusy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              {importProgress ? `Adding ${importProgress}…` : `Add ${picked.length} selected`}
            </Button>
          ) : null}
        </div>

        {results ? (
          <>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((look) => {
                const on = picked.includes(look.slug);
                return (
                  <li
                    key={look.slug}
                    className={`overflow-hidden rounded-lg border ${on ? "border-primary" : "border-border"}`}
                  >
                    <button
                      type="button"
                      className="block w-full text-left"
                      onClick={() =>
                        setPicked((p) =>
                          p.includes(look.slug)
                            ? p.filter((s) => s !== look.slug)
                            : [...p, look.slug],
                        )
                      }
                    >
                      {look.images[0] ? (
                        <img
                          src={look.images[0]}
                          referrerPolicy="no-referrer"
                          alt={look.title}
                          loading="lazy"
                          width={300}
                          height={400}
                          className="aspect-[3/4] w-full object-cover"
                        />
                      ) : null}
                      <div className="space-y-1 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-eyebrow">{look.designer}</p>
                          <Checkbox checked={on} className="mt-0.5" />
                        </div>
                        <p className="line-clamp-2 text-sm">{look.title}</p>
                        <p className="text-sm text-primary">₹{look.price}</p>
                      </div>
                    </button>
                    <div className="flex items-center justify-between border-t border-border px-3 py-2">
                      <a
                        href={look.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-muted-foreground underline"
                      >
                        View on the shop
                      </a>
                      {look.soldOut ? <Badge variant="secondary">Sold out</Badge> : null}
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={listBusy || page <= 1}
                onClick={() => runSearch(page - 1)}
              >
                Previous
              </Button>
              {pageLinks.map((n, i) =>
                n === null ? (
                  <span key={`gap-${i}`} className="px-1 text-xs text-muted-foreground">
                    …
                  </span>
                ) : (
                  <Button
                    key={n}
                    size="sm"
                    variant={n === page ? "default" : "ghost"}
                    disabled={listBusy}
                    onClick={() => runSearch(n)}
                  >
                    {n}
                  </Button>
                ),
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={listBusy || page >= totalPages}
                onClick={() => runSearch(page + 1)}
              >
                Next
              </Button>
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
