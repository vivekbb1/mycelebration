import { createFileRoute } from "@tanstack/react-router";

// Serves our own copies of outfit photos (not sensitive; read-only).
// ?w=<px> returns a smaller, compressed copy when the storage service can resize;
// otherwise the original is served.
export const Route = createFileRoute("/api/public/outfit-image/$")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const path = String(params._splat ?? "");
        if (!/^[a-z0-9\-_]+\/\d+\.(jpg|png|webp)$/i.test(path)) {
          return new Response("Not found", { status: 404 });
        }
        const wRaw = Number(new URL(request.url).searchParams.get("w"));
        const width = [120, 240, 400, 600, 800].includes(wRaw) ? wRaw : 0;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const bucket = supabaseAdmin.storage.from("outfit-images");
        let data: Blob | null = null;
        if (width) {
          const res = await bucket.download(path, {
            transform: { width, height: Math.round((width * 4) / 3), resize: "cover", quality: 70 },
          });
          if (!res.error && res.data && res.data.size > 0) data = res.data;
        }
        if (!data) {
          const res = await bucket.download(path);
          if (res.error || !res.data) return new Response("Not found", { status: 404 });
          data = res.data;
        }
        return new Response(data, {
          headers: {
            "content-type": data.type || "image/jpeg",
            "cache-control": "public, max-age=31536000, s-maxage=31536000, immutable",
          },
        });
      },
    },
  },
});
