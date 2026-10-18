import { missingOutfitEvents } from "@/lib/outfit-pick-progress";
import { PUBLIC_ORIGIN } from "@/lib/public-url";
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type SendResult = { sent: boolean; reason?: string };

function prettyDate(value: string | null) {
  if (!value) return "date to follow";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

/**
 * Nudges one guest who hasn't chosen a look yet. Lists the events still
 * waiting on them and links straight to the wardrobe.
 * Host-only: the caller must host the guest’s celebration.
 */
export const sendOutfitReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { inviteId: string }) => {
    if (typeof data?.inviteId !== "string" || data.inviteId.length > 64) {
      throw new Error("Invalid guest");
    }
    return { inviteId: data.inviteId };
  })
  .handler(async ({ data, context }): Promise<SendResult> => {
    const { data: isAdmin } = await context.supabase.rpc("is_any_host");
    if (!isAdmin) return { sent: false, reason: "forbidden" };

    const { data: guest } = await context.supabase
      .from("invite_codes")
      .select("guest_name, email, household, claimed_by, invite_id, gender")
      .eq("id", data.inviteId)
      .maybeSingle();

    if (!guest) return { sent: false, reason: "guest_not_found" };
    {
      const { data: isHost } = guest.invite_id
        ? await context.supabase.rpc("is_celebration_host", { _invite_id: guest.invite_id })
        : { data: false };
      if (isHost !== true) return { sent: false, reason: "forbidden" };
    }
    if (!guest.invite_id) return { sent: false, reason: "guest_not_found" };
    const inviteId = guest.invite_id;
    const [members, access, events, reservations, outfits, feeds] = await Promise.all([
      context.supabase.from("invite_codes").select("guest_name, email, household, claimed_by, gender").eq("invite_id", inviteId),
      context.supabase.from("household_event_invites").select("household, event_id, outfit_selection").eq("invite_id", inviteId),
      context.supabase.from("events").select("id, name, event_date, dress_code, outfit_selection, outfit_ready_by, sort_order").eq("invite_id", inviteId).order("sort_order"),
      context.supabase.from("reservations").select("guest_id, guest_name, outfits(event_id)").eq("invite_id", inviteId),
      context.supabase.from("outfits").select("event_id, gender").eq("invite_id", inviteId).in("gender", ["boy", "girl"]),
      context.supabase.from("outfit_feeds").select("event_id, audience").eq("invite_id", inviteId).in("audience", ["boy", "girl"]),
    ]);
    for (const result of [members, access, events, reservations, outfits, feeds]) {
      if (result.error) throw result.error;
    }
    const recipient = guest.email || (members.data ?? []).find((m) => m.household === guest.household && m.email)?.email;
    if (!recipient) return { sent: false, reason: "no_email" };
    const kids = new Set([
      ...(outfits.data ?? []).map((o) => `${o.event_id}|${o.gender}`),
      ...(feeds.data ?? []).map((f) => `${f.event_id}|${f.audience}`),
    ]);
    const waiting = missingOutfitEvents(guest, members.data ?? [], events.data ?? [], access.data ?? [], reservations.data ?? [], kids);
    if (waiting.length === 0) return { sent: false, reason: "already_chosen" };

    const { escapeHtml, emailShell, sendGuestEmail } = await import("@/lib/email.server");
    const origin = PUBLIC_ORIGIN;
    const link = `${origin}/guest/outfits`;

    const rows = waiting
      .map(
        (e) => `<tr>
          <td style="padding:10px 0;border-bottom:1px solid #e4d3c6">
            <p style="margin:0;font-size:15px;color:#57302c">${escapeHtml(e.name)}</p>
            <p style="margin:3px 0 0;font-size:13px;color:#8a6a62">
              ${escapeHtml(prettyDate(e.event_date))}${e.dress_code ? ` · ${escapeHtml(e.dress_code)}` : ""}${
                e.outfit_ready_by
                  ? `<br/>Please choose by ${escapeHtml(prettyDate(e.outfit_ready_by))}`
                  : ""
              }
            </p>
          </td>
        </tr>`,
      )
      .join("");

    const html = emailShell(`
    <div style="padding:30px">
      <p style="letter-spacing:.18em;text-transform:uppercase;font-size:11px;color:#b08637;margin:0">A gentle nudge</p>
      <h1 style="font-size:26px;margin:12px 0 10px;color:#57302c">${escapeHtml(guest.guest_name)}, your look is still to be chosen</h1>
      <p style="color:#8a6a62;font-size:15px;line-height:1.6;margin:0 0 20px">
        We're holding pieces for you, and tailoring takes time — choosing soon means yours is ready
        without a rush. Here's what's still waiting on you:
      </p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 22px">${rows}</table>
      <p style="margin:0 0 18px">
        <a href="${link}" style="display:inline-block;background:#b08637;color:#fdfaf6;text-decoration:none;padding:13px 24px;border-radius:8px;font-size:15px">Choose your outfit</a>
      </p>
      <p style="color:#8a6a62;font-size:13px;line-height:1.6;margin:0">
        Once you've picked, pop your measurements in on the same page and we'll take it from there.
      </p>
    </div>`);

    return sendGuestEmail({
      inviteId: guest.invite_id,
      to: recipient,
      subject: `${guest.guest_name}, please choose your outfit`,
      html,
    });
  });
