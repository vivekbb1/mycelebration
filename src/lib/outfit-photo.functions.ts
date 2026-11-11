import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validateOutfitJpeg } from "@/lib/outfit-photo";

export const uploadOutfitPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { inviteId: string; base64: string }) => z.object({
    inviteId: z.string().uuid(),
    base64: z.string().min(4).max(7_000_000),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: allowed, error: roleError } = await context.supabase.rpc("is_celebration_host", { _invite_id: data.inviteId });
    if (roleError || allowed !== true) throw new Error("Only this celebration's hosts can upload outfit photos.");
    const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    validateOutfitJpeg(bytes);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const path = `${data.inviteId}/${crypto.randomUUID()}/0.jpg`;
    const { error } = await supabaseAdmin.storage.from("outfit-images").upload(path, bytes, { contentType: "image/jpeg", upsert: false });
    if (error) throw new Error("The photo could not be uploaded. Please try again.");
    return { url: `/api/public/outfit-image/${path}` };
  });