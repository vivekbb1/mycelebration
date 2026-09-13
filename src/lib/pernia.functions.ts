import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Reads outfit detail and category listings from Pernia's Pop-Up Shop's own
 * storefront feed so the host can pull a look (or a whole price-filtered
 * category) into the wardrobe instead of typing every field by hand.
 */

const HOST = "https://www.perniaspopupshop.com";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export type PerniaLook = {
  sku: string;
  slug: string;
  url: string;
  title: string;
  designer: string;
  price: string;
  priceInr: number;
  images: string[];
  color: string | null;
  garmentType: string | null;
  silhouette: string | null;
  description: string;
  gender: string;
  soldOut: boolean;
};

type Ctx = { supabase: { from: (t: string) => any }; userId: string };

async function assertHost(context: Ctx) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}

function slugFromUrl(input: string) {
  const raw = input.trim();
  if (!raw) throw new Error("Paste an outfit link");
  const slug = raw.startsWith("http") ? new URL(raw).pathname : raw;
  const clean = slug.replace(/^\/+/, "").split("?")[0] ?? "";
  if (!/^[a-z0-9\-]+\.html$/i.test(clean)) {
    throw new Error("That doesn't look like a Pernia's outfit link");
  }
  return clean;
}

const GARMENTS = [
  "Lehenga",
  "Saree",
  "Sharara",
  "Anarkali",
  "Gown",
  "Sherwani",
  "Bandhgala",
  "Kurta",
  "Kaftan",
  "Dress",
  "Suit",
];

function garmentOf(title: string) {
  const found = GARMENTS.find((g) => title.toLowerCase().includes(g.toLowerCase()));
  return found ?? null;
}

