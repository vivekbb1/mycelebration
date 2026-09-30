/**
 * Kora (koranm.com) — a Shopify menswear shop. Hosts browse its collections
 * with filters and copy chosen looks into a celebration's wardrobe.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const KORA_HOST = "https://koranm.com";
const BASE = `${KORA_HOST}/en-int`;

export const KORA_COLLECTIONS = [
  { handle: "sherwani-set-for-men", label: "Sherwani sets" },
  { handle: "kurta-set-for-men", label: "Kurta sets" },
  { handle: "kurta-jackets", label: "Kurta jackets" },
  { handle: "all", label: "Everything" },
] as const;

export type KoraLook = {
  handle: string;
  url: string;
  title: string;
  designer: string;
  priceInr: number;
  images: string[];
  garmentType: string | null;
  colours: string[];
  description: string;
  sku: string;
  soldOut: boolean;
};

function strip(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim().slice(0, 2000);
}

function mapProduct(p: any): KoraLook {
  const variants: any[] = Array.isArray(p.variants) ? p.variants : [];
  const prices = variants.map((v) => Number(v.price)).filter((n) => n > 0);
  const colourOpt = (p.options ?? []).find((o: any) => /colou?r/i.test(o?.name ?? ""));
  return {
    handle: String(p.handle),
    url: `${BASE}/products/${p.handle}`,
    title: String(p.title ?? "Untitled look"),
    designer: "Kora",
    priceInr: prices.length ? Math.round(Math.min(...prices)) : 0,
    images: (p.images ?? []).map((i: any) => String(i.src).split("?")[0]).slice(0, 6),
    garmentType: p.product_type ? String(p.product_type) : null,
    colours: colourOpt?.values ?? [],
    description: strip(String(p.body_html ?? "")),
    sku: String(variants[0]?.sku ?? "").split(/\s/)[0] ?? "",
    soldOut: !variants.some((v) => v.available),
  };
}

function handleFrom(input: string) {
  const m = input.match(/\/products\/([a-z0-9\-]+)/i);
  const h = (m ? m[1] : input).trim().toLowerCase();
  if (!/^[a-z0-9\-]{1,200}$/.test(h)) throw new Error("That doesn't look like a Kora product link");
  return h;
}

type Ctx = { supabase: any };
async function assertHost(ctx: Ctx, inviteId: string | null) {
  if (!inviteId) throw new Error("Choose a celebration first");
  const { data } = await ctx.supabase.rpc("is_celebration_host", { _invite_id: inviteId });
  if (data !== true) throw new Error("Forbidden");
}

export const searchKoraCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { inviteId: string | null; collection: string; page: number; minPrice: number; maxPrice: number; query?: string; inStock?: boolean }) => ({
      inviteId: d?.inviteId ? String(d.inviteId) : null,
      collection: /^[a-z0-9\-]{1,80}$/.test(String(d?.collection)) ? String(d.collection) : "all",
      page: Math.max(1, Math.min(50, Number(d?.page) || 1)),
      minPrice: Math.max(0, Number(d?.minPrice) || 0),
      maxPrice: Math.max(0, Number(d?.maxPrice) || 10_000_000),
      query: String(d?.query ?? "").trim().toLowerCase().slice(0, 80),
      inStock: Boolean(d?.inStock),
    }),
  )
  .handler(async ({ data, context }) => {
    await assertHost(context as unknown as Ctx, data.inviteId);
    const res = await fetch(`${BASE}/collections/${data.collection}/products.json?limit=48&page=${data.page}`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new Error("Kora's shop didn't answer — try again in a moment");
    const json = (await res.json()) as { products?: any[] };
    const raw = json.products ?? [];
    const looks = raw
      .map(mapProduct)
      .filter((l) => l.priceInr >= data.minPrice && l.priceInr <= data.maxPrice)
      .filter((l) => !data.inStock || !l.soldOut)
      .filter((l) => !data.query || `${l.title} ${l.garmentType} ${l.colours.join(" ")}`.toLowerCase().includes(data.query));
    return { looks, hasMore: raw.length === 48 };
  });

export const fetchKoraLook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { inviteId: string | null; url: string }) => ({
    inviteId: d?.inviteId ? String(d.inviteId) : null,
    url: String(d?.url ?? "").slice(0, 500),
  }))
  .handler(async ({ data, context }) => {
    await assertHost(context as unknown as Ctx, data.inviteId);
    const res = await fetch(`${BASE}/products/${handleFrom(data.url)}.json`);
    if (!res.ok) throw new Error("Couldn't find that look on Kora");
    return mapProduct(((await res.json()) as any).product);
  });

export const importKoraLooks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { inviteId: string | null; handles: string[]; eventId?: string | null; gender?: string | null }) => ({
      inviteId: d?.inviteId ? String(d.inviteId) : null,
      handles: (Array.isArray(d?.handles) ? d.handles : []).slice(0, 40).map((h) => handleFrom(String(h))),
      eventId: d?.eventId ? String(d.eventId) : null,
      gender: ["men", "boy"].includes(String(d?.gender)) ? String(d.gender) : "men",
    }),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    await assertHost(ctx, data.inviteId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    // Kora is an atelier of this celebration; create and link it on first use.
    let { data: shop } = await db.from("boutiques").select("id").eq("name", "Kora").limit(1).maybeSingle();
    if (!shop) {
      const code = `KORA-${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
      const made = await db.from("boutiques").insert({ name: "Kora", city: "Mumbai", access_code: code, notes: "koranm.com" }).select("id").single();
      if (made.error) throw new Error(made.error.message);
      shop = made.data;
    }
    await db.from("boutique_celebrations").upsert({ boutique_id: shop.id, invite_id: data.inviteId }, { ignoreDuplicates: true });

    const { copyImages } = await import("@/lib/outfit-images.server");
    let imported = 0, skipped = 0, failed = 0;
    for (const handle of data.handles) {
      const url = `${BASE}/products/${handle}`;
      const { data: dup } = await ctx.supabase.from("outfits").select("id").eq("invite_id", data.inviteId).eq("boutique_url", url).limit(1);
      if (dup?.length) { skipped++; continue; }
      try {
        const res = await fetch(`${url}.json`);
        if (!res.ok) throw new Error();
        const look = mapProduct(((await res.json()) as any).product);
        const images = await copyImages(`kora-${handle}`, look.images);
        const { error } = await ctx.supabase.from("outfits").insert({
          title: look.title,
          designer: look.designer,
          boutique_url: url,
          image_url: images[0] ?? null,
          images,
          color_family: look.colours[0] ?? null,
          garment_type: look.garmentType,
          price_note: look.priceInr ? `₹${look.priceInr.toLocaleString("en-IN")}` : null,
          price_inr: look.priceInr || null,
          source_sku: look.sku || null,
          gender: data.gender,
          notes: look.description || null,
          event_id: data.eventId,
          boutique_id: shop.id,
          invite_id: data.inviteId,
        });
        if (error) { error.code === "23505" ? skipped++ : failed++; } else imported++;
      } catch {
        failed++;
      }
    }
    return { imported, skipped, failed };
  });
