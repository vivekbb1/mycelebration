import { randomCode } from "@/lib/secure-code";
import { authLink } from "@/lib/public-url";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type HostInviteResult = {
  ok: boolean;
  error?: string;
  code?: string;
  link?: string;
  sent?: boolean;
  reason?: string;
};

const inviteSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  fullName: z.string().trim().max(100).optional(),
  inviteId: z.string().uuid(),
});

function makeCode() {
  return `HOST-${randomCode(10)}`;
}

/** Invites another host by email and emails them a registration link. */
export const inviteHostByEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inviteSchema.parse(data))
  .handler(async ({ data, context }): Promise<HostInviteResult> => {
    const { data: isOwner } = await context.supabase.rpc("is_celebration_owner", {
      _invite_id: data.inviteId,
    });
    if (!isOwner) return { ok: false, error: "Only an owner of this celebration can invite other hosts." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.toLowerCase();
    const fullName = data.fullName?.trim() || null;

    const { data: existing } = await supabaseAdmin
      .from("host_invites")
      .select("id, code, claimed_by")
      .ilike("email", email)
      .eq("invite_id", data.inviteId)
      .maybeSingle();

    let code = existing?.code ?? makeCode();
    if (existing) {
      if (existing.claimed_by) {
        return { ok: false, error: "That person is already a host." };
      }
      if (fullName) {
        await supabaseAdmin.from("host_invites").update({ full_name: fullName }).eq("id", existing.id);
      }
    } else {
      const { error } = await supabaseAdmin
        .from("host_invites")
        .insert({ email, full_name: fullName, code, invited_by: context.userId, invite_id: data.inviteId });
      if (error) {
        if (error.code === "23505") {
          code = makeCode();
          const retry = await supabaseAdmin
            .from("host_invites")
            .insert({ email, full_name: fullName, code, invited_by: context.userId, invite_id: data.inviteId });
          if (retry.error) return { ok: false, error: "We couldn't create that invitation." };
        } else {
          return { ok: false, error: "We couldn't create that invitation." };
        }
      }
    }

    const { data: cel } = await supabaseAdmin.from("invites").select("slug").eq("id", data.inviteId).maybeSingle();
    const link = authLink(code, cel?.slug);

    const { escapeHtml, emailShell, sendGuestEmail } = await import("@/lib/email.server");
    const greeting = fullName ? `${escapeHtml(fullName)},` : "Hello,";
    const html = emailShell(`
    <div style="padding:30px">
      <p style="letter-spacing:.18em;text-transform:uppercase;font-size:11px;color:#caa04b;margin:0">My Celebration</p>
      <h1 style="font-size:26px;margin:12px 0 10px">You've been asked to help host</h1>
      <p style="color:#c9c3b5;font-size:15px;line-height:1.6;margin:0 0 18px">
        ${greeting} you can now help run the celebration — the guest list, the events,
        the outfits, measurements and the delivery plan. Register with this link to get started.
      </p>
      <p style="margin:0 0 22px">
        <a href="${link}" style="display:inline-block;background:#caa04b;color:#151a3c;text-decoration:none;padding:13px 24px;border-radius:8px;font-size:15px">Register as a host</a>
      </p>
      <p style="color:#8f8b80;font-size:13px;margin:0 0 4px">Your host code</p>
      <p style="font-size:20px;letter-spacing:.12em;color:#f3ecdf;margin:0 0 18px">${escapeHtml(code)}</p>
      <p style="color:#8f8b80;font-size:12px;line-height:1.6;margin:0">
        Register with this email address and enter the code above. Link: ${escapeHtml(link)}
      </p>
    </div>`);

    const result = await sendGuestEmail({
      inviteId: data.inviteId,
      to: email,
      subject: "You've been invited to help host on My Celebration",
      html,
    });

    return { ok: true, code, link, sent: result.sent, ...(result.reason ? { reason: result.reason } : {}) };
  });

/** Turns a host invitation code into host access for the signed-in user. */
export const claimHostInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ code: z.string().trim().min(3).max(64) }).parse(data))
  .handler(async ({ data, context }): Promise<HostInviteResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: invite } = await supabaseAdmin
      .from("host_invites")
      .select("id, code, email, full_name, claimed_by, invite_id")
      .ilike("code", data.code.trim())
      .maybeSingle();

    if (!invite) return { ok: false, error: "That host code was not recognised" };
    // Host codes are single-use: once claimed they can never restore access,
    // so a removed co-host can't rejoin with their old code.
    if (invite.claimed_by) {
      return { ok: false, error: "That host invitation has already been used" };
    }

    if (!invite.invite_id) return { ok: false, error: "That host code isn't linked to a celebration." };
    const { error: roleError } = await supabaseAdmin
      .from("celebration_hosts")
      .insert({ user_id: userId, invite_id: invite.invite_id, role: "host" });
    if (roleError && roleError.code !== "23505") {
      return { ok: false, error: "We couldn't give you host access. Please try again." };
    }

    await supabaseAdmin
      .from("host_invites")
      .update({ claimed_by: userId, claimed_at: new Date().toISOString() })
      .eq("id", invite.id);

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();

    await supabaseAdmin
      .from("profiles")
      .update({
        invite_claimed: true,
        full_name: profile?.full_name ? profile.full_name : (invite.full_name ?? ""),
      })
      .eq("id", userId);

    return { ok: true };
  });
