import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ClaimResult = { ok: boolean; error?: string };

const codeSchema = z.object({ code: z.string().trim().min(3).max(64) });

/**
 * Claims a guest invitation for the signed-in user. Runs server-side with the
 * service role so no privileged database event is callable from the browser.
 */
export const claimGuestInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => codeSchema.parse(data))
  .handler(async ({ data, context }): Promise<ClaimResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const code = data.code.trim();

    const { data: invite, error } = await supabaseAdmin
      .from("invite_codes")
      .select("id, code, guest_name, claimed_by, claimed_at, household, gender")
      .ilike("code", code)
      .maybeSingle();

    if (error) return { ok: false, error: "We couldn't check that code. Please try again." };
    if (!invite) return { ok: false, error: "That invitation code was not recognised" };
    if (invite.claimed_by && invite.claimed_by !== userId) {
      return { ok: false, error: "That invitation has already been used" };
    }

    const { error: inviteError } = await supabaseAdmin
      .from("invite_codes")
      .update({ claimed_by: userId, claimed_at: invite.claimed_at ?? new Date().toISOString() })
      .eq("id", invite.id);
    if (inviteError) return { ok: false, error: "We couldn't confirm that invitation." };

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, household, gender")
      .eq("id", userId)
      .maybeSingle();

    // The family name and wardrobe come from the invitation: they decide which
    // events this guest sees and whether we show menswear or womenswear.
    await supabaseAdmin
      .from("profiles")
      .update({
        invite_claimed: true,
        full_name: profile?.full_name ? profile.full_name : invite.guest_name,
        household: profile?.household ?? invite.household,
        gender: profile?.gender ?? invite.gender,
      })
      .eq("id", userId);

    return { ok: true };
  });

/**
 * Confirms host access for someone who already holds the host role. Host
 * access is only ever granted through a host invitation or by the platform
 * admin — never self-claimed.
 */
export const claimHostAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ClaimResult> => {
    const { data: isHost } = await context.supabase.rpc("is_any_host");
    return isHost === true
      ? { ok: true }
      : { ok: false, error: "Host access needs a host invitation. Ask the celebration's host for one." };
  });
