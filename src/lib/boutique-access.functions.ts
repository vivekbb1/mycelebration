import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type ClaimResult = { ok: boolean; boutiqueName?: string; error?: string };

/**
 * A stylist at a designer/boutique joins their atelier with the private access
 * code the host gave them. The boutique is resolved server-side from the code,
 * and membership is always recorded for the verified caller — never for an id
 * supplied by the browser.
 */
export const claimBoutiqueAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { code: string }) => {
    const code = typeof data?.code === "string" ? data.code.trim() : "";
    if (!code || code.length > 64) throw new Error("Invalid code");
    return { code };
  })
  .handler(async ({ data, context }): Promise<ClaimResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: boutique, error } = await supabaseAdmin
      .from("boutiques")
      .select("id, name")
      .ilike("access_code", data.code)
      .maybeSingle();

    if (error) return { ok: false, error: "Something went wrong. Please try again." };
    if (!boutique) return { ok: false, error: "That boutique code was not recognised." };

    const { error: insertError } = await supabaseAdmin
      .from("boutique_members")
      .insert({ boutique_id: boutique.id, user_id: context.userId });

    // 23505 = already a member, which is a success from the stylist's point of view.
    if (insertError && insertError.code !== "23505") {
      return { ok: false, error: "We couldn't add you to that boutique. Please try again." };
    }

    return { ok: true, boutiqueName: boutique.name };
  });
