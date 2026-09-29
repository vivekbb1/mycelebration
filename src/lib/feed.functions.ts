import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { HOST, detail, getJson, mapListing, slugFromUrl } from "@/lib/pernia.functions";

/**
 * Live feeds: each event can carry saved shop filters per audience (women,
 * men, kids). Guests browse the shop's current looks through them; a look is
 * only saved into the wardrobe at the moment someone claims it. Prices and
 * shop links never leave the server.
 */

export type FeedLook = {
  slug: string;
  title: string;
  designer: string;
  images: string[];
  garmentType: string | null;
  hidden?: boolean;
};

type Ctx = { supabase: any; userId: string };
const AUDIENCES = ["women", "men", "boy", "girl"] as const;

async function access(ctx: Ctx, eventId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: ev } = await supabaseAdmin.from("events").select("invite_id").eq("id", eventId).maybeSingle();
  const inviteId = (ev?.invite_id as string | null) ?? null;
  if (inviteId) {
    const { data: isHost } = await ctx.supabase.rpc("is_celebration_host", { _invite_id: inviteId });
    if (isHost) return { isHost: true, inviteId };
  }
  const { data: ids } = await ctx.supabase.rpc("my_event_ids");
  const ok = ((ids ?? []) as { event_id: string }[]).some((r) => r.event_id === eventId);
  if (!ok || !inviteId) throw new Error("Forbidden");
  return { isHost: false, inviteId };
}

async function shopPage(feed: any, page: number) {
  const filter: Record<string, string> = {};
  String(feed.category)
    .split("/")
    .forEach((p: string, i: number) => {
      filter[`dynamicParams${i + 1}`] = p;
    });
  const queryString: Record<string, string> = {
    currency: "INR",
    price: `${feed.min_price}-${feed.max_price}`,
    page: String(page),
  };
  if (feed.ready_to_ship) queryString["ready_to_ship"] = "ready_to_ship";
  if (feed.colour) queryString["colour_code"] = feed.colour;
  if (feed.ship_in_days) queryString["ship_in_days"] = feed.ship_in_days;
  const q = encodeURIComponent(JSON.stringify({ filter, queryString }));
  try {
    const json = await getJson(`${HOST}/napi/dyanmic?queryData=${q}`);
    const products = (Array.isArray(json?.data?.products) ? json.data.products : []) as any[];
    return { products, more: products.length >= 24 };
  } catch {
    return { products: [] as any[], more: false };
  }
}

const inputOf = (data: any) => {
  const audience = AUDIENCES.includes(data?.audience) ? (data.audience as string) : "women";
  return {
    eventId: String(data?.eventId ?? ""),
    audience,
    page: Math.max(1, Math.min(100, Math.round(Number(data?.page) || 1))),
  };
};

/** The shop's current looks for one event and audience, with prices stripped. */
export const browseEventFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { eventId: string; audience: string; page?: number }) => inputOf(d))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { isHost, inviteId } = await access(ctx, data.eventId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: feeds } = await supabaseAdmin
      .from("outfit_feeds")
      .select("*")
      .eq("event_id", data.eventId)
      .eq("audience", data.audience)
      .order("sort_order");
    if (!feeds?.length) return { looks: [] as FeedLook[], more: false, hasFeeds: false };

    const [{ data: hidden }, pages] = await Promise.all([
      supabaseAdmin.from("outfit_feed_hidden").select("slug").eq("event_id", data.eventId),
      Promise.all(feeds.map((f) => shopPage(f, data.page))),
    ]);
    const hiddenSet = new Set((hidden ?? []).map((h) => h.slug));

    const seen = new Set<string>();
    const listed = pages
      .flatMap((p) => p.products)
      .map(mapListing)
      .filter((l) => l.slug && !l.soldOut && !seen.has(l.slug) && seen.add(l.slug));

    // Looks already saved in the wardrobe show in the regular lookbook instead.
    const skus = listed.map((l) => l.sku).filter(Boolean);
    const { data: saved } = skus.length
      ? await supabaseAdmin.from("outfits").select("source_sku").eq("invite_id", inviteId).in("source_sku", skus)
      : { data: [] as { source_sku: string | null }[] };
    const savedSet = new Set((saved ?? []).map((s) => s.source_sku));

    const looks: FeedLook[] = listed
      .filter((l) => !savedSet.has(l.sku))
      .filter((l) => isHost || !hiddenSet.has(l.slug))
      .map((l) => ({
        slug: l.slug,
        title: l.title,
        designer: l.designer,
        images: l.images,
        garmentType: l.garmentType,
        ...(isHost ? { hidden: hiddenSet.has(l.slug) } : {}),
      }));

    return { looks, more: pages.some((p) => p.more), hasFeeds: true };
  });

