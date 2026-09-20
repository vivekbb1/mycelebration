import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type SendResult = { sent: boolean; reason?: string };

function prettyDate(value: string | null) {
  if (!value) return "date to follow";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

/**
 * Emails one guest their invitation: their event dates, the look set aside for them,
 * their personal code and a link to their guest plan.
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
      .select("code, guest_name, email, household, claimed_by, invite_id, family_id")
      .eq("id", data.inviteId)
      .maybeSingle();

    if (!invite) return { sent: false, reason: "invite_not_found" };
    if (!invite.email) return { sent: false, reason: "no_email" };

    // Which events is this guest's household invited to?
    let allowed: string[] | null = null;
    if (invite.household) {
      const { data: rows } = await context.supabase
        .from("household_event_invites")
        .select("event_id")
        .eq("household", invite.household);
      if (rows && rows.length > 0) allowed = rows.map((r) => r.event_id);
    }

    let eventQuery = context.supabase
      .from("events")
      .select("id, name, event_date, venue, start_time, dress_code, invite_id, sort_order")
      .order("sort_order", { ascending: true });
    if (invite.invite_id) eventQuery = eventQuery.eq("invite_id", invite.invite_id);
    const { data: allEvents } = await eventQuery;
    const events = (allEvents ?? []).filter((e) => !allowed || allowed.includes(e.id));

    // The look already set aside for them, if any.
    let look: { title: string; designer: string | null; image: string | null } | null = null;
    if (invite.claimed_by) {
      const { data: res } = await context.supabase
        .from("reservations")
        .select("guest_name, outfits(title, designer, image_url)")
        .eq("guest_id", invite.claimed_by);
      const mine = (res ?? []).find(
        (r) =>
          !r.guest_name ||
          r.guest_name.trim().toLowerCase() === invite.guest_name.trim().toLowerCase(),
      );
      const outfit = mine?.outfits as
        | { title: string; designer: string | null; image_url: string | null }
        | null
        | undefined;
      if (outfit) {
        look = { title: outfit.title, designer: outfit.designer, image: outfit.image_url };
      }
    }

    const { escapeHtml, emailShell, sendGuestEmail } = await import("@/lib/email.server");
    const origin = new URL(getRequest().url).origin;
    const link = `${origin}/auth?code=${encodeURIComponent(invite.code)}`;
    const planLink = `${origin}/plan`;

    const scheduleHtml =
      events.length > 0
        ? `<table style="width:100%;border-collapse:collapse;margin:0 0 22px">
            ${events
              .map(
                (e) => `<tr>
                  <td style="padding:10px 0;border-bottom:1px solid #e4d3c6">
                    <p style="margin:0;font-size:15px;color:#57302c">${escapeHtml(e.name)}</p>
                    <p style="margin:3px 0 0;font-size:13px;color:#8a6a62">
                      ${escapeHtml(prettyDate(e.event_date))}${e.start_time ? ` · ${escapeHtml(e.start_time)}` : ""}${e.venue ? ` · ${escapeHtml(e.venue)}` : ""}${e.dress_code ? `<br/>Dress: ${escapeHtml(e.dress_code)}` : ""}
                    </p>
                  </td>
                </tr>`,
              )
              .join("")}
          </table>`
        : `<p style="color:#8a6a62;font-size:14px;margin:0 0 22px">We'll share the day-by-day timings with you shortly.</p>`;

    const lookHtml = look
      ? `<div style="border:1px solid #e4d3c6;border-radius:12px;padding:14px;margin:0 0 22px">
          <p style="margin:0;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#b08637">Your look</p>
          <p style="margin:8px 0 0;font-size:15px;color:#57302c">${escapeHtml(look.title)}${look.designer ? ` — ${escapeHtml(look.designer)}` : ""}</p>
          ${look.image ? `<img src="${escapeHtml(look.image)}" alt="" width="180" style="margin-top:10px;border-radius:10px;max-width:100%"/>` : ""}
        </div>`
      : `<p style="color:#8a6a62;font-size:14px;margin:0 0 22px">Your outfit isn't chosen yet — open your plan to pick a look and send your measurements.</p>`;

    const html = emailShell(`
    <div style="padding:30px">
      <p style="letter-spacing:.18em;text-transform:uppercase;font-size:11px;color:#b08637;margin:0">You're invited</p>
      <h1 style="font-size:26px;margin:12px 0 10px;color:#57302c">${escapeHtml(invite.guest_name)}, here are your days with us</h1>
      <p style="color:#8a6a62;font-size:15px;line-height:1.6;margin:0 0 20px">
        Everything below is yours — your functions, the look set aside for you and where to send your
        measurements. Tailoring and delivery are on us.
      </p>
      ${scheduleHtml}
      ${lookHtml}
      <p style="margin:0 0 18px">
        <a href="${planLink}" style="display:inline-block;background:#b08637;color:#fdfaf6;text-decoration:none;padding:13px 24px;border-radius:8px;font-size:15px">Open your plan</a>
      </p>
      <p style="color:#8a6a62;font-size:13px;margin:0 0 4px">Your personal invitation code</p>
      <p style="font-size:20px;letter-spacing:.12em;color:#57302c;margin:0 0 18px">${escapeHtml(invite.code)}</p>
      <p style="color:#8a6a62;font-size:12px;line-height:1.6;margin:0">
        First time here? Create your account with this code: ${escapeHtml(link)} — then your plan lives at ${escapeHtml(planLink)}.
      </p>
    </div>`);

    return sendGuestEmail({
      to: invite.email,
      subject: `${invite.guest_name}, your invitation and outfit plan`,
      html,
    });
  });
