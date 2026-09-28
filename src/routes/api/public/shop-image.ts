import { createFileRoute } from "@tanstack/react-router";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** Only photos from the shops we pull live feeds from. */
const allowed = (host: string) => /(^|\.)perniaspopupshop\.com$/i.test(host) || /pernia/i.test(host);

/**
 * Keeps a copy of a live-feed shop photo on first view, then sends the
 * browser to our own (resized, long-cached) copy.
 */
export const Route = createFileRoute("/api/public/shop-image")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const src = url.searchParams.get("u") ?? "";
        const w = url.searchParams.get("w") ?? "400";
        let target: URL;
        try {
          target = new URL(src);
        } catch {
          return new Response("Bad image", { status: 400 });
        }
        if (target.protocol !== "https:" || !allowed(target.hostname)) {
          return new Response("Not allowed", { status: 403 });
        }
        const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(target.href));
        const hash = [...new Uint8Array(digest)].slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
        const path = `shopcache${hash}/0.jpg`;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const bucket = supabaseAdmin.storage.from("outfit-images");
        const existing = await bucket.list(`shopcache${hash}`, { limit: 1 });
        if (!existing.data?.length) {
          const res = await fetch(target.href, { headers: { "user-agent": UA } });
          const type = res.headers.get("content-type") ?? "";
          if (!res.ok || !type.startsWith("image/")) return Response.redirect(target.href, 302);
          const { error } = await bucket.upload(path, await res.arrayBuffer(), { contentType: type, upsert: true });
          if (error) return Response.redirect(target.href, 302);
        }
        return new Response(null, {
          status: 302,
          headers: {
            location: `/api/public/outfit-image/${path}?w=${encodeURIComponent(w)}`,
            "cache-control": "public, max-age=86400",
          },
        });
      },
    },
  },
});
