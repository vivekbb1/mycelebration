import { Repeat } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SubSnap = { title?: string; sku?: string; image?: string; size?: string; shop?: string };
export type LatestSub = { original: SubSnap; replacement: SubSnap; order: boolean; at: string };

function thumb(src: string) {
  if (src.startsWith("/api/public/outfit-image/")) return `${src.split("?")[0]}?w=240`;
  if (/^https:\/\/[^/]*pernia/i.test(src)) return `/api/public/shop-image?w=240&u=${encodeURIComponent(src)}`;
  return src;
}

const generic = (s?: { title?: string; sku?: string }) => !s?.title?.trim() || /^alternative\s/i.test(s.title.trim()) || s.title.trim() === s.sku?.trim();

/** Fills photo, name and shop link of substitutes saved with only a model number, from the wardrobe (same model number). */
export async function fillSnapsFromWardrobe<T extends { title?: string; sku?: string; image?: string; shop?: string; designer?: string }>(snaps: T[]): Promise<void> {
  const need = snaps.filter((s) => s.sku?.trim() && (!s.image || generic(s)));
  const skus = [...new Set(need.map((s) => s.sku!.trim()))];
  if (!skus.length) return;
  const r = await supabase.from("outfits").select("title, designer, source_sku, boutique_url, image_url").in("source_sku", skus);
  if (r.error) return;
  const by = new Map(r.data.map((o) => [(o.source_sku ?? "").trim().toUpperCase(), o]));
  for (const s of need) {
    const o = by.get(s.sku!.trim().toUpperCase()); if (!o) continue;
    if (!s.image && o.image_url) s.image = o.image_url;
    if (generic(s) && o.title) s.title = o.title;
    if (!s.shop && o.boutique_url) s.shop = o.boutique_url;
    if (!s.designer && o.designer) s.designer = o.designer;
  }
}

/** Latest host substitution per reservation (host-only history). */
export function useLatestSubstitutions(reservationIds: string[]) {
  const ids = [...new Set(reservationIds)].sort();
  return useQuery({
    queryKey: ["outfit-substitution-history", "latest", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const latest = new Map<string, LatestSub>();
      for (let i = 0; i < ids.length; i += 200) {
        const r = await supabase.from("wardrobe_substitution_history").select("reservation_id,original,replacement,created_at,order_id").in("reservation_id", ids.slice(i, i + 200)).order("created_at", { ascending: false });
        if (r.error) throw r.error;
        for (const h of r.data) if (!latest.has(h.reservation_id)) latest.set(h.reservation_id, { original: h.original as SubSnap, replacement: h.replacement as SubSnap, order: Boolean(h.order_id), at: h.created_at });
      }
      await fillSnapsFromWardrobe([...latest.values()].map((l) => l.replacement));
      return latest;
    },
  });
}

/** Shows original vs substituted look side by side. */
export function SubstitutionNote({ sub, showOriginal = false }: { sub?: LatestSub | undefined; showOriginal?: boolean }) {
  if (!sub) return null;
  const look = (s: SubSnap, label: string) => {
    const shop = s.shop && /^https?:\/\//i.test(s.shop) ? s.shop : null;
    const img = s.image ? <img src={thumb(s.image)} alt={s.title ?? label} loading="lazy" className="h-20 w-14 shrink-0 rounded object-cover" /> : null;
    return (
      <div className="flex min-w-0 items-start gap-2">
        {img && shop ? <a href={shop} target="_blank" rel="noopener noreferrer" aria-label={`Open ${s.title ?? label} in shop`} className="shrink-0">{img}</a> : img}
        <div className="min-w-0 text-xs">
          <p className="text-muted-foreground">{label}</p>
          {shop ? <a href={shop} target="_blank" rel="noopener noreferrer" className="block font-medium hover:text-primary hover:underline">{s.title || "Look"}</a> : <p className="font-medium">{s.title || "Look"}</p>}
          {s.sku ? <p className="text-muted-foreground">{s.sku}</p> : null}
          <p>Size: {s.size || "Not recorded"}</p>
        </div>
      </div>
    );
  };
  return (
    <div className="mt-2 w-full border-t border-border pt-2">
      <p className="flex items-center gap-1 text-xs font-medium text-primary"><Repeat className="size-3" /> Substituted at {sub.order ? "order" : "pre-order"} · {new Date(sub.at).toLocaleDateString("en-GB")}</p>
      <div className="mt-1 flex flex-wrap gap-4">
        {showOriginal ? look(sub.original, "Original") : null}
        {look(sub.replacement, "Replacement")}
      </div>
    </div>
  );
}