/** Claim a look from a live feed: saves it into the wardrobe and locks it to the guest. */
export const claimFeedLook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { eventId: string; audience: string; slug: string; guestName?: string | null }) => ({
      ...inputOf(d),
      slug: String(d?.slug ?? "").slice(0, 300),
      guestName: d?.guestName ? String(d.guestName).slice(0, 120) : null,
    }),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { inviteId } = await access(ctx, data.eventId);
    const slug = slugFromUrl(data.slug);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: feed }, { data: hidden }, { data: ev }] = await Promise.all([
      supabaseAdmin
        .from("outfit_feeds")
        .select("id")
        .eq("event_id", data.eventId)
        .eq("audience", data.audience)
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("outfit_feed_hidden")
        .select("id")
        .eq("event_id", data.eventId)
        .eq("slug", slug)
        .maybeSingle(),
      supabaseAdmin.from("events").select("outfit_selection").eq("id", data.eventId).maybeSingle(),
    ]);
    if (!feed || hidden || ev?.outfit_selection === false) {
      throw new Error("That look isn't offered for this event.");
    }

    const look = await detail(slug);
    if (look.soldOut) throw new Error("That look has just sold out — please pick another.");

    let outfitId: string | null = null;
    if (look.sku) {
      const { data: existing } = await supabaseAdmin
        .from("outfits")
        .select("id")
        .eq("source_sku", look.sku)
        .eq("invite_id", inviteId)
        .maybeSingle();
      outfitId = existing?.id ?? null;
    }
    if (!outfitId) {
      const { copyImages } = await import("@/lib/outfit-images.server");
      const images = await copyImages(look.sku || slug.replace(/\.html$/, ""), look.images);
      const { data: row, error } = await supabaseAdmin
        .from("outfits")
        .insert({
          title: look.title,
          designer: look.designer,
          boutique_url: look.url,
          image_url: images[0] ?? null,
          images,
          color_family: look.color,
          garment_type: look.garmentType,
          silhouette: look.silhouette,
          price_note: look.price ? `₹${look.price}` : null,
          price_inr: look.priceInr || null,
          source_sku: look.sku || null,
          gender: data.audience,
          notes: look.description || null,
          event_id: data.eventId,
        })
        .select("id")
        .single();
      if (error) throw new Error("Another guest just claimed this look — please pick another.");
      outfitId = row.id;
    }

    const { error } = await ctx.supabase.from("reservations").insert({
      outfit_id: outfitId,
      guest_id: ctx.userId,
      guest_name: data.guestName,
    });
    if (error) {
      throw new Error(
        error.code === "23505"
          ? "Another guest just claimed this look — please pick another."
          : error.message.includes("ONE_LOOK_PER_EVENT")
            ? "You already have a look for this event — release it first to choose another."
            : error.message,
      );
    }
    return { outfitId, title: look.title };
  });

/** Imports one shop page (up to 24 looks) of a saved feed into the wardrobe,
 *  copying the photos. The host's screen calls it page by page. */
export const importFeedPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { feedId: string; page: number }) => ({
    feedId: String(d?.feedId ?? ""),
    page: Math.max(1, Math.min(100, Math.round(Number(d?.page) || 1))),
  }))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { copyImages } = await import("@/lib/outfit-images.server");

    const { data: feed } = await supabaseAdmin.from("outfit_feeds").select("*").eq("id", data.feedId).maybeSingle();
    if (!feed) throw new Error("Feed not found");
    const { data: isHost } = await ctx.supabase.rpc("is_celebration_host", { _invite_id: feed.invite_id });
    if (!isHost) throw new Error("Forbidden");
    const [{ products, more }, { data: hidden }] = await Promise.all([
      shopPage(feed, data.page),
      supabaseAdmin.from("outfit_feed_hidden").select("slug").eq("event_id", feed.event_id),
    ]);
    const hiddenSet = new Set((hidden ?? []).map((h) => h.slug));
    const listed = products.map(mapListing).filter((l) => l.sku && !l.soldOut && !hiddenSet.has(l.slug));

    const { data: saved } = listed.length
      ? await supabaseAdmin.from("outfits").select("source_sku").eq("invite_id", feed.invite_id as string).in("source_sku", listed.map((l) => l.sku))
      : { data: [] as { source_sku: string | null }[] };
    const savedSet = new Set((saved ?? []).map((s) => s.source_sku));

    let imported = 0;
    let failed = 0;
    const skipped = listed.filter((l) => savedSet.has(l.sku)).length;
    const todo = listed.filter((l) => !savedSet.has(l.sku));
    await Promise.all(
      todo.map(async (l) => {
        // The listing only carries two photos; the look's own page has them all.
        let source = l.images;
        try {
          const full = await detail(l.slug);
          if (full.images.length) source = full.images;
        } catch {
          /* keep the listing photos */
        }
        const images = await copyImages(l.sku, source, 6);
        const { error } = await supabaseAdmin.from("outfits").insert({
          title: l.title,
          designer: l.designer,
          boutique_url: l.url,
          image_url: images[0] ?? null,
          images,
          garment_type: l.garmentType,
          price_note: l.price ? `₹${l.price}` : null,
          price_inr: l.priceInr || null,
          source_sku: l.sku,
          gender: feed.audience,
          event_id: feed.event_id,
          invite_id: feed.invite_id,
        });
        if (error) failed += 1;
        else imported += 1;
      }),
    );
    return { imported, skipped, failed, more };
  });
