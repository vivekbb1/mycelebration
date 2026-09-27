import { createFileRoute } from "@tanstack/react-router";

// Serves our own copies of outfit photos (not sensitive; read-only).
export const Route = createFileRoute("/api/public/outfit-image/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const path = String(params._splat ?? "");
        if (!/^[a-z0-9\-_]+\/\d+\.(jpg|png|webp)$/i.test(path)) {
          return new Response("Not found", { status: 404 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage.from("outfit-images").download(path);
        if (error || !data) return new Response("Not found", { status: 404 });
        return new Response(data, {
          headers: {
            "content-type": data.type || "image/jpeg",
            "cache-control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
