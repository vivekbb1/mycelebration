import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { authLink } from "@/lib/public-url";

/** Host emails one family a reminder of what they still owe. */
export const sendMissingDetailsReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { inviteId: string; household: string; travel: boolean; passport: boolean; outfits: boolean; measurements?: boolean }) => {
      if (typeof d?.inviteId !== "string" || d.inviteId.length > 64) throw new Error("Invalid celebration");
      if (typeof d?.household !== "string" || !d.household || d.household.length > 200) throw new Error("Invalid family");
      return { inviteId: d.inviteId, household: d.household, travel: !!d.travel, passport: !!d.passport, outfits: !!d.outfits, measurements: !!d.measurements };
    },
  )
  .handler(async ({ data, context }) => {
    const { data: isHost } = await context.supabase.rpc("is_celebration_host", { _invite_id: data.inviteId });
    if (!isHost) return { sent: false, reason: "forbidden" };
    const items = [
      data.travel && "your travel dates and flights",
      data.passport && "passport details",
      data.outfits && "your outfit choices",
      data.measurements && "measurements for everyone with a chosen look",
    ].filter(Boolean) as string[];
    if (!items.length) return { sent: false, reason: "nothing_owed" };

    const [{ data: codes }, { data: inv }] = await Promise.all([
      context.supabase
        .from("invite_codes")
        .select("guest_name, email, code")
        .eq("invite_id", data.inviteId)
        .eq("household", data.household),
      context.supabase.from("invites").select("name, slug").eq("id", data.inviteId).maybeSingle(),
    ]);
    const recipients = (codes ?? []).filter((c) => c.email);
    if (!recipients.length) return { sent: false, reason: "no_email" };

    const { emailShell, escapeHtml, sendGuestEmail } = await import("@/lib/email.server");
    let sent = 0;
    for (const r of recipients.slice(0, 10)) {
      const link = authLink(r.code, inv?.slug);
      const html = emailShell(`
        <p>Dear ${escapeHtml(r.guest_name)},</p>
        <p>We're getting everything ready for ${escapeHtml(inv?.name ?? "our celebration")}. We still need:</p>
        <ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>
        <p style="margin:24px 0"><a href="${link}" style="background:#7a1f2b;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none">Add my details</a></p>
        <p style="color:#666;font-size:13px">If the button doesn't work, copy this link: ${link}</p>`);
      const res = await sendGuestEmail({
        to: r.email!,
        subject: `A few details still needed for ${inv?.name ?? "the celebration"}`,
        html,
        inviteId: data.inviteId,
      });
      if (res.sent) sent += 1;
    }
    return { sent: sent > 0, reason: sent ? undefined : "send_failed" };
  });
