import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type SendResult = { sent: boolean; reason?: string };

/**
 * Emails one guest their personal invitation code and sign-up link.
 * Host-only: the caller must hold the admin role.
 */
export const sendInviteEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { inviteId: string }) => {
    if (typeof data?.inviteId !== "string" || data.inviteId.length > 64) {
      throw new Error("Invalid invitation");
    }
    return { inviteId: data.inviteId };
  })
  .handler(async ({ data, context }): Promise<SendResult> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) return { sent: false, reason: "forbidden" };

    const { data: invite } = await context.supabase
      .from("invite_codes")
      .select("code, guest_name, email")
      .eq("id", data.inviteId)
      .maybeSingle();

    if (!invite) return { sent: false, reason: "invite_not_found" };
    if (!invite.email) return { sent: false, reason: "no_email" };

    const { escapeHtml, emailShell, sendGuestEmail } = await import("@/lib/email.server");
    const origin = new URL(getRequest().url).origin;
    const link = `${origin}/auth?code=${encodeURIComponent(invite.code)}`;

    const html = emailShell(`
    <div style="padding:30px">
      <p style="letter-spacing:.18em;text-transform:uppercase;font-size:11px;color:#caa04b;margin:0">Your wedding wardrobe</p>
      <h1 style="font-size:26px;margin:12px 0 10px">You're invited to pick your outfit</h1>
      <p style="color:#c9c3b5;font-size:15px;line-height:1.6;margin:0 0 18px">
        ${escapeHtml(invite.guest_name)}, as our gift we've put together a wardrobe of festive Indian
        outfits for the wedding. Open your private invitation, choose a look, and send your
        measurements — tailoring and delivery are on us.
      </p>
      <p style="margin:0 0 22px">
        <a href="${link}" style="display:inline-block;background:#caa04b;color:#151a3c;text-decoration:none;padding:13px 24px;border-radius:8px;font-size:15px">Open your invitation</a>
      </p>
      <p style="color:#8f8b80;font-size:13px;margin:0 0 4px">Your personal invitation code</p>
      <p style="font-size:20px;letter-spacing:.12em;color:#f3ecdf;margin:0 0 18px">${escapeHtml(invite.code)}</p>
      <p style="color:#8f8b80;font-size:12px;line-height:1.6;margin:0">
        Register with any email address, then enter this code to unlock the lookbook. Each look can be
        reserved by one guest only, so pick early. Link: ${escapeHtml(link)}
      </p>
    </div>`);

    return sendGuestEmail({
      to: invite.email,
      subject: `${invite.guest_name}, your outfit invitation for the wedding`,
      html,
    });
  });
