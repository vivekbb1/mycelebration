import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ShopSize } from "@/lib/size-charts";

const PERNIA = "https://www.perniaspopupshop.com";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** Reads a Pernia product's size list with stock. Null when the shop has no sizes. */
export async function perniaSizes(url: string): Promise<ShopSize[] | null> {
  const u = new URL(url);
  if (u.origin !== PERNIA) return null;
  const slug = u.pathname.replace(/^\/+/, "");
  if (!/^[a-z0-9-]+\.html$/i.test(slug)) return null;
  const res = await fetch(`${PERNIA}/napi/newGetProductDetailAPI/${slug}/INR/IN`, {
    headers: { "user-agent": UA, accept: "application/json" },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as any;
  const opts: any[] = json?.result?.attributeOptions?.["Shop by Size"] ?? [];
  if (!Array.isArray(opts) || !opts.length) return null;
  const sold = Boolean(json?.result?.soldOut);
  return opts
    .filter((o) => !/custom/i.test(String(o?.label ?? "")))
    .map((o) => ({
      label: String(o.label),
      available: !sold && o.isAvailable !== false,
      ready_to_ship: Boolean(o.readyToShip),
      ships_by: o.estimated_shipping_date ? String(o.estimated_shipping_date) : null,
    }));
}

/** Kora (Shopify) product sizes with stock. */
async function koraSizes(url: string): Promise<ShopSize[] | null> {
  const u = new URL(url);
  if (u.origin !== "https://koranm.com") return null;
  const m = u.pathname.match(/\/products\/([a-z0-9-]{1,200})/i);
  if (!m) return null;
  const res = await fetch(`https://koranm.com/en-int/products/${m[1]}.json`, { headers: { "user-agent": UA } });
  if (!res.ok) return null;
  const { mapProduct } = await import("@/lib/kora.functions");
  return mapProduct(((await res.json()) as any).product).sizes;
}

/**
 * Live sizes for one look. The caller must be able to read the look (RLS);
 * fresh stock is then saved back so every screen shows it.
 */
export const checkOutfitSizes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { outfitId: string }) => ({ outfitId: String(d?.outfitId ?? "").slice(0, 64) }))
  .handler(async ({ data, context }) => {
    const { data: outfit } = await context.supabase
      .from("outfits")
      .select("id, boutique_url, sizes")
      .eq("id", data.outfitId)
      .maybeSingle();
    if (!outfit) throw new Error("Look not found");
    const saved = (outfit.sizes as ShopSize[] | null) ?? null;
    if (!outfit.boutique_url) return { sizes: saved, live: false };
    let fresh: ShopSize[] | null = null;
    try {
      fresh = (await perniaSizes(outfit.boutique_url)) ?? (await koraSizes(outfit.boutique_url));
    } catch {
      fresh = null;
    }
    if (!fresh) return { sizes: saved, live: false };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("outfits").update({ sizes: fresh as any, sizes_checked_at: new Date().toISOString() }).eq("id", outfit.id);
    return { sizes: fresh, live: true };
  });

const STALE_MS = 30 * 60 * 1000;

/**
 * Refreshes stock for the shop looks a guest is about to browse.
 * Only looks the caller can read (RLS) and not checked in the last 30 minutes.
 */
export const refreshGallerySizes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { outfitIds: string[] }) => ({
    outfitIds: (Array.isArray(d?.outfitIds) ? d.outfitIds : []).map((x) => String(x).slice(0, 64)).slice(0, 120),
  }))
  .handler(async ({ data, context }) => {
    if (!data.outfitIds.length) return { updated: 0 };
    const { data: rows } = await context.supabase
      .from("outfits")
      .select("id, boutique_url, sizes_checked_at")
      .in("id", data.outfitIds);
    const cutoff = Date.now() - STALE_MS;
    const due = (rows ?? []).filter(
      (r) => r.boutique_url && (!r.sizes_checked_at || new Date(r.sizes_checked_at).getTime() < cutoff),
    );
    if (!due.length) return { updated: 0 };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let updated = 0;
    const queue = [...due];
    const worker = async () => {
      while (queue.length) {
        const r = queue.shift()!;
        let fresh: ShopSize[] | null = null;
        try {
          fresh = (await perniaSizes(r.boutique_url!)) ?? (await koraSizes(r.boutique_url!));
        } catch {
          fresh = null;
        }
        const patch: Record<string, unknown> = { sizes_checked_at: new Date().toISOString() };
        if (fresh) patch["sizes"] = fresh;
        await supabaseAdmin.from("outfits").update(patch as any).eq("id", r.id);
        if (fresh) updated++;
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    return { updated };
  });
