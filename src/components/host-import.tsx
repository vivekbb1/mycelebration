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
  type PerniaLook,
} from "@/lib/pernia.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CATEGORIES = [
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

  const [url, setUrl] = useState("");
  const [single, setSingle] = useState<PerniaLook | null>(null);
  const [singleBusy, setSingleBusy] = useState(false);

  const [category, setCategory] = useState("clothing/lehenga");
  const [minPrice, setMinPrice] = useState("0");
  const [maxPrice, setMaxPrice] = useState("30000");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState("12");
  const [results, setResults] = useState<ListLook[] | null>(null);
  const [total, setTotal] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [listBusy, setListBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);

  const events = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, name, sort_order")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const boutiques = useQuery({
    queryKey: ["boutiques"],
    queryFn: async () => {
      const { data, error } = await supabase.from("boutiques").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["outfits"] });
  };

  const runSearch = async (nextPage = 1) => {
    setListBusy(true);
    try {
      const res = await searchCategory({
        data: {
          category,
          minPrice: Number(minPrice) || 0,
          maxPrice: Number(maxPrice) || 30000,
          page: nextPage,
          perPage: Number(perPage) || 12,
        },
      });
      setResults(res.looks);
      setTotal(res.total);
      setPage(res.page);
      setPicked([]);
      if (res.looks.length === 0) toast.info("No looks in that price range — widen it a little.");
    } catch {
      toast.error("Pernia's didn't answer just now. Try again in a moment.");
    } finally {
      setListBusy(false);
    }
  };

  const saveSelection = async (slugs: string[]) => {
    if (!slugs.length) return;
    setImportBusy(true);
    try {
      const res = await importLooks({
        data: { slugs, eventId: eventId || null, boutiqueId: boutiqueId || null },
      });
      const bits = [
        res.imported ? `${res.imported} added` : null,
        res.skipped ? `${res.skipped} already in the wardrobe` : null,
        res.failed ? `${res.failed} couldn't be read` : null,
      ].filter(Boolean);
      toast.success(bits.join(" · ") || "Nothing to add");
      setPicked([]);
      await refresh();
    } catch {
      toast.error("We couldn't add those looks. Please try again.");
    } finally {
      setImportBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="panel p-6">
        <h2 className="text-xl">Where should imported looks go?</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Applied to everything you add below. You can change it per look afterwards in Outfits.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Function</Label>
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
        </div>
      </section>

      <section className="panel p-6">
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

      <section className="panel p-6">
        <h2 className="text-xl">Browse a category in your price range</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Pick everything you like and add it in one go. Prices are in rupees.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.path} value={c.path}>
                    {c.label}
                  </SelectItem>
                ))}
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
                {["6", "12", "24", "36", "48", "60"].map((n) => (
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
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button disabled={listBusy} onClick={() => runSearch(1)}>
            {listBusy ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            Show looks
          </Button>
          {results ? (
            <p className="text-xs text-muted-foreground">
              {total.toLocaleString()} looks match · page {page}
            </p>
          ) : null}
          {results && results.length ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setPicked((p) =>
                  p.length === results.length ? [] : results.map((l) => l.slug),
                )
              }
            >
              {picked.length === results.length ? "Clear selection" : "Select all on this page"}
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
              Add {picked.length} selected
            </Button>
          ) : null}
        </div>

        {results ? (
          <>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((look) => {
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
            <div className="mt-6 flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={listBusy || page <= 1}
                onClick={() => runSearch(page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={listBusy || results.length === 0}
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
