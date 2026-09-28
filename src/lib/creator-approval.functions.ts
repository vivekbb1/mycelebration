import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PUBLIC_ORIGIN } from "@/lib/public-url";

/**
 * Platform operator approves someone to create their own celebration and
 * emails them a link to get started.
 */
export const approveCreator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { email: string }) => {
    const email = String(data?.email ?? "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) throw new Error("Invalid email");
    return { email };
  })
  .handler(async ({ data, context }) => {
    const { data: isOp } = await context.supabase.rpc("is_platform_admin");
    if (!isOp) return { ok: false, error: "Only the platform operator can approve" };
    const { data: res, error } = await context.supabase.rpc("approve_celebration_creator", { _email: data.email });
    const r = res as { ok?: boolean; error?: string; registered?: boolean } | null;
    if (error || !r?.ok) return { ok: false, error: error?.message ?? r?.error ?? "Couldn't approve" };

    const { emailShell, escapeHtml, sendGuestEmail } = await import("@/lib/email.server");
    const link = `${PUBLIC_ORIGIN}/host/celebration`;
    const html = emailShell(`
      <h1 style="font-size:22px;margin:0 0 12px">You're approved to set up your celebration</h1>
      <p>You can now create your own celebration on My Celebration: add your events, invite your families and choose looks together.</p>
      <p>${r.registered ? "Sign in with" : "Sign up with"} <strong>${escapeHtml(data.email)}</strong>, then open <strong>Celebration</strong> in the host area and follow the four setup steps.</p>
      <p style="margin:24px 0"><a href="${link}" style="background:#7a1f2b;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none">Set up my celebration</a></p>
      <p style="color:#666;font-size:13px">If the button doesn't work, copy this link: ${link}</p>`);
    const sent = await sendGuestEmail({ to: data.email, subject: "Your celebration is approved", html });
    if (sent.sent) {
      await context.supabase
        .from("celebration_creator_emails")
        .update({ notified_at: new Date().toISOString() })
        .eq("email", data.email);
    }
    return { ok: true, registered: !!r.registered, emailed: sent.sent, reason: sent.reason ?? null };
  });
