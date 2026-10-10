import { koraSizes, perniaSizes } from "@/lib/outfit-sizes.functions";
import type { ShopSize } from "@/lib/size-charts";

/** Refreshes shop stock for the looks checked longest ago. Safe to run repeatedly. */
export async function runStockRefresh(limit = 150) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const cutoff = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
  const { data } = await supabaseAdmin
    .from("outfits")
    .select("id, boutique_url, sizes_checked_at")
    .not("boutique_url", "is", null)
    .or(`sizes_checked_at.is.null,sizes_checked_at.lt.${cutoff}`)
    .order("sizes_checked_at", { ascending: true, nullsFirst: true })
    .limit(limit);
  const queue = [...(data ?? [])];
  let updated = 0;
  let failed = 0;
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
      else failed++;
      await supabaseAdmin.from("outfits").update(patch as never).eq("id", r.id);
      if (fresh) updated++;
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  return { checked: (data ?? []).length, updated, failed };
}