async function getJson(url: string) {
  const res = await fetch(url, {
    headers: { "user-agent": UA, accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Pernia's returned ${res.status}`);
  return (await res.json()) as any;
}

async function detail(slug: string): Promise<PerniaLook> {
  const json = await getJson(`${HOST}/napi/newGetProductDetailAPI/${slug}/INR/IN`);
  const r = json?.result;
  if (!r) throw new Error("That outfit could not be read");

  const title: string = r.short_description || r.image_alt || r.name || "Untitled look";
  const images: string[] = (
    (Array.isArray(r.image_array_zoom) && r.image_array_zoom.length
      ? r.image_array_zoom
      : r.image_array) ?? []
  ).filter((s: unknown): s is string => typeof s === "string");
  if (!images.length && typeof r.img === "string") images.push(r.img);

  const specs: Array<{ key?: string; value?: string }> = Array.isArray(r.specs) ? r.specs : [];
  const pick = (k: string) => specs.find((s) => (s.key ?? "").toLowerCase() === k)?.value ?? null;
  const silhouette = [pick("components"), pick("fit"), pick("composition")]
    .filter(Boolean)
    .join(" · ");

  const priceInr = Number(r.prices?.price_by_currency ?? r.price_data ?? 0);

  return {
    sku: String(r.sku ?? ""),
    slug,
    url: `${HOST}/${slug}`,
    title,
    designer: String(r.designer ?? r.name ?? ""),
    price: String(r.price ?? ""),
    priceInr,
    images,
    color: r.color ?? null,
    garmentType: garmentOf(title),
    silhouette: silhouette || null,
    description: String(r.description ?? ""),
    gender: r.gender === "male" ? "men" : "women",
    soldOut: Boolean(r.soldOut),
  };
}

/** One outfit, from a pasted product link. */
export const fetchPerniaLook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { url: string }) => ({ url: String(data?.url ?? "").slice(0, 500) }))
  .handler(async ({ data, context }): Promise<PerniaLook> => {
    await assertHost(context as unknown as Ctx);
    return detail(slugFromUrl(data.url));
  });

/** A category page filtered by price, e.g. clothing/lehenga at 0–30,000. */
export const searchPerniaCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { category: string; minPrice: number; maxPrice: number; page: number }) => {
      const category = String(data?.category ?? "clothing/lehenga")
        .trim()
        .replace(/^\/+|\/+$/g, "");
      if (!/^[a-z0-9\-]+(\/[a-z0-9\-]+){0,2}$/.test(category)) {
        throw new Error("Unknown category");
      }
      return {
        category,
        minPrice: Math.max(0, Math.min(2_000_000, Math.round(Number(data?.minPrice) || 0))),
        maxPrice: Math.max(1, Math.min(2_000_000, Math.round(Number(data?.maxPrice) || 30000))),
        page: Math.max(1, Math.min(60, Math.round(Number(data?.page) || 1))),
      };
    },
  )
  .handler(async ({ data, context }) => {
    await assertHost(context as unknown as Ctx);

    const parts = data.category.split("/");
    const filter: Record<string, string> = {};
    parts.forEach((p, i) => {
      filter[`dynamicParams${i + 1}`] = p;
    });

    const queryData = encodeURIComponent(
      JSON.stringify({
        filter,
        queryString: {
          currency: "INR",
          price: `${data.minPrice}-${data.maxPrice}`,
          page: String(data.page),
        },
      }),
    );

    const json = await getJson(`${HOST}/napi/dyanmic?queryData=${queryData}`);
    const raw: any[] = Array.isArray(json?.data?.products) ? json.data.products : [];

    const looks = raw.map((p) => {
      const title = String(p.short_description ?? p.product_name ?? "Untitled look");
      const images = [p.img, p.hover_image]
        .filter((s): s is string => typeof s === "string")
        .map((s) => s.split("?")[0] as string);
      return {
        sku: String(p.sku ?? ""),
        slug: String(p.url ?? ""),
        url: `${HOST}/${p.url}`,
        title,
        designer: String(p.designer ?? p.product_name ?? ""),
        price: String(p.special_price || p.price || ""),
        priceInr: Number(p.base_special_price?.toString().replace(/,/g, "") || p.base_price || 0),
        images,
        garmentType: garmentOf(title),
        soldOut: Boolean(p.soldOut),
      };
    });

    return {
      total: Number(json?.data?.totalSize ?? looks.length),
      page: data.page,
      looks,
    };
  });

/** Saves the chosen looks into the wardrobe, with every photo they have. */
export const importPerniaLooks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { slugs: string[]; eventId?: string | null; boutiqueId?: string | null }) => ({
    slugs: (Array.isArray(data?.slugs) ? data.slugs : []).slice(0, 24).map((s) => String(s)),
    eventId: data?.eventId ? String(data.eventId) : null,
    boutiqueId: data?.boutiqueId ? String(data.boutiqueId) : null,
  }))
  .handler(async ({ data, context }) => {
    await assertHost(context as unknown as Ctx);
    if (!data.slugs.length) return { imported: 0, skipped: 0, failed: 0 };

    let imported = 0;
    let skipped = 0;
    let failed = 0;

    for (const raw of data.slugs) {
      let look: PerniaLook;
      try {
        look = await detail(slugFromUrl(raw));
      } catch {
        failed += 1;
        continue;
      }

      const { error } = await (context as unknown as Ctx).supabase.from("outfits").insert({
        title: look.title,
        designer: look.designer,
        boutique_url: look.url,
        image_url: look.images[0] ?? null,
        images: look.images,
        color_family: look.color,
        garment_type: look.garmentType,
        silhouette: look.silhouette,
        price_note: look.price ? `₹${look.price}` : null,
        price_inr: look.priceInr || null,
        source_sku: look.sku || null,
        gender: look.gender,
        notes: look.description || null,
        event_id: data.eventId,
        boutique_id: data.boutiqueId,
      });

      if (error) {
        if (error.code === "23505") skipped += 1;
        else failed += 1;
        continue;
      }
      imported += 1;
    }

    return { imported, skipped, failed };
  });
